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

import { Rdf, vocabularies } from 'platform/api/rdf';
const xsd = vocabularies.xsd;

describe('RDF', () => {
  describe('utils', () => {
    it('parse full IRI', () => {
      const iri = Rdf.fullIri('<http://example.com>');
      expect(iri.value).to.be.equal('http://example.com');
    });

    it('throws error when try to parse full IRI which is not enclosed in <>', () => {
      const iri = () => Rdf.fullIri('http://example.com');
      expect(iri).to.throw(Error);
    });
  });

  describe('Node', () => {
    const pairsOfEqualNodes: [Rdf.Node, Rdf.Node][] = [
      [Rdf.iri('some:iri'), Rdf.iri('some:iri')],
      [Rdf.literal('42', xsd.integer), Rdf.literal('42', xsd.integer)],
      [Rdf.langLiteral('42', 'en'), Rdf.langLiteral('42', 'en')],
    ];

    const pairsOfUnequalNodes: [Rdf.Node, Rdf.Node][] = [
      [Rdf.iri('some:iri'), Rdf.iri('some:other-iri')],
      [Rdf.iri('some:iri'), Rdf.literal('some:iri')],
      [Rdf.iri('some:iri'), Rdf.langLiteral('some:iri', 'en')],
      [Rdf.literal('hello'), Rdf.literal('world')],
      [Rdf.literal('42', xsd.integer), Rdf.literal('42', xsd.double)],
      [Rdf.literal('42', xsd.integer), Rdf.literal('42')],
      [Rdf.literal('foo'), Rdf.langLiteral('foo', 'en')],
      [Rdf.langLiteral('hello', 'en'), Rdf.langLiteral('world', 'en')],
      [Rdf.langLiteral('bar', 'en'), Rdf.langLiteral('bar', 'ru')],
    ];

    const pairsOfFalseComparisons: [Rdf.Node, any][] = [
      [Rdf.iri('foo:foo'), 'foo:foo'],
      [Rdf.iri('foo:foo'), {value: 'foo:foo'}],
      [Rdf.literal('foo'), 'foo'],
      [Rdf.literal('42', xsd.integer), 42],
      [Rdf.literal(true), true],
      [Rdf.langLiteral('bar', 'en'), {}],
    ];

    it('equals to same node is correct, reflexive and symmetric', () => {
      for (const [first, second] of pairsOfEqualNodes) {
        expect(first.equals(first) && second.equals(second)).to.be.equal(
          true, `${first} and ${second} should be equal to itself`);
        expect(first.equals(second) && second.equals(first)).to.be.equal(
          true, `${first} should be equal to ${second} (and in reverse too)`);
      }
    });

    it('equal nodes has same hashCode', () => {
      for (const [first, second] of pairsOfEqualNodes) {
        expect(Rdf.hashTerm(first)).to.be.equal(Rdf.hashTerm(second),
          `Hashcode of equal nodes ${first} and ${second} must match`);
      }
    });

    it('different nodes are unequal', () => {
      for (const [first, second] of pairsOfUnequalNodes) {
        expect(first.equals(second)).to.be.equal(
          false, `${first} should not equals ${second}`);
        expect(second.equals(first)).to.be.equal(
          false, `${first} should not equals ${second}`);
      }
    });

    it('never equals to a non-Node', () => {
      for (const [node, other] of pairsOfFalseComparisons) {
        expect(node.equals(other)).to.be.equal(
          false, `Node ${node} should not equals to non-Node value ${JSON.stringify(other)}`);
      }
    });
  });
});
