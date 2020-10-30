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
import { use, expect, assert } from 'chai';
import * as chaiString from 'chai-string';
use(chaiString);

import * as SparqlJs from 'sparqljs';

import { SparqlUtil } from 'platform/api/sparql';
const { Sparql, serializeQuery } = SparqlUtil;

describe('SparqlUtil', function() {

  it('Use Sparql string template function to parse the query', function() {
    SparqlUtil.init({
      foaf: 'http://xmlns.com/foaf/0.1/',
      rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
    });
    const query: SparqlJs.SparqlQuery =
        Sparql`
          PREFIX foaf: <http://xmlns.com/foaf/0.1/>
          PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
          SELECT ?s WHERE {
            ?s a foaf:Person ;
               rdfs:label ?label .
          }
        `;

    const expected = [
      'PREFIX foaf: <http://xmlns.com/foaf/0.1/>',
      'PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>',
      'SELECT ?s WHERE {',
      '  ?s <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> foaf:Person;',
      '    rdfs:label ?label.',
      '}',
    ].join('\n');

    expect(serializeQuery(query)).to.be.equal(expected);
  });

  const TEST_QUERY = 'Hello   (!)world';
  it(`makeLuceneQuery(query, escape, tokenize)`, () => {
    assert.equal(
      SparqlUtil.makeLuceneQuery(TEST_QUERY).value,
      'Hello* \\(\\!\\)world*'
    );
    assert.equal(
      SparqlUtil.makeLuceneQuery(TEST_QUERY, true, true).value,
      'Hello* \\(\\!\\)world*'
    );
  });
  it(`makeLuceneQuery(query, escape, !tokenize)`, () => {
    assert.equal(
      SparqlUtil.makeLuceneQuery(TEST_QUERY, true, false).value,
      'Hello \\(\\!\\)world'
    );
  });
  it(`makeLuceneQuery(query, !escape, tokenize)`, () => {
    assert.equal(
      SparqlUtil.makeLuceneQuery(TEST_QUERY, false, true).value,
      'Hello* (!)world*'
    );
  });
  it(`makeLuceneQuery(query, !escape, !tokenize)`, () => {
    assert.equal(
      SparqlUtil.makeLuceneQuery(TEST_QUERY, false, false).value,
      'Hello (!)world'
    );
  });
  it(`makeLuceneQuery(query, !escape, 'regex')`, () => {
    assert.equal(
      SparqlUtil.makeLuceneQuery(TEST_QUERY, false, 'regex').value,
      'Hello.* (!)world.*'
    );
  });

  it('findTokenizationDefaults() on BDS', () => {
    const bdsQuery = SparqlUtil.parseQuery(`
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX bds: <http://www.bigdata.com/rdf/search#>
      SELECT * WHERE {
        ?value rdfs:label ?label .
        ?label bds:search ?__bdsToken__ .
      }
    `) as SparqlJs.SelectQuery;
    assert.deepEqual(
      SparqlUtil.findTokenizationDefaults(bdsQuery.where, '__bdsToken__'),
      {escapeLucene: true, tokenize: true}
    );
  });
  it('findTokenizationDefaults() on Lookup service', () => {
    const lookupQuery = SparqlUtil.parseQuery(`
      PREFIX lookup: <http://www.metaphacts.com/ontologies/platform/repository/lookup#>
      PREFIX Repository: <http://www.metaphacts.com/ontologies/repository#>
      SELECT * WHERE {
        SERVICE Repository:lookup {
          ?value lookup:token ?__lookupToken__ .
        }
      }
    `) as SparqlJs.SelectQuery;
    assert.deepEqual(
      SparqlUtil.findTokenizationDefaults(lookupQuery.where, '__lookupToken__'),
      {escapeLucene: false, tokenize: false}
    );
  });
  it('findTokenizationDefaults() on simple REGEX', () => {
    const regexQuery = SparqlUtil.parseQuery(`
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      SELECT * WHERE {
        ?value rdfs:label ?label .
        FILTER(REGEX(?label, ?__regexToken__, "i"))
      }
    `) as SparqlJs.SelectQuery;
    assert.deepEqual(
      SparqlUtil.findTokenizationDefaults(regexQuery.where, '__regexToken__'),
      {escapeLucene: false, tokenize: 'regex'}
    );
  });
  it('findTokenizationDefaults() on REGEX when using LCASE on token', () => {
    const regexQuery = SparqlUtil.parseQuery(`
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      SELECT * WHERE {
        ?value rdfs:label ?label .
        FILTER(REGEX(LCASE(?label), LCASE(?__regexToken__), "i"))
      }
    `) as SparqlJs.SelectQuery;
    assert.deepEqual(
      SparqlUtil.findTokenizationDefaults(regexQuery.where, '__regexToken__'),
      {escapeLucene: false, tokenize: 'regex'}
    );
  });
  it('findTokenizationDefaults() on mixed token usages', () => {
    const mixedQuery = SparqlUtil.parseQuery(`
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX bds: <http://www.bigdata.com/rdf/search#>
      SELECT * WHERE {
        ?value rdfs:label ?label .
        FILTER(REGEX(?label, ?__mixedToken__, "i"))
        ?label bds:search ?__mixedToken__ .
      }
    `) as SparqlJs.SelectQuery;
    assert.deepEqual(
      SparqlUtil.findTokenizationDefaults(mixedQuery.where, '__mixedToken__'),
      {escapeLucene: undefined, tokenize: undefined}
    );
  });
  it('findTokenizationDefaults() on unknown token usage', () => {
    const unknownQuery = SparqlUtil.parseQuery(`
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      SELECT * WHERE {
        ?value rdfs:label ?label .
      }
    `) as SparqlJs.SelectQuery;
    assert.deepEqual(
      SparqlUtil.findTokenizationDefaults(unknownQuery.where, '__unknownToken__'),
      {escapeLucene: undefined, tokenize: undefined}
    );
  });
});
