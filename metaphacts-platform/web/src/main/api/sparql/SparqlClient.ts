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
import * as assign from 'object-assign';
import * as Kefir from 'kefir';
import * as _ from 'lodash';
import * as SparqlJs from 'sparqljs';
import * as URI from 'urijs';

import { serializeQuery, parseQuerySync } from './SparqlUtil';
import { cloneQuery } from './QueryVisitor';
import { VariableBinder, TextBinder } from './QueryBinder';
import * as turtle from '../rdf/formats/turtle';
import * as Rdf from '../rdf/core/Rdf';
import * as request from 'platform/api/http';
import { requestAsProperty } from 'platform/api/async';

/*
 * Javascript client for SPARQL 1.1 endpoint.
 * http://www.w3.org/TR/sparql11-protocol/
 */

/**
 * SPARQL protocol operations.
 *
 * @see {@link http://www.w3.org/TR/sparql11-protocol/#protocol}
 */
export enum SparqlOperationType {
  QUERY, UPDATE,
}

/**
 * Supported SPARQL query forms.
 *
 * @see {@link http://www.w3.org/TR/sparql11-query/#QueryForms}
 */
export type SparqlQueryForm = 'SELECT' | 'CONSTRUCT' | 'ASK' | 'DESCRIBE';

const SPARQL_RESULTS_JSON_FORMAT = 'application/sparql-results+json';
const SPARQL_STAR_RESULTS_JSON_FORMAT = 'application/x-sparqlstar-results+json';
const TURTLE_STAR_FORMAT = 'application/x-turtlestar';

export function getDefaultQueryResultAcceptFormat(queryForm: SparqlQueryForm): string {
  switch (queryForm) {
    case 'SELECT':
    case 'ASK':
      return SPARQL_RESULTS_JSON_FORMAT;
    case 'CONSTRUCT':
    case 'DESCRIBE':
      return TURTLE_STAR_FORMAT;
  }
  throw new Error(`Unknown SPARQL query form: "${queryForm}"`);
}

export interface Dictionary<T> {
  [index: string]: T;
}

export interface SparqlSelectJsonResult {
  head: {
    link: any[];
    vars: string[];
  };
  results: {
    bindings: Dictionary<SparqlJsonTerm>[];
    distinct: boolean;
    ordered: boolean;
  }
}

type SparqlJsonTerm = SparqlJsonIri | SparqlJsonBlank | SparqlJsonLiteral | SparqlJsonTriple;

interface SparqlJsonIri {
  type: 'uri';
  value: string;
}

interface SparqlJsonBlank {
  type: 'bnode';
  value: string;
}

interface SparqlJsonLiteral {
  type: 'literal';
  value: string;
  datatype?: string;
  'xml:lang': string;
}

/** SPARQL* triple in rdf4j-specific format. */
interface SparqlJsonTriple {
  type: 'triple';
  value: {
    s: SparqlJsonTerm;
    p: SparqlJsonTerm;
    o: SparqlJsonTerm;
    g?: SparqlJsonTerm;
  }
}

export type Binding<T = Rdf.Node> = { readonly [bindingName: string]: T };
export type Bindings<T = Rdf.Node> = ReadonlyArray<Binding<T>>;

export interface SparqlSelectResult<T = Rdf.Node> {
  head: {
    link: any[];
    vars: string[];
  };
  results: {
    bindings: Bindings<T>;
    distinct: boolean;
    ordered: boolean;
  }
}

export type StarBinding = Binding<Rdf.Node | Rdf.Quad>;
export type StarBindings = Bindings<Rdf.Node | Rdf.Quad>;
export type SparqlStarSelectResult = SparqlSelectResult<Rdf.Node | Rdf.Quad>;

export type Parameters = ReadonlyArray<Dictionary<Rdf.Node>>;

/**
 * Parametrize query using VALUES clause.
 *
 * Example:
 * query = SELECT ?p WHERE {?s ?p ?o}
 * parameters = [{'p': <example>}, {'p': <example2>}]
 * result = SELECT ?p WHERE {?s ?p ?o . VALUES(?p) { (<example>) (<example2>) }}
 */
export function prepareQuery(
  query: string , parameters: Parameters
): Kefir.Property<SparqlJs.SparqlQuery> {
  return Kefir.constant(parseQuerySync<SparqlJs.Query>(query)).map(prepareParsedQuery(parameters));
}

export function prepareParsedQuery(parameters: Parameters) {
  return <TQuery extends SparqlJs.Query>(query: TQuery): TQuery => {
    const values = serializeParameters(parameters);
    if (_.isEmpty(values) === false) {
      const queryCopy = _.cloneDeep(query);
      // When query has no where clause we need to add empty one.
      // This can happen in case of simple construct query.
      queryCopy.where = queryCopy.where ? queryCopy.where : [];
      queryCopy.where.unshift({
        type: 'values',
        values: values,
      });
      return queryCopy;
    } else {
      return query;
    }
  };
}

export function prependValuesClause(patterns: SparqlJs.Pattern[], parameters: Parameters): void {
  const values = serializeParameters(parameters);
  if (!_.isEmpty(values)) {
    patterns.unshift({type: 'values', values});
  }
}

function serializeParameters(parameters: Parameters) {
  return _.map(parameters, tuple =>
    _.reduce(tuple, (acc, v, k) => {
      if (v) {
        if (Rdf.isBnode(v)) {
          throw new Error('Cannot parametrize VALUES block with blank node');
        }
        acc['?' + k] = v;
      } else {
        acc['?' + k] = undefined;
      }
      return acc;
    }, {} as Dictionary<SparqlJs.IriTerm | SparqlJs.LiteralTerm | undefined>)
  );
}

/**
 * Parametrize query by replacing variables or IRIs.
 *
 * @example
 * setBindings(
 *   parseQuery('SELECT * WHERE { ?s ?p <my:obj> }'),
 *   { 'p': Rdf.iri('my:iri'), 'my:obj': Rdf.literal('my_literal') })
 * === parseQuery('SELECT * WHERE { ?s <my:iri> "my_literal"^^xsd:string }')
 */
export function setBindings<TQuery extends SparqlJs.SparqlQuery>(
  query: TQuery,
  parameters: Dictionary<Rdf.Node>
): TQuery {
  const queryCopy = cloneQuery(query);
  new VariableBinder(parameters).sparqlQuery(queryCopy);
  return queryCopy;
}

/**
 * Parametrize query by applying specified RegExp to its literals.
 *
 * @example
 * setTextBindings(
 *   parseQuery('SELECT * WHERE { ?s ?p "text TOKEN othertext" }'),
 *   [{test: /TOKEN/, replace: 'replacement' })
 * === parseQuery('SELECT * WHERE { ?s ?p "text replacement othertext" }')
 */
export function setTextBindings<TQuery extends SparqlJs.SparqlQuery>(
  query: TQuery, replacements: Array<{ test: RegExp, replace: string }>
) {
  const queryCopy = cloneQuery(query);
  new TextBinder(replacements).sparqlQuery(queryCopy);
  return queryCopy;
}

export interface SparqlOptions {
  endpoint?: string;
  context?: QueryContext;
}

export interface QueryContext {
  readonly repository?: string;
  readonly bindings?: SparqlContext;

  readonly defaultGraphs?: Array<string>;
  readonly namedGraphs?: Array<string>;

  /**
   * True if the context is a default one and has not been overwritten.
   */
  readonly isDefault?: boolean;
}

export interface SparqlContext {
  [binding: string]: Rdf.Node;
}

export function construct(
  query: string | SparqlJs.SparqlQuery, options?: SparqlOptions
): Kefir.Property<Rdf.Quad[]> {
  return graphQuery(query, true, options);
}

export function describe(
  query: string | SparqlJs.SparqlQuery, options?: SparqlOptions
): Kefir.Property<Rdf.Quad[]> {
  return graphQuery(query, false, options);
}

export function select(
  query: string | SparqlJs.SparqlQuery, options?: SparqlOptions
): Kefir.Property<SparqlSelectResult> {
  return sendSparqlQuery(query, SPARQL_RESULTS_JSON_FORMAT, options).map(res => {
    const selectJson = <SparqlSelectJsonResult>JSON.parse(res);
    // TODO: return more concrete SPARQL* result in the future
    // (currently is causes too many type errors otherwise)
    return sparqlJsonToSelectResult(selectJson) as SparqlSelectResult;
  });
}

export function selectStar(
  query: string | SparqlJs.SparqlQuery, options?: SparqlOptions
): Kefir.Property<SparqlStarSelectResult> {
  return sendSparqlQuery(query, SPARQL_STAR_RESULTS_JSON_FORMAT, options).map(res => {
    const selectJson = <SparqlSelectJsonResult>JSON.parse(res);
    return sparqlJsonToSelectResult(selectJson);
  });
}

export function sparqlJsonToSelectResult(
  selectJson: SparqlSelectJsonResult
): SparqlStarSelectResult {
  const bindings = _.map(
    selectJson.results.bindings,
    binding => _.mapValues(binding, sparqlSelectBindingValueToRdf));
  return {
    head: selectJson.head,
    results: {
      bindings: bindings,
      distinct: selectJson.results.distinct,
      ordered: selectJson.results.ordered,
    },
  };
}

export function ask(
  query: string | SparqlJs.SparqlQuery, options?: SparqlOptions
): Kefir.Property<boolean> {
  return sendSparqlQuery(query, SPARQL_RESULTS_JSON_FORMAT, options)
    .map(res => JSON.parse(res)['boolean']);
}

function graphQuery(
  query: string | SparqlJs.SparqlQuery, isConstruct: boolean, options?: SparqlOptions
) {
  return sendSparqlQuery(
    query, TURTLE_STAR_FORMAT, options
  ).flatMap(
    turtle.deserialize.turtleToTriples
  ).toProperty();
}

export function sendSparqlQuery(
  query: string | SparqlJs.SparqlQuery, acceptFormat: string, options: SparqlOptions = {}
) {
  const {endpoint, context} = options;
  return sparqlQueryRequest({
    query,
    endpoint,
    headers: {'Accept': acceptFormat},
    context,
  });
}

export function sparqlQueryRequest(params: {
  query: string | SparqlJs.SparqlQuery;
  endpoint: string;
  headers: { [header: string]: string };
  context: QueryContext;
}): Kefir.Property<string> {
  const {query, endpoint = '/sparql', headers, context = {}} = params;

  let parametrizedEndpoint = new URI(endpoint);
  if (context.repository) {
    parametrizedEndpoint.addQuery({repository: context.repository});
  }
  if (context.defaultGraphs) {
    parametrizedEndpoint.addQuery({'default-graph-uri': context.defaultGraphs});
  }
  if (context.namedGraphs) {
    parametrizedEndpoint.addQuery({'named-graph-uri': context.namedGraphs});
  }
  let parsedQuery: SparqlJs.SparqlQuery;
  try {
    parsedQuery = typeof query === 'string' ? parseQuerySync(query) : query;
  } catch (e) {
    return Kefir.constantError(e);
  }
  const queryWithContext = context.bindings
    ? setBindings(parsedQuery, context.bindings) : parsedQuery;
  const preparedQuery = serializeQuery(queryWithContext);

  const header = assign({
    'Content-Type': 'application/sparql-query; charset=utf-8',
  }, headers);

  const req =
    request.post(parametrizedEndpoint.toString()).send(preparedQuery).set(header);
  return requestAsProperty(req).map(res => res.text);
}

export function executeSparqlUpdate(
  query: SparqlJs.Update | string, options: SparqlOptions = {}
): Kefir.Property<void> {
  const {endpoint = '/sparql', context = {}} = options;

  let parametrizedEndpoint = endpoint;
  if (context.repository) {
    parametrizedEndpoint += '?' + URI.buildQuery({repository: context.repository});
  }

  const parsedQuery = typeof query === 'string' ? parseQuerySync(query) : query;
  const queryWithContext = context.bindings
    ? setBindings(parsedQuery, context.bindings) : parsedQuery;
  const preparedQuery = serializeQuery(queryWithContext);

  const updateRequest = request
    .post(parametrizedEndpoint)
    .send(preparedQuery)
    .set('Content-Type', 'application/sparql-query; charset=utf-8')
    .set('Accept', 'text/boolean');

  return requestAsProperty(updateRequest).map(res => res.body);
}

/**
 * Convert sparql-results+json binding term to internal RDF representation.
 *
 * @see http://www.w3.org/TR/sparql11-results-json/#select-encode-terms
 */
function sparqlSelectBindingValueToRdf(binding: SparqlJsonTerm): Rdf.Node | Rdf.Quad {
  switch (binding.type) {
    case 'uri':
      return Rdf.iri(binding.value);
    case 'bnode':
      return Rdf.bnode(binding.value);
    case 'literal':
      return sparqlSelectBindingLiteralToRdf(binding);
    case 'triple':
      return sparqlSelectBindingTripleToRdf(binding);
  }
  throw new Error(`Unexpected binding type: "${(binding as SparqlJsonTerm).type}"`);
}

function sparqlSelectBindingLiteralToRdf(binding: SparqlJsonLiteral): Rdf.Literal {
  if (!_.isUndefined(binding['xml:lang'])) {
    return Rdf.langLiteral(binding.value, binding['xml:lang']);
  } else if (!_.isUndefined(binding.datatype)) {
    return Rdf.literal(binding.value, Rdf.iri(binding.datatype));
  } else {
    return Rdf.literal(binding.value);
  }
}

function sparqlSelectBindingTripleToRdf(binding: SparqlJsonTriple): Rdf.Quad {
  const s = sparqlSelectBindingValueToRdf(binding.value.s);
  if (!(s.termType === 'NamedNode'
    || s.termType === 'BlankNode'
    || s.termType === 'Quad'
  )) {
    throw new Error(`Unexpected quad subject type: "${s.termType}"`);
  }
  const p = sparqlSelectBindingValueToRdf(binding.value.p);
  if (!(p.termType === 'NamedNode')) {
    throw new Error(`Unexpected quad predicate type: "${p.termType}"`);
  }
  const o = sparqlSelectBindingValueToRdf(binding.value.o);
  const g = binding.value.g
    ? sparqlSelectBindingValueToRdf(binding.value.g)
    : Rdf.DEFAULT_GRAPH;
  if (!(g.termType === 'NamedNode'
    || g.termType === 'DefaultGraph'
  )) {
    throw new Error(`Unexpected quad graph type: "${g.termType}"`);
  }
  // TODO: remove casts when RDF* support will be available in RDF/JS
  return Rdf.triple(
    s as Rdf.Quad['subject'],
    p as Rdf.Quad['predicate'],
    o as Rdf.Quad['object'],
    g
  );
}
