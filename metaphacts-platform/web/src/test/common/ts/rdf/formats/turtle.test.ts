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
import { expect } from 'chai';

import { Rdf, turtle, vocabularies } from 'platform/api/rdf';

describe('turtle writer/parser', () => {
  it('conversion between RDF typed literal and N3 literal', () => {
    const literal = Rdf.literal('example');
    const expectedN3Literal = '"example"^^<http://www.w3.org/2001/XMLSchema#string>';
    const n3Literal = turtle.serialize.nodeToN3(literal);

    expect(n3Literal).to.be.equal(expectedN3Literal);
    expect(
      turtle.deserialize.n3ValueToRdf(n3Literal)
    ).to.be.deep.equal(literal);
  });

  it('conversion between RDF lang literal and N3 literal', () => {
    const literal = Rdf.langLiteral('example', 'en');
    const expectedN3Literal = '"example"@en';
    const n3Literal = turtle.serialize.nodeToN3(literal);

    expect(n3Literal).to.be.equal(expectedN3Literal);
    expect(
      turtle.deserialize.n3ValueToRdf(n3Literal)
    ).to.be.deep.equal(literal);
  });


  it('conversion between RDF Iri and N3 value', () => {
    const iri = Rdf.iri('http://example.com');
    const expectedN3Value = '<http://example.com>';
    const n3Value = turtle.serialize.nodeToN3(iri);

    expect(n3Value).to.be.equal(expectedN3Value);
    expect(
      turtle.deserialize.n3ValueToRdf(n3Value)
    ).to.be.deep.equal(iri);
  });


  it('conversion between RDF Bnode and N3 value', () => {
    const bnode = Rdf.bnode('node');
    const expectedN3Value = '_:node';
    const n3Value = turtle.serialize.nodeToN3(bnode);

    expect(n3Value).to.be.equal(expectedN3Value);
    expect(
      turtle.deserialize.n3ValueToRdf(n3Value)
    ).to.be.deep.equal(bnode);
  });


  it('conversion between RDF Graph and Turtle', async () => {
    const {xsd} = vocabularies;
    const graph = Rdf.graph([
      Rdf.triple(
        Rdf.iri('http://ex.com'), Rdf.iri('http://example.com'), Rdf.langLiteral('hello', 'en')
      ),
      Rdf.triple(
        Rdf.bnode('node'), Rdf.iri('http://example.com'), Rdf.literal('5', xsd.integer)
      ),
    ]);
    const ttl = await turtle.serialize.serializeGraph(graph).toPromise();
    const res = await turtle.deserialize.turtleToGraph(ttl).toPromise();
    expect(res).to.be.deep.equal(graph);
  });
});
