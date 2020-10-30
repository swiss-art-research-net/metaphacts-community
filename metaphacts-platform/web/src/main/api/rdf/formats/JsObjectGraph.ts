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

import * as Rdf from '../core/Rdf';
import { rdf, xsd, persist } from '../vocabularies';

const {JsonUndefined, JsonNull} = persist;

export function propertyKeyToIriDefault(
  keyOrIndex: string | number,
  propertyNamespace: Rdf.Iri
): Rdf.Iri {
  const encodedKey = typeof keyOrIndex === 'number'
    ? `_item/${keyOrIndex}`
    : encodeURIComponent(keyOrIndex);
  return Rdf.iri(`${propertyNamespace.value}/${encodedKey}`);
}

export function iriToPropertyKeyDefault(iri: Rdf.Quad['predicate']): string | undefined {
  if (!Rdf.isIri(iri)) { return undefined; }
  const encodedKey = iri.value.substr(iri.value.lastIndexOf('/') + 1);
  return decodeURIComponent(encodedKey);
}

/**
 * Converts JSON-like Javascript object into Rdf.PointedGraph similar to AST of JSON.
 *
 * Arrays are represented as RDF lists:
 * ```
 *   [] -> rdf:nil
 *   [x:xs] -> root rdf:first x ; rdf:rest xs .
 * ```
 *
 * Plain objects are represented by IRIs `<[propertyNamespace] / [path from root] / [key name]>`
 * ```
 *   {"foo": bar} -> root <[propertyNamespace]/foo> bar .
 *   [{"foo": bar}] -> root
 *     rdf:first [ <[propertyNamespace]/_item/0/foo> bar ] ;
 *     rdf:rest rdf:nil .
 * ```
 *
 * `string`, `boolean` values are represented by literals with corresponding XSD datatype
 * (e.g. numbers by `xsd:double`, `xsd:integer`, etc).
 *
 * `null` value is represented by `persistedComponent:json/null`;
 * `undefined` value is represented by `persistedComponent:json/undefined`.
 *
 * Non-plain objects and functions are treated as if they're undefined.
 * Extra (non-index) array keys and object entries with `undefined` values are discarded.
 */
export function serialize(
  value: any,
  propertyNamespace: Rdf.Iri,
  propertyKeyToIri = propertyKeyToIriDefault
): Rdf.PointedGraph {
  if (typeof value === undefined) {
    return Rdf.pg(JsonUndefined, Rdf.EMPTY_GRAPH);
  } else if (value === null) {
    return Rdf.pg(JsonNull, Rdf.EMPTY_GRAPH);
  } else if (typeof value === 'string') {
    return Rdf.pg(Rdf.literal(value, xsd._string), Rdf.EMPTY_GRAPH);
  } else if (typeof value === 'boolean') {
    return Rdf.pg(Rdf.literal(value, xsd.boolean), Rdf.EMPTY_GRAPH);
  } else if (typeof value === 'number') {
    if (Math.round(value) === value) {
      return Rdf.pg(Rdf.literal(value.toString(), xsd.integer), Rdf.EMPTY_GRAPH);
    } else {
      return Rdf.pg(Rdf.literal(value.toString(), xsd.double), Rdf.EMPTY_GRAPH);
    }
  } else if (Array.isArray(value)) {
    return serializeArray(value, (item, index) =>
      serialize(item, propertyKeyToIri(index, propertyNamespace))
    );
  } else if (_.isPlainObject(value)) {
    const root = Rdf.bnode();
    const result: Rdf.Quad[] = [];
    for (const key in value) {
      if (!value.hasOwnProperty(key)) { continue; }
      const nestedNamespace = propertyKeyToIri(key, propertyNamespace);
      const {graph, pointer} = serialize(value[key], nestedNamespace, propertyKeyToIri);
      // ignore undefined values in objects
      if (!pointer.equals(JsonUndefined)) {
        result.push(...graph.triples.toArray());
        result.push(Rdf.triple(root, nestedNamespace, pointer));
      }
    }
    return Rdf.pg(root, Rdf.graph(result));
  } else {
    // return JsonUndefined for functions and non-plain objects
    return Rdf.pg(JsonUndefined, Rdf.EMPTY_GRAPH);
  }
}

export function serializeArray<T>(
  array: T[], mapper: (item: T, index: number) => Rdf.PointedGraph
): Rdf.PointedGraph {
  if (array.length === 0) {
    return Rdf.pg(rdf.nil, Rdf.EMPTY_GRAPH);
  }

  let rest: Rdf.Node = rdf.nil;
  let triples: Rdf.Quad[] = [];

  for (let i = array.length - 1; i >= 0; i--) {
    const node = Rdf.bnode();
    const {pointer, graph} = mapper(array[i], i);
    triples.push(Rdf.triple(node, rdf.first, pointer));
    triples.push(Rdf.triple(node, rdf.rest, rest));
    graph.triples.forEach(triple => triples.push(triple));
    rest = node;
  }

  return Rdf.pg(rest, Rdf.graph(triples));
}

function deserializeObjectHelper(
  root: Rdf.Node,
  graph: Rdf.Graph,
  iriToPropertyKey: (iri: Rdf.Quad['predicate']) => string | undefined
): object {
  const isArray = graph.triples.some(t => t.s.equals(root) && t.p.equals(rdf.first));
  if (isArray) {
    return deserializeArray(root, graph, pointer => deserialize(pointer, graph, iriToPropertyKey));
  } else {
    const result: { [key: string]: any } = {};
    const outgoing = graph.triples.filter(t => t.s.equals(root));
    outgoing.forEach(t => {
      const key = iriToPropertyKey(t.p);
      if (key) {
        result[key] = deserialize(t.o, graph, iriToPropertyKey);
      }
    });
    return result;
  }
}

/**
 * Converts Rdf.PointedGraph generated by `serialize()` back to JSON-like object.
 */
export function deserialize(
  root: Rdf.Term, graph: Rdf.Graph, iriToPropertyKey = iriToPropertyKeyDefault
): any {
  switch (root.termType) {
    case 'NamedNode': {
      const iri = root;
      if (iri.equals(rdf.nil)) {
        return [];
      } else if (iri.equals(JsonUndefined)) {
        return undefined;
      } else if (iri.equals(JsonNull)) {
        return null;
      } else {
        return deserializeObjectHelper(iri, graph, iriToPropertyKey);
      }
    }
    case 'Literal': {
      const literal = root;
      if (literal.datatype.equals(xsd._string)) {
        return literal.value;
      } else if (literal.datatype.equals(xsd.boolean)) {
        return literal.value === 'true';
      } else if (literal.datatype.equals(xsd.double)) {
        return parseFloat(literal.value);
      } else if (literal.datatype.equals(xsd.integer)) {
        return parseInt(literal.value);
      } else {
        return undefined;
      }
    }
    case 'BlankNode': {
      const bnode = root;
      return deserializeObjectHelper(bnode, graph, iriToPropertyKey);
    }
  }
  return undefined;
}

export function deserializeArray<T>(
  root: Rdf.Term,
  graph: Rdf.Graph,
  mapper: (pointer: Rdf.Node) => T | undefined
): (T | undefined)[] {
  if (root.equals(rdf.nil)) {
    return [];
  }

  const {triples} = graph;
  const items: T[] = [];

  let node = root;
  while (!node.equals(rdf.nil)) {
    const first = triples.filter(t => t.s.equals(node) && t.p.equals(rdf.first)).first();
    const rest = triples.filter(t => t.s.equals(node) && t.p.equals(rdf.rest)).first();
    if (!first) {
      throw new Error(`Missing rdf:first triple for array ${root} at node ${node}`);
    }
    if (Rdf.isNode(first.o)) {
      const item = mapper(first.o);
      items.push(item);
    }
    node = rest ? rest.o : rdf.nil;
  }

  return items;
}
