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
import * as classnames from 'classnames';

import { Button } from 'react-bootstrap';

import { Cancellation } from 'platform/api/async';

import { FieldValue, SparqlBindingValue, ErrorKind, DataState } from '../FieldValues';
import {
  MultipleValuesInput, MultipleValuesConfig, MultipleValuesProps, MultipleValuesHandlerProps,
  CardinalityCheckingHandler, ValuesWithErrors,
} from './MultipleValuesInput';
import { queryValues } from '../QueryValues';

const CHECKLIST_CLASS = 'semantic-form-checklist-input';

/**
 * Form component to select one or several items from list.
 *
 * **Example**:
 *
 * Default with `type='checkbox'`:
 * ```
 * <semantic-form-checklist-input for='field-name'>
 * </semantic-form-checklist-input>
 * ```
 * Using `row=true` lay items in a row:
 * ```
 * <semantic-form-checklist-input for='field-name' row=true>
 * </semantic-form-checklist-input>
 * ```
 * It's also possible to choose between either `checkbox or `radio` type:
 * ```
 * <semantic-form-checklist-input for='field-name' type='checkbox'>
 * </semantic-form-checklist-input>
 *
 * <semantic-form-checklist-input for='field-name' type='radio'>
 * </semantic-form-checklist-input>
 * ```
 */
interface SemanticFormChecklistInputConfig extends MultipleValuesConfig {
  /**
   * Adds custom CSS class to checklist.
   */
  className?: string;

  /**
   * Adds custom CSS class to checklist item.
   */
  classItemName?: string;

  /**
   * Adds a button to clear all selected items.
   * 
   * @default false
   * 
   */
  clearable?: boolean;

  /**
   * Allow to transform items (checkboxes or radio-buttons) in a row.
   *
   * @default false
   */
  row?: boolean;

  /**
   * Allow to select one of two types `checkbox` and `radio`.
   *
   * @default "checkbox"
   */
  type?: ChecklistType;
}

export type ChecklistType = 'radio' | 'checkbox';

export interface ChecklistInputProps
  extends SemanticFormChecklistInputConfig, MultipleValuesProps {}

interface State {
  readonly valueSet?: ReadonlyArray<SparqlBindingValue>;
}

export class ChecklistInput extends MultipleValuesInput<ChecklistInputProps, State> {
  private fetchingValueSet = Cancellation.cancelled;
  private isLoading = true;

  constructor(props: ChecklistInputProps, context: any) {
    super(props, context);
    this.state = {
      valueSet: [],
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

  componentWillReceiveProps(nextProps: ChecklistInputProps) {
    if (nextProps.dependencyContext !== this.props.dependencyContext) {
      this.fetchValueSet(nextProps);
    }
  }

  componentWillUnmount() {
    this.fetchingValueSet.cancelAll();
  }

  private fetchValueSet(props: ChecklistInputProps) {
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
          this.setState({valueSet});
          this.props.updateValues(v => v);
        },
        error: error => {
          console.error(error);
          this.isLoading = false;
          this.props.updateValues(appendValueSetLoadingError);
        }
      });
    }
  }

  private onValueChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    const {updateValues, handler} = this.props;
    const {valueSet} = this.state;
    const checked = event.target.checked;
    updateValues(({values, errors}) => {
      let newValues: ReadonlyArray<SparqlBindingValue> = [];
      if (this.checkType() === 'checkbox') {
        // Look for previous values if they are existing.
        const previousValues = values.filter(value => {
          return FieldValue.isAtomic(value) && value.value.value !== event.target.value;
        });
        newValues = valueSet.filter(value => {
          const isEqualValues = value.value.value === event.target.value;
          // Current value compare with items from previous selection.
          const previouslyChecked = previousValues.some(v =>
            FieldValue.isAtomic(v) && v.value.equals(value.value)
          );
          return checked
            ? (previouslyChecked || isEqualValues)
            : (previouslyChecked && !isEqualValues);
        });
      }
      if (this.checkType() === 'radio') {
        newValues = valueSet.filter(value => {
          const isEqualValues = value.value.value === event.target.value;
          return checked && isEqualValues;
        });
      }
      const validated = handler.validate({
        values: newValues.map(value => FieldValue.fromLabeled(value)),
        errors: errors,
      });
      return validated;
    });
  }
  private clearList = () => {
    // Clear the current selection.
    const {updateValues, handler} = this.props;
    const {valueSet} = this.state;
    updateValues(({errors}) => {
      let newValues: ReadonlyArray<SparqlBindingValue> = [];
      if (this.checkType() === 'checkbox') {
        // Look for previous values if they are existing.
        newValues = valueSet.filter(() => {
          return false
        });
      }
      if (this.checkType() === 'radio') {
        newValues = valueSet.filter(() => {
          return false
        });
      }
      const validated = handler.validate({
        values: newValues.map(value => FieldValue.fromLabeled(value)),
        errors: errors,
      });
      return validated;
    });
  }

  private checkType() {
    const {type} = this.props;
    return (
      type === 'checkbox' ? 'checkbox' :
      type === 'radio' ? 'radio' :
      'checkbox'
    );
  }

  private clearable() {
    const {clearable, values} = this.props;
    if (clearable !== true) {
      return false;
    }
    return values.length > 0 && values[0].type != 'empty'
  }

  private renderCheckItem(value: SparqlBindingValue, checked: boolean, key: string) {
    const {classItemName} = this.props;
    const type = this.checkType();
    const labelClass = `${CHECKLIST_CLASS}__label`;
    const inputClass = `${CHECKLIST_CLASS}__input`;
    const textClass = type === 'radio' ?
      `${CHECKLIST_CLASS}__radio` :
      `${CHECKLIST_CLASS}__checkbox`;
    return <div key={key} className={classnames(`${CHECKLIST_CLASS}`, classItemName)}>
      <label className={labelClass}>
        {value.label}
        <input type={type}
          className={inputClass}
          onChange={this.onValueChanged}
          value={value.value.value}
          checked={checked} />
        <span className={textClass}></span>
      </label>
    </div>;
  }

  private renderChecklist(options: ReadonlyArray<SparqlBindingValue>) {
    const {values} = this.props;
    return options.map((option, index) => {
      const checked = values.some(v => {
        return FieldValue.isAtomic(v) && v.value.equals(option.value);
      });
      return this.renderCheckItem(option, checked, `${option.value.value}-${index}`);
    });
  }

  render() {
    const {row, className} = this.props;
    const options = this.state.valueSet
      ? this.state.valueSet
      : [];
    return (
      <div className={classnames(className, {[`${CHECKLIST_CLASS}_row`]: row})}>
        {this.renderChecklist(options)}
        {this.clearable() &&
          <Button size='sm' variant='secondary'
            onClick={this.clearList}>
            <span className='fa fa-trash' />
          </Button>
        }
      </div>
    );
  }

  static makeHandler(props: MultipleValuesHandlerProps<ChecklistInputProps>) {
    return new CardinalityCheckingHandler(props);
  }
}

function getValueSetPattern(props: ChecklistInputProps) {
  const {definition, dependencyContext} = props;
  if (dependencyContext) {
    return dependencyContext.valueSetPattern;
  } else {
    return definition.valueSetPattern;
  }
}

function appendValueSetLoadingError({values, errors}: ValuesWithErrors): ValuesWithErrors {
  const otherErrors = errors.filter(e => e.kind === ErrorKind.Loading);
  otherErrors.push({
    kind: ErrorKind.Loading,
    message: `Failed to load value set`,
  });
  return {values, errors: otherErrors};
}

MultipleValuesInput.assertStatic(ChecklistInput);

export default ChecklistInput;
