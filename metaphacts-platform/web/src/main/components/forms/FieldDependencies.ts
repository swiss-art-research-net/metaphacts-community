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
import { Rdf } from 'platform/api/rdf';
import { SparqlClient, SparqlUtil } from 'platform/api/sparql';

import { FieldDependency } from './FieldDefinition';
import { CompositeValue } from './FieldValues';
import { tryMakeBindings } from './QueryValues';

export interface DependencyContext {
  readonly bindings: SparqlClient.Dictionary<Rdf.Node>;
  readonly autosuggestionPattern: string | undefined;
  readonly valueSetPattern: string | undefined;
}

export function makeDependencyContext(
  dependency: FieldDependency,
  composite: CompositeValue,
  previous: DependencyContext | undefined
): DependencyContext | undefined {
  const definition = composite.definitions.get(dependency.field);
  if (!definition) {
    return undefined;
  }
  const bindings = tryMakeBindings(composite, dependency.dependencies);
  if (!bindings) {
    return undefined;
  }
  if (previous && sameBindings(bindings, previous.bindings)) {
    return previous;
  }
  const resolvePattern = (
    pattern: 'autosuggestionPattern' | 'valueSetPattern'
  ) => {
    if (dependency[pattern]) {
      const baseQuery = SparqlUtil.parseQuery(dependency[pattern]);
      const boundQuery = SparqlClient.setBindings(baseQuery, bindings);
      return SparqlUtil.serializeQuery(boundQuery);
    }
    return definition[pattern];
  };
  return {
    bindings,
    autosuggestionPattern: resolvePattern('autosuggestionPattern'),
    valueSetPattern: resolvePattern('valueSetPattern'),
  };
}

function sameBindings(
  a: SparqlClient.Dictionary<Rdf.Node>,
  b: SparqlClient.Dictionary<Rdf.Node>
): boolean {
  for (const name in a) {
    if (!Object.prototype.hasOwnProperty.call(a, name)) { continue; }
    if (!Object.prototype.hasOwnProperty.call(b, name)) {
      return false;
    }
    if (a[name] !== b[name]) {
      return false;
    }
  }
  for (const name in b) {
    if (!Object.prototype.hasOwnProperty.call(b, name)) { continue; }
    if (!Object.prototype.hasOwnProperty.call(a, name)) {
      return false;
    }
  }
  return true;
}
