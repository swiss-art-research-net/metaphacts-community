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
import * as _ from 'lodash';
import * as Immutable from 'immutable';
import * as Kefir from 'kefir';
import { Rdf } from 'platform/api/rdf';
import { xsd } from 'platform/api/rdf/vocabularies';
import { Cancellation } from 'platform/api/async';

export function makeUniqueColumnNameGenerator() {
  const usedNames = new Set<string>();
  return (baseName: string) => {
    let generatedName = baseName;
    let index = 1;
    while (usedNames.has(generatedName)) {
      generatedName = `__${baseName}-${index}`;
      index++;
    }
    usedNames.add(generatedName);
    return generatedName;
  };
}

export function isPrimitiveDatatype(data: any): boolean {
  return _.isString(data)
    || _.isBoolean(data)
    || _.isNumber(data)
    || _.isNull(data)
    || _.isUndefined(data);
}


/**
 * Creates table cell comparator which allows to sort table data based
 * on target column values. This comparator considers prefetched resource labels (if available)
 * and uses XSD datatype to automatically sort numerical columns.
 */
export function makeCellComparator(state: { getLabel(resource: Rdf.Iri): string }) {
  return (a: unknown, b: unknown): number => {
    if (isPrimitiveDatatype(a) && isPrimitiveDatatype(b)) {
      return (
        a < b ? -1 :
        a > b ? 1 :
        0
      );
    } else if (Rdf.looksLikeTerm(a) && Rdf.looksLikeTerm(b)) {
      return compareRdfNodes(a, b, state);
    } else {
      const aKind = getCellDataKind(a);
      const bKind = getCellDataKind(b);
      return (
        aKind < bKind ? -1 :
        aKind > bKind ? 1 :
        0
      );
    }
  };
}

function compareRdfNodes(
  a: Rdf.TermLike, b: Rdf.TermLike, state: { getLabel(resource: Rdf.Iri): string }
): number {
  // put triples after atomic terms
  const aKind = Rdf.isQuad(a) ? 1 : 0;
  const bKind = Rdf.isQuad(b) ? 1 : 0;
  if (aKind !== bKind) {
    return aKind - bKind;
  }

  if (Rdf.isLiteral(a) && Rdf.isLiteral(b)) {
    if (xsd.NUMERIC_TYPES.has(a.datatype) && xsd.NUMERIC_TYPES.has(b.datatype)) {
      const aNumeric = Number(a.value);
      const bNumeric = Number(b.value);
      if (!Number.isNaN(aNumeric) && !Number.isNaN(bNumeric)) {
        return (
          aNumeric < bNumeric ? -1 :
          aNumeric > bNumeric ? 1 :
          0
        );
      }
    }
  }

  if (Rdf.isQuad(a) && Rdf.isQuad(b)) {
    return (
      compareRdfNodes(a.subject, b.subject, state) ||
      compareRdfNodes(a.predicate, b.predicate, state) ||
      compareRdfNodes(a.object, b.object, state) ||
      compareRdfNodes(a.graph, b.graph, state)
    );
  }

  const aValue = Rdf.isIri(a) && state.getLabel(a) || a.value;
  const bValue = Rdf.isIri(b) && state.getLabel(b) || b.value;
  return aValue.localeCompare(bValue);
}


function getCellDataKind(data: unknown): number {
  return (
    isPrimitiveDatatype(data) ? 0 :
    Rdf.looksLikeTerm(data) ? 1 :
    /* other kind */ 2
  );
}

export function prepareCellMatchQuery(textQuery: string): RegExp {
  const regexpText = _.escapeRegExp(textQuery);
  return new RegExp(regexpText, 'i');
}

export function doesCellMatchText(
  item: unknown,
  query: RegExp,
  state: { getLabel(resource: Rdf.Iri): string }
): boolean {
  if (typeof item !== 'object') { return false; }
  for (const key in item) {
    if (!Object.hasOwnProperty.call(item, key)) { continue; }
    const value = (item as { [key: string]: unknown })[key];
    if (isPrimitiveDatatype(value)) {
      if (query.test(String(value))) {
        return true;
      }
    } else if (Rdf.looksLikeTerm(value)) {
      if (doesTermMatchText(value, query, state)) {
        return true;
      }
    }
  }
  return false;
}

function doesTermMatchText(
  term: Rdf.TermLike,
  query: RegExp,
  state: { getLabel(resource: Rdf.Iri): string }
): boolean {
  if (Rdf.isQuad(term)) {
    return (
      doesTermMatchText(term.subject, query, state) ||
      doesTermMatchText(term.predicate, query, state) ||
      doesTermMatchText(term.object, query, state) ||
      doesTermMatchText(term.graph, query, state)
    );
  } else {
    const label = Rdf.isIri(term) ? state.getLabel(term) : undefined;
    if (label && query.test(label)) {
      return true;
    }
    if (query.test(term.value)) {
      return true;
    }
    return false;
  }
}

export class KeyedBufferPool<K, V> {
  private activeCount = 0;
  private _targets: Immutable.Set<K>;
  private _result: Immutable.Map<K, V>;
  private _error: unknown;

  constructor(
    initialValue: Immutable.Map<K, V>,
    private cancellation: Cancellation,
    private onLoad: (keys: Immutable.Set<K>) => Kefir.Property<Immutable.Map<K, V>>,
    private onCompleted: () => void
  ) {
    this._targets = initialValue.keySeq().toSet();
    this._result = initialValue;
  }

  get targets() { return this._targets; }
  get result() { return this._result; }
  get error() { return this._error; }

  get loading() {
    return this.activeCount > 0;
  }

  load(keys: Immutable.Set<K>): void {
    if (keys.size === 0) {
      return;
    }
    this.activeCount++;
    this._targets = this._targets.merge(keys);
    this.cancellation.map(this.onLoad(keys)).observe({
      value: value => {
        this._result = this._result.merge(value);
      },
      error: error => {
        this._error = error;
      },
      end: () => {
        this.activeCount--;
        if (this.activeCount === 0 && !this.cancellation.aborted) {
          this.onCompleted();
        }
      }
    });
  }
}
