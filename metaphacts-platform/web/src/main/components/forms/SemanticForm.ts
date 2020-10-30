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
 * Copyright (C) 2015-2020, metaphacts GmbH
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
import { createElement, ReactNode, Component, createFactory } from 'react';
import * as D from 'react-dom-factories';
import * as Kefir from 'kefir';

import { Cancellation } from 'platform/api/async';

import { ErrorNotification } from 'platform/components/ui/notification';
import { Spinner } from 'platform/components/ui/spinner';

import { FieldDefinitionProp, FieldDependency, MultipleFieldConstraint } from './FieldDefinition';
import {
  FieldValue, EmptyValue, AtomicValue, CompositeValue, ErrorKind, DataState,
} from './FieldValues';

import { CompositeInput } from './inputs/CompositeInput';
import { SingleValueHandler } from './inputs/SingleValueInput';
import { FormErrors } from './static/FormErrors';

import './forms.scss';

export interface SemanticFormProps {
  fields?: ReadonlyArray<FieldDefinitionProp>;
  fieldConstraints?: ReadonlyArray<MultipleFieldConstraint>;
  fieldDependencies?: ReadonlyArray<FieldDependency>;
  model: EmptyValue | AtomicValue | CompositeValue;
  onChanged: (model: CompositeValue) => void;
  onUpdateState?: (dataState: DataState, loadedModel: CompositeValue | undefined) => void;
  newSubjectTemplate?: string;
  children?: ReactNode;
  debug?: boolean;
}

enum LoadingState {
  Loading, Completed,
}

/**
 * Component to view and edit semantic data represented by a collection of fields.
 * This component is an equivalent of HTML <form> element for display and modification
 * of data represented by {@link Rdf.Node}s.
 *
 * Usage and lifecycle:
 *
 *   1. Render form with inputs as children (either {@link SingleValueInput} or
 *      {@link MultipleValuesInput}, former automatically wrapped by {@link CardinalitySupport}).
 *
 *      Child inputs provided with field definition and current field state from model
 *      based on 'for' property of input component.
 *
 *   2. Props.onUpdated() is called on mount with initialized model derived from
 *      initially provided model by filtering unused field definitions and adding information
 *      about configuration errors (e.g. missing field definition for input).
 *
 *   3. Props.onChanged is called on model change:
 *      a. when initial value and value set of field is loaded
 *      b. when user changed field value using form's input
 *      c. when new value of edited field finished validation by Sparql query
 */
export class SemanticForm extends Component<SemanticFormProps, {}> {
  private readonly cancellation = new Cancellation();

  private handler: SingleValueHandler;

  private input: CompositeInput;
  private lastDataState: DataState | undefined;
  private loadingState = LoadingState.Loading;
  private pendingModel: FieldValue;

  constructor(props: SemanticFormProps, context: any) {
    super(props, context);
    this.pendingModel = this.props.model;
    this.handler = CompositeInput.makeHandler({
      definition: undefined,
      baseInputProps: {
        fields: this.props.fields || [],
        fieldConstraints: this.props.fieldConstraints,
        fieldDependencies: this.props.fieldDependencies,
        newSubjectTemplate: this.props.newSubjectTemplate,
        children: this.props.children,
      },
    });
  }

  componentWillReceiveProps(nextProps: SemanticFormProps) {
    if (nextProps.model !== this.props.model) {
      this.pendingModel = nextProps.model;
    }
  }

  componentWillUnmount() {
    this.cancellation.cancelAll();
  }

  private updateModel = (reducer: (previous: FieldValue) => FieldValue) => {
    this.pendingModel = reducer(this.pendingModel);
    if (!FieldValue.isComposite(this.pendingModel)) {
      throw new Error('CompositeValue.updateValue returned non-composite');
    }
    this.props.onChanged(this.pendingModel);
  }

  componentDidMount() {
    const dataState = this.input ? this.input.dataState() : DataState.Loading;
    if (dataState === DataState.Ready && FieldValue.isComposite(this.props.model)) {
      this.loadingState = LoadingState.Completed;
      if (this.props.onUpdateState) {
        this.props.onUpdateState(dataState, this.props.model);
      }
    }
    if (this.props.debug) {
      console.log(
        `[mount: ${LoadingState[this.loadingState]}] ${DataState[dataState]}`,
        asDebugJSObject(this.props.model)
      );
    }
  }

  componentDidUpdate(prevProps: SemanticFormProps) {
    const dataState = this.input ? this.input.dataState() : DataState.Loading;
    const modelOrDataStateChanged = !(
      this.props.model === prevProps.model &&
      this.lastDataState === dataState
    );
    this.lastDataState = dataState;

    if (modelOrDataStateChanged) {
      if (this.props.debug) {
        console.log(
          `[update: ${LoadingState[this.loadingState]}] ${DataState[dataState]}`,
          asDebugJSObject(this.props.model)
        );
      }

      let loadedModel: CompositeValue | undefined = undefined;
      switch (this.loadingState) {
        case LoadingState.Loading: {
          // transition from Loading to Ready
          if (dataState === DataState.Ready && FieldValue.isComposite(this.props.model)) {
            this.loadingState = LoadingState.Completed;
            if (this.props.debug) {
              console.log(`[update -> ${LoadingState[this.loadingState]}]`);
            }
            loadedModel = this.props.model;
          }
          break;
        }
      }

      if (this.props.onUpdateState) {
        this.props.onUpdateState(dataState, loadedModel);
      }
    }
  }

  private onCompositeMounted = (input: CompositeInput) => {
    this.input = input;
  }

  /**
   * Performs validation of model with form inputs.
   * This is useful when model is only partially validated or not validated at all,
   * e.g. loaded as initial state, restored from previous session, etc.
   */
  validate(model: CompositeValue): CompositeValue {
    const validated = this.handler.validate(model);
    if (!FieldValue.isComposite(validated)) {
      throw new Error(
        'Expected to return either composite or empty value from CompositeInput.validate');
    }
    return validated;
  }

  finalize(model: CompositeValue): Kefir.Property<CompositeValue> {
    return this.handler.finalize(model, FieldValue.empty)
      .flatMap(finalized => FieldValue.isComposite(finalized)
        ? Kefir.constant(finalized)
        : Kefir.constantError<any>(new Error('Expected CompositeValue as finalize result'))
      )
      .toProperty();
  }

  render() {
    if (FieldValue.isEmpty(this.props.model)) {
      return createElement(Spinner);
    }

    const hasConfigurationErrors = this.props.model.errors
      .some(e => e.kind === ErrorKind.Configuration);

    return D.div({className: 'semantic-form'},
      createElement(CompositeInput,
        {
          ref: this.onCompositeMounted,
          handler: this.handler,
          fields: this.props.fields || [],
          newSubjectTemplate: this.props.newSubjectTemplate,
          dataState: DataState.Ready,
          updateValue: this.updateModel,
          value: this.props.model,
          // in case of configuration errors show FormErrors component instead of form content
          children: hasConfigurationErrors
            ? createElement(ErrorNotification, {title: 'Errors in form configuration'},
                createElement(FormErrors, {model: this.props.model})
              )
            : this.props.children
        }
      ),
      (this.props.debug
        ? D.pre({}, JSON.stringify(asDebugJSObject(this.props.model), null, 2))
        : null)
    );
  }
}

function asDebugJSObject(value: FieldValue): object {
  switch (value.type) {
    case EmptyValue.type: return {type: EmptyValue.type};
    case AtomicValue.type: return {
      type: AtomicValue.type,
      value: value.value.toString(),
      label: value.label,
      errors: value.errors,
    };
    case CompositeValue.type: return {
      type: CompositeValue.type,
      subject: value.subject.toString(),
      discriminator: value.discriminator ? value.discriminator.toString() : undefined,
      fields: value.fields.map(state => ({
        values: state.values.map(asDebugJSObject),
        errors: state.errors,
      })).toObject(),
      errors: value.errors,
    };
  }
}

export default createFactory(SemanticForm);
