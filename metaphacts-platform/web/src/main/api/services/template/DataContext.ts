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
export interface DataContext {
  /** `this` context */
  readonly context: unknown;
  /** `@data` stack */
  readonly data?: HandlebarsDataStack;
}

/**
 * Represents `@data` stack from Handlebars template context.
 */
export interface HandlebarsDataStack {
  _parent?: HandlebarsDataStack;
  root?: any;
  index?: number;
  key?: number | string;
  first?: boolean;
  last?: boolean;
}

export function mergeInContextOverride(
  outer: DataContext | undefined,
  innerContextObject: unknown
): DataContext {
  return {
    context: outer
      ? mergeContextObject(outer.context, innerContextObject)
      : innerContextObject,
    data: outer ? outer.data : undefined,
  };
}

const CAPTURED_DATA_KEYS: Array<keyof HandlebarsDataStack> =
  ['root', 'index', 'key', 'first', 'last'];

export function emptyDataStack(): HandlebarsDataStack {
  return {};
}

export function cloneDataStack(data: HandlebarsDataStack) {
  if (!data) { return data; }
  const clone: HandlebarsDataStack = {};
  for (const key of CAPTURED_DATA_KEYS) {
    if (key in data) {
      (clone as any)[key] = data[key];
    }
  }
  if ('_parent' in data) {
    clone._parent = cloneDataStack(data._parent);
  }
  return clone;
}

export function mergeContextObject(outer: unknown, inner: unknown): unknown {
  if (isPlainObjectOrNothing(inner)) {
    if (isPlainObjectOrNothing(outer)) {
      return {...outer, ...inner};
    } else {
      // 'outer' is a primitive and can be inherited only when 'inner' is empty
      return hasAnyOwnKey(inner) ? inner : outer;
    }
  } else {
    // 'inner' is a primitive and cannot inherit data context
    return inner;
  }
}

/**
 * Checks if `target` is a plain object (not function, class instance or boxed primitive)
 * or `undefined` / `null`.
 */
function isPlainObjectOrNothing(target: any): target is object | undefined | null {
  if (target === null || target === undefined) {
    return true;
  }
  if (typeof target !== 'object') {
    return false;
  }
  const prototype = Object.getPrototypeOf(target);
  return !prototype || prototype === Object.getPrototypeOf({});
}

function hasAnyOwnKey(target: object): boolean {
  for (const key in target) {
    if (target.hasOwnProperty(key)) {
      return true;
    }
  }
  return false;
}

export function overrideDataStack(
  outer: HandlebarsDataStack,
  inner: HandlebarsDataStack
): HandlebarsDataStack {
  const result = {...outer, ...inner};
  if (outer._parent && inner._parent) {
    result._parent = overrideDataStack(outer._parent, inner._parent);
  }
  return result;
}
