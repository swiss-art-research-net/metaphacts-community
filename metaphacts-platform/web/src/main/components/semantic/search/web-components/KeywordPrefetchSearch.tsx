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
import * as Maybe from 'data.maybe';
import * as Kefir from 'kefir';
import * as React from 'react';
import { FormControl, FormGroup } from 'react-bootstrap';

import { Cancellation } from 'platform/api/async';
import { DataQuery, DataClient } from 'platform/api/dataClient';
import { Rdf } from 'platform/api/rdf';
import { SparqlClient, cloneQuery, SparqlUtil } from 'platform/api/sparql';

import * as SparqlJs from 'sparqljs';

import { Component } from 'platform/api/components';
import * as Model from 'platform/components/semantic/search/data/search/Model';
import { Spinner } from 'platform/components/ui/spinner';
import { ErrorNotification } from 'platform/components/ui/notification';

import { setSearchDomain } from '../commons/Utils';
import { SemanticSearchContext, InitialQueryContext } from './SemanticSearchApi';

const DEFAULT_TOKEN_VARIABLE_NAME = '__token__';
const MINIMAL_SEARCH_KEY_LENGTH = 3;
const DEFAULT_VALUE_BINDING_NAME = 'subject';
const DEFAULT_TERM_TYPE = Rdf.iri('http://www.w3.org/2001/XMLSchema#string');
const SELECT_QUERY_BASE: SparqlJs.SelectQuery = {
  type: 'query',
  queryType: 'SELECT',
  variables: [Rdf.DATA_FACTORY.variable(DEFAULT_VALUE_BINDING_NAME)],
  prefixes: {},
  where: [],
};

/**
  * **Example**
  * ```
  * // <http://example.com/foo>
  * {
  *   "termType": "NamedNode",
  *   "value": "http://example.com/foo"
  * }
  * ```
  */
 interface NamedNodeData {
  termType: 'NamedNode';
  value: string;
}

/**
  * **Example**
  * ```
  * // "foo"^^xsd:string
  * {"termType": "Literal", "value": "foo"}
  *
  * // "bar"@de (with rdf:langString datatype)
  * {"termType": "Literal", "value": "bar", "language": "de"}
  *
  * // "42"^^xsd:integer
  * {
  *   "termType": "Literal",
  *   "value": "42",
  *   "datatype": "http://www.w3.org/2001/XMLSchema#integer"
  * }
  * ```
  */
interface LiteralData {
  termType: 'Literal';
  value: string;
  /* @default "http://www.w3.org/2001/XMLSchema#string" */
  datatype?: string;
  /* @default "" */
  language?: string;
}

export interface VariableDefinition {
  /**
   * DataClient projection variable name.
   * (Name of the associated column from the preliminary fetching results).
   */
  id: string;

  /**
   * Alias to map fetched column name to the name in VALUES clause.
   * If not set, the original id is used.
   */
  aliasId?: string;

  /**
   * Fallback value to use in cases when the preliminary fetched results
   * contain no value for the specified column.
   * This parameter can also be used for creating artificial columns,
   * which are not in the database or were not preliminary fetched.
   */
  fallback?: NamedNodeData | LiteralData;
}

export interface KeywordPrefetchSearchConfig {
  /**
   * LookupDataQuery or SparqlDataQuery
   */
  query: DataQuery | string;

  /**
   * User input variable name.
   * This parameter can be changed only when you provided SparqlDataQuery
   * as value to the query parameter.
   * @default "__token__"
   */
  searchTermVariable?: string;

  /**
   * Maps binding names to variables in the result VALUES clause.
   * If not defined, tries to provide all possible columns.
   */
  variableDefinitions?: ReadonlyArray<VariableDefinition>;

  /**
   * Custom CSS styles for the input element
   */
  style?: React.CSSProperties;

  /**
   * Custom css classes for the input element
   */
  className?: string;

  /**
   * Specify search domain category IRI (full IRI enclosed in <>).
   * Required, if component is used together with facets.
   */
  domain?: string;

  /**
   * Number of milliseconds to wait after the last keystroke before sending the query.
   *
   * @default 300
   */
  debounce?: number;

  /**
   * Minimum number of input characters that triggers the search.
   * @default 3
   */
  minSearchTermLength?: number;

  /**
   * Input placeholder.
   */
  placeholder?: string;
}

type KeywordPrefetchSearchProps = KeywordPrefetchSearchConfig;

class KeywordPrefetchSearch extends Component<KeywordPrefetchSearchProps, void> {
  render() {
    return (
      <SemanticSearchContext.Consumer>
        {context => <KeywordPrefetchSearchInner {...this.props} context={context} />}
      </SemanticSearchContext.Consumer>
    );
  }
}

interface InnerProps extends KeywordPrefetchSearchProps {
  context: InitialQueryContext;
}

interface State {
  fetchingData: boolean;
  value?: string;
  error?: Error;
}

type DefaultProps = Required<Pick<KeywordPrefetchSearchProps,
  'debounce' | 'searchTermVariable' | 'minSearchTermLength'
>>;

class KeywordPrefetchSearchInner extends React.Component<InnerProps, State> {
  private queryProcessingCancellation = new Cancellation();
  private searchDebounce = new Cancellation();

  static defaultProps: DefaultProps = {
    debounce: 300,
    searchTermVariable: DEFAULT_TOKEN_VARIABLE_NAME,
    minSearchTermLength: MINIMAL_SEARCH_KEY_LENGTH,
  };

  constructor(props: InnerProps) {
    super(props);
    this.state = { fetchingData: false };
  }

  componentDidMount() {
    const {domain, context} = this.props;
    setSearchDomain(domain, context);
    const error = validateKeywordPrefetchSearchConfig(this.props);
    if (error) {
      this.setState({error});
    }
  }

  componentDidUpdate(prevProps: InnerProps) {
    const {context} = prevProps;
    const {context: newContext} = this.props;

    if (newContext.searchProfileStore.isJust && newContext.domain.isNothing) {
      setSearchDomain(this.props.domain, newContext);
    }
    if (newContext.baseQueryStructure.isJust && context.baseQueryStructure.isNothing) {
      const search = newContext.baseQueryStructure.get();
      if (search.kind === Model.SearchKind.Keyword) {
        this.setState({value: search.value}, () => {
          this.updateSearchContext();
        });
      }
    }
  }

  componentWillUnmount() {
    this.queryProcessingCancellation.cancelAll();
    this.searchDebounce.cancelAll();
  }

  render() {
    const {error, fetchingData} = this.state;

    if (error) {
      return <ErrorNotification errorMessage={error}></ErrorNotification>;
    } else {
      const {style, className, minSearchTermLength, placeholder: defaultPlaceholder} = this.props;
      const placeholder = defaultPlaceholder ?? `type to search, minimum ${minSearchTermLength} symbols ...`;
      return (
          <FormGroup controlId='semantic-search-prefetch-text-input'>
            <FormControl
              className={className}
              style={style}
              value={this.state.value}
              placeholder={placeholder}
              onChange={this.onKeyPress}
            />
            {fetchingData ? <Spinner /> : null}
          </FormGroup>
      );
    }
  }

  private onKeyPress = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({value: event.target.value}, () => {
      this.updateSearchContext();
    });
  }

  private updateSearchContext = () => {
    const {context, debounce, minSearchTermLength} = this.props;
    const {value} = this.state;

    this.queryProcessingCancellation.cancelAll();
    this.searchDebounce.cancelAll();

    if (checkSearchKey(value, minSearchTermLength)) {
      const cancellation = new Cancellation();
      this.searchDebounce = cancellation;

      cancellation.map(
        Kefir.later(debounce, value)
      ).flatMap(term => {
        this.setState({fetchingData: true});
        return this.buildQuery(term).map(query => ({
          query, term,
        }));
      }).observe({
        value: ({term, query}) => {
          this.setState({fetchingData: false});
          context.setBaseQuery(Maybe.Just(query));
          context.setBaseQueryStructure(
            Maybe.Just({
              kind: Model.SearchKind.Keyword,
              value: term,
              domain: context.domain.getOrElse(undefined),
            })
          );
        },
        error: error => {
          this.setState({fetchingData: false, error});
          this.resetSearchContext();
        }
      });
    } else {
      this.resetSearchContext();
    }
  }

  private buildQuery = (term: string) => {
    const {query, searchTermVariable, variableDefinitions} = this.props;
    const dataClientQuery = (
      typeof query === 'string' ?
        DataClient.createClientQuery(query, {
          [searchTermVariable]: {
            type: 'token',
            required: true,
          }
        }) : query
    );

    const cancellation = new Cancellation();
    this.queryProcessingCancellation.cancelAll();
    this.queryProcessingCancellation = cancellation;

    return cancellation.map(
      DataClient.fetchData(dataClientQuery, {[searchTermVariable]: Rdf.literal(term)})
        .map(results => {
          const variables = variableDefinitions ?
            variableDefinitions : buildDefinitionsFromBindings(results);

          const selectQuery = cloneQuery(SELECT_QUERY_BASE);
          const valueParameters = prepareValueParameters(results, variables);
          if (valueParameters.length > 0) {
            SparqlClient.prependValuesClause(selectQuery.where, valueParameters);
          }
          return selectQuery;
        })
    );
  }

  private resetSearchContext = () => {
    const {context} = this.props;
    context.setBaseQuery(Maybe.Nothing());
    context.setBaseQueryStructure(Maybe.Nothing());
  }
}

export default KeywordPrefetchSearch;

function checkSearchKey(key: string, limit: number) {
  return key && key.length >= limit;
}

function prepareValueParameters(
  bindings: SparqlClient.Bindings<Rdf.Node>,
  variables: ReadonlyArray<VariableDefinition>
): SparqlClient.Parameters {
  const fallbackValues = prepareFallbackValues(variables);

  return bindings.map(binding => {
    const dictionary: SparqlClient.Dictionary<Rdf.Node> = {};
    for (const variable of variables) {
      dictionary[variable.aliasId ?? variable.id] =
        binding[variable.id] ?? fallbackValues.get(variable.id);
    }
    return dictionary;
  });
}

function buildDefinitionsFromBindings(bindings: SparqlClient.Bindings<Rdf.Node>) {
  const variableDefinitions = new Map<string, VariableDefinition>();
  bindings.forEach(binding => {
    for (const key in binding) {
      if (binding.hasOwnProperty(key) && !variableDefinitions.has(key)) {
        variableDefinitions.set(key, {id: key});
      }
    }
  });
  return Array.from(variableDefinitions.values());
}

function prepareFallbackValues(variableDefinitions: ReadonlyArray<VariableDefinition>) {
  const fallbackMap = new Map<string, Rdf.Node>();
  for (const variable of variableDefinitions) {
    const fallback = variable.fallback;
    if (fallback) {
      let value: Rdf.Node;
      if (fallback.termType === 'Literal') {
        if (fallback.language) {
          value = Rdf.langLiteral(fallback.value, fallback.language);
        } else {
          value = Rdf.literal(
            fallback.value, fallback.termType ? Rdf.iri(fallback.termType) : DEFAULT_TERM_TYPE
          );
        }
      } else if (fallback.termType === 'NamedNode') {
        value = Rdf.iri(fallback.value);
      } else {
        throw Error('Unsupported term type provided as a fallback value.');
      }
      fallbackMap.set(variable.id, value);
    }
  }
  return fallbackMap;
}

function validateKeywordPrefetchSearchConfig(config: KeywordPrefetchSearchConfig) {
  const {query, searchTermVariable} = config;

  let error: Error;
  if (query) {
    if (typeof query === 'string') {
      try {
        SparqlUtil.parseQuery(query);
      } catch (e) {
        error = e;
      }
    } else {
      error = DataClient.validateQuery(query, [DEFAULT_VALUE_BINDING_NAME]);
    }
  } else {
    error = new Error('There is no query provided.');
  }

  if (error) {
    return error;
  } else if (
    query &&
    typeof query !== 'string' &&
    query.type === 'lookup' &&
    searchTermVariable !== DEFAULT_TOKEN_VARIABLE_NAME
  ) {
    return new Error(
      `The tokenVariableName for the data client query of a 'lookup' ` +
      `type cannot be changed. Use ${DEFAULT_TOKEN_VARIABLE_NAME}`);
  }
}
