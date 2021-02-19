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
import {
  ReconciliationService, ReconciliationRequest, ReconciliationResponse, ReconciliationCandidate,
} from 'platform/api/services/reconciliation';
import { SparqlClient } from 'platform/api/sparql';
import { Rdf, vocabularies } from 'platform/api/rdf';
import { getPreferredUserLanguage } from 'platform/api/services/language';

const { xsd } = vocabularies;

export const SUBJECT_VARIABLE_NAME = 'subject';
export const TOKEN_VARIABLE_NAME = '__token__';

/**
 * Queries of this type are processed using Reconciliation Service.
 */
export interface LookupDataQuery {
  /**
   * Type of the query. Should be always `lookup` in order to be of a type LookupDataQuery
   */
  type: 'lookup';

  /**
   * Provides a default query term for the case when keyword is not provided via arguments
   */
  defaultTerm?: string;

  /**
   * Tells for how much results we are looking for
   */
  limit?: number;

  /**
   * Filter result by specified entityType. See documentation for Reconciliation API.
   */
  entityType?: string;

  /**
   * Direct query to a specific implementation of the lookup service.
   * If not specified the default lookup service is used.
   */
  lookupServiceName?: string;

  /**
   * Language tag (or comma-separated list of language tags with decreasing order of preference)
   * of the preferred language(s) (optional). A language tag consists of the language and
   * optionally variant, e.g. `de` or `de-CH`.
   * See <a href="https://tools.ietf.org/html/rfc4647">RFC4647</a> for details.
   * Examples: `ru`, `ru,fr-CH,de,en`
   * The default value is the user selected preferred language.
   * So the default language can be changed using dedicated switched in the toolbar
   * (if provided more then one preferred language, otherwise the switch is hidden).
   */
  preferredLanguage?: string;
}

/**
 * @param query - LookupDataQuery - parameter which provides default values for the request.
 * Type defaultTerm is used only when the actual value is not provided via args parameter
 * @param args - Arguments map. It's expected to have only one parameter:
 * __token__ with rdf-literal as value. In case the value is not provided
 * the defaultTerm will be used as value
 * For lookup quires there is number of limitations:
 * 1) Keyword in the arguments for the search should be passed
 * via __token__ variable and should be an rdf-literal
 * 2) For using lookupClient with UI components in some cases should be
 * configure in advance, to be able to provide exactly "__token__" variable
 * via arguments and then correctly process bindings where
 * the valueBindingName is "subject" because as output of fetchData
 * function it's expected to have list of SPARQL-bindings
 * @returns Array of {
 *  subject: Rdf.iri,
 *  label: Rdf.literal[string],
 *  score: Rdf.literal[number],
 *  match: Rdf.literal[boolean],
 *  type: (optional) Rdf.iri,
 *  typeLabel: (optional) Rdf.literal[string],
 *  datasetId: (optional) Rdf.iri,
 *  datasetLabel: (optional) Rdf.literal[string]
 *  description: (optional) Rdf.literal[string]
 * }
 */
export function fetchData(
  query: LookupDataQuery,
  args: { [arg: string]: Rdf.Node }
): Kefir.Property<SparqlClient.Bindings> {
  const reconciliationRequest = makeReconciliationRequest(query, args);
  return ReconciliationService.reconcile(
    reconciliationRequest,
    query.lookupServiceName
  ).map(response => {
    return responseToSparqlBindings(response, query);
  });
}

export function validateQuery(
  query: LookupDataQuery, outputVariables: string[]
): Error | undefined {
  if (outputVariables.length !== 1 || outputVariables[0] !== SUBJECT_VARIABLE_NAME) {
    return new Error(
      `The only possible output variable for lookupClient is "${SUBJECT_VARIABLE_NAME}", ` +
      `but "${
        outputVariables && outputVariables.length > 0 ? outputVariables[0] : 'none'
      }" is provided.`
    );
  }

  const termType = typeof query.defaultTerm;
  if (query.defaultTerm && termType !== 'string') {
    return new Error(`Query term should be a string, but provided: ${termType}`);
  }

  const limitType = typeof query.limit;
  if (query.limit && limitType !== 'number') {
    return new Error(
      `Limit term should be a positive number, but provided: ${limitType}`
    );
  }

  const entityTypeType = typeof query.entityType;
  if (query.entityType && entityTypeType !== 'string') {
    return new Error(`Query term should be a string, but provided: ${entityTypeType}`);
  }
}

export function validateParameters(
  query: LookupDataQuery, args?: { [arg: string]: Rdf.Node }
): Error | undefined {
  const entityTypeType = typeof query.entityType;
  if (query.entityType && entityTypeType !== 'string') {
    return new Error(`Query term should be a string, but provided: ${entityTypeType}`);
  }

  if (args && !(args[TOKEN_VARIABLE_NAME] || query.defaultTerm)) {
    return new Error('Neither "__token__" argument nor defaultTerm parameter were provided');
  }

  if (args && args[TOKEN_VARIABLE_NAME] && !Rdf.isLiteral(args[TOKEN_VARIABLE_NAME])) {
    return new Error('Token should be rdf-literal');
  }
}

function makeReconciliationRequest(
  lookupDataQuery: LookupDataQuery,
  args: { [arg: string]: Rdf.Node }
): ReconciliationRequest {
  const query = args && args[TOKEN_VARIABLE_NAME] ?
    args[TOKEN_VARIABLE_NAME].value : lookupDataQuery.defaultTerm;

  if (args && !args[TOKEN_VARIABLE_NAME]) {
    console.warn(`Arguments list doesn't contain ${
      TOKEN_VARIABLE_NAME
    }, the defaultTerm value will be used.`);
  }

  return {
    q0: {
      query,
      limit: lookupDataQuery.limit,
      type: lookupDataQuery.entityType,
      preferredLanguage: lookupDataQuery.preferredLanguage ?? getPreferredUserLanguage(),
    }
  };
}

function responseToSparqlBindings(
  response: ReconciliationResponse,
  query: LookupDataQuery
): SparqlClient.Bindings {
  const bindings: {[id: string]: Rdf.Node}[] = [];
  const allCandidates = getAllCandidatesFromResponse(response);
  allCandidates.sort(compareByScore);
  for (const candidate of allCandidates) {
    /**
     * TODO: Use rdf-graphs
     * It's essential to use RDF-graph instead of
     * sparql-bindings! In other way we do we loose data,
     * because we cant provided array of types
     */
    const types = candidate.type || [];
    let indexToSelect = 0;
    if (query.entityType) {
      const targetIndex = types.map(t => t.id).indexOf(query.entityType);
      indexToSelect = targetIndex !== -1 ? targetIndex : indexToSelect;
    }
    const entityType = types[indexToSelect];
    const binding: SparqlClient.Binding = {
      [SUBJECT_VARIABLE_NAME]: Rdf.iri(candidate.id),
      label: Rdf.literal(candidate.name, xsd._string),
      type: entityType ? Rdf.iri(entityType.id) : undefined,
      typeLabel: entityType ? Rdf.literal(entityType.name) : undefined,
      score: Rdf.literal(`${candidate.score}`, xsd.double),
      match: Rdf.literal(`${candidate.match}`, xsd.boolean),
      datasetId: candidate.dataset ? Rdf.iri(candidate.dataset.id) : undefined,
      datasetLabel: candidate.dataset ? Rdf.literal(candidate.dataset.name) : undefined,
      description: candidate.description ? Rdf.literal(candidate.description) : undefined,
    };
    bindings.push(binding);
  }
  return bindings;
}

function getAllCandidatesFromResponse(response: ReconciliationResponse) {
  const allCandidates: ReconciliationCandidate[] = [];
  for (const respId in response) {
    if (response.hasOwnProperty(respId)) {
      const candidates = response[respId].result;
      for (const candidate of candidates) {
        allCandidates.push(candidate);
      }
    }
  }
  return allCandidates;
}

function compareByScore(a: ReconciliationCandidate, b: ReconciliationCandidate) {
  if (a.score < b.score) {
    return 1;
  } else if (a.score > b.score) {
    return -1;
  } else {
    return 0;
  }
}
