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
/**
 * This module can be used to serialize/deserialize JS instance to/from JSON.
 * E.g. it can be used to save state of the react component.
 */

import * as _ from 'lodash';
import { Iterable } from 'immutable';

export interface Deserializer<T> {
  /**
   * Name which is used to determine appropriate deserializer function.
   * Should be unique across all possible deserializers.
   */
  name: string

  /**
   * Deserializer function. Converts JSON object to JS instance.
   */
  deserializer: (obj: any) => T
}

export interface Serializer<T> {
  /**
   * Name which is used to mark serialized obeject.
   * Deserializer with corresponding name will be used for deserialization.
   * Should be unique across all possible serializers.
   */
  name: string

  predicate: (x: any) => boolean

  /**
   * Serializer function. Converts JS instance to JSON.
   */
  serializer: (x: T) => {}
}

const TYPE_VARIABLE_NAME = '#type';
const VALUE_VARIABLE_NAME = '#value';

/**
 * All registered desrializers.
 */
const deserializers: Array<Deserializer<any>> = [];

/**
 * All registered srializers.
 */
const serializers: Array<Serializer<any>> = [];

/**
 * ES6 decorator function to register method as deserializer for class instance.
 *
 * @example
 *  class MyClass {
 *    @deserializer
 *    public static fromJson(obj: {}) {return new MyClass();}
 *  }
 */
export function deserializer<T>(target: any, key: string, descriptor: any) {
  deserializers.push(
    {
      name: <string>target.prototype.constructor.name,
      deserializer: descriptor.value,
    }
  );
  return descriptor;
}

/**
 * ES6 decorator function to register method as serializer for class instance.
 *
 * @example
 *  class MyClass {
 *    @serializer
 *    toJson() {return {}}
 *  }
 */
export function serializer<T>(target: any, key: string, descriptor: any) {
  serializers.push(
    {
      name: target.constructor.name,
      predicate: obj => obj instanceof target.constructor,
      serializer: descriptor.value,
    }
  );
  return descriptor;
}

/**
 * Register serializer for class.
 * Useful when serializer need to be registered for class that is not under control.
 * Otherwise decorator approach is more concise.
 *
 * @example
 * class MyClassA {
 *    constructor(x: MyClassB) {
 *      this._x = x;
 *    }
 * }
 *
 * serializerFor({
 *   name: MyClassA.prototype.constructor.name,
 *   predicate: function(obj) {
 *     return obj instanceof MyClassA
 *   },
 *   serializer: function(obj: MyClassA) {
 *     return {
 *       x: obj._x
 *     };
 *   }
 * });
 *
 * If serializer for MyClassB has been already defined, it will be properly serialized as well.
 */
export function serializerFor<T>(serializer: Serializer<T>) {
  serializers.push(serializer);
}
/**
 * Register deserializer for class.
 * Useful when deserializer need to be registered for class that is not under control.
 * Otherwise decorator approach is more concise.
 *
 * @example
 * class MyClassA {
 *    constructor(x: MyClassB) {
 *      this._x = x;
 *    }
 * }
 *
 * derializerFor({
 *   name: MyClassA.prototype.constructor.name,
 *   deserializer: function(obj: any) {
 *     return new MyClassA(obj.x);
 *   }
 * });
 *
 * If there is deserializer for MyClassB, obj.x will deserialized before invocation of the deserializer for MyClassA.
 * As result obj.x will be instanceof MyClassB.
 */
export function deserializerFor<T>(deserializer: Deserializer<T>) {
  return deserializers.push(deserializer);
}

/**
 * Serialize JS class instance to JSON object.
 * Serialization rules:
 *   serialize(null) === null
 *   serialize(1) === 1
 *   serialize('string') === 'string'
 *   serialize([1, myClassInstance]) == [1, {#type: MyClass, #value: {...}}]
 *   serialize({x: 1, y: myClassInstance}) == {x: 1, y: {#type: MyClass, #value: {...}}}
 */
export function serialize(object: any): {} {
  if (_.isUndefined(object) || _.isNull(object) || _.isNumber(object) || _.isString(object)) {
    return object;
  } else if (_.isArray(object)) {
    return _.map(object, serialize);
  // need to have !(object instanceof Iterable) check to avoid warnings from immutablejs
  } else if (!(object instanceof Iterable) && _.isPlainObject(object)) {
    return _.transform(object, (res, val, key) => {
      res[key] = serialize(val);
      return res;
    }, {});
  } else {
    var serializerObj = _.find(serializers, serializer => serializer.predicate(object));
    if (serializerObj) {
      return addTypeDiscriminator(
        serializerObj.serializer, serializerObj.name
      )(object);
    } else {
      return object;
    }
  }
}

/**
 * Deserialize JSON as some JS class instance.
 */
export function deserialize<T>(object: any): T {
  if (_.isUndefined(object) || _.isNull(object) || _.isNumber(object) || _.isString(object)) {
    return object as any;
  } else if (_.isArray(object)) {
    return <any>_.map(object, deserialize);
  } else {
    var deserializerObj = _.find(
      deserializers, deserializer => object[TYPE_VARIABLE_NAME] === deserializer.name
    );
    if (deserializerObj) {
      return deserializerObj.deserializer(
        deserialize(object[VALUE_VARIABLE_NAME])
      );
    } else if (_.isPlainObject(object)) {
      return <any>_.transform(object, (res, val, key) => {
        res[key] = deserialize(val);
        return res;
      }, {});
    } else {
      return object;
    }
  }
}

function addTypeDiscriminator(originalFn: Function, serializedObjectType: string) {
  return function (obj: object) {
    const json: { [property: string]: unknown } = {};
    json[TYPE_VARIABLE_NAME] = serializedObjectType;
    json[VALUE_VARIABLE_NAME] = serialize(originalFn.apply(obj, [obj]));
    return json;
  };
}
