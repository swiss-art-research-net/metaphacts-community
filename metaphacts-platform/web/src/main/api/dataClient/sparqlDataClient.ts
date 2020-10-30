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
import * as SparqlJs from 'sparqljs';

import { Rdf, vocabularies } from 'platform/api/rdf';
import { SparqlClient, QueryContext, SparqlUtil, SparqlTypeGuards } from 'platform/api/sparql';
import { isQuery, isSelectQuery } from 'platform/api/sparql/TypeGuards';

const { xsd } = vocabularies;

/**
 * Defines a binding input parameters, tells if the parameter is optional or not and what datatype the parameter should have.
 */
interface BindSparqlParam {
  /**
   * Defines the type of parameter
   */
  type: 'bind';

  /**
   * Tells whether the token is required parameter or not
   */
  required?: boolean;

  /**
   * Defines xsd datatype of the parameter
   */
  datatype?: string;
}

/**
 * Defines a token input parameters and tells whether it should be escaped and tokenized or not.
 * Also here it's possible to specify if the parameter is optional or not.
 * It's expected that token alway of <code>Literal^^xsd:string</code> type.
 */
interface TokenSparqlParam {
  /**
   * Defines the type of parameter
   */
  type: 'token';

  /**
   * Tells whether the token is required parameter or not
   */
  required?: boolean;

  /**
   * Tells whether SparqlClient should escape the search string or not.
   *
   * Deprecated: escaping will be applied automatically based on SPARQL query.
   *
   * @deprecated Escaping will be applied automatically based on SPARQL query.
   */
  escapeLuceneSyntax?: boolean;

  /**
   * Tells whether SparqlClient should tokenize lucene query or not.
   *
   * Deprecated: tokenization will be applied automatically based on SPARQL query.
   *
   * @deprecated Tokenization will be applied automatically based on SPARQL query.
   */
  tokenizeLuceneQuery?: boolean;
}

export type SparqlParam = TokenSparqlParam | BindSparqlParam;

/**
 * Queries of this types are processed using SparqlClient the same way as ordinary SPARQL queries.
 */
export interface SparqlDataQuery {
  /**
   * Type of the query. Should be always "<b>sparql</b>" in order to be of a type SparqlQuery
   */
  type: 'sparql';

  /**
   * SPARQL <b>SELECT</b> query
   */
  query: string;

  /**
   * Dictionary of input parameters where for each defined input variable there is a corresponding definition.
   * The definition can be one of two types <code>TokenSparqlParam</code> or <code>BindSparqlParam</code>.
   */
  params?: { [variable: string]: SparqlParam };
}

/**
 * Note: The Query to execute contains SparqlQuery output variables
 * of each should match input parameters of a component to work with.
 */
export function fetchData(
  query: SparqlDataQuery, args: { [arg: string]: Rdf.Node }, context?: QueryContext
): Kefir.Property<SparqlClient.Bindings> {
  const sparqlQuery = SparqlUtil.parseQuerySync(query.query) as SparqlJs.SelectQuery;
  const queryWithToken = bindArguments(sparqlQuery, query.params, args);
  return SparqlClient.select(queryWithToken, {context}).map(response => response.results.bindings);
}

export function validateQuery(
  query: SparqlDataQuery, outputVariables: string[]
): Error | undefined {
  try {
    const sparqlQuery = SparqlUtil.parseQuerySync(query.query);
    if (isQuery(sparqlQuery) && isSelectQuery(sparqlQuery)) {
      if (SparqlTypeGuards.isStarProjection(sparqlQuery.variables)) {
        return new Error('You can\'t use \'*\' as output variable.');
      }
      const variables = sparqlQuery.variables
        .map(v => (SparqlTypeGuards.isVariable(v) ? v : v.variable).value);
      const notMatchedVariables = outputVariables.
        filter(variable => variables.indexOf(variable) === -1);

      if (notMatchedVariables.length !== 0) {
        return new Error(
          'Query configuration is not valid:\n' +
          'The query must contain the following variables as ' +
          'projection variables: ' + notMatchedVariables.join(', ') + '.'
        );
      }
    } else {
      return new Error('This query is not a valid SPARQL-select query.');
    }
  } catch (e) {
    return e;
  }
}

export function validateParameters(
  query: SparqlDataQuery, args?: { [arg: string]: Rdf.Node }
): Error | undefined {
  for (const variable of Object.keys(query.params || {})) {
    if (!variable) { continue; }

    const parameter = query.params[variable];
    if (parameter.type !== 'bind' && parameter.type !== 'token') {
      return new Error(`Unknown type of the parameter ${variable}: ${(parameter as any).type}`);
    }

    const value = args ? args[variable] : undefined;
    if (args && Boolean(parameter.required) && !value) {
      return new Error(`${variable} is required but not provided.`);
    }
    if (value) {
      switch (parameter.type) {
        case 'token': {
          if (!Rdf.isLiteral(value)) {
            return new Error(`${variable} being of a type 'token' should be rdf-literal.`);
          }
          if (!value.datatype.equals(xsd._string)) {
            return new Error(`Datatype of ${variable} should be xsd:string but ${value.datatype} is provided.`);
          }
          break;
        }
        case 'bind': {
          if (parameter.datatype && (
            Rdf.isIri(value) && parameter.datatype !== xsd.anyURI.value ||
            Rdf.isLiteral(value) && value.datatype.value !== parameter.datatype
          )) {
            return new Error(`${variable} should be of a following type: ${parameter.datatype}.`);
          }
          break;
        }
      }
    }
  }

  if (args) {
    if (!query.params) {
      return new Error('Query parameters are not defined, but provided.');
    }
    for (const key in args) {
      if (args.hasOwnProperty(key) && !query.params[key]) {
        return new Error(`Query parameter '${key}:${args[key]}' is provided, but not defined in the 'params' section.`);
      }
    }
  }
}

function bindArguments(
  targetQuery: SparqlJs.SelectQuery,
  params: { [variable: string]: SparqlParam },
  args: { [arg: string]: Rdf.Node }
) {
  const result: { [arg: string]: Rdf.Node } = {};
  for (const arg in args) {
    if (!Object.prototype.hasOwnProperty.call(args, arg)) { continue; }
    const value = args[arg];
    if (Rdf.isLiteral(value) && params[arg] && params[arg].type === 'token') {
      // tslint:disable-next-line: deprecation
      const {escapeLuceneSyntax, tokenizeLuceneQuery} = params[arg] as TokenSparqlParam;
      const defaults = SparqlUtil.findTokenizationDefaults(targetQuery.where, arg);
      const escapedValue = SparqlUtil.makeLuceneQuery(
        value.value,
        escapeLuceneSyntax ?? defaults.escapeLucene,
        tokenizeLuceneQuery ?? defaults.tokenize
      );
      result[arg] = escapedValue;
    } else {
      result[arg] = value;
    }
  }
  return SparqlClient.setBindings(targetQuery, result);
}
