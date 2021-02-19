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
import * as React from 'react';
import * as Maybe from 'data.maybe';
import * as Kefir from 'kefir';
import * as _ from 'lodash';
import { FormControl, FormGroup } from 'react-bootstrap';
import * as SparqlJs from 'sparqljs';

import { SparqlUtil, SparqlClient } from 'platform/api/sparql';
import { Component } from 'platform/api/components';
import { Action } from 'platform/components/utils';

import { setSearchDomain } from '../commons/Utils';
import { SemanticSimpleSearchBaseConfig } from '../../simple-search/Config';
import { SemanticSearchContext, InitialQueryContext } from './SemanticSearchApi';
import * as Model from 'platform/components/semantic/search/data/search/Model';

export interface SemanticSearchKeywordConfig extends SemanticSimpleSearchBaseConfig {
  /**
   * SPARQL SELECT query string.
   *
   * Needs to have a variable `?__token__` serving as placeholder for the user input.
   * Note that the name of this variable can be customized using `searchTermVariable`.
   */
  query: string;

  /**
   * SPARQL SELECT query string to show default suggestions without the need for the user
   * to type anything if specified.
   *
   * Needs to define `?subject` as projection variable.
   */
  defaultQuery?: string;

  /**
   * Custom css styles for the input element
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
}

interface KeywordSearchProps extends SemanticSearchKeywordConfig {}

class KeywordSearch extends Component<KeywordSearchProps, {}> {
  render() {
    return (
      <SemanticSearchContext.Consumer>
        {context => <KeywordSearchInner {...this.props} context={context} />}
      </SemanticSearchContext.Consumer>
    );
  }
}

interface InnerProps extends KeywordSearchProps {
  context: InitialQueryContext;
}

interface State {
  value: string;
}

type DefaultProps = Required<Pick<KeywordSearchProps,
  'placeholder' | 'searchTermVariable' | 'minSearchTermLength' | 'debounce'
>>;

class KeywordSearchInner extends React.Component<InnerProps, State> {
  static defaultProps: DefaultProps = {
    placeholder: 'type to search, minimum 3 symbols ...',
    searchTermVariable: '__token__',
    minSearchTermLength: 3,
    debounce: 300,
  };

  private keys = Action<string>();

  constructor(props: InnerProps) {
    super(props);
    this.state = {
      value: undefined,
    };
  }

  componentDidMount() {
    setSearchDomain(this.props.domain, this.props.context);
    this.initialize(this.props);
  }

  componentDidUpdate(prevProps: InnerProps, prevState: State) {
    if (this.state.value !== prevState.value) {
      _.isEmpty(this.state.value) ? this.clearSearch() : this.keys(this.state.value);
    }
  }

  componentWillReceiveProps(nextProps: InnerProps) {
    const {context} = this.props;
    const {context: nextContext} = nextProps;
    if (nextContext.searchProfileStore.isJust && nextContext.domain.isNothing) {
      setSearchDomain(nextProps.domain, nextContext);
    }
    if (nextContext.baseQueryStructure.isJust && context.baseQueryStructure.isNothing) {
      const search = nextContext.baseQueryStructure.get();
      if (search.kind === Model.SearchKind.Keyword) {
        this.setState({value: search.value});
      }
    }
  }

  render() {
    const {placeholder, style, className} = this.props;
    return <FormGroup controlId='semantic-search-text-input'>
    <FormControl
        className={className}
        style={style}
        value={this.state.value}
        placeholder={placeholder}
        onChange={this.onKeyPress}
      />
    </FormGroup>;
  }

  private initialize = (props: InnerProps) => {
    const query = SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(props.query);
    const defaultQuery =
      props.defaultQuery ?
        Maybe.Just(
          SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(props.defaultQuery)
        ) : Maybe.Nothing<SparqlJs.SelectQuery>();

    const queryProp =
      this.keys.$property
        .filter(str => str.length >= this.props.minSearchTermLength)
        .map(
          this.buildQuery(query)
        );

    const defaultQueryProp =
      this.keys.$property
      .filter(str => props.defaultQuery && _.isEmpty(str))
      .map(
        () => defaultQuery.get()
      );

    const initializers = [queryProp];
    if (props.defaultQuery) {
      initializers.push(
        Kefir.constant(defaultQuery.get()), defaultQueryProp
      );
    }

    Kefir.merge(initializers)
      .debounce(this.props.debounce)
      .onValue(
        q => {
          this.props.context.setBaseQuery(Maybe.Just(q));
          this.props.context.setBaseQueryStructure(
            Maybe.Just({
              kind: Model.SearchKind.Keyword,
              value: this.state.value,
              domain: this.props.context.domain.getOrElse(undefined),
            })
          );
        }
      );
  }

  private onKeyPress = (event: React.ChangeEvent<HTMLInputElement>) =>
    this.setState({value: event.target.value})

  private buildQuery =
    (baseQuery: SparqlJs.SelectQuery) => (token: string): SparqlJs.SelectQuery => {
      // tslint:disable-next-line: deprecation
      const {searchTermVariable, escapeLuceneSyntax, tokenizeLuceneQuery} = this.props;
      const defaults = SparqlUtil.findTokenizationDefaults(baseQuery.where, searchTermVariable);
      const value = SparqlUtil.makeLuceneQuery(
        token,
        escapeLuceneSyntax ?? defaults.escapeLucene,
        tokenizeLuceneQuery ?? defaults.tokenize
      );
      return SparqlClient.setBindings(
        baseQuery, {[searchTermVariable]: value}
      );
    }

  private clearSearch() {
    if (this.props.defaultQuery) {
      this.keys(this.state.value);
    } else {
      this.props.context.setBaseQuery(Maybe.Nothing());
      this.props.context.setBaseQueryStructure(Maybe.Nothing());
    }
  }
}

export default KeywordSearch;
