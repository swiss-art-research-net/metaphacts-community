/*
 * "Commons Clause" License Condition v1.0
 *
 * The Software is provided to you by the Licensor under the
 * License, as defined below, subject to the following condition.
 *
 * Without limiting other conditions in the License, the grant
 * of rights under the License will not include, and the
 * License does not grant to you, the right to Sell the Software.
 *
 * For purposes of the foregoing, "Sell" means practicing any
 * or all of the rights granted to you under the License to
 * provide to third parties, for a fee or other consideration
 * (including without limitation fees for hosting or
 * consulting/ support services related to the Software), a
 * product or service whose value derives, entirely or substantially,
 * from the functionality of the Software. Any
 * license notice or attribution required by the License must
 * also include this Commons Clause License Condition notice.
 *
 * License: LGPL 2.1 or later
 * Licensor: metaphacts GmbH
 *
 * Copyright (C) 2015-2021, metaphacts GmbH
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
import * as React from 'react';
import * as Immutable from 'immutable';
import * as Kefir from 'kefir';
import * as classnames from 'classnames';

import { Cancellation } from 'platform/api/async';
import { Rdf } from 'platform/api/rdf';

import { Spinner } from 'platform/components/ui/spinner';

import {
  FieldDefinition, FieldDefinitionConfig, FieldDefinitionProp, FieldDependency,
  MultipleFieldConstraint, FieldConstraint, normalizeFieldDefinition, hasBindingNameForField,
} from '../FieldDefinition';
import { DependencyContext, makeDependencyContext } from '../FieldDependencies';
import {
  FieldValue, EmptyValue, CompositeValue, FieldError, FieldState, DataState, InspectedInputTree,
  mergeDataState,
} from '../FieldValues';
import {
  FieldMappingContext, InputMapping, validateFieldConfiguration, renderFields,
} from '../FieldMapping';
import {
  CompositeChange, SubjectTemplateSettings, fieldInitialState, loadDefaults,
  generateSubjectByTemplate, wasSubjectGeneratedByTemplate,
} from '../FormModel';
import {
  ValidationResult, findChangedValues, clearConstraintErrors, tryValidateSingleField,
  tryValidateMultipleFields, clearSubjectErrors,
} from '../FormValidation';

import { CardinalitySupport } from './CardinalitySupport';
import {
  SingleValueInput, SingleValueInputConfig, SingleValueInputProps,
  SingleValueHandler, SingleValueHandlerProps,
} from './SingleValueInput';
import {
  MultipleValuesInput, MultipleValuesProps, MultipleValuesHandler, ValuesWithErrors,
} from './MultipleValuesInput';

interface BaseCompositeInputConfig extends SingleValueInputConfig {
  className?: string;
  fieldConstraints?: ReadonlyArray<MultipleFieldConstraint>;
  fieldDependencies?: ReadonlyArray<FieldDependency>;
  newSubjectTemplate?: string;
  newSubjectTemplateSettings?: SubjectTemplateSettings;
}

// TODO: move into base config
interface ExperimentalCompositeInputConfig {
  /**
   * **Experimental**: allows to edit form subject IRI using `<semantic-form-subject-input>`
   * component.
   *
   * @default false
   */
  defaultEditSubject?: boolean;
  /**
   * **Experimental**: automatically rewrites subject IRI using provided `new-subject-template`.
   * Has no effect if `default-edit-subject` is `false`.
   *
   * @default false
   */
  defaultSuggestSubject?: boolean;
}

interface SemanticFormCompositeInputConfig extends BaseCompositeInputConfig {
  fields: ReadonlyArray<FieldDefinitionConfig>;
  children?: {};
}

export interface CompositeInputProps
  extends BaseCompositeInputConfig, ExperimentalCompositeInputConfig, SingleValueInputProps {
  fields: ReadonlyArray<FieldDefinitionProp>;
  children?: React.ReactNode;
  /**
   * Asynchronously validates subject IRI with specified callback.
   */
  onValidateSubject?: (model: CompositeValue) => Kefir.Property<CompositeChange>;
}

interface ValidationState {
  /** Set of {fieldId} */
  readonly fields: ReadonlySet<string>;
  readonly cancellation: Cancellation;
}

const VALIDATION_DEBOUNCE_DELAY = 500;

type ChildInput = MultipleValuesInput<MultipleValuesProps, unknown>;

const MAPPING_CONTEXT: FieldMappingContext = {
  cardinalitySupport: CardinalitySupport,
};

export class CompositeInput extends SingleValueInput<CompositeInputProps, {}> {
  private compositeLoading = Cancellation.cancelled;
  private isCompositeLoading = false;

  private subjectValidating = Cancellation.cancelled;
  private isSubjectValidating = false;

  private onValueChangeLoader = new OnValueChangeLoader();
  private inputRefs = new Map<string, Array<ChildInput | null>>();
  private validations = new Map<FieldConstraint, ValidationState>();
  private dependencyContexts = new Map<string, DependencyContext | undefined>();

  constructor(props: CompositeInputProps, context: any) {
    super(props, context);
  }

  private getHandler(): CompositeHandler {
    const {handler} = this.props;
    if (!(handler instanceof CompositeHandler)) {
      throw new Error('Invalid value handler for CompositeInput');
    }
    return handler;
  }

  componentDidMount() {
    this.tryLoadComposite(this.props);
  }

  componentWillReceiveProps(props: CompositeInputProps) {
    if (props.value !== this.props.value) {
      // track reload requests separately to be able to suspend
      // composite load until `props.dataState` becomes `DataState.Ready`
      this.onValueChangeLoader.markChanged();
    }
    this.tryLoadComposite(props);
  }

  componentWillUnmount() {
    this.cancelCompositeOperations();
  }

  private tryLoadComposite(props: CompositeInputProps) {
    if (this.onValueChangeLoader.shouldLoadInState(props.dataState)) {
      const shouldLoad = !FieldValue.isComposite(props.value) || (
        // composite value requires to load definitions and defaults
        // (e.g. when value is restored from local storage)
        props.value.fields.size > 0 &&
        props.value.definitions.size === 0
      );
      if (shouldLoad) {
        this.onValueChangeLoader.markLoaded();
        this.loadComposite(props);
      }
    }
  }

  private loadComposite(props: CompositeInputProps) {
    this.cancelCompositeOperations();
    this.compositeLoading = new Cancellation();
    const handler = this.getHandler();

    // filter model from unused field definitions
    // (the ones without corresponding input)
    const filterUnusedFields = <T>(items: Immutable.Iterable<string, T>) =>
      items.filter((item, fieldId) => handler.inputs.has(fieldId)).toMap();

    const definitions = filterUnusedFields(handler.definitions);
    let rawComposite = createRawComposite(
      props.value,
      definitions,
      handler.constraints,
      handler.configurationErrors
    );
    if (props.defaultEditSubject) {
      const subject = generateSubjectByTemplate(
        props.newSubjectTemplate,
        undefined,
        rawComposite,
        props.newSubjectTemplateSettings
      );
      rawComposite = CompositeValue.set(rawComposite, {
        subject,
        editableSubject: true,
        suggestSubject: Boolean(props.defaultSuggestSubject),
      });
    }

    this.isCompositeLoading = true;

    props.updateValue(() => rawComposite);
    this.compositeLoading.map(
      // add zero delay to force asynchronous observer call
      loadDefaults(rawComposite, handler.inputs)
        .flatMap(v => Kefir.later(0, v))
    ).observe({
      value: change => {
        let loaded = change(rawComposite);
        if (FieldValue.isComposite(props.value)) {
          loaded = mergeInitialValues(loaded, props.value);
        }
        this.isCompositeLoading = false;
        this.props.updateValue(() => loaded);
      },
    });
  }

  private cancelCompositeOperations() {
    this.compositeLoading.cancelAll();
    this.isCompositeLoading = false;
    this.subjectValidating.cancelAll();
    this.isSubjectValidating = false;
    this.validations.forEach(state => {
      state.cancellation.cancelAll();
    });
    this.validations.clear();
  }

  private onFieldValuesChanged = (
    def: FieldDefinition,
    reducer: (previous: ValuesWithErrors) => ValuesWithErrors
  ) => {
    this.props.updateValue(previous => this.setFieldValue(def, previous, reducer));
  }

  private setFieldValue(
    def: FieldDefinition,
    oldValue: FieldValue,
    reducer: (previous: ValuesWithErrors) => ValuesWithErrors
  ): FieldValue {
    if (!FieldValue.isComposite(oldValue)) { return; }

    let newValue = reduceFieldValue(def.id, oldValue, reducer);
    newValue = clearConstraintErrors(newValue, def.id);
    newValue = setSuggestedSubject(
      newValue,
      this.props.newSubjectTemplate,
      this.props.newSubjectTemplateSettings
    );

    if (newValue.subject.value !== oldValue.subject.value) {
      if (this.tryStartValidatingSubject(newValue)) {
        newValue = clearSubjectErrors(newValue);
      }
    }

    this.cancelFieldValidation(def.id);
    if (!this.isInputLoading(def.id)) {
      this.startValidatingField(def, oldValue, newValue);
    }

    // immediately apply user edits in an input component
    // then update model with validation info when it'll be available
    return newValue;
  }

  private isInputLoading(fieldId: string): boolean {
    const refs = this.inputRefs.get(fieldId);
    if (!refs) {
      return true;
    }
    for (const ref of refs) {
      if (!ref || ref.dataState() === DataState.Loading) {
        return true;
      }
    }
    return false;
  }

  private cancelFieldValidation(fieldId: string) {
    this.validations.forEach((state, constraint) => {
      if (state.fields.has(fieldId)) {
        state.cancellation.cancelAll();
        this.validations.delete(constraint);
      }
    });
  }

  private tryStartValidatingSubject(model: CompositeValue): boolean {
    const {onValidateSubject} = this.props;
    if (!onValidateSubject) {
      return false;
    }

    this.subjectValidating.cancelAll();
    const cancellation = new Cancellation();
    this.subjectValidating = cancellation;
    this.isSubjectValidating = true;

    cancellation.map(
      Kefir.later(VALIDATION_DEBOUNCE_DELAY, model)
        .flatMap(onValidateSubject)
    ).observe({
      value: compositeChange => {
        this.isSubjectValidating = false;
        this.props.updateValue(value =>
          FieldValue.isComposite(value) ? compositeChange(value) : value
        );
      }
    });

    return true;
  }

  private startValidatingField(
    def: FieldDefinition, oldValue: CompositeValue, newValue: CompositeValue
  ) {
    const changedValues = findChangedValues(def.id, oldValue, newValue);
    if (changedValues.length === 0) {
      return;
    }

    const cancellation = new Cancellation();
    const changes: Array<Kefir.Stream<ValidationResult>> = [];

    for (const constraint of def.constraints) {
      const change = tryValidateSingleField(constraint, newValue, def.id, changedValues);
      if (change) {
        const fields = new Set<string>([def.id]);
        this.validations.set(constraint, {cancellation, fields});
        changes.push(change);
      }
    }

    for (const constraint of newValue.constraints) {
      if (!hasBindingNameForField(constraint.fields, def.id)) { continue; }
      const change = tryValidateMultipleFields(constraint, newValue);
      if (change) {
        const fields = new Set<string>(Object.keys(constraint.fields));
        this.validations.set(constraint, {cancellation, fields});
        changes.push(change);
      }
    }

    if (changes.length > 0) {
      cancellation.map(
        Kefir.later(VALIDATION_DEBOUNCE_DELAY, {})
          .flatMap(() => Kefir.merge(changes))
      ).observe({
        value: change => {
          const current = this.props.value;
          if (!FieldValue.isComposite(current)) { return; }
          const validated = change.applyChange(current);
          this.validations.delete(change.constraint);
          this.props.updateValue(() => validated);
        }
      });
    }
  }

  private updateDependencyContexts(composite: CompositeValue) {
    for (const dependency of this.getHandler().dependencies) {
      const previous = this.dependencyContexts.get(dependency.field);
      const dependencyContext = makeDependencyContext(dependency, composite, previous);
      this.dependencyContexts.set(dependency.field, dependencyContext);
    }
    return this.dependencyContexts;
  }

  dataState(): DataState {
    if (!FieldValue.isComposite(this.props.value)) {
      return DataState.Loading;
    } else if (this.isCompositeLoading) {
      return DataState.Loading;
    } else if (this.isSubjectValidating) {
      return DataState.Verifying;
    }

    let result = DataState.Ready;

    const validatingFields = computeValidatingFields(this.validations);
    const fieldIds = this.getHandler().inputs.keySeq().toArray();
    for (const fieldId of fieldIds) {
      const refs = this.inputRefs.get(fieldId);
      if (!refs) {
        result = mergeDataState(result, DataState.Loading);
        continue;
      }

      const validatingState = validatingFields.has(fieldId)
        ? DataState.Verifying : DataState.Ready;
      result = mergeDataState(result, validatingState);

      if (validatingState === DataState.Ready) {
        for (const ref of refs) {
          if (ref) {
            result = mergeDataState(result, ref.dataState());
          }
        }
      }
    }

    return result;
  }

  inspect(): InspectedInputTree {
    const inspectedFields: { [fieldId: string]: InspectedInputTree[] } = {};
    const fieldIds = this.getHandler().inputs.keySeq().toArray();
    for (const fieldId of fieldIds) {
      const inspectedChildren: InspectedInputTree[] = [];
      const refs = this.inputRefs.get(fieldId);
      if (refs) {
        for (const ref of refs) {
          inspectedChildren.push(ref.inspect());
        }
      }
      inspectedFields[fieldId] = inspectedChildren;
    }
    return {...super.inspect(), children: inspectedFields};
  }

  render() {
    const composite = this.props.value;
    if (!FieldValue.isComposite(composite)) {
      return React.createElement(Spinner);
    }

    const handler = this.getHandler();
    const validatingFields = computeValidatingFields(this.validations);
    const dataStateForField = (fieldId: string): DataState => {
      if (this.isCompositeLoading) {
        return DataState.Loading;
      }
      return validatingFields.has(fieldId) ? DataState.Verifying : DataState.Ready;
    };
    const dependencyContexts = this.updateDependencyContexts(composite);
    const children = renderFields(this.props.children, composite, {
      inputHandlers: handler.handlers,
      getDataState: dataStateForField,
      updateField: this.onFieldValuesChanged,
      onInputMounted: this.onMountInput,
      dependencyContexts,
      mappingContext: MAPPING_CONTEXT,
      setSuggestSubject: this.setSuggestSubject,
      updateSubject: this.updateSubject,
    });

    const className = classnames('composite-input', this.props.className);
    return React.createElement('div', {className}, children);
  }

  private onMountInput = (
    inputId: string,
    inputIndex: number,
    inputRef: MultipleValuesInput<MultipleValuesProps, any> | null
  ) => {
    let refs = this.inputRefs.get(inputId);
    if (!refs) {
      refs = [];
      this.inputRefs.set(inputId, refs);
    }
    refs[inputIndex] = inputRef;
  }

  private setSuggestSubject = (suggest: boolean) => {
    this.props.updateValue(model => {
      if (!(FieldValue.isComposite(model))) { return model; }
      if (model.editableSubject) {
        if (suggest) {
          const subject = generateSubjectByTemplate(
            this.props.newSubjectTemplate,
            undefined,
            {...model, subject: Rdf.iri('')},
            this.props.newSubjectTemplateSettings
          );
          let newModel = CompositeValue.set(model, {subject, suggestSubject: true});
          if (this.tryStartValidatingSubject(newModel)) {
            newModel = clearSubjectErrors(newModel);
          }
          return newModel;
        }
      }
      return CompositeValue.set(model, {suggestSubject: suggest});
    });
  }

  private updateSubject = (newSubject: Rdf.Iri) => {
    this.props.updateValue(model => {
      if (!(FieldValue.isComposite(model) && model.editableSubject)) { return model; }
      let newModel = CompositeValue.set(model, {
        subject: newSubject,
        suggestSubject: false,
      });
      if (this.tryStartValidatingSubject(newModel)) {
        newModel = clearSubjectErrors(newModel);
      }
      return newModel;
    });
  }

  static get inputGroupType(): 'composite' {
    return 'composite';
  }

  static makeHandler(props: SingleValueHandlerProps<CompositeInputProps>): CompositeHandler {
    return new CompositeHandler(props);
  }
}

class CompositeHandler implements SingleValueHandler {
  readonly newSubjectTemplate: string | undefined;
  readonly newSubjectTemplateSettings: SubjectTemplateSettings | undefined;

  readonly definitions: Immutable.Map<string, FieldDefinition>;
  readonly constraints: ReadonlyArray<MultipleFieldConstraint>;
  readonly dependencies: ReadonlyArray<FieldDependency>;

  readonly inputs: Immutable.Map<string, ReadonlyArray<InputMapping>>;
  readonly configurationErrors: ReadonlyArray<FieldError>;
  readonly handlers: Immutable.Map<string, ReadonlyArray<MultipleValuesHandler>>;

  constructor({baseInputProps}: SingleValueHandlerProps<CompositeInputProps>) {
    this.newSubjectTemplate = baseInputProps.newSubjectTemplate;
    this.newSubjectTemplateSettings = baseInputProps.newSubjectTemplateSettings;
    this.definitions = normalizeDefinitions(baseInputProps.fields);
    this.constraints = baseInputProps.fieldConstraints || [];
    this.dependencies = baseInputProps.fieldDependencies || [];
    const {inputs, errors} = validateFieldConfiguration(
      this.definitions,
      this.constraints,
      this.dependencies,
      baseInputProps.children,
      MAPPING_CONTEXT
    );
    this.inputs = inputs;
    this.configurationErrors = errors;
    this.handlers = inputs.map(mappings =>
      mappings.map(mapping =>
        MultipleValuesInput.getHandlerOrDefault(mapping.inputType as any, {
          definition: this.definitions.get(mapping.for),
          baseInputProps: mapping.element.props
        })
      )
    ).toMap();
  }

  validate(value: FieldValue) {
    if (!FieldValue.isComposite(value)) {
      return value;
    }
    return CompositeValue.set(value, {
      fields: value.fields.map((state, fieldId) => {
        const handlers = this.handlers.get(fieldId);
        if (!handlers || handlers.length === 0) {
          return state;
        }
        let validated = state;
        for (const handler of handlers) {
          validated = handler.validate(validated);
        }
        return FieldState.set(state, validated);
      }).toMap(),
    });
  }

  discard(value: FieldValue): void {
    if (!FieldValue.isComposite(value)) { return; }
    value.fields.forEach((state, fieldId) => {
      const handlers = this.handlers.get(fieldId);
      if (!handlers) { return; }
      for (const handler of handlers) {
        handler.discard?.(state);
      }
    });
  }

  beforeFinalize(): void {
    this.handlers.forEach(handlers => {
      for (const handler of handlers) {
        handler.beforeFinalize?.();
      }
    });
  }

  finalize(value: FieldValue, owner: EmptyValue | CompositeValue): Kefir.Property<CompositeValue> {
    const finalizedComposite = this.finalizeSubject(value, owner);

    const fieldProps = finalizedComposite.fields.map((state, fieldId) => {
      const handlers = this.handlers.get(fieldId);
      if (!handlers || handlers.length === 0) {
        return Kefir.constant(state);
      }
      let finalizing = Kefir.constant(state.values);
      for (const handler of handlers) {
        finalizing = finalizing.flatMap(v => handler.finalize(v, finalizedComposite)).toProperty();
      }
      return finalizing.map(values => {
        return FieldState.set(state, {values, errors: FieldError.noErrors});
      });
    }).toMap();

    return zipImmutableMap(fieldProps).map(fields => {
      return CompositeValue.set(finalizedComposite, {fields});
    });
  }

  finalizeSubject(value: FieldValue, owner: EmptyValue | CompositeValue): CompositeValue {
    const sourceValue: CompositeValue = FieldValue.isComposite(value)
      ? value : createRawComposite(value);

    const ownerSubject = FieldValue.isComposite(owner) ? owner.subject : undefined;
    return CompositeValue.set(sourceValue, {
      subject: generateSubjectByTemplate(
        this.newSubjectTemplate,
        ownerSubject,
        sourceValue,
        this.newSubjectTemplateSettings
      ),
    });
  }
}

export class OnValueChangeLoader {
  private shouldReload = true;

  markChanged() {
    this.shouldReload = true;
  }

  markLoaded() {
    this.shouldReload = false;
  }

  shouldLoadInState(dataState: DataState): boolean {
    return this.shouldReload && dataState === DataState.Ready;
  }
}

function normalizeDefinitions(rawFields: ReadonlyArray<FieldDefinitionProp>) {
  return Immutable.Map<string, FieldDefinition>().withMutations(result => {
    for (const raw of rawFields) {
      if (result.has(raw.id)) { continue; }
      const parsed = normalizeFieldDefinition(raw);
      result.set(parsed.id, parsed);
    }
  });
}

function zipImmutableMap<K, V>(
  map: Immutable.Map<K, Kefir.Property<V>>
): Kefir.Property<Immutable.Map<K, V>> {
  const mapAsArray = map.map((kefirValue, key) => {
    return kefirValue.map(value => ({key, value}));
  }).toArray();

  if (mapAsArray.length > 0) {
    return Kefir.zip(mapAsArray).map(values =>
      Immutable.Map<K, V>().withMutations(newMap => {
        for (const {key, value} of values) {
          newMap.set(key, value);
        }
      })
    ).toProperty();
  } else {
    return Kefir.constant(Immutable.Map());
  }
}

function createRawComposite(
  sourceValue: FieldValue,
  definitions = Immutable.Map<string, FieldDefinition>(),
  constraints: ReadonlyArray<MultipleFieldConstraint> = [],
  errors = FieldError.noErrors
): CompositeValue {
  return CompositeValue.set(CompositeValue.empty, {
    subject: getSubject(sourceValue),
    definitions,
    constraints,
    fields: definitions.map(fieldInitialState).toMap(),
    errors,
  });
}

function getSubject(value: FieldValue): Rdf.Iri {
  if (FieldValue.isComposite(value)) {
    return value.subject;
  } else if (FieldValue.isAtomic(value)) {
    const node = FieldValue.asRdfNode(value);
    if (Rdf.isIri(node)) { return node; }
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
  reducer: (previous: ValuesWithErrors) => ValuesWithErrors
) {
  const fieldState = previous.fields.get(fieldId, FieldState.empty);
  const updatedState = FieldState.set(fieldState, reducer({
    values: fieldState.values,
    errors: fieldState.errors,
  }));
  const fields = previous.fields.set(fieldId, updatedState);
  return CompositeValue.set(previous, {fields});
}

/**
 * @returns set of {fieldId}
 */
function computeValidatingFields(validations: ReadonlyMap<FieldConstraint, ValidationState>) {
  const validatingFields = new Set<string>();
  validations.forEach(state => {
    state.fields.forEach(fieldId => validatingFields.add(fieldId));
  });
  return validatingFields;
}

function setSuggestedSubject(
  model: CompositeValue,
  newSubjectTemplate: string | undefined,
  newSubjectTemplateSettings: SubjectTemplateSettings | undefined
): CompositeValue {
  if (!(model.editableSubject && model.suggestSubject)) {
    return model;
  }
  if (doesSubjectEqualToSuggested(model, newSubjectTemplate, newSubjectTemplateSettings)) {
    return model;
  }
  const subject = generateSubjectByTemplate(
    newSubjectTemplate,
    undefined,
    {...model, subject: Rdf.iri('')},
    newSubjectTemplateSettings
  );
  if (Rdf.equalTerms(model.subject, subject)) {
    return model;
  }
  return CompositeValue.set(model, {subject});
}

function doesSubjectEqualToSuggested(
  model: CompositeValue,
  newSubjectTemplate: string | undefined,
  newSubjectTemplateSettings: SubjectTemplateSettings | undefined
): boolean {
  if (CompositeValue.isPlaceholder(model.subject)) {
    return true;
  }
  return wasSubjectGeneratedByTemplate(
    model.subject.value,
    newSubjectTemplate,
    newSubjectTemplateSettings,
    undefined,
    {...model, subject: Rdf.iri('')}
  );
}

SingleValueInput.assertStatic(CompositeInput);
SingleValueInput.assertInputGroup(CompositeInput);

export default CompositeInput;
