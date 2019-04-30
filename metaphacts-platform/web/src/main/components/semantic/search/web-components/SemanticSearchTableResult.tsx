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

import * as React from 'react';

import { universalChildren, isValidChild } from 'platform/components/utils';
import { SemanticTable } from 'platform/components/semantic/table';

import { ResultContext, ResultContextTypes } from './SemanticSearchApi';

export interface State {
  columnConfiguration?: any[];
}

export class SemanticSearchTableResult extends React.Component<{}, State> {
  static contextTypes = ResultContextTypes;
  context: ResultContext;

  constructor(props: {}, context: any) {
    super(props, context);
    this.state = {columnConfiguration: []};
  }

  componentDidMount() {
    this.prepareColumnConfiguration();
  }

  componentDidUpdate(prevProps: {}, prevState: State, prevContext: ResultContext) {
    const {searchProfileStore, availableDomains} = this.context;
    if (!prevContext.searchProfileStore.isEqual(searchProfileStore) ||
      !prevContext.availableDomains.isEqual(availableDomains)) {
      this.prepareColumnConfiguration();
    }
  }

  private prepareColumnConfiguration() {
    const {searchProfileStore, availableDomains} = this.context;
    const columnConfiguration: any[] = [];
    searchProfileStore.map(store =>
      availableDomains.map(domains =>
        domains.forEach((domain, iri) => {
          const variableName = domain.replace(/^\?/, '');
          columnConfiguration.push({variableName, displayName: store.categories.get(iri).label});
        })
      )
    );
    this.setState({columnConfiguration});
  }

  private mapChildren(children: React.ReactNode) {
    const {columnConfiguration} = this.state;
    return universalChildren(
      React.Children.toArray(children).map(child => {
        if (!isValidChild(child)) {
          return child;
        }
        if (child.type === SemanticTable) {
          return React.cloneElement(child, {...child.props, columnConfiguration});
        } else {
          return React.cloneElement(
            child, child.props,
            this.mapChildren(child.props.children)
          );
        }
      })
    );
  }

  render() {
    return this.mapChildren(this.props.children);
  }
}

export default SemanticSearchTableResult;
