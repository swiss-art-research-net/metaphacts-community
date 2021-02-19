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
import * as SparqlJs from 'sparqljs';

import { Rdf } from 'platform/api/rdf';
import {
  SparqlUtil, PropertyPathBinder, TextBinder, PatternBinder,
} from 'platform/api/sparql';

describe('QueryBinder', () => {
  const parser = new SparqlJs.Parser({
    factory: Rdf.DATA_FACTORY,
    prefixes: {
      'owl': 'http://www.w3.org/2002/07/owl#',
      'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
      'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    }
  });

  it('PropertyPathBinder parametrizes ASK', () => {
    const query = parser.parse(`ASK WHERE {
      ?s ?p1 ?p1 .
      ?s ?p2 ?p2 .
    }`);

    new PropertyPathBinder({
      p1: {type: 'path', pathType: '/',
        items: [Rdf.iri('http:a'), Rdf.iri('http:b')]},
      p2: {type: 'path', pathType: '|',
        items: [Rdf.iri('http:c')]},
    }).sparqlQuery(query);

    const result = parser.parse(`ASK WHERE {
      ?s <http:a> / <http:b> ?p1 .
      ?s <http:c> ?p2 .
    }`);
    expect(query).to.deep.equal(result);
  });

  it('TextBinder parametrizes SELECT', () => {
    const query = parser.parse('SELECT * WHERE { ?s ?p "text TOKEN othertext" }');
    new TextBinder([
      {test: /TOKEN/, replace: 'replacement'},
    ]).sparqlQuery(query);

    const result = parser.parse('SELECT * WHERE { ?s ?p "text replacement othertext" }');
    expect(query).to.deep.equal(result);
  });

  it('PatternBinder parametrizes SELECT', () => {
    const query = parser.parse(`SELECT * WHERE { FILTER(?foo) }`);
    const patterns = SparqlUtil.parsePatterns(
      `?s ?p ?o . ?s a owl:Thing`, query.prefixes);
    new PatternBinder('foo', patterns).sparqlQuery(query);
    const result = parser.parse(`
      SELECT * WHERE {
        ?s ?p ?o .
        ?s a owl:Thing
      }
    `);
    expect(query).to.be.deep.equal(result);
  });
});
