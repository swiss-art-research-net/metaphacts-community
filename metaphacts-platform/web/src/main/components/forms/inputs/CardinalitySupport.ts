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
import { uniqueId } from 'lodash';
import * as Immutable from 'immutable';
import * as Kefir from 'kefir';

import {
  ReactNode,
  Children,
  createElement,
  cloneElement,
  ReactElement,
  ClassAttributes,
} from 'react';
import * as D from 'react-dom-factories';
import * as classnames from 'classnames';
import { Button } from 'react-bootstrap';

import {
  isValidChild, componentHasType, hasBaseDerivedRelationship, universalChildren,
} from 'platform/components/utils';

import { ReorderableList, Ordering } from 'platform/components/ui/reorderable-list';

import { FieldDefinition, getPreferredLabel } from '../FieldDefinition';
import {
  FieldState, FieldValue, EmptyValue, CompositeValue, DataState, ErrorKind, FieldError,
  mergeDataState,
} from '../FieldValues';

import {
  SingleValueInput, SingleValueInputProps, SingleValueHandler, SingleValueInputGroup,
} from './SingleValueInput';
import {
  MultipleValuesInput, MultipleValuesProps, MultipleValuesHandler, MultipleValuesHandlerProps,
  ValuesWithErrors, checkCardinalityAndDuplicates,
} from './MultipleValuesInput';

export interface CardinalitySupportProps extends MultipleValuesProps {
  children?: ReactNode;
}

const COMPONENT_NAME = 'cardinality-support';

type ChildInput = SingleValueInput<SingleValueInputProps, unknown>;

/**
 * Wraps {@link SingleValueInput} and exposes self as {@link MultipleValuesInput}
 * by duplicating input component for each field value.
 *
 * This component validates cardinality of field and produces corresponding errors
 * through {@link Props.onValuesChanged}.
 */
export class CardinalitySupport extends MultipleValuesInput<CardinalitySupportProps, {}> {
  /**
   * React element keys corresponding to field values, to prevent incorrect
   * virtual DOM merging when adding or deleting values.
   */
  private valueKeys: string[] = [];

  private readonly inputs = new Map<string, ChildInput[]>();
  private lastRenderedDataState: DataState | undefined;

  private getHandler(): CardinalitySupportHandler {
    const {handler} = this.props;
    if (!(handler instanceof CardinalitySupportHandler)) {
      throw new Error('Invalid value handler for CardinalitySupport');
    }
    return handler;
  }

  shouldComponentUpdate(nextProps: CardinalitySupportProps, nextState: {}) {
    if (this.state !== nextState) { return true; }
    const previous = this.props;
    return !(
      this.dataState() === this.lastRenderedDataState &&
      previous.renderHeader === nextProps.renderHeader &&
      previous.definition === nextProps.definition &&
      previous.dataState === nextProps.dataState &&
      previous.dependencyContext === nextProps.dependencyContext &&
      shallowEqualArrays(previous.values, nextProps.values) &&
      shallowEqualArrays(previous.errors, nextProps.errors)
    );
  }

  render(): ReactElement<any> {
    const definition = this.props.definition;
    if (definition.maxOccurs === 0) { return D.div({}); }

    const dataState = this.props.dataState;
    this.lastRenderedDataState = this.dataState();

    const size = this.props.values.length;
    const canEdit = dataState === DataState.Ready || dataState === DataState.Verifying;
    const canAddValue = canEdit && size < definition.maxOccurs;
    const canRemoveValue = canEdit && size > definition.minOccurs && size > 0;
    const fieldLabel = (getPreferredLabel(definition.label) || 'value').toLowerCase();
    const children = this.renderChildren(canRemoveValue);

    return D.div(
      {className: COMPONENT_NAME},
      definition.orderedWith
        ? createElement(ReorderableList, {
            ordering: Ordering.empty,
            onOrderChanged: this.onOrderChanged,
            dragByHandle: true,
            itemClass: `${COMPONENT_NAME}__reorderable-list-item`,
          }, children)
        : children,

      canAddValue ? (
        D.a({
          className: classnames({
            [`${COMPONENT_NAME}__add-value`]: true,
            [`${COMPONENT_NAME}__add-value--first`]: size === 0,
            [`${COMPONENT_NAME}__add-value--another`]: size > 0,
          }),
          onClick: this.addNewValue,
        }, `+ Add ${fieldLabel}`)
      ) : null
    );
  }

  private onOrderChanged = (order: Ordering) => {
    this.onValuesChanged(values => {
      this.valueKeys = order.apply(this.valueKeys);
      return order.apply(values);
    });
  }

  private renderChildren(canRemoveValue: boolean) {
    this.ensureValueKeys(this.props.values.length);

    const childIsInputGroup = isInputGroup(this.props.children);
    const className = childIsInputGroup
      ? `${COMPONENT_NAME}__group-instance`
      : `${COMPONENT_NAME}__single-instance`;

    return this.props.values.map((value, index) => D.div(
      {key: this.valueKeys[index], className},
      renderChildInputs(
        this.props,
        this.getHandler(),
        value,
        this.valueKeys[index],
        reducer => {
          this.onValuesChanged(values =>
            FieldState.setValueAtIndex(values, index, reducer(values[index]))
          );
        },
        (key, inputIndex, input) => {
          let refs = this.inputs.get(key);
          if (!refs) {
            refs = [];
            this.inputs.set(key, refs);
          }
          refs[inputIndex] = input;
        }
      ),
      canRemoveValue
        ? createElement(Button, {
            className: COMPONENT_NAME + '__remove-value',
            onClick: () => this.removeValue(index),
          }, D.span({className: 'fa fa-times'}))
        : undefined));
  }

  private ensureValueKeys(valueCount: number) {
    while (this.valueKeys.length < valueCount) {
      this.valueKeys.push(uniqueId());
    }
  }

  private addNewValue = () => {
    this.onValuesChanged(() => [...this.props.values, FieldValue.empty]);
  }

  private removeValue = (valueIndex: number) => {
    this.valueKeys.splice(valueIndex, 1);
    this.onValuesChanged(() => FieldState.deleteValueAtIndex(this.props.values, valueIndex));
  }

  private onValuesChanged(
    reducer: (previous: ReadonlyArray<FieldValue>) => ReadonlyArray<FieldValue>
  ) {
    const handler = this.getHandler();
    this.props.updateValues(previous => {
      const newValues = reducer(previous.values);
      const validated = handler.validate({values: newValues, errors: previous.errors}, false);
      return validated;
    });
  }

  dataState(): DataState {
    let result = DataState.Ready;
    for (const key of this.valueKeys) {
      const refs = this.inputs.get(key);
      if (!refs) {
        result = mergeDataState(result, DataState.Loading);
        continue;
      }
      for (const ref of refs) {
        if (ref) {
          result = mergeDataState(result, ref.dataState());
        }
      }
    }
    return result;
  }

  static makeHandler(
    props: MultipleValuesHandlerProps<CardinalitySupportProps>
  ): CardinalitySupportHandler {
    return new CardinalitySupportHandler(props);
  }
}

function shallowEqualArrays<T>(a: ReadonlyArray<T>, b: ReadonlyArray<T>): boolean {
  if (a === b) { return true; }
  if (a.length !== b.length) { return false; }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) { return false; }
  }
  return true;
}

function renderChildInputs(this: void,
  inputProps: CardinalitySupportProps,
  inputHandler: CardinalitySupportHandler,
  value: FieldValue,
  key: string,
  updateValue: (reducer: (value: FieldValue) => FieldValue) => void,
  onInputMount: (key: string, inputIndex: number, input: ChildInput | null) => void
) {
  let nextIndex = 0;
  function mapChildren(children: ReactNode): ReactNode {
    return universalChildren(Children.map(children, child => {
      if (isValidChild(child)) {
        const element = child as ReactElement<any>;
        if (hasBaseDerivedRelationship(SingleValueInput, element.type)) {
          const inputIndex = nextIndex;
          nextIndex++;

          if (inputIndex > inputHandler.handlers.length) {
            throw new Error(
              `Missing handler for cardinality field ${inputProps.for} at index ${inputIndex}`
            );
          }
          const handler = inputHandler.handlers[inputIndex];

          const props: SingleValueInputProps & ClassAttributes<ChildInput> = {
            for: inputProps.for,
            handler,
            definition: inputProps.definition,
            dataState: inputProps.dataState,
            dependencyContext: inputProps.dependencyContext,
            value: value,
            updateValue,
            ref: input => onInputMount(key, inputIndex, input),
          };
          return cloneElement(element, props);
        } else if (element.props.children) {
          return cloneElement(element, {}, mapChildren(element.props.children));
        }
      }
      return child;
    }));
  }
  return mapChildren(inputProps.children);
}

class CardinalitySupportHandler implements MultipleValuesHandler {
  readonly definition: FieldDefinition;
  readonly handlers: ReadonlyArray<SingleValueHandler>;

  constructor(props: MultipleValuesHandlerProps<CardinalitySupportProps>) {
    this.definition = props.definition;
    this.handlers = findInputs(props.baseInputProps.children).map(input => {
      return SingleValueInput.getHandlerOrDefault(input.type as any, {
        definition: this.definition,
        baseInputProps: input.props,
      });
    });
  }

  /**
   * Performs cardinality validation of field and
   * validates its values with wrapped {@link SingleValueInput}.
   */
  validate(
    {values, errors}: ValuesWithErrors,
    validateByChildInput = true
  ) {
    const otherErrors = errors.filter(e => e.kind !== ErrorKind.Input);
    const cardinalityErrors = this.validateCardinality(values);
    return {
      values: validateByChildInput
        ? values.map(this.validateThoughChildInputs)
        : values,
      errors: otherErrors.concat(cardinalityErrors),
    };
  }

  private validateThoughChildInputs = (value: FieldValue) => {
    if (FieldValue.isEmpty(value)) { return value; }
    const cleanValue = FieldValue.setErrors(value, FieldError.noErrors);
    // combine errors from every child input
    let validated: FieldValue = cleanValue;
    for (const handler of this.handlers) {
      validated = handler.validate(validated);
    }
    return validated;
  }

  private validateCardinality(values: ReadonlyArray<FieldValue>): ReadonlyArray<FieldError> {
    let preparedValues = values;
    for (const handler of this.handlers) {
      if (handler.finalizeSubject) {
        preparedValues = values.map(v => {
          // finalize subject to distinguish composites
          return FieldValue.isComposite(v) ? handler.finalizeSubject(v, FieldValue.empty) : v;
        });
      }
    }
    return checkCardinalityAndDuplicates(preparedValues, this.definition);
  }

  finalize(
    values: ReadonlyArray<FieldValue>,
    owner: EmptyValue | CompositeValue
  ): Kefir.Property<ReadonlyArray<FieldValue>> {
    let finalizing = Kefir.constant(values);
    for (const handler of this.handlers) {
      finalizing = finalizing.flatMap(intermediates => {
        const tasks = intermediates.map(value => handler.finalize(value, owner));
        if (tasks.length > 0) {
          return Kefir.zip(tasks).toProperty();
        } else {
          return Kefir.constant(FieldState.empty.values);
        }
      }).toProperty();
    }
    return finalizing;
  }
}

function findInputs(inputChildren: ReactNode): ReactElement<SingleValueInputProps>[] {
  const foundInputs: ReactElement<SingleValueInputProps>[] = [];

  function collectInputs(children: ReactNode) {
    Children.forEach(children, child => {
      if (isValidChild(child)) {
        const element = child as ReactElement<any>;
        if (hasBaseDerivedRelationship(SingleValueInput, element.type)) {
          foundInputs.push(element);
        } else if (element.props.children) {
          collectInputs(element.props.children);
        }
      }
    });
  }

  collectInputs(inputChildren);
  return foundInputs;
}

function isInputGroup(children: ReactNode) {
  const childCount = Children.count(children);
  if (childCount !== 1) {
    return childCount > 1;
  }
  const child = Children.toArray(children)[0];
  if (!isValidChild(child)) {
    return true;
  }
  const {inputGroupType} = child.type as Partial<SingleValueInputGroup>;
  return inputGroupType === 'composite'
    || inputGroupType === 'switch'
    || !componentHasType(child, SingleValueInput as any);
}

MultipleValuesInput.assertStatic(CardinalitySupport);

export default CardinalitySupport;
