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
import { SparqlUtil } from 'platform/api/sparql';
import { LdpPersistence } from 'platform/components/forms';

import { mockRequest } from 'platform-tests/mocks';

const LDP_PERSISTENCE = new LdpPersistence();

describe('LdpPersistence: converting insert queries of field definitions into construct queries', () => {
  mockRequest();

  it('with plain bgp patterns', function (done) {

    const expectedConstructString = `
    CONSTRUCT {
      <http://testsubject> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://testvalue>.
      <http://testsubject> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://testtype>.
    } WHERE {
      <http://testsubject> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type>
        <http://testvalue>, <http://testtype>, <http://testtype2>.
    }
    `.replace(/\s/g, '');

    SparqlUtil.parseQueryAsync(`INSERT {
      $subject a $value.
      <http://testsubject> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://testtype>.
    } WHERE {
      $subject a $value.
      <http://testsubject> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://testtype>.
      <http://testsubject> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://testtype2>.
    }`).onValue(insertQuery => {
      expect(
        LDP_PERSISTENCE.createFieldConstructQueries(
          insertQuery as SparqlJs.Update,
          [{value: Rdf.iri('http://testvalue')}],
          Rdf.iri('http://testsubject')
        ).map(
          construct => SparqlUtil.serializeQuery(construct).replace(/\s/g, '')
        ).toArray()
      ).to.be.deep.equal([expectedConstructString]);
      done();
    });
    this.request.respond(
      200, {'Content-Type': 'application/json'}, JSON.stringify({
      })
    );
  });

  it('with bgp and graph pattern in where', function(done) {

    const expectedConstructString = `
    CONSTRUCT {
      <http://testsubject> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://testvalue>.
    }WHERE {
      <http://testsubject> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://testvalue>.
    }
    `.replace(/\s/g, '');

    SparqlUtil.parseQueryAsync(`INSERT {
      $subject a $value.
      GRAPH <http://testgraph>{
        <http://testsubject> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://testtype>.
      }
    } WHERE {
      $subject a $value
    }`).onValue(insertQuery => {
      expect(
        LDP_PERSISTENCE.createFieldConstructQueries(
          insertQuery as SparqlJs.Update,
          [{value: Rdf.iri('http://testvalue')}],
          Rdf.iri('http://testsubject')
        ).map(
          construct => SparqlUtil.serializeQuery(construct).replace(/\s/g, '')
        ).toArray()
      ).to.be.deep.equal([expectedConstructString]);
      done();
    });
    this.request.respond(
      200, {'Content-Type': 'application/json'}, JSON.stringify({
      })
    );
  });

  it('with bgp and graph pattern in insert, and other patterns in where', function(done) {

    const expectedConstructString = `
    CONSTRUCT {
      <http://testsubject> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://testvalue>.
    }WHERE {
      {
        <http://testsubject> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://testvalue>.
        SERVICE<http://testservice>{
          <http://servicesubject> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://servicetype>.
        }
        GRAPH <http://testgraphinwhere>{
          <http://graphsubject> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://graphtype>.
        }
      }UNION{
        <http://unionsubject> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://uniontype>.
      }
    }
    `.replace(/\s/g, '');

    SparqlUtil.parseQueryAsync(`INSERT {
      $subject a $value.
      GRAPH <http://testgraph>{
        <http://testsubject> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://testtype>.
      }
    } WHERE {
      {
        $subject a $value
        SERVICE<http://testservice>{
          <http://servicesubject> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://servicetype>.
        }
        GRAPH <http://testgraphinwhere>{
          <http://graphsubject> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://graphtype>.
        }
      }UNION{
        <http://unionsubject> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://uniontype>.
      }
    }`).onValue(insertQuery => {
      expect(
        LDP_PERSISTENCE.createFieldConstructQueries(
          insertQuery as SparqlJs.Update,
          [{value: Rdf.iri('http://testvalue')}],
          Rdf.iri('http://testsubject')
        ).map(
          construct => SparqlUtil.serializeQuery(construct).replace(/\s/g, '')
        ).toArray()
      ).to.be.deep.equal([expectedConstructString]);
      done();
    });
    this.request.respond(
      200, {'Content-Type': 'application/json'}, JSON.stringify({
      })
    );
  });


  it('with multiple new values', function(done) {

    const expectedConstructString = `
    CONSTRUCT {
      <http://testsubject> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://testvalue>.
    }WHERE {
      <http://testsubject> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://testvalue>.
    }
    `.replace(/\s/g, '');

    const expectedConstructString2 = `
    CONSTRUCT {
      <http://testsubject> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://testvalue2>.
    }WHERE {
      <http://testsubject> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://testvalue2>.
    }
    `.replace(/\s/g, '');

    SparqlUtil.parseQueryAsync('INSERT {$subject a $value} WHERE {$subject a $value}').onValue(insertQuery => {
      expect(
        LDP_PERSISTENCE.createFieldConstructQueries(
          insertQuery as SparqlJs.Update,
          [{value: Rdf.iri('http://testvalue')}, {value: Rdf.iri('http://testvalue2')}],
          Rdf.iri('http://testsubject')
        ).map(
          construct => SparqlUtil.serializeQuery(construct).replace(/\s/g, '')
        ).toArray()
      ).to.be.deep.equal([expectedConstructString, expectedConstructString2]);
      done();
    });
    this.request.respond(
      200, {'Content-Type': 'application/json'}, JSON.stringify({
      })
    );
  });
});
