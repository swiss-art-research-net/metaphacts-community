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
import * as Kefir from 'kefir';

import { Component } from 'platform/api/components';
import { Rdf, vocabularies, XsdDataTypeValidation } from 'platform/api/rdf';

import { FieldDefinition } from '../FieldDefinition';
import { DependencyContext } from '../FieldDependencies';
import {
  FieldValue, AtomicValue, CompositeValue, LabeledValue, EmptyValue, DataState, ErrorKind,
} from '../FieldValues';

export interface SingleValueInputConfig {
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

export interface SingleValueInputProps extends SingleValueInputConfig {
  handler?: SingleValueHandler;
  definition?: FieldDefinition;
  dataState?: DataState;
  value?: FieldValue;
  updateValue?: (reducer: (value: FieldValue) => FieldValue) => void;
  dependencyContext?: DependencyContext;
}

export interface SingleValueHandler {
  validate(value: FieldValue): FieldValue;
  discard?(value: FieldValue): void;
  beforeFinalize?(): void;
  finalize(
    value: FieldValue,
    owner: EmptyValue | CompositeValue
  ): Kefir.Property<FieldValue>;
  finalizeSubject?(
    value: FieldValue,
    owner: EmptyValue | CompositeValue
  ): CompositeValue;
}

export interface SingleValueHandlerProps<InputProps> {
  definition: FieldDefinition | undefined;
  baseInputProps: InputProps;
}

interface SingleValueInputStatic {
  makeHandler(props: SingleValueHandlerProps<any>): SingleValueHandler;
}

export interface SingleValueInputGroup {
  inputGroupType: 'composite' | 'switch';
}

export abstract class SingleValueInput<P extends SingleValueInputProps, S> extends Component<P, S> {
  constructor(props: P, context: any) {
    super(props, context);
  }

  dataState(): DataState {
    return DataState.Ready;
  }

  protected canEdit() {
    const dataState = this.props.dataState;
    return dataState === DataState.Ready || dataState === DataState.Verifying;
  }

  static readonly defaultHandler: SingleValueHandler = {
    validate: value => value,
    finalize: (value, owner) => Kefir.constant(value),
  };

  static assertStatic(constructor: SingleValueInputStatic) { /* nothing */ }
  static assertInputGroup(constructor: SingleValueInputGroup) { /* nothing */ }

  static getHandlerOrDefault(
    componentType: Partial<SingleValueInputStatic>,
    handlerProps: SingleValueHandlerProps<any>
  ): SingleValueHandler {
    if (!(componentType && componentType.makeHandler)) {
      return SingleValueInput.defaultHandler;
    }
    return componentType.makeHandler(handlerProps);
  }
}

export interface AtomicValueInputProps extends SingleValueInputProps {
  value?: AtomicValue | EmptyValue;
}

export class AtomicValueInput<P extends AtomicValueInputProps, S> extends SingleValueInput<P, S> {
  constructor(props: P, context: any) {
    super(props, context);
  }

  protected setAndValidate(value: FieldValue) {
    this.props.updateValue(() => this.props.handler.validate(value));
  }

  static makeAtomicHandler(props: SingleValueHandlerProps<AtomicValueInputProps>) {
    return new AtomicValueHandler(props);
  }
}

export class AtomicValueHandler implements SingleValueHandler {
  private definition: FieldDefinition;

  constructor(props: SingleValueHandlerProps<AtomicValueInputProps>) {
    this.definition = props.definition;
  }

  validate(selected: EmptyValue): EmptyValue;
  validate(selected: FieldValue): AtomicValue;
  validate(selected: FieldValue): AtomicValue | EmptyValue {
    const atomic = AtomicValueHandler.assertAtomicOrEmpty(selected);
    if (FieldValue.isEmpty(atomic)) { return atomic; }
    const newValue = validateType(atomic, this.definition.xsdDatatype);
    return AtomicValue.set(newValue, {
      // preserve non-validation errors
      errors: atomic.errors
        .filter(error => error.kind !== ErrorKind.Input &&
          error.kind !== ErrorKind.Validation)
        .concat(FieldValue.getErrors(newValue)),
    });
  }

  static assertAtomicOrEmpty(value: FieldValue): AtomicValue | EmptyValue {
    if (FieldValue.isEmpty(value) || FieldValue.isAtomic(value)) {
      return value;
    } else {
      throw new Error('Expected atomic or empty value');
    }
  }

  finalize(value: FieldValue, owner: EmptyValue | CompositeValue) {
    return SingleValueInput.defaultHandler.finalize(value, owner);
  }
}

export function validateType(
  selected: LabeledValue, datatype: Rdf.Iri | undefined
): AtomicValue | EmptyValue {
  if (!selected.value) { return FieldValue.empty; }
  if (!datatype) { return FieldValue.fromLabeled(selected); }

  if (XsdDataTypeValidation.sameXsdDatatype(datatype, vocabularies.xsd.anyURI)) {
    if (Rdf.isLiteral(selected.value)) {
      const literal = selected.value as Rdf.Literal;
      return withInputError(selected,
        `Selected value is ${XsdDataTypeValidation.datatypeToString(literal.datatype)} ` +
        `where IRI expected`);
    } else {
      const validation: XsdDataTypeValidation.ValidationResult = XsdDataTypeValidation.validate(
        Rdf.literal(selected.value.value, vocabularies.xsd.anyURI)
      );
      if (validation.success) {
        return FieldValue.fromLabeled(selected);
      } else {
        return withInputError(selected, validation.message);
      }
    }
  } else {
    if (Rdf.isLiteral(selected.value)) {
      const literal = selected.value as Rdf.Literal;
      const coerced = coerceTo(datatype, literal);
      if (coerced) {
        const validation = XsdDataTypeValidation.validate(coerced);
        if (validation.success) {
          return FieldValue.fromLabeled({value: coerced, label: selected.label});
        } else {
          return withInputError(
            {value: coerced, label: selected.label}, validation.message);
        }
      } else {
        return withInputError(selected,
          `XSD datatype of selected value is ` +
          `${XsdDataTypeValidation.datatypeToString(literal.datatype)} where ` +
          `${XsdDataTypeValidation.datatypeToString(datatype)} expected`);
      }
    } else {
      return withInputError(selected,
        `Selected value is IRI where ${XsdDataTypeValidation.datatypeToString(datatype)} expected`);
    }
  }
}

function coerceTo(datatype: Rdf.Iri, value: Rdf.Literal): Rdf.Literal {
  if (XsdDataTypeValidation.sameXsdDatatype(datatype, value.datatype)) {
    return value;
  } else if (XsdDataTypeValidation.sameXsdDatatype(datatype, vocabularies.xsd._string)
    && XsdDataTypeValidation.sameXsdDatatype(value.datatype, vocabularies.rdf.langString)) {
    // rdf:langString is assignable to xsd:string as-is
    return value;
  } else if (XsdDataTypeValidation.sameXsdDatatype(datatype, vocabularies.rdf.langString)
    && XsdDataTypeValidation.sameXsdDatatype(value.datatype, vocabularies.xsd._string)) {
    // xsd:string is assignable to rdf:langString as-is
    return value;
  } else {
    return undefined;
  }
}

function withInputError(value: LabeledValue, error: string) {
  return FieldValue.fromLabeled(value, [{
    kind: ErrorKind.Input,
    message: error,
  }]);
}
