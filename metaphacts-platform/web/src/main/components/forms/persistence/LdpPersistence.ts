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
import { cloneDeep } from 'lodash';
import * as SparqlJs from 'sparqljs';

import { requestAsProperty } from 'platform/api/async';
import * as request from 'platform/api/http';
import { Rdf } from 'platform/api/rdf';
import { SparqlClient, SparqlUtil } from 'platform/api/sparql';

import { FieldValue, CompositeValue, EmptyValue } from '../FieldValues';
import { parseQueryStringAsUpdateOperation } from './PersistenceUtils';
import { TriplestorePersistence, ModelDiffEntry, computeModelDiff } from './TriplestorePersistence';

/**
 * LDP persistence with options to specify the repository and container.
 *
 * Example:
 * ```
 * persistence='{
 *   "type": "ldp",
 *   "containerIri": "http://www.example.com/customContainer"
 * }'
 * ```
 */
export interface LdpPersistenceConfig {
  type: 'ldp';
  /**
   * (Optional) ID of the repository in which the data should be updated.
   */
  repository?: string;
  /**
   * IRI of the LDP container to use for persistence.
  */
  containerIri?: string;
}

export class LdpPersistence implements TriplestorePersistence {
  constructor(private config: LdpPersistenceConfig = {type: 'ldp'}) {}

  persist(
    initialModel: CompositeValue | EmptyValue,
    currentModel: CompositeValue | EmptyValue,
  ): Kefir.Property<void> {
    if (FieldValue.isEmpty(currentModel)) {
      if (FieldValue.isEmpty(initialModel) || CompositeValue.isPlaceholder(initialModel.subject)) {
        // nothing has changed
        return Kefir.constant<void>(undefined);
      } else {
        // subject has been deleted
        return this.deleteSubjectContainer(initialModel.subject);
      }
    } else {
      // subject has changed
      const updates = computeModelDiff(FieldValue.empty, currentModel);
      return this.persistModelUpdates(currentModel.subject, updates);
    }
  }

  persistModelUpdates(subject: Rdf.Iri, updates: ModelDiffEntry[]) {
    const listOfConstructs = this.createFormConstructQueries(updates);
    return this.sendConstructsToBackend(subject, listOfConstructs.toArray());
  }

  private createFormConstructQueries(
    entries: ModelDiffEntry[]
  ): Immutable.List<SparqlJs.ConstructQuery> {
    return Immutable.List(entries
      .filter(entry => entry.definition.insertPattern)
      .map(entry => {
        const insertQuery = parseQueryStringAsUpdateOperation(entry.definition.insertPattern);
        return this.createFieldConstructQueries(
          insertQuery,
          entry.inserted,
          entry.subject,
        );
      })
    ).filter(updates => updates.size > 0).flatten().toList();
  }

  /**
   * Takes an SPARQL insert query and turns it into an construct query.
   * The query will be parameterize as many times as number of newValues (will parameterize $value),
   * producing a list of SPARQL construct queries. All queries will be
   * additionally parameterized by the supplied $subject value.
   */
  createFieldConstructQueries(
    insertQuery: SparqlJs.Update | undefined,
    newValues: ReadonlyArray<{ value: Rdf.Node; index?: Rdf.Literal }>,
    subject: Rdf.Iri
  ): Immutable.List<SparqlJs.ConstructQuery> {

    let constructQueries = Immutable.List<SparqlJs.ConstructQuery>();
    if (!insertQuery) {
      return constructQueries;
    }

    const constructQuery: SparqlJs.ConstructQuery = {
      type: 'query',
      prefixes: {},
      queryType: 'CONSTRUCT',
    };

    const insertDeleteOperations = (<SparqlJs.InsertDeleteOperation[]> insertQuery.updates);

    // According to the SPARQL standard there can be several update operations
    // separated by ; i.e. INSERT {} WHERER{}; INSERT {} WHERER{}
    // However, in forms we always expect a single operation i.e. INSERT clause
    if ( insertDeleteOperations.length !== 1 ) {
      // TODO error handling here ?
      return constructQueries;
    }

    const updateOperation = insertDeleteOperations.pop();

    // TODO silently filtering, logging, error ?
    constructQuery.template = updateOperation.insert.filter(
      // first filter all bgp patters i.e. insert may also be SparqlJs.GraphPattern
      // which is not supported in template of SparqlJs.ConstructQuery
      p => p.type === 'bgp'
    ).reduce(
      (ar: SparqlJs.Triple[], p) =>
        ar.concat(cloneDeep(<SparqlJs.BgpPattern>p).triples), new Array<SparqlJs.Triple>()
    );

    // clone the where part from the insert query to the construct query
    constructQuery.where = cloneDeep(updateOperation.where);

    // parameterization of $subject and $value
    const paramterize = (
      query: SparqlJs.ConstructQuery, value: { value: Rdf.Node; index?: Rdf.Literal }
    ) =>
      SparqlClient.setBindings(query, {
        'subject': subject,
        'value': value.value,
        'index': value.index,
      });

    if (constructQuery) {
      constructQueries = constructQueries.concat(
        newValues.map(value => paramterize(constructQuery, value))
      );
    }
    return constructQueries;
  }

  sendConstructsToBackend(
    subject: Rdf.Iri, queries: SparqlJs.ConstructQuery[]
  ): Kefir.Property<void> {
    // convert the array of SparqlJs.Update objects to plain strings
    const stringQueries: string [] = queries.map(SparqlUtil.serializeQuery);

    const req = request
      .post('/form-persistence/ldp')
      .type('application/json')
      .query({
        iri: this.getTargetLdpResource(subject),
        repository: this.getTargetRepository(),
      })
      .send(stringQueries);

    return requestAsProperty(req).map(() => {});
  }

  private deleteSubjectContainer(subject: Rdf.Iri) {
    const req = request
      .delete('/form-persistence/ldp')
      .type('application/json')
      .query({
        iri: this.getTargetLdpResource(subject),
        repository: this.getTargetRepository(),
      })
      .send();

    return requestAsProperty(req).map(() => {});
  }

  private getTargetLdpResource(subject: Rdf.Iri) {
    const {containerIri} = this.config;
    return containerIri ? containerIri : `${subject.value}/container`;
  }

  private getTargetRepository() {
    const {repository = 'default'} = this.config;
    return repository;
  }
}
