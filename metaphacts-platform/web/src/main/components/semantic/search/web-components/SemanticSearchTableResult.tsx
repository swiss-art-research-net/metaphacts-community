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

import { Rdf } from 'platform/api/rdf';

import { universalChildren, isValidChild, componentHasType } from 'platform/components/utils';
import {
  SemanticTable, SemanticTableConfig, ColumnConfiguration, ColumnConfig,
} from 'platform/components/semantic/table';
import { SemanticDataTable } from 'platform/components/semantic/data-table';

import { SEMANTIC_SEARCH_VARIABLES } from '../config/SearchConfig';
import { SemanticSearchContext, ResultContext, GraphScopeContext } from './SemanticSearchApi';

interface SemanticSearchTableResultConfig {}
export type SemanticSearchTableResultProps = SemanticSearchTableResultConfig;

export class SemanticSearchTableResult extends React.Component<SemanticSearchTableResultProps> {
  render() {
    return (
      <SemanticSearchContext.Consumer>
        {context => <SemanticSearchTableResultInner {...this.props} context={context} />}
      </SemanticSearchContext.Consumer>
    );
  }
}

interface InnerProps {
  context: ResultContext & GraphScopeContext;
}

interface State {
  columnConfiguration?: ReadonlyArray<ColumnConfiguration>;
}

export class SemanticSearchTableResultInner extends React.Component<InnerProps, State> {
  constructor(props: InnerProps) {
    super(props);
    this.state = {columnConfiguration: []};
  }

  componentDidMount() {
    this.prepareColumnConfiguration();
  }

  componentDidUpdate(prevProps: InnerProps) {
    const {context: prevContext} = prevProps;
    const {context} = this.props;
    const sameColumns = (
      prevContext.searchProfileStore.isEqual(context.searchProfileStore) &&
      prevContext.availableDomains.isEqual(context.availableDomains) &&
      prevContext.extendedVisualizationContext === context.extendedVisualizationContext
    );
    if (!sameColumns) {
      this.prepareColumnConfiguration();
    }
  }

  private prepareColumnConfiguration() {
    const {graphScopeResults} = this.props.context;

    const columnConfiguration = graphScopeResults.isJust
      ? prepareGraphScopeColumns(this.props.context)
      : prepareSearchProfileColumns(this.props.context);

    this.setState({columnConfiguration});
  }

  private mapChildren(children: React.ReactNode): React.ReactNode {
    return universalChildren(
      React.Children.toArray(children).map(child => {
        if (!isValidChild(child)) {
          return child;
        }
        if (componentHasType(child, SemanticTable) || componentHasType(child, SemanticDataTable)) {
          const {columnConfiguration: childColumnConfiguration = []} = child.props as ColumnConfig;
          const columnConfiguration = this.state.columnConfiguration.map(column => {
            const childColumn = childColumnConfiguration.find(
              ({variableName}) => variableName === column.variableName
            );
            if (childColumn) {
              return {
                ...column,
                displayName: childColumn.displayName,
                cellTemplate: childColumn.cellTemplate,
              };
            }
            return column;
          });
          return React.cloneElement(
            child, {...child.props, columnConfiguration} as SemanticTableConfig
          );
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

function prepareSearchProfileColumns(context: ResultContext): ColumnConfiguration[] {
  const {searchProfileStore, availableDomains, extendedVisualizationContext} = context;
  const columns: ColumnConfiguration[] = [];
  const store = searchProfileStore.isJust ? searchProfileStore.get() : undefined;
  const domains = availableDomains.isJust ? availableDomains.get() : undefined;
  if (domains) {
    domains.forEach((domain, iri) => {
      const variableName = domain.replace(/^\?/, '');
      columns.push({
        variableName,
        displayName: store && store.categories.has(iri)
          ? store.categories.get(iri).label : variableName,
      });
    });
  } else if (context.domain.isJust) {
    const domain = context.domain.get();
    columns.push({
      variableName: SEMANTIC_SEARCH_VARIABLES.PROJECTION_ALIAS_VAR,
      displayName: domain.label,
    });
  }

  if (extendedVisualizationContext && extendedVisualizationContext.addProjection) {
    for (const property of extendedVisualizationContext.properties) {
      columns.push({
        variableName: property.variableName,
        displayName: property.relation.label,
      });
    }
  }
  return columns;
}

// TODO: This method should not exists; instead this information
// should be present in the search profile
function prepareGraphScopeColumns(
  context: ResultContext & GraphScopeContext
): ColumnConfiguration[] {
  const {searchProfileStore, graphScopeResults} = context;
  const store = searchProfileStore.isJust ? searchProfileStore.get() : undefined;
  const columns: ColumnConfiguration[] = [];
  if (graphScopeResults.isJust) {
    for (const column of graphScopeResults.get().columns) {
      const variableName = column.id.replace(/^\?/, '');
      let displayName: string;
      if (column.type === 'var-concept') {
        const iri = Rdf.fullIri(column.tgConcept.iri);
        displayName = store && store.categories.has(iri)
          ? store.categories.get(iri).label : variableName;
      } else {
        displayName = column.attribute.label;
      }
      columns.push({variableName, displayName});
    }
  }
  return columns;
}

export default SemanticSearchTableResult;
