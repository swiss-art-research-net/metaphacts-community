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
import { OrderedMap, Map } from 'immutable';

import { Rdf } from 'platform/api/rdf';
import { Resource } from '../Common';

export interface Category extends Resource {
  readonly thumbnail?: string
  readonly color?: string;
}
export type Categories = OrderedMap<Rdf.Iri, Category>;
export interface Relation extends Resource {
  readonly hasRange: Category
  readonly hasDomain: Category
  available?: boolean
  hashCode: () => number
  equals: (other: Relation) => boolean
}
export type Relations = OrderedMap<RelationKey.Key, Relation>;

export interface Profile extends Resource {
  readonly categories: Categories
  readonly relations: Relations
}
export type Profiles = Map<Rdf.Iri, Profile>;

export module RelationKey {
  export interface Value {
    iri: Rdf.Iri;
    domain: Rdf.Iri;
    range: Rdf.Iri;
  }

  export class Key {
    constructor(private _value: Value) {}

    get value() {
      return this._value;
    }

    public equals(other: Key) {
      return (
        this.value.iri.equals(other.value.iri) &&
        this.value.domain.equals(other.value.domain) &&
        this.value.range.equals(other.value.range)
      );
    }

    public hashCode() {
      let hash = 0;
      hash = 31 * hash + Rdf.hashTerm(this.value.iri);
      hash = 31 * hash + Rdf.hashTerm(this.value.domain);
      hash = 31 * hash + Rdf.hashTerm(this.value.range);
      return Rdf.smi(hash);
    }
  }

  export function key(value: Value) {
    return new Key(value);
  }
}

export type AvailableDomains = Map<Rdf.Iri, string>;
