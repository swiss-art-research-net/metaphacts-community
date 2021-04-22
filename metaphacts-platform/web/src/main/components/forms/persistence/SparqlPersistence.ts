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
import * as Kefir from 'kefir';
import * as request from 'platform/api/http';
import * as Immutable from 'immutable';

import { SparqlUtil } from 'platform/api/sparql';

import { CompositeValue, EmptyValue } from '../FieldValues';
import { RawSparqlPersistence, setDefaultGraphForUpdate } from './RawSparqlPersistence';
import { TriplestorePersistence } from './TriplestorePersistence';

/**
 * SPARQL persistence with options to specify the repository and named graphs.
 *
 * The SPARQL queries are executed against the Form SPARQL endpoint
 * and require permissions on forms for the user.
 *
 * Optionally an `insertGraph` and a `deleteGraph` can be specified which are
 * injected into the SPARQL UPDATE queries. If none are provided, data is written
 * as specified through the queries in the field definitions.
 *
 * Example:
 * ```
 * persistence='{
 *   "type": "sparql",
 *   "insertGraph": "http://www.example.com/customNamedGraph",
 *   "deleteGraph": "http://www.example.com/customNamedGraph"
 * }'
 * ```
 */
export interface SparqlPersistenceConfig {
  type: 'sparql';
  /**
   * ID of the repository in which the data should be updated.
   */
  repository?: string;
  /**
   * IRI of named graph used for INSERT queries. Specifying this modifies the INSERT queries
   * to wrap the statements in a `GRAPH` block.
   */
  insertGraph?: string;
  /**
   * IRI of named graph used for DELETE queries. Specifying this modifies the DELETE queries
   * to wrap the statements in a `GRAPH` block.
   */
  deleteGraph?: string;
}

export class SparqlPersistence implements TriplestorePersistence {
  constructor(private config: SparqlPersistenceConfig = {type: 'sparql'}) {}

  persist(
    initialModel: CompositeValue | EmptyValue,
    currentModel: CompositeValue | EmptyValue
  ): Kefir.Property<void> {
    const {insertGraph, deleteGraph} = this.config;
    const updateQueries = RawSparqlPersistence.createFormUpdateQueries(initialModel, currentModel);
    const stringQueries = Immutable.List(updateQueries)
      .map(update => setDefaultGraphForUpdate(update, insertGraph, deleteGraph))
      .map(SparqlUtil.serializeQuery)
      .toArray();

    const {repository = 'default'} = this.config;
    const req = request
      .post('/form-persistence/sparql')
      .type('application/json')
      .query({repository})
      .send(stringQueries);
    return Kefir.fromNodeCallback<void>(
        (cb) => req.end((err, res) => cb(err, res.body))
    ).toProperty();
  }
}
