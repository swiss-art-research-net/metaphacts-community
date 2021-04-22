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
import * as Immutable from 'immutable';
import * as Kefir from 'kefir';

import { Component } from 'platform/api/components';
import { Rdf } from 'platform/api/rdf';

import { FieldDefinition } from '../FieldDefinition';
import { DependencyContext } from '../FieldDependencies';
import {
  FieldValue, EmptyValue, CompositeValue, DataState, FieldError, ErrorKind, InspectedInputTree,
} from '../FieldValues';

export interface MultipleValuesConfig {
  /**
   * Field definition ID to associate input with.
   */
  for?: string;
  defaultValue?: string | number | boolean;
  defaultValues?: ReadonlyArray<string>;
  /**
   * Determines whether field label and description should be displayed above the input.
   *
   * If explicitly set to `false` the header will not be rendered and other markup may
   * be used instead.
   *
   * Defaults to `false` in `<semantic-form-hidden-input>` otherwise `true`.
   */
  renderHeader?: boolean;
}

export interface MultipleValuesProps extends MultipleValuesConfig {
  handler?: MultipleValuesHandler;
  definition?: FieldDefinition;
  dataState?: DataState;
  values?: ReadonlyArray<FieldValue>;
  errors?: ReadonlyArray<FieldError>;
  updateValues?: (reducer: (previous: ValuesWithErrors) => ValuesWithErrors) => void;
  dependencyContext?: DependencyContext;
}

export interface MultipleValuesHandler {
  validate(values: ValuesWithErrors): ValuesWithErrors;
  discard?(values: ValuesWithErrors): void;
  beforeFinalize?(): void;
  finalize(
    values: ReadonlyArray<FieldValue>,
    owner: EmptyValue | CompositeValue
  ): Kefir.Property<ReadonlyArray<FieldValue>>;
}

export interface MultipleValuesHandlerProps<InputProps> {
  definition: FieldDefinition;
  baseInputProps: InputProps;
}

interface MultipleValuesInputStatic {
  makeHandler(props: MultipleValuesHandlerProps<any>): MultipleValuesHandler;
}

export type ValuesWithErrors = {
  values: ReadonlyArray<FieldValue>;
  errors: ReadonlyArray<FieldError>;
};

export abstract class MultipleValuesInput<P extends MultipleValuesProps, S>
  extends Component<P, S> {

  dataState(): DataState {
    return DataState.Ready;
  }

  inspect(): InspectedInputTree {
    return {
      self: this,
      dataState: DataState[this.dataState()] as keyof typeof DataState,
      handler: this.props.handler,
      children: {},
    };
  }

  static readonly defaultHandler: MultipleValuesHandler = {
    validate: values => values,
    finalize: (values, owner) => Kefir.constant(values),
  };

  static assertStatic(constructor: MultipleValuesInputStatic) { /* nothing */ }

  static getHandlerOrDefault(
    componentType: MultipleValuesInputStatic,
    handlerProps: MultipleValuesHandlerProps<any>
  ): MultipleValuesHandler {
    if (!(componentType && componentType.makeHandler)) {
      return MultipleValuesInput.defaultHandler;
    }
    return componentType.makeHandler(handlerProps);
  }
}

export class CardinalityCheckingHandler implements MultipleValuesHandler {
  private definition: FieldDefinition;

  constructor(props: MultipleValuesHandlerProps<MultipleValuesProps>) {
    this.definition = props.definition;
  }

  validate({values, errors}: ValuesWithErrors): ValuesWithErrors {
    const otherErrors = errors.filter(e => e.kind !== ErrorKind.Input);
    const cardinalityErrors = checkCardinalityAndDuplicates(values, this.definition);
    return {
      values: values,
      errors: otherErrors.concat(cardinalityErrors),
    };
  }

  finalize(
    values: ReadonlyArray<FieldValue>,
    owner: EmptyValue | CompositeValue
  ): Kefir.Property<ReadonlyArray<FieldValue>> {
    return MultipleValuesInput.defaultHandler.finalize(values, owner);
  }
}

export function checkCardinalityAndDuplicates(
  values: ReadonlyArray<FieldValue>, definition: FieldDefinition
): ReadonlyArray<FieldError> {
  const errors: FieldError[] = [];

  // filter empty values and duplicates, emit "duplicate value" errors
  const nonEmpty = values.reduce((set, v) => {
    if (FieldValue.isComposite(v) && CompositeValue.isPlaceholder(v.subject)) {
      // only happens on initial loading: optimistically assume that
      // composite subject IRIs will be different after subject generation
      return set.add(Rdf.bnode());
    }
    const rdfNode = FieldValue.asRdfNode(v);
    if (!rdfNode) {
      return set;
    } else if (set.has(rdfNode)) {
      errors.push({
        kind: ErrorKind.Input,
        message: FieldValue.isComposite(v)
          ? `The new subject identifier (IRI) is not unique: ${rdfNode.toString()}`
          : `Value "${rdfNode.value}" is appears more than once`,
      });
      return set;
    } else {
      return set.add(rdfNode);
    }
  }, Immutable.Set<Rdf.Node>());

  if (nonEmpty.size < definition.minOccurs) {
    errors.push({
      kind: ErrorKind.Input,
      message: `Required a minimum of ${definition.minOccurs} values`
        + ` but ${nonEmpty.size} provided`,
    });
  }
  if (nonEmpty.size > definition.maxOccurs) {
    errors.push({
      kind: ErrorKind.Input,
      message: `Required a maximum of ${definition.maxOccurs} values`
        + ` but ${nonEmpty.size} provided`,
    });
  }

  return errors;
}
