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
import { SparqlClient } from 'platform/api/sparql';
import { Rdf } from 'platform/api/rdf';
import { QueryContext } from 'platform/api/sparql';
import * as SparqlDataClient from './sparqlDataClient';
import * as LookupDataClient from './lookupDataClient';

export type DataQuery = SparqlDataClient.SparqlDataQuery | LookupDataClient.LookupDataQuery;

/**
 * This module provides ability to execute and validate queries of
 * different types: SparqlDataQuery, LookupDataQuery.
 * It's expected to have two parameters for input: Query and Arguments.
 * Depending on the type of Query there can be limitations on Arguments.
 * See dedicated queryClient documentation for each type of query.
 * Optionally it's possible to provide execution context for fetching data.
 */

/**
 * Main function of this interface which provides ability to execute queries and return bindings.
 * @param query LookupDataQuery or SparqlDataQuery
 * @param args Set of arguments to parametrize the query
 * @param context (optional) context of the query which defines a target repository etc
 */
export function fetchData(
  query: DataQuery,
  args: { [arg: string]: Rdf.Node },
  context?: QueryContext
): Kefir.Property<SparqlClient.Bindings> {
  const error = validateParameters(query, args);
  if (error) {
    return Kefir.constantError<any>(error);
  }
  switch (query.type) {
    case 'lookup':
      return LookupDataClient.fetchData(query, args);
    case 'sparql':
      return SparqlDataClient.fetchData(query, args, context);
    default:
      return Kefir.constantError<any>(new Error('There is no suitable client for this type of query.'));
  }
}

/**
 * Function to validate queries. Returns a Error if the query is incorrectly
 defined and "undefined" if everything is valid.
 * @param query - LookupDataQuery or SparqlDataQuery
 * @param outputVariables - The list of identifiers of variables which are
 expected to have in the result bindings set
 */
export function validateQuery(
  query: DataQuery,
  outputVariables: string[]
): Error | undefined {
  switch (query.type) {
    case 'lookup':
      return LookupDataClient.validateQuery(query, outputVariables);
    case 'sparql':
      return SparqlDataClient.validateQuery(query, outputVariables);
    default:
      return new Error(`There is no suitable client for this type of query (${(query as any).type}).`);
  }
}

/**
 * Creates query from a sparql string - this method is meant only
 * for backward compatibility.
 * @param sparqlQuery - String sparql query
 * @param defaultParameters - Default dictionary of parameters (see SparqlDataQuery)
 */
export function createClientQuery(
  sparqlQuery: string,
  defaultParameters?: { [variable: string]: SparqlDataClient.SparqlParam }
): DataQuery {
  return typeof sparqlQuery !== 'string' ? sparqlQuery : {
    type: 'sparql',
    query: sparqlQuery,
    params: defaultParameters
  };
}

function validateParameters(
  query: DataQuery,
  args?: { [arg: string]: Rdf.Node }
): Error | undefined {
  switch (query.type) {
    case 'lookup':
      return LookupDataClient.validateParameters(query, args);
    case 'sparql':
      return SparqlDataClient.validateParameters(query, args);
    default:
      return new Error(`There is no suitable client for this type of query (${(query as any).type}).`);
  }
}
