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
import * as Kefir from 'kefir';

import { Rdf, XsdDataTypeValidation } from 'platform/api/rdf';
import { xsd } from 'platform/api/rdf/vocabularies';
import { SparqlClient, SparqlUtil } from 'platform/api/sparql';

import { getLabel } from 'platform/api/services/resource-label';

import {
  FieldState, FieldValue, CompositeValue, SparqlBindingValue, LabeledValue,
} from './FieldValues';

export function tryMakeBindings(
  composite: CompositeValue,
  fieldBindingNames: { readonly [fieldId: string]: string }
): SparqlClient.Dictionary<Rdf.Node> | undefined {
  const bindings: SparqlClient.Dictionary<Rdf.Node> = {};
  for (const fieldId in fieldBindingNames) {
    if (!Object.prototype.hasOwnProperty.call(fieldBindingNames, fieldId)) { continue; }
    const fieldState = composite.fields.get(fieldId, FieldState.empty);
    const values = fieldState.values.filter(FieldValue.isAtomic);
    // require exactly one value per field
    if (values.length === 1) {
      const variableName = fieldBindingNames[fieldId];
      bindings[variableName] = values[0].value;
    } else {
      return undefined;
    }
  }
  return bindings;
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
        index: parseValueIndex(binding.index),
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
    && value.value && Rdf.isIri(value.value);
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
  if (Rdf.isLiteral(node) && !node.language) {
    return Rdf.literal(node.value, XsdDataTypeValidation.replaceDatatypeAliases(node.datatype));
  } else {
    return node;
  }
}

function parseValueIndex(term: Rdf.Node | undefined): number | undefined {
  if (!(term && Rdf.isLiteral(term))) { return undefined; }
  if (!XsdDataTypeValidation.sameXsdDatatype(term.datatype, xsd.integer)) {
    return undefined;
  }
  const index = Number(term.value);
  return Number.isInteger(index) ? index : undefined;
}
