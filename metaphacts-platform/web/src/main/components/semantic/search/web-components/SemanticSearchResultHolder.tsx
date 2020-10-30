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
import * as React from 'react';

import { SemanticSearchContext, ResultContext } from './SemanticSearchApi';
import { Category } from '../data/search/Model';
import { ErrorNotification } from 'platform/components/ui/notification';

interface SemanticSearchResultHolderConfig {
  /**
   * An array of search domains categories (full IRIs without <>) to be shown.
   * If effective search domain is <b>in the array</b>, search result will be <b>shown</b>,
   * otherwise - it will be hidden in this <code>semantic-search-result-holder</code> visualization.
   * Cannot be used together with domains-exclude.
   */
  domainsInclude?: ReadonlyArray<string>;

  /**
   * An array of search domains categories (full IRIs without <>) to be shown.
   * If effective search domain is <b>in the array</b>, search result will be <b>hidden</b>,
   * otherwise - it will be shown in this <code>semantic-search-result-holder</code> visualization.
   * Cannot be used together with domains-include.
   */
  domainsExclude?: ReadonlyArray<string>;
}

interface SemanticSearchResultHolderProps extends SemanticSearchResultHolderConfig {
  children: React.ReactNode;
}

class SemanticSearchResultHolder extends React.Component<SemanticSearchResultHolderProps> {
  render() {
    return (
      <SemanticSearchContext.Consumer>
        {context => <SemanticSearchResultHolderInner {...this.props} context={context} />}
      </SemanticSearchContext.Consumer>
    );
  }
}

interface InnerProps extends SemanticSearchResultHolderConfig {
  context: ResultContext;
}

interface State {
  error?: string;
}

class SemanticSearchResultHolderInner extends React.Component<InnerProps, State> {
  constructor(props: InnerProps) {
    super(props);
    this.state = {};
  }

  componentDidMount() {
    const {domainsInclude, domainsExclude} = this.props;
    if (domainsInclude && domainsExclude) {
      this.setState({
        error: '"domains-include" and "domains-exclude" properties cannot be used at the same time.'
      });
    }
  }

  render() {
    const {domainsInclude, domainsExclude, context, children} = this.props;
    const child = React.Children.only(children);
    const currentDomain: Category = context.domain.getOrElse(undefined);
    const {error} = this.state;
    if (error) {
      return <ErrorNotification errorMessage={error} />;
    }
    if (domainMatches(currentDomain, domainsInclude, domainsExclude)) {
      return context.resultQuery.map(query => child).getOrElse(null);
    } else {
      return null;
    }
  }
}

export default SemanticSearchResultHolder;

function domainMatches(
  domain: Category | undefined,
  includes: ReadonlyArray<string> | undefined,
  excludes: ReadonlyArray<string> | undefined
) {
  if (includes) {
    if (!(domain && includes.indexOf(domain.iri.value) >= 0)) {
      return false;
    }
  }
  if (excludes) {
    if (domain && excludes.indexOf(domain.iri.value) >= 0) {
      return false;
    }
  }
  return true;
}
