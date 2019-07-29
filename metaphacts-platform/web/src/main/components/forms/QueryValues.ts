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

import * as Kefir from 'kefir';
import * as SparqlJs from 'sparqljs';
import * as Immutable from 'immutable';

import { Rdf, XsdDataTypeValidation } from 'platform/api/rdf';
import { SparqlClient, SparqlUtil, SparqlTypeGuards } from 'platform/api/sparql';

import { getLabel } from 'platform/api/services/resource-label';

import { FieldDefinition } from './FieldDefinition';
import {
  FieldValue, SparqlBindingValue, FieldError, ErrorKind, AtomicValue, LabeledValue,
} from './FieldValues';

/**
 * @returns a promise of field validation result.
 */
export function validate(
  subject: Rdf.Iri,
  field: FieldDefinition,
  oldValue: FieldValue,
  newValue: FieldValue,
): Kefir.Stream<FieldValue> {
  if (!FieldValue.isAtomic(newValue) || Immutable.is(oldValue, newValue)) {
    return Kefir.later(0, newValue);
  }
  const queries = field.constraints.map(constraint =>
    SparqlUtil.parseQueryAsync(constraint.validatePattern)
    .flatMap<SparqlJs.AskQuery>(query =>
      (SparqlTypeGuards.isQuery(query) && query.queryType === 'ASK')
        ? Kefir.constant(query)
        : Kefir.constantError<any>(new Error('validatePattern is not an ASK query'))
    )
    .map(query => SparqlClient.setBindings(query,  {
      'subject': subject,
      'value': newValue.value,
    }))
    .flatMap<boolean>(query => SparqlClient.ask(query))
    .map(success => ({constraint, success, error: undefined}))
    .flatMapErrors(error => Kefir.constant(
      {constraint, success: false, error}))
  );
  // merge validation errors from FieldDefinition.constrains queries into FieldValue
  return Kefir.zip(queries).map(results => {
    const otherErrors = newValue.errors
      .filter(error => error.kind !== ErrorKind.Validation).toList();
    return AtomicValue.set(newValue, {
      errors: otherErrors.concat(results
        .filter(result => !result.success)
        .map<FieldError>(result => ({
          kind: ErrorKind.Validation,
          message: result.error
            ? `Failed to validate value: ${result.error}`
            : result.constraint.message,
        }))
      ),
    });
  });
}

export function queryValues(
  pattern: string, subject?: Rdf.Iri, options?: SparqlClient.SparqlOptions
): Kefir.Property<SparqlBindingValue[]> {
  if (!pattern) { return Kefir.constant([]); }
  return SparqlUtil.parseQueryAsync(pattern)
    .map(query => subject
      ? SparqlClient.setBindings(query, {'subject': subject})
      : query
    )
    .flatMap<SparqlClient.SparqlSelectResult>(query => SparqlClient.select(query, options))
    .map(result => result.results.bindings
      .map<SparqlBindingValue>(binding => ({
        value: binding.value,
        label: binding.label ? binding.label.value : undefined,
        binding: binding,
      }))
      .filter(v => v.value !== undefined)
      .map(v => SparqlBindingValue.set(v, {
        value: normalizeValueDatatype(v.value),
        binding: v.binding
      }))
      .map(restoreLabel)
    )
    .flatMap(values => values.length > 0 ? Kefir.zip(values) : Kefir.constant([]))
    .toProperty();
}

export function canRestoreLabel(value: LabeledValue): boolean {
  return (value.label === null || value.label === undefined)
    && value.value && value.value.isIri();
}

export function restoreLabel<T extends LabeledValue>(value: T): Kefir.Property<T> {
  if (canRestoreLabel(value)) {
    return getLabel(value.value as Rdf.Iri)
      .map(label => ({...value as any, label} as T));
  } else {
    return Kefir.constant(value);
  }
}

function normalizeValueDatatype(node: Rdf.Node): Rdf.Node {
  if (node instanceof Rdf.Literal &&
    !(node instanceof Rdf.LangLiteral)
  ) {
    return Rdf.literal(node.value, XsdDataTypeValidation.replaceDatatypeAliases(node.dataType));
  } else {
    return node;
  }
}
