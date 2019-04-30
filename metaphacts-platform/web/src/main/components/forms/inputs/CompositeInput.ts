/*
 * Copyright (C) 2015-2019, metaphacts GmbH
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, you can receive a copy
 * of the GNU Lesser General Public License from http://www.gnu.org/
 */

import { createElement, Props, ReactNode } from 'react';
import * as D from 'react-dom-factories';
import * as Immutable from 'immutable';
import * as Kefir from 'kefir';

import { Cancellation } from 'platform/api/async';
import { Rdf } from 'platform/api/rdf';

import { Spinner } from 'platform/components/ui/spinner';

import { FieldDefinitionProp, FieldDefinition, normalizeFieldDefinition } from '../FieldDefinition';
import {
  FieldValue, EmptyValue, CompositeValue, FieldError, FieldState, DataState,
} from '../FieldValues';
import { validateFieldConfiguration, renderFields } from '../FieldMapping';
import {
  fieldInitialState, generateSubjectByTemplate, loadDefaults, tryBeginValidation,
} from '../FormModel';

import { SingleValueInput, SingleValueInputProps } from './SingleValueInput';
import { MultipleValuesInput, MultipleValuesProps, ValuesWithErrors } from './MultipleValuesInput';

export interface CompositeInputProps extends SingleValueInputProps {
  fields: ReadonlyArray<FieldDefinitionProp>;
  newSubjectTemplate?: string;
  children?: ReactNode;
}

type ComponentProps = CompositeInputProps & Props<CompositeInput>;

interface InputState {
  readonly dataState: DataState.Ready | DataState.Verifying;
  readonly validation: Cancellation;
}
const READY_INPUT_STATE: InputState = {
  dataState: DataState.Ready,
  validation: Cancellation.cancelled,
};

const VALIDATION_DEBOUNCE_DELAY = 500;

export class CompositeInput extends SingleValueInput<ComponentProps, {}> {
  private readonly cancellation = new Cancellation();
  private compositeOperations = this.cancellation.derive();

  private shouldReload = true;
  private compositeState: DataState.Loading | DataState.Ready = DataState.Ready;
  private inputs: { [fieldId: string]: MultipleValuesInput<MultipleValuesProps, any> } = {};
  private inputStates = new Map<string, InputState>();

  constructor(props: ComponentProps, context: any) {
    super(props, context);
  }

  componentDidMount() {
    this.tryLoadComposite(this.props);
  }

  componentWillReceiveProps(props: ComponentProps) {
    if (props.value !== this.props.value) {
      // track reload requests separately to be able to suspend
      // composite load until `props.dataState` becomes `DataState.Ready`
      this.shouldReload = true;
    }
    this.tryLoadComposite(props);
  }

  componentWillUnmount() {
    this.cancellation.cancelAll();
  }

  private tryLoadComposite(props: ComponentProps) {
    if (!(this.shouldReload && props.dataState === DataState.Ready)) {
      return;
    }
    const shouldLoad = !FieldValue.isComposite(props.value) || (
      // composite value requires to load definitions and defaults
      // (e.g. when value is restored from local storage)
      props.value.fields.size > 0 &&
      props.value.definitions.size === 0
    );
    if (shouldLoad) {
      this.shouldReload = false;
      this.loadComposite(props);
    }
  }

  private loadComposite(props: ComponentProps) {
    this.compositeOperations = this.cancellation.deriveAndCancel(this.compositeOperations);

    const allDefinitions = normalizeDefinitons(props.fields);
    const {inputs, errors} = validateFieldConfiguration(allDefinitions, props.children);

    // filter model from unused field definitions
    // (the ones without corresponding input)
    const filterUnusedFields = <T>(items: Immutable.Iterable<string, T>) =>
      items.filter((item, fieldId) => inputs.has(fieldId)).toMap();

    const definitions = filterUnusedFields(allDefinitions);
    const rawComposite = createRawComposite(props.value, definitions, errors);

    this.compositeState = DataState.Loading;
    this.inputStates.clear();

    props.updateValue(() => rawComposite);
    this.compositeOperations.map(
      // add zero delay to force asynchronous observer call
      loadDefaults(rawComposite, inputs)
        .flatMap(v => Kefir.later(0, v))
    ).observe({
      value: change => {
        let loaded = change(rawComposite);
        if (FieldValue.isComposite(props.value)) {
          loaded = mergeInitialValues(loaded, props.value);
        }
        this.compositeState = DataState.Ready;
        this.props.updateValue(() => loaded);
      },
    });
  }

  private onFieldValuesChanged = (
    def: FieldDefinition,
    reducer: (previous: ValuesWithErrors) => ValuesWithErrors,
  ) => {
    this.props.updateValue(previous => this.setFieldValue(def, previous, reducer));
  }

  private setFieldValue(
    def: FieldDefinition,
    oldValue: FieldValue,
    reducer: (previous: ValuesWithErrors) => ValuesWithErrors,
  ): FieldValue {
    if (!FieldValue.isComposite(oldValue)) { return; }

    const newValue = reduceFieldValue(def.id, oldValue, reducer);

    const input = this.inputs[def.id];
    const isInputLoading = !input || input.dataState() === DataState.Loading;
    if (isInputLoading) {
      this.inputStates.set(def.id, READY_INPUT_STATE);
    } else {
      this.startValidatingField(def, oldValue, newValue);
    }

    return newValue;
  }

  private startValidatingField(
    def: FieldDefinition, oldValue: CompositeValue, newValue: CompositeValue
  ) {
    let {dataState, validation} = this.inputStates.get(def.id) || READY_INPUT_STATE;
    // immediately apply user edits in an input component
    // then update model with validation info when it'll be available
    const modelChange = tryBeginValidation(def, oldValue, newValue);

    dataState = modelChange ? DataState.Verifying : DataState.Ready;
    validation = this.compositeOperations.deriveAndCancel(validation);

    this.inputStates.set(def.id, {dataState, validation});

    if (modelChange) {
      validation.map(
        Kefir.later(VALIDATION_DEBOUNCE_DELAY, {})
          .flatMap(() => modelChange)
      ).observe({
        value: change => {
          const current = this.props.value;
          if (!FieldValue.isComposite(current)) { return; }
          const validated = change(current);
          this.inputStates.set(def.id, READY_INPUT_STATE);
          this.props.updateValue(() => validated);
        },
      });
    }
  }

  dataState(): DataState {
    if (!FieldValue.isComposite(this.props.value)) {
      return DataState.Loading;
    } else if (this.compositeState !== DataState.Ready) {
      return this.compositeState;
    }
    const states = this.props.value.definitions.map(def => def.id)
      .map(fieldId => {
        const input = this.inputs[fieldId];
        if (!input) { return DataState.Loading; }
        const state = this.inputStates.get(fieldId) || READY_INPUT_STATE;
        return state.dataState === DataState.Ready
          ? this.inputs[fieldId].dataState()
          : state.dataState;
      });
    return (
      states.some(s => s === DataState.Loading) ? DataState.Loading :
      states.some(s => s === DataState.Verifying) ? DataState.Verifying :
      DataState.Ready
    );
  }

  private dataStateForField = (fieldId: string): DataState => {
    if (this.compositeState !== DataState.Ready) {
      return this.compositeState;
    }
    const state = this.inputStates.get(fieldId) || READY_INPUT_STATE;
    return state.dataState;
  }

  validate(selected: FieldValue): FieldValue {
    if (!FieldValue.isComposite(selected)) {
      return selected;
    }
    return CompositeValue.set(selected, {
      fields: selected.fields.map((state, fieldId) => {
        const input = this.inputs[fieldId];
        if (!input) { return state; }
        return FieldState.set(state, input.validate(state));
      }).toMap(),
    });
  }

  finalizeSubject(owner: EmptyValue | CompositeValue, value: FieldValue): CompositeValue {
    const sourceValue: CompositeValue = FieldValue.isComposite(value)
      ? value : createRawComposite(value);

    const ownerSubject = FieldValue.isComposite(owner) ? owner.subject : undefined;
    return CompositeValue.set(sourceValue, {
      subject: generateSubjectByTemplate(this.props.newSubjectTemplate, ownerSubject, sourceValue),
    });
  }

  finalize(owner: EmptyValue | CompositeValue, value: FieldValue): Kefir.Property<CompositeValue> {
    const finalizedComposite = this.finalizeSubject(owner, value);

    const fieldProps = finalizedComposite.fields.map((state, fieldId) => {
      const input = this.inputs[fieldId];
      const valuesStream = input
        ? input.finalize(finalizedComposite, state.values)
        : Kefir.constant(Immutable.List<FieldValue>());

      return valuesStream.map(values => {
        return FieldState.set(state, {values, errors: FieldError.noErrors});
      })
    }).toMap();

    const fields = zipImmutableMap(fieldProps);
    return fields.map(fields => {
      return CompositeValue.set(finalizedComposite, {fields});
    });
  }

  render() {
    const composite = this.props.value;
    if (!FieldValue.isComposite(composite)) {
      return createElement(Spinner);
    }

    const children = renderFields(
      this.props.children,
      composite,
      this.dataStateForField,
      this.onFieldValuesChanged,
      (inputId, input) => this.inputs[inputId] = input,
    );

    return D.div({className: 'composite-input'}, children);
  }
}

function normalizeDefinitons(rawFields: ReadonlyArray<FieldDefinitionProp>) {
  return Immutable.Map<string, FieldDefinition>().withMutations(result => {
    for (const raw of rawFields) {
      if (result.has(raw.id)) { continue; }
      const parsed = normalizeFieldDefinition(raw);
      result.set(parsed.id, parsed);
    }
  });
}

function zipImmutableMap<Type>(
  map: Immutable.Map<string, Kefir.Property<Type>>
): Kefir.Property<Immutable.Map<string, Type>> {
  const mapAsArray = map.map((kefirValue, key) => {
    return kefirValue.map(value => {
      return {key, value};
    });
  }).toArray();

  if(mapAsArray.length > 0) {
    return Kefir.zip(mapAsArray).map(values => {
      const newMap = {};
      values.forEach(({key, value}) => {
        newMap[key] = value;
      });
      return Immutable.Map<string, Type>(newMap);
    }).toProperty();
  } else {
    return Kefir.constant(Immutable.Map());
  }
}

function createRawComposite(
  sourceValue: FieldValue,
  definitions = Immutable.Map<string, FieldDefinition>(),
  errors = FieldError.noErrors,
): CompositeValue {
  return {
    type: CompositeValue.type,
    subject: getSubject(sourceValue),
    definitions,
    fields: definitions.map(fieldInitialState).toMap(),
    errors,
  };
}

function getSubject(value: FieldValue): Rdf.Iri {
  if (FieldValue.isComposite(value)) {
    return value.subject;
  } else if (FieldValue.isAtomic(value)) {
    const node = FieldValue.asRdfNode(value);
    if (node.isIri()) { return node; }
  }
  return Rdf.iri('');
}

function mergeInitialValues(base: CompositeValue, patch: CompositeValue): CompositeValue {
  if (patch.fields.size === 0) { return base; }
  return CompositeValue.set(base, {
    fields: base.fields.map((state, fieldId) => {
      return patch.fields.get(fieldId, state);
    }).toMap(),
  });
}

function reduceFieldValue(
  fieldId: string,
  previous: CompositeValue,
  reducer: (previous: ValuesWithErrors) => ValuesWithErrors,
) {
  const fieldState = previous.fields.get(fieldId, FieldState.empty);
  const updatedState = FieldState.set(fieldState, reducer({
    values: fieldState.values,
    errors: fieldState.errors,
  }));
  const fields = previous.fields.set(fieldId, updatedState);
  return CompositeValue.set(previous, {fields});
}

export default CompositeInput;
