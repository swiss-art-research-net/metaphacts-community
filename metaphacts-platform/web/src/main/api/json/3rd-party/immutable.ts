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
import { serializerFor, deserializerFor } from '../JsonCore';

/**
 * Serializers and deserializers for Immutable.js.
 */
export function registerSerializersAndDeserializers() {

  // for Immutable.OrderedSet
  serializerFor({
    name: 'Immutable.Set',
    predicate: function(obj) {
      return obj instanceof Immutable.Set;
    },
    serializer: function(obj: any) {
      return obj.toArray();
    },
  });
  deserializerFor({
    name: 'Immutable.Set',
    deserializer: function(object: any) {
      return Immutable.Set(
        (<any>Immutable).Seq.Indexed(object)
      );
    },
  });

  // for Immutable.OrderedSet
  serializerFor({
    name: 'Immutable.OrderedSet',
    predicate: function(obj) {
      return obj instanceof Immutable.OrderedSet;
    },
    serializer: function(obj: any) {
      return obj.toArray();
    },
  });
  deserializerFor({
    name: 'Immutable.OrderedSet',
    deserializer: function(object: any) {
      return Immutable.OrderedSet(
        (<any>Immutable).Seq.Indexed(object)
      );
    },
  });

  // for Immutable.List
  serializerFor({
    name: 'Immutable.List',
    predicate: function(obj) {
      return obj instanceof Immutable.List;
    },
    serializer: function(obj: any) {
      return obj.toArray();
    },
  });
  deserializerFor({
    name: 'Immutable.List',
    deserializer: function(object: any) {
      return Immutable.List(
        (<any>Immutable).Seq.Indexed(object)
      );
    },
  });

  // for Immutable.OrderedMap
  serializerFor({
    name: 'Immutable.OrderedMap',
    predicate: function(obj) {
      return obj instanceof Immutable.OrderedMap;
    },
    serializer: function(obj: any) {
      return obj.toObject();
    },
  });
  deserializerFor({
    name: 'Immutable.OrderedMap',
    deserializer: function(object: any) {
      return Immutable.OrderedMap(
        (<any>Immutable).Seq.Keyed(object)
      );
    },
  });

  // for Immutable.Map
  serializerFor({
    name: 'Immutable.Map',
    predicate: function(obj) {
      return obj instanceof Immutable.Map;
    },
    serializer: function(obj: any) {
      return obj.toObject();
    },
  });
  deserializerFor({
    name: 'Immutable.Map',
    deserializer: function(object: any) {
      return Immutable.Map(
        (<any>Immutable).Seq.Keyed(object)
      );
    },
  });
}

export function recordSerializer<T>(
  name: string, constructorFn: Immutable.Record.Factory<T>
) {
  serializerFor<T>({
    name: name,
    predicate: obj => obj instanceof constructorFn,
    serializer: record => {
      return (<any>record).toObject();
    },
  });
  deserializerFor({
    name: name,
    deserializer: obj => new constructorFn(<T>obj),
  });
}
