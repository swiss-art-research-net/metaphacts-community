/*
 * Copyright (C) 2015-2019, metaphacts GmbH
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

import { createElement, Props, Children, cloneElement } from 'react';
import { SemanticContext, SemanticContextTypes } from 'platform/api/components';
import * as SparqlClient from 'platform/api/sparql/SparqlClient';
import {Cancellation} from 'platform/api/async';
import {Action} from 'platform/components/utils';
import {trigger} from 'platform/api/events';
import * as BuiltInEvents from 'platform/api/events/BuiltInEvents';
import * as _ from 'lodash';
import * as Immutable from 'immutable';
import {Spinner} from 'platform/components/ui/spinner';
import * as D from 'react-dom-factories';
import {ErrorNotification} from 'platform/components/ui/notification';
import Ontodia from 'platform/components/3-rd-party/ontodia/Ontodia';
import * as React from 'react';
import { ResultContext, ResultContextTypes } from 'platform/components/semantic/search';

export interface DiagramSearchResultConfig {
  /**
   * SPARQL select query where all resource values will be treated as elements
   */
  query: string;
  id?: string;
};

interface State {
  queryResult?: SparqlClient.SparqlSelectResult;
  isLoading: boolean;
  errorMessage?: string;
  iris?: string [];
}

export type DiagramSearchResultProps = DiagramSearchResultConfig & Props<DiagramSearchResult>;

export class DiagramSearchResult extends React.Component<DiagramSearchResultProps, State> {
  static contextTypes = {...SemanticContextTypes, ...ResultContextTypes};
  context: SemanticContext & ResultContext;

  private readonly cancellation = new Cancellation();
  private query = Action<DiagramSearchResultConfig>();

  constructor(props: DiagramSearchResultProps, context: any) {
    super(props, context);
    this.state = {isLoading: true};
    this.cancellation.map(
      this.query.$property.debounce(300)
    ).flatMap(
      this.loadQueryData
    ).onValue(() => {/**/});
    this.loadQueryData(this.props);
  }

  componentWillReceiveProps(nextProps: DiagramSearchResultProps) {
    if (nextProps.query !== this.props.query) {
      this.setState({isLoading: true, errorMessage: undefined});
      // this.query(nextProps);
      this.loadQueryData(nextProps);
    }
  }

  private loadQueryData = (config: DiagramSearchResultConfig) => {
    const context = this.context.semanticContext;
    const querying = SparqlClient.select(config.query, {context});
    querying.onValue(queryResult => {
      this.setState({
        queryResult: queryResult,
        iris: this.buildElements(config, queryResult),
        isLoading: false,
      });
    });
    querying.onError(errorMessage => {
      this.setState({
        errorMessage: errorMessage,
        isLoading: false,
      });
    });
    querying.onEnd(() => {
      if (this.props.id) {
        trigger({eventType: BuiltInEvents.ComponentLoaded, source: this.props.id});
      }
    });
    return querying;
  }

  render() {
    const {iris, isLoading, errorMessage} = this.state;
    if (isLoading) {
      return createElement(Spinner);
    } else if (errorMessage) {
      return D.div({}, createElement(ErrorNotification, {errorMessage}));
    } else if (iris) {
      const nodeStyles = {};
      this.context.searchProfileStore.map(profileStore =>
        profileStore.categories.forEach(category =>
          nodeStyles[category.iri.value] = {image: category.thumbnail, color: category.color}
        )
      );
      const child = Children.only(this.props.children);
      if (child.type !== Ontodia) {
        throw Error('The child element should be Ontodia');
      }
      return cloneElement(child, {iris, nodeStyles});
    }
  }

  private buildElements(
    config: DiagramSearchResultConfig,
    queryResult: SparqlClient.SparqlSelectResult
  ) {
    return Immutable.Set(_.flatMap(queryResult.results.bindings, b => _.values(b)))
        .filter(el => el.isIri())
        .map(el => el.value)
        .toArray();
  }
}

export default DiagramSearchResult;
