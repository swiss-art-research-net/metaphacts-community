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
  parseQueryStringAsUpdateOperation,
} from 'platform/components/forms';

describe('parse insert query string and cast into SparqlJs.Update object', () => {
  it('insertPattern is valid insert query string', function () {
    const value = parseQueryStringAsUpdateOperation(`INSERT {
      <http://testsubject> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://testtype>.
    } WHERE {}`);

    const expectedUpdate: SparqlJs.Update = {
      type: 'update',
      prefixes: {},
      updates: [
        {
          updateType: 'insertdelete',
          insert: [
            {
              type: 'bgp',
              triples: [
                {
                  subject: Rdf.iri('http://testsubject'),
                  predicate: Rdf.iri('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                  object: Rdf.iri('http://testtype'),
                },
              ],
            },
          ],
          delete: [],
          where: [],
        },
      ],
    };

    expect(value).to.be.deep.equal(expectedUpdate);
  });

  it('insert is not an insert (i.e. not an update operation)', function () {
    expect(() => {
      parseQueryStringAsUpdateOperation(`SELECT * WHERE { $subject a $value. }`);
    }).to.throw('Specified deletePattern or insertPattern is not an update query.');
  });
});
