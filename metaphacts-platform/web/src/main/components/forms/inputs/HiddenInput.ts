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
import * as Immutable from 'immutable';
import * as Kefir from 'kefir';

import { ErrorNotification } from 'platform/components/ui/notification';

import { FieldValue, FieldError, EmptyValue, CompositeValue, AtomicValue } from '../FieldValues';
import { createDefaultValue } from '../FormModel';
import { FieldDefinition } from '../FieldDefinition';
import {
  MultipleValuesInput,
  MultipleValuesProps,
  MultipleValuesHandler,
  ValuesWithErrors,
  MultipleValuesHandlerProps
} from './MultipleValuesInput';
import { ValidationMessages } from './Decorations';


export type Mode = 'replace' | 'append';

export type HiddenValue = string | number | boolean;

export interface HiddenInputProps extends MultipleValuesProps {
  /**
   * Value which user can push to the object dataset
   */
  appendValue?: HiddenValue;
  /**
   * Values which user can push to the object dataset
   */
  appendValues?: HiddenValue[];
  /**
   * Value which user can change to the object dataset
   */
  replaceValue?: HiddenValue;
  /**
   * Values which user can change to the object dataset
   */
  replaceValues?: HiddenValue[];
}

/**
 * Represents a hidden field, which will not be visible to the user and which
 * will be automatically saved as soon as the form is saved.
 *
 * @example
 * <semantic-form-hidden-input for='...' default-value='https://www.wikidata.org/wiki/Q2337004'>
 * </semantic-form-hidden-input>
 *
 * <semantic-form-hidden-input for='...' default-values='["Emmett Brown", "Marty McFly"]'>
 * </semantic-form-hidden-input>
 *
 * <semantic-form-hidden-input for='{field-id}'
 *     append-value='
 *     [[singleValueFromSelect "SELECT ?user WHERE {
 *       BIND(?__useruri__ as ?user) }" ]]'>
 * </semantic-form-hidden-input>
 *
 * <semantic-form-hidden-input for='{field-id}'
 *   replace-value='
 *   [[singleValueFromSelect "SELECT ?date WHERE {
 *       BIND(NOW() as ?date) }" ]]'>
 * </semantic-form-hidden-input>
 *
 */
export class HiddenInput extends MultipleValuesInput<HiddenInputProps, {}> {
  static defaultProps: Partial<HiddenInputProps> = {
    renderHeader: false,
  };

  render() {
    const configError = checkInputConfiguration(this.props);
    const errors: FieldError[] = [];
    for (const value of this.props.values) {
      for (const error of FieldValue.getErrors(value)) {
        errors.push(error);
      }
    }
    if (configError) {
      return createElement(ErrorNotification, {errorMessage: configError});
    }
    return createElement(ValidationMessages, {errors});
  }

  static makeHandler(props: MultipleValuesHandlerProps<HiddenInputProps>) {
    return new HiddenInputHandler(props.baseInputProps, props.definition);
  }
}

class HiddenInputHandler implements MultipleValuesHandler {
  private readonly appendValues: ReadonlyArray<AtomicValue>;
  private readonly replaceValues: ReadonlyArray<AtomicValue>;

  constructor(props: HiddenInputProps, definition: FieldDefinition) {
    const configError = checkInputConfiguration(props);
    if (configError) {
      return;
    }
    const appendValue = normalizeValue(props.appendValue);
    const appendValues = normalizeValues(props.appendValues);
    const replaceValue = normalizeValue(props.replaceValue);
    const replaceValues = normalizeValues(props.replaceValues);

    if (appendValue || appendValues) {
      this.appendValues = lookForValues(appendValue, appendValues, definition);
    } else if (replaceValue || replaceValues) {
      this.replaceValues = lookForValues(replaceValue, replaceValues, definition);
    }
  }

  private getOnlyNewValues(values: ReadonlyArray<FieldValue>): AtomicValue[] {
    if (!this.appendValues) {
      return;
    }
    return this.appendValues.filter(appendValue => {
      return !values.some(checkValue => {
        return FieldValue.isAtomic(checkValue) && checkValue.value.equals(appendValue.value);
      });
    });
  }

  validate(values: ValuesWithErrors) {
    return values;
  }

  finalize(
    values: ReadonlyArray<FieldValue>,
    owner: EmptyValue | CompositeValue
  ): Kefir.Property<ReadonlyArray<FieldValue>> {
    if (this.appendValues) {
      const newValues = this.getOnlyNewValues(values);
      return Kefir.constant(values.concat(newValues));
    } else if (this.replaceValues) {
      return Kefir.constant(this.replaceValues);
    }
    return Kefir.constant(values);
  }

}

function normalizeValues(values: (HiddenValue)[] | undefined): string[] | undefined {
  if (values === undefined) {
    return undefined;
  } else {
    return values.map(v => normalizeValue(v));
  }
}

function normalizeValue(value: HiddenValue | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  } else if (typeof value === 'string') {
    return value;
  } else {
    return `${value}`;
  }
}

function lookForValues(
  externalValue: string,
  externalValues: string[],
  definition: FieldDefinition
): AtomicValue[] {
  if ((externalValue || externalValues) && definition) {
    const values = externalValue ? [externalValue] : externalValues;
    const fieldValues = values.map(value => createDefaultValue(value, definition));
    return fieldValues ? fieldValues : undefined;
  }
}

function checkInputConfiguration(props: HiddenInputProps): string | undefined {
  const {replaceValue, replaceValues, appendValue, appendValues} = props;
  let count = 0;
  if (replaceValue) { count++; }
  if (replaceValues) { count++; }
  if (appendValue) { count++; }
  if (appendValues) { count++; }
  if (count > 1) {
    return `Too much attributes, must be only one from their attributes:\n` +
      `append-value / append-values / replace-value / replace-values`;
  }
  return undefined;
}

MultipleValuesInput.assertStatic(HiddenInput);

export default HiddenInput;
