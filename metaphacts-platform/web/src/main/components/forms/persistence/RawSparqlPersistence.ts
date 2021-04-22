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
import * as Immutable from 'immutable';
import * as Kefir from 'kefir';
import * as SparqlJs from 'sparqljs';

import { Rdf } from 'platform/api/rdf';
import { SparqlClient, SparqlUtil, SparqlTypeGuards, cloneQuery } from 'platform/api/sparql';

import { CompositeValue, EmptyValue } from '../FieldValues';
import { parseQueryStringAsUpdateOperation } from './PersistenceUtils';
import { TriplestorePersistence, computeModelDiff } from './TriplestorePersistence';

/**
 * SPARQL persistence with options to specify the repository and named graphs.
 *
 * The SPARQL queries are executed against the regular `/sparql` endpoint
 * and require corresponding permissions for the user.
 *
 * Optionally an `insertGraph` and a `deleteGraph` can be specified which are
 * injected into the SPARQL UPDATE queries. If none are provided, data is written
 * as specified through the queries in the field definitions.
 *
 * Example:
 * ```
 * persistence='{
 *   "type": "client-side-sparql",
 *   "insertGraph": "http://www.example.com/customNamedGraph",
 *   "deleteGraph": "http://www.example.com/customNamedGraph"
 * }'
 * ```
 */
export interface RawSparqlPersistenceConfig {
  type: 'client-side-sparql';
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

export class RawSparqlPersistence implements TriplestorePersistence {
  constructor(private config: RawSparqlPersistenceConfig = {type: 'client-side-sparql'}) {}

  persist(
    initialModel: CompositeValue | EmptyValue,
    currentModel: CompositeValue | EmptyValue
  ): Kefir.Property<void> {
    const {insertGraph, deleteGraph} = this.config;
    const updateQueries = RawSparqlPersistence.createFormUpdateQueries(initialModel, currentModel);
    if (updateQueries.size === 0) {
      return Kefir.constant<void>(undefined);
    }
    updateQueries.forEach(query => {
      console.log(SparqlUtil.serializeQuery(query));
    });
    const {repository = 'default'} = this.config;
    const context: SparqlClient.QueryContext = {repository};
    const updateOperations = Kefir.zip<void>(updateQueries.map(update => {
      const query = setDefaultGraphForUpdate(update, insertGraph, deleteGraph);
      return SparqlClient.executeSparqlUpdate(query, {context});
    }).toArray());
    return updateOperations.map(() => {/* void */}).toProperty();
  }

  static createFormUpdateQueries(
    initialModel: CompositeValue | EmptyValue,
    currentModel: CompositeValue | EmptyValue
  ): Immutable.List<SparqlJs.Update> {
    const entries = computeModelDiff(initialModel, currentModel);
    return Immutable.List(entries)
      .filter(({definition}) => Boolean(definition.insertPattern && definition.deletePattern))
      .map(({definition, subject, inserted, deleted}) => {
        const deleteQuery = parseQueryStringAsUpdateOperation(definition.deletePattern);
        const insertQuery = parseQueryStringAsUpdateOperation(definition.insertPattern);
        return createFieldUpdateQueries(subject, deleteQuery, insertQuery, inserted, deleted);
      }).filter(update => update.size > 0).flatten().toList();
  }
}

function createFieldUpdateQueries(
  subject: Rdf.Iri,
  deleteQuery: SparqlJs.Update | undefined,
  insertQuery: SparqlJs.Update | undefined,
  inserted: ReadonlyArray<{ value: Rdf.Node; index?: Rdf.Literal }>,
  deleted: ReadonlyArray<Rdf.Node>
): Immutable.List<SparqlJs.Update> {
  let queries = Immutable.List<SparqlJs.Update>();

  if (deleted.length === 0 && inserted.length === 0) {
    return queries;
  }

  const parametrizeInsert =
    (query: SparqlJs.Update, value: { value: Rdf.Node; index?: Rdf.Literal }) =>
      SparqlClient.setBindings(query, {
        'subject': subject,
        'value': value.value,
        'index': value.index,
      });
  const parametrizeDelete = (query: SparqlJs.Update, value: Rdf.Node) =>
    SparqlClient.setBindings(query, {
      'subject': subject,
      'value': value,
    });

  if (deleteQuery) {
    queries = queries.concat(
      deleted.map(value => parametrizeDelete(deleteQuery, value)));
  }
  if (insertQuery) {
    queries = queries.concat(
      inserted.map(value => parametrizeInsert(insertQuery, value)));
  }
  return queries;
}

export function setDefaultGraphForUpdate(
  update: SparqlJs.Update,
  insertGraph: string | undefined,
  deleteGraph: string | undefined
) {
  if (!(typeof insertGraph === 'string' || typeof deleteGraph === 'string')) {
    return update;
  }
  const clone = cloneQuery(update);
  for (const operation of clone.updates) {
    if (!SparqlTypeGuards.isInsertDeleteOperation(operation)) {
      continue;
    }
    if (operation.insert && typeof insertGraph === 'string') {
      setDefaultGraphForQuads(operation.insert, Rdf.iri(insertGraph));
    }
    if (operation.delete && typeof deleteGraph === 'string') {
      setDefaultGraphForQuads(operation.delete, Rdf.iri(deleteGraph));
    }
  }
  return clone;
}

function setDefaultGraphForQuads(blocks: SparqlJs.Quads[], targetGraph: SparqlJs.IriTerm): void {
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.type === 'bgp') {
      blocks[i] = {
        type: 'graph',
        name: targetGraph,
        triples: block.triples,
      };
    }
  }
}
