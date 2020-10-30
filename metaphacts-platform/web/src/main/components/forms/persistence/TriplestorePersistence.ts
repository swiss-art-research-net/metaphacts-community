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
import * as Immutable from 'immutable';
import * as Kefir from 'kefir';

import { Rdf } from 'platform/api/rdf';
import { xsd } from 'platform/api/rdf/vocabularies';

import { FieldDefinition } from '../FieldDefinition';
import { FieldValue, CompositeValue, EmptyValue, FieldState } from '../FieldValues';

export interface TriplestorePersistence {
  persist(
    initialModel: CompositeValue | EmptyValue,
    currentModel: CompositeValue | EmptyValue
  ): Kefir.Property<void>;
}

export function isTriplestorePersistence(obj: any): obj is TriplestorePersistence {
  return obj && typeof obj === 'object' && typeof obj.persist === 'function';
}

export interface ModelDiffEntry {
  subject: Rdf.Iri;
  definition: FieldDefinition;
  deleted: ReadonlyArray<Rdf.Node>;
  inserted: ReadonlyArray<{ value: Rdf.Node; index?: Rdf.Literal }>;
}

export function computeModelDiff(
  base: CompositeValue | EmptyValue,
  changed: CompositeValue | EmptyValue
): ModelDiffEntry[] {
  const result: ModelDiffEntry[] = [];
  // replace placeholder models with an empty ones to correctly handle default values
  // (otherwise fields with default values would be considered unchanged)
  const namedBaseOrEmpty = isPlaceholderComposite(base) ? FieldValue.empty : base;
  const namedChangedOrEmpty = isPlaceholderComposite(changed) ? FieldValue.empty : changed;
  collectCompositeDiff(namedBaseOrEmpty, namedChangedOrEmpty, result);
  return result;
}

function isPlaceholderComposite(value: FieldValue): value is CompositeValue {
  return FieldValue.isComposite(value) && CompositeValue.isPlaceholder(value.subject);
}

function collectCompositeDiff(
  base: CompositeValue | EmptyValue,
  changed: CompositeValue | EmptyValue,
  result: ModelDiffEntry[]
) {
  if (FieldValue.isComposite(base)) {
    if (CompositeValue.isPlaceholder(base.subject)) {
      throw new Error('Cannot compute diff with placeholder base composite');
    }
    base.fields.forEach((state, fieldId) => {
      const definition = base.definitions.get(fieldId);
      const changedValues = getFieldValues(changed, fieldId);
      collectFieldDiff(base.subject, definition, state.values, changedValues, result);
    });
  }

  if (FieldValue.isComposite(changed)) {
    if (CompositeValue.isPlaceholder(changed.subject)) {
      throw new Error('Cannot compute diff with placeholder changed composite');
    }
    changed.fields.forEach((state, fieldId) => {
      if (FieldValue.isEmpty(base) || !base.fields.has(fieldId)) {
        const definition = changed.definitions.get(fieldId);
        collectFieldDiff(
          changed.subject, definition, FieldState.empty.values, state.values, result
        );
      }
    });
  }
}

function getFieldValues(
  composite: CompositeValue | EmptyValue,
  fieldId: string
): ReadonlyArray<FieldValue> {
  if (FieldValue.isEmpty(composite)) {
    return FieldState.empty.values;
  }
  const state = composite.fields.get(fieldId) || FieldState.empty;
  return state.values;
}

function collectFieldDiff(
  subject: Rdf.Iri,
  definition: FieldDefinition,
  base: ReadonlyArray<FieldValue>,
  changed: ReadonlyArray<FieldValue>,
  result: ModelDiffEntry[]
) {
  const baseSet = Immutable.OrderedSet(
    base.map(FieldValue.asRdfNode).filter(node => node !== undefined)
  );
  const changedSet = Immutable.OrderedSet(
    changed.map(FieldValue.asRdfNode).filter(node => node !== undefined)
  );

  let deleted: Array<Rdf.Node> = [];
  let inserted: Array<{ value: Rdf.Node; index?: Rdf.Literal }> = [];
  if (definition.orderedWith && !Immutable.is(baseSet, changedSet)) {
    deleted = baseSet.toArray();
    inserted = changedSet.toArray().map((value, index) => ({
      value,
      index: Rdf.literal(index.toString(), xsd.integer),
    }));
  } else {
    deleted = baseSet.subtract(changedSet).toArray();
    inserted = changedSet.subtract(baseSet).toArray().map(value => ({value}));
  }

  if (deleted.length > 0 || inserted.length > 0) {
    result.push({subject, definition, deleted, inserted});
  }

  const baseComposites = pickComposites(base);
  const changedComposites = pickComposites(changed);

  baseComposites.forEach((baseComposite, subjectKey) => {
    const changedComposite = changedComposites.get(subjectKey) || FieldValue.empty;
    collectCompositeDiff(baseComposite, changedComposite, result);
  });
  changedComposites.forEach((changedComposite, subjectKey) => {
    if (!baseComposites.has(subjectKey)) {
      collectCompositeDiff(FieldValue.empty, changedComposite, result);
    }
  });
}

function pickComposites(values: ReadonlyArray<FieldValue>): Map<string, CompositeValue> {
  const result = new Map<string, CompositeValue>();
  for (const value of values) {
    if (FieldValue.isComposite(value) && !CompositeValue.isPlaceholder(value.subject)) {
      result.set(value.subject.value, value);
    }
  }
  return result;
}
