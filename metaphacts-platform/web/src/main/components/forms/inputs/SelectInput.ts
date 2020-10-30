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
import { createElement } from 'react';
import * as D from 'react-dom-factories';
import ReactSelect, {
  OnChangeHandler, OptionRendererHandler, ValueRendererHandler
} from 'react-select';
import * as Immutable from 'immutable';

import { Cancellation } from 'platform/api/async/Cancellation';
import { Rdf } from 'platform/api/rdf';

import { TemplateItem } from 'platform/components/ui/template';

import { FieldDefinition, getPreferredLabel } from '../FieldDefinition';
import {
  FieldValue, AtomicValue, EmptyValue, SparqlBindingValue, ErrorKind, DataState,
} from '../FieldValues';
import { SingleValueInput, AtomicValueInput, AtomicValueInputProps } from './SingleValueInput';
import { ValidationMessages } from './Decorations';
import { queryValues } from '../QueryValues';

export interface SelectInputProps extends AtomicValueInputProps {
  template?: string;
  placeholder?: string;
}

interface State {
  valueSet?: Immutable.List<SparqlBindingValue>;
}

const SELECT_TEXT_CLASS = 'select-text-field';
const OPTION_CLASS = SELECT_TEXT_CLASS + 'option';

export class SelectInput extends AtomicValueInput<SelectInputProps, State> {
  private fetchingValueSet = Cancellation.cancelled;

  private isLoading = true;

  constructor(props: SelectInputProps, context: any) {
    super(props, context);
    this.state = {
      valueSet: Immutable.List<SparqlBindingValue>(),
    };
  }

  dataState(): DataState {
    if (this.isLoading) {
      return DataState.Loading;
    }
    return DataState.Ready;
  }

  componentDidMount() {
    this.fetchValueSet(this.props);
  }

  componentWillReceiveProps(nextProps: SelectInputProps) {
    if (nextProps.dependencyContext !== this.props.dependencyContext) {
      this.fetchValueSet(nextProps);
    }
  }

  componentWillUnmount() {
    this.fetchingValueSet.cancelAll();
  }

  private fetchValueSet(props: SelectInputProps) {
    this.isLoading = false;
    this.fetchingValueSet.cancelAll();

    const valueSetPattern = getValueSetPattern(props);
    if (valueSetPattern) {
      this.isLoading = true;
      this.fetchingValueSet = new Cancellation();
      this.fetchingValueSet.map(
        queryValues(valueSetPattern)
      ).observe({
        value: valueSet => {
          this.isLoading = false;
          this.setState({valueSet: Immutable.List(valueSet)});
          this.props.updateValue(v => v);
        },
        error: error => {
          console.error(error);
          this.isLoading = false;
          this.props.updateValue(appendValueSetLoadingError);
        }
      });
    }
  }

  private onValueChanged = (value?: SparqlBindingValue) => {
    this.setAndValidate(this.parseValue(value));
  }

  private parseValue(value: SparqlBindingValue): AtomicValue | EmptyValue {
    // this is for testing purpose only i.e. checking whether callback is called
    if (!value) { return FieldValue.empty; }

    const findCorresponding = this.state.valueSet
      .find(v => v.value.equals(value.value));
    if (!findCorresponding) { return FieldValue.empty; }

    // turn into field value for standard validation calls
    const corresponding: Partial<AtomicValue> = {
      value: findCorresponding.value,
      label: findCorresponding.label,
    };
    return AtomicValue.set(this.props.value, corresponding);
  }

  private optionRenderer = (option: SparqlBindingValue) => {
    if (this.props.template !== undefined) {
      return createElement(TemplateItem, {
        template: {
          source: this.props.template,
          options: option.binding,
        },
      });
    } else {
      // default option template
      return D.span(
        {id: option.label, className: OPTION_CLASS}, option.label || option.value.value
      );
    }
  }

  private valueRenderer = (v: AtomicValue | undefined) => {
    // that is if user adds a new input which get's empty as initial field value
    if (!v) { return; }

    let valueSet = this.state.valueSet;
    if (valueSet) {
      // try to find the selected value in the pre-computed valueSet
      const bindingValue = valueSet.find(setValue => setValue.value.equals(v.value));
      // if existing, then use optionRenderer to exploit the template and additional bindings
      if (bindingValue) {
        return this.optionRenderer(bindingValue);
      }
    }

    // fallback rendering i.e. if recovering from state or saved value
    // but value is not any longer in dynamically (on every initialization) computed set
    return D.span(
      {id: v.label, className: OPTION_CLASS}, v.label || v.value.value
    );
  }

  render() {
    const definition = this.props.definition;
    const options = this.state.valueSet
      ? this.state.valueSet.toArray()
      : new Array<SparqlBindingValue>();

    const inputValue = this.props.value;
    const selectedValue = FieldValue.isAtomic(inputValue) ? inputValue : undefined;

    const placeholder = typeof this.props.placeholder === 'undefined'
      ? this.createDefaultPlaceholder(definition) : this.props.placeholder;

    return D.div(
      {className: SELECT_TEXT_CLASS},

      createElement(ReactSelect, {
        name: definition.id,
        placeholder: placeholder,
        onChange: this.onValueChanged as OnChangeHandler<any>,
        disabled: !this.canEdit,
        options: options,
        value: selectedValue,
        optionRenderer: this.optionRenderer as OptionRendererHandler<any>,
        valueRenderer: this.valueRenderer as ValueRendererHandler<any>,
      }),

      createElement(ValidationMessages, {errors: FieldValue.getErrors(this.props.value)})
    );
  }

  private createDefaultPlaceholder(definition: FieldDefinition): string {
    const fieldName = (getPreferredLabel(definition.label) || 'entity').toLocaleLowerCase();
    return `Select ${fieldName} here...`;
  }

  static makeHandler = AtomicValueInput.makeAtomicHandler;
}

function getValueSetPattern(props: SelectInputProps) {
  const {definition, dependencyContext} = props;
  if (dependencyContext) {
    return dependencyContext.valueSetPattern;
  } else {
    return definition.valueSetPattern;
  }
}

function appendValueSetLoadingError(v: FieldValue): FieldValue {
  const nonEmpty = FieldValue.isEmpty(v)
    ? FieldValue.fromLabeled({value: Rdf.iri('')}) : v;
  const errors = [...FieldValue.getErrors(nonEmpty), {
    kind: ErrorKind.Loading,
    message: `Failed to load value set`,
  }];
  return FieldValue.setErrors(nonEmpty, errors);
}

SingleValueInput.assertStatic(SelectInput);

export default SelectInput;
