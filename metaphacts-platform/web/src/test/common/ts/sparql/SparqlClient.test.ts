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
import * as Kefir from 'kefir';
import { use, expect, assert } from 'chai';
import * as sinon from 'sinon';
import * as chaiString from 'chai-string';
use(chaiString);

import * as NamespaceService from 'platform/api/services/namespace';
sinon.stub(NamespaceService, 'getRegisteredPrefixes').callsFake(function() {
  return Kefir.constant({});
});

import { Rdf, vocabularies } from 'platform/api/rdf';
import { SparqlClient, SparqlUtil } from 'platform/api/sparql';

import { mockRequest } from 'platform-tests/mocks';

describe('SparqlClient', function() {
  mockRequest();

  it('SPARQL select query', function(done) {
    const rawResponse = JSON.stringify({
      'head' : {
        'vars' : [ 'x', 'y' ],
      },
      'results' : {
        'bindings' : [
          {
            'x' : {
              'type' : 'uri',
              'value' : 'http://example.com/1',
            },
            'y' : {
              'type' : 'literal',
              'value' : 'Example1',
            },
          },
          {
            'x' : {
              'type' : 'uri',
              'value' : 'http://example.com/2',
            },
            'y' : {
              'type' : 'literal',
              'datatype': 'http://www.w3.org/2001/XMLSchema#integer',
              'value' : '2',
            },
          },
          {
            'x' : {
              'type' : 'uri',
              'value' : 'http://example.com/3',
            },
            'y' : {
              'type' : 'literal',
              'xml:lang': 'en',
              'value' : 'Example3',
            },
          },
        ],
      },
    });

    const expectedResponse: SparqlClient.SparqlSelectResult = {
      'head' : {
        'vars' : [ 'x', 'y' ],
      } as SparqlClient.SparqlSelectResult['head'],
      'results' : {
        'distinct': undefined,
        'ordered': undefined,
        'bindings' : [
          {
            'x': Rdf.iri('http://example.com/1'),
            'y': Rdf.literal('Example1'),
          },
          {
            'x': Rdf.iri('http://example.com/2'),
            'y': Rdf.literal('2', vocabularies.xsd.integer),
          },
          {
            'x': Rdf.iri('http://example.com/3'),
            'y': Rdf.langLiteral('Example3', 'en'),
          },
        ],
      },
    };

    const query = 'SELECT ?x ?y WHERE {?x ?p ?y.}';
    SparqlClient.select(query).onValue(
      res => {
        expect(res).to.be.deep.equal(expectedResponse);
        done();
      }
    ).onError(done);

    expect(this.request.requestBody).to.be.equalIgnoreSpaces(query);
    expect(this.request.requestHeaders).to.be.deep.equal({
      'Content-Type': 'application/sparql-query;charset=utf-8',
      'Accept': 'application/sparql-results+json',
    });

    this.request.respond(
      200, {'Content-Type': 'application/sparql-results+json'}, rawResponse
    );
  });

  it('SPARQL construct query', function(done) {
    const rawResponse = `
        <http://example.com/1>  <http://example.com/p> "Example1".
        <http://example.com/2>  <http://example.com/p> "2"^^<http://www.w3.org/2001/XMLSchema#integer>.
        <http://example.com/3>  <http://example.com/p> "Example3"@en.
    `;

    const expectedResponse = [
      Rdf.triple(
        Rdf.iri('http://example.com/1'),  Rdf.iri('http://example.com/p'), Rdf.literal('Example1')
      ),
      Rdf.triple(
        Rdf.iri('http://example.com/2'), Rdf.iri('http://example.com/p'),
        Rdf.literal('2', vocabularies.xsd.integer)
      ),
      Rdf.triple(
        Rdf.iri('http://example.com/3'), Rdf.iri('http://example.com/p'), Rdf.langLiteral('Example3', 'en')
      ),
    ];

    const query = 'CONSTRUCT {?s ?p ?o.} WHERE {?s ?p ?o.}';
    SparqlClient.construct(query).onValue(
      res => {
        expect(res).to.be.deep.equal(expectedResponse);
        done();
      }
    ).onError(done);

    expect(this.request.requestBody).to.be.equalIgnoreSpaces(query);
    expect(this.request.requestHeaders).to.be.deep.equal({
      'Content-Type': 'application/sparql-query;charset=utf-8',
      'Accept': 'application/x-turtlestar',
    });

    this.request.respond(
      200, {'Content-Type': 'application/x-turtlestar'}, rawResponse
    );
  });

  it('SPARQL ask query', function(done) {
    const rawResponse = JSON.stringify({
      'head': [],
      'boolean': true,
    });

    const query = 'ASK WHERE {?s ?p ?o.}';
    SparqlClient.ask(query).onValue(
      res => {
        expect(res).to.be.equal(true);
        done();
      }
    ).onError(done);

    expect(this.request.requestBody).to.be.equalIgnoreSpaces(query);
    expect(this.request.requestHeaders).to.be.deep.equal({
      'Content-Type': 'application/sparql-query;charset=utf-8',
      'Accept': 'application/sparql-results+json',
    });

    this.request.respond(
      200, {'Content-Type': 'application/sparql-results+json'}, rawResponse
    );
  });

  it('should add query parameter as VALUES clause', function(done) {
    const query = `
      SELECT * WHERE {
        ?s ?p ?o.
      }
    `;

    const expectedQuery = `
      SELECT * WHERE {
        VALUES (?s ?o) {
          (<http://example.com> 42)
        }
        ?s ?p ?o.
      }`;

    const {xsd} = vocabularies;
    const parametrizedQuery = SparqlClient.prepareQuery(query, [
      {s: Rdf.iri('http://example.com'), o: Rdf.literal('42', xsd.integer)},
    ]);

    parametrizedQuery.onValue(
      preparedQuery => {
        expect(SparqlUtil.serializeQuery(preparedQuery)).to.be.equalIgnoreSpaces(expectedQuery);
        done();
      }
    ).onError(
      error => assert.fail(error)
    );
  });

  it('should add multiple query parameters as VALUES clause', function(done) {
    const query = `
      SELECT * WHERE {
        ?s ?p ?o.
      }
    `;

    const expectedQuery = `
      SELECT * WHERE {
        VALUES (?s ?p) {
          (<http://example.com/1> "example1")
          (<http://example.com/2> "example2")
        }
        ?s ?p ?o.
      }`;

    const parametrizedQuery =
      SparqlClient.prepareQuery(query, [
        {
          s: Rdf.iri('http://example.com/1'),
          p: Rdf.literal('example1'),
        },
        {
          s: Rdf.iri('http://example.com/2'),
          p: Rdf.literal('example2'),
        },
      ]);

      parametrizedQuery.onValue(
        preparedQuery => {
          expect(SparqlUtil.serializeQuery(preparedQuery)).to.be.equalIgnoreSpaces(expectedQuery);
          done();
        }
      ).onError(
        error => assert.fail(error)
      );
  });
});
