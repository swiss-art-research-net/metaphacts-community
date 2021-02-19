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
import { expect } from 'chai';

import { Rdf } from 'platform/api/rdf';
import { xsd, rdf, persist } from 'platform/api/rdf/vocabularies';
import { ObjectGraph } from 'platform/api/rdf';

const {JsonUndefined} = persist;

const EXAMPLE_JS: unknown = [{
  abc: [123, 3.14, 'str'],
  def: 'abc',
}, {
  '123': [3.14, {}],
  def: true,
}];

const BASE_NAMESPACE = Rdf.iri('http://example.com');

function propertyKey(key: string) {
  return ObjectGraph.propertyKeyToIriDefault(key, BASE_NAMESPACE);
}

const exampleGraph = Rdf.graph([
  Rdf.triple(Rdf.iri('http://example.com/root'), rdf.first, Rdf.bnode('0')),
  Rdf.triple(Rdf.iri('http://example.com/root'), rdf.rest, Rdf.bnode('0rest')),
  Rdf.triple(Rdf.bnode('0rest'), rdf.first, Rdf.bnode('1')),
  Rdf.triple(Rdf.bnode('0rest'), rdf.rest, rdf.nil),

  Rdf.triple(Rdf.bnode('0'), propertyKey('abc'), Rdf.bnode('0_abc')),
  Rdf.triple(Rdf.bnode('0'), propertyKey('def'), Rdf.literal('abc')),
  Rdf.triple(Rdf.bnode('1'), propertyKey('123'), Rdf.bnode('1_123')),
  Rdf.triple(Rdf.bnode('1'), propertyKey('def'), Rdf.literal(true)),

  Rdf.triple(Rdf.bnode('0_abc'), rdf.first, Rdf.literal('123', xsd.integer)),
  Rdf.triple(Rdf.bnode('0_abc'), rdf.rest, Rdf.bnode('0_abc_0rest')),
  Rdf.triple(Rdf.bnode('0_abc_0rest'), rdf.first, Rdf.literal('3.14', xsd.double)),
  Rdf.triple(Rdf.bnode('0_abc_0rest'), rdf.rest, Rdf.bnode('0_abc_1rest')),
  Rdf.triple(Rdf.bnode('0_abc_1rest'), rdf.first, Rdf.literal('str')),
  Rdf.triple(Rdf.bnode('0_abc_1rest'), rdf.rest, rdf.nil),

  Rdf.triple(Rdf.bnode('1_123'), rdf.first, Rdf.literal('3.14', xsd.double)),
  Rdf.triple(Rdf.bnode('1_123'), rdf.rest, Rdf.bnode('1_123_0rest')),
  Rdf.triple(Rdf.bnode('1_123_0rest'), rdf.first, Rdf.bnode('1_123_1')),
  Rdf.triple(Rdf.bnode('1_123_0rest'), rdf.rest, rdf.nil),
]);


function checkObjectToGraphAndBack(example: unknown) {
  const graph = ObjectGraph.serialize(example, BASE_NAMESPACE);
  /* Comment this line with // for tests update
  turtle.serialize.serializeGraph(graph.graph).onValue(value => {
    console.log('serialized graph for ' + JSON.stringify(example) + ':\n' +
      'Size: ' + graph.graph.triples.toArray().length + '\n' +
      'Root: ' + graph.pointer.value + '\n' + value);
    return true;
  }).observe({end: () => { }});
  // */
  const obj = ObjectGraph.deserialize(graph.pointer, graph.graph);
  expect(obj).to.be.deep.equals(example);
}

describe('JsObjectGraph', () => {
  it('converts JS object to RDF graph and back', () => {
    checkObjectToGraphAndBack(EXAMPLE_JS);
  });

  it('converts RDF graph to JS object', () => {
    const obj = ObjectGraph.deserialize(Rdf.iri('http://example.com/root'), exampleGraph);
    expect(obj).to.be.deep.equal(EXAMPLE_JS);
  });

  it('converts JS object with nulls to RDF graph and back', () => {
    checkObjectToGraphAndBack(null);
    checkObjectToGraphAndBack([null]);
    checkObjectToGraphAndBack([[]]);
    checkObjectToGraphAndBack({k: null});
    checkObjectToGraphAndBack({k: []});
    checkObjectToGraphAndBack({k: {}});
    checkObjectToGraphAndBack({k: [{}, null, [], [true, false], {key: null, key2: 123}]});
  });

  it('converts JS object with nulls to RDF graph and back', () => {
    checkObjectToGraphAndBack(undefined);
    checkObjectToGraphAndBack([undefined]);
    checkObjectToGraphAndBack({k: [{}, undefined, [], [true, false], {key: null, key2: 123}]});
  });

  it('serializes functions as undefined', () => {
    const functionGraph = ObjectGraph.serialize((x: number) => x + 1, BASE_NAMESPACE);
    expect(functionGraph.pointer).to.be.equal(JsonUndefined);
    expect(functionGraph.graph.triples.toArray()).to.be.empty;
  });

  it('serializes non-plain objects as undefined', () => {
    const nonPlainObjectGraph = ObjectGraph.serialize(
      Rdf.iri('http://example.com'), BASE_NAMESPACE);
    expect(nonPlainObjectGraph.pointer).to.be.equal(JsonUndefined);
    expect(nonPlainObjectGraph.graph.triples.toArray()).to.be.empty;
  });

  it('omits entries with undefined values from plain objects', () => {
    const data: unknown = {
      bar: {
        k1: 'A',
        k2: null,
        k3: undefined,
      },
      qux: undefined,
    };
    const expected: unknown = {
      bar: {
        k1: 'A',
        k2: null,
      },
    };
    const {graph, pointer} = ObjectGraph.serialize(data, BASE_NAMESPACE);
    const result = ObjectGraph.deserialize(pointer, graph);
    expect(result).to.be.deep.equal(expected);
  });
});
