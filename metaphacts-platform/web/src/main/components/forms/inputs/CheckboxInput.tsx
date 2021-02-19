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
import * as Kefir from 'kefir';
import * as classnames from 'classnames';

import { Rdf } from 'platform/api/rdf';

import { FieldDefinition } from '../FieldDefinition';
import {
  FieldState, FieldValue, ErrorKind, EmptyValue, CompositeValue, FieldError,
} from '../FieldValues';
import {
  MultipleValuesInput, MultipleValuesConfig, MultipleValuesProps, MultipleValuesHandler,
  MultipleValuesHandlerProps, ValuesWithErrors
} from './MultipleValuesInput';

/**
 * Form input displayed as a single checkbox with binary status to exclusively handle
 * `xsd:boolean` values.
 *
 * If the checkbox is checked it will persist `"true"^^xsd:boolean` literal value,
 * otherwise `"false"^^xsd:boolean`.
 *
 * Missing or non-boolean value is represented as checkbox in "indeterminate" state.
 *
 * **Example**:
 * ```
 * <semantic-form-checkbox-input for='field-name'>
 * </semantic-form-checkbox-input>
 * ```
 */
interface SemanticFormCheckboxInputConfig extends MultipleValuesConfig {
  /**
   * Adds custom CSS class to checkbox.
   */
  className?: string;
}

export interface CheckboxInputProps
  extends SemanticFormCheckboxInputConfig, MultipleValuesProps {}

enum CheckboxState {
  Unchecked = 0,
  Checked,
  Indeterminate,
}

const TRUE_VALUE = Rdf.literal(true);
const FALSE_VALUE = Rdf.literal(false);

const CHECKBOX_CLASS = 'semantic-form-checkbox-input';

export class CheckboxInput extends MultipleValuesInput<CheckboxInputProps, {}> {
  constructor(props: CheckboxInputProps, context: any) {
    super(props, context);
  }

  private onValueChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.createNewValues(event.target.checked);
  }

  private createNewValues = (checked: boolean) => {
    const {updateValues, handler} = this.props;
    updateValues(({values, errors}) => {
      const newValue = FieldValue.fromLabeled({value: Rdf.literal(checked)});
      const validated = handler.validate({values: [newValue], errors});
      return validated;
    });
  }

  private renderCheckbox = (checkboxState: CheckboxState) => {
    const labelClass = `${CHECKBOX_CLASS}__label`;
    const inputClass = `${CHECKBOX_CLASS}__input`;
    const textClass = `${CHECKBOX_CLASS}__checkbox`;
    return <label className={labelClass}>
      <input type={'checkbox'}
        className={inputClass}
        onChange={this.onValueChanged}
        checked={checkboxState === CheckboxState.Checked}
        ref={input => {
          if (input) {
            input.indeterminate = checkboxState === CheckboxState.Indeterminate;
          }
        }}/>
      <span className={textClass}></span>
    </label>;
  }

  render() {
    const {className, values} = this.props;
    const checkboxState = getCheckboxState(values);
    return (
      <div className={classnames(className, {[CHECKBOX_CLASS]: true})}>
        {this.renderCheckbox(checkboxState)}
      </div>
    );
  }

  static makeHandler(props: MultipleValuesHandlerProps<CheckboxInputProps>) {
    return new CheckboxHandler(props);
  }
}

class CheckboxHandler implements MultipleValuesHandler {
  private definition: FieldDefinition;

  constructor(props: MultipleValuesHandlerProps<CheckboxInputProps>) {
    this.definition = props.definition;
  }

  validate({values, errors}: ValuesWithErrors) {
    const otherErrors = errors.filter(e => e.kind !== ErrorKind.Input);
    const checkboxErrors = this.validateCheckboxValues(values);
    return {
      values: values,
      errors: otherErrors.concat(checkboxErrors),
    };
  }

  private validateCheckboxValues(values: ReadonlyArray<FieldValue>): ReadonlyArray<FieldError> {
    const errors: FieldError[] = [];
    if (values.length > 1) {
      errors.push({
        kind: ErrorKind.Input,
        message: `Incorrect values count = ${values.length}; should be equal to 1`,
      });
    }
    const {minOccurs} = this.definition;
    if (minOccurs > 1) {
      errors.push({
        kind: ErrorKind.Input,
        message: `Incorrect cardinality (minOccurs = ${minOccurs}); should be equal to 0 or 1`,
      });
    }
    const value = FieldState.getFirst(values);
    if (value && FieldValue.isComposite(value)) {
      errors.push({
        kind: ErrorKind.Input,
        message: `Incorrect field value type = "${value.type}"; should be "atomic"`,
      });
    }
    if (value && FieldValue.isAtomic(value)) {
      if (!value.value.equals(TRUE_VALUE) && !value.value.equals(FALSE_VALUE)) {
        errors.push({
          kind: ErrorKind.Input,
          message: `Incorrect datatype; should be "xsd:boolean"`,
        });
      }
    }
    return errors;
  }

  finalize(
    values: ReadonlyArray<FieldValue>,
    owner: EmptyValue | CompositeValue
  ): Kefir.Property<ReadonlyArray<FieldValue>> {
    const defaultValues = createDefaultValue(values);
    if (defaultValues) {
      return Kefir.constant(defaultValues);
    }
    return Kefir.constant(values);
  }
}

function getCheckboxState(values: ReadonlyArray<FieldValue>): CheckboxState {
  if (values.length === 0) {
    return CheckboxState.Unchecked;
  } else if (values.length > 1) {
    return CheckboxState.Indeterminate;
  }

  const value = FieldState.getFirst(values);
  if (FieldValue.isAtomic(value)) {
    if (value.value.equals(TRUE_VALUE)) {
      return CheckboxState.Checked;
    } else if (value.value.equals(FALSE_VALUE)) {
      return CheckboxState.Unchecked;
    }
  } else if (FieldValue.isEmpty(value)) {
    return CheckboxState.Unchecked;
  }
  return CheckboxState.Indeterminate;
}

function createDefaultValue (
  values: ReadonlyArray<FieldValue>
): ReadonlyArray<FieldValue> | undefined {
  const isDefaultValue = values.length === 0 ||
    (values.length === 1 && FieldValue.isEmpty(FieldState.getFirst(values)));
  if (isDefaultValue) {
    const newValue = FieldValue.fromLabeled({value: Rdf.literal(false)});
    return [newValue];
  }
  return undefined;
}

MultipleValuesInput.assertStatic(CheckboxInput);

export default CheckboxInput;
