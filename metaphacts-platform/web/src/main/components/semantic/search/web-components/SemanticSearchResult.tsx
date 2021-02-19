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
import * as Kefir from 'kefir';
import * as _ from 'lodash';
import * as SparqlJs from 'sparqljs';

import { Cancellation } from 'platform/api/async';
import {
  isValidChild, componentHasType, hasControlledProps, ControlledPropsHandler, universalChildren,
} from 'platform/components/utils';
import {
  BuiltInEvents, listen
} from 'platform/api/events';
import { Rdf } from 'platform/api/rdf';
import {
  SparqlUtil, SparqlClient, SparqlTypeGuards, PatternBinder, VariableBinder, VariableRenameBinder,
  cloneQuery,
} from 'platform/api/sparql';
import { ErrorNotification } from 'platform/components/ui/notification';

import { ResultsNumber } from 'platform/components/semantic/results';

import { SemanticSearchContext, ResultContext, VisualizationContext } from './SemanticSearchApi';
import * as Config from '../config/SearchConfig';
import { SEMANTIC_SEARCH_VARIABLES, RESULT_VARIABLES } from '../config/SearchConfig';
import { transformRangePattern } from '../data/Common';
import * as Model from '../data/search/Model';
import {
  tryGetRelationPatterns, generateQueryForMultipleDatasets,
} from '../data/search/SparqlQueryGenerator';

interface SemanticSearchResultConfig {}

export type SemanticSearchResultProps = SemanticSearchResultConfig;

export class SemanticSearchResult extends React.Component<{}, {}> {
  render() {
    return (
      <SemanticSearchContext.Consumer>
        {context => <SemanticSearchResultInner {...this.props} context={context} />}
      </SemanticSearchContext.Consumer>
    );
  }
}

interface InnerProps {
  context: ResultContext;
}

interface State {
  error?: string;
}

class SemanticSearchResultInner extends React.Component<InnerProps, State> {
  private readonly cancellation = new Cancellation();

  constructor(props: InnerProps) {
    super(props);
    this.state = {};
  }

  shouldComponentUpdate(nextProps: InnerProps, nextState: State) {
    const {context} = this.props;
    const {context: nextContext} = nextProps;
    const sameState = (
      _.isEqual(nextContext.resultQuery.getOrElse(null), context.resultQuery.getOrElse(null)) &&
      _.isEqual(nextContext.bindings, context.bindings) &&
      _.isEqual(this.state, nextState) &&
      nextContext.availableDomains.isEqual(context.availableDomains) &&
      nextContext.selectedDatasets === context.selectedDatasets &&
      nextContext.visualizationContext === context.visualizationContext &&
      nextContext.extendedVisualizationContext === context.extendedVisualizationContext
    );
    return !sameState;
  }

  componentWillUnmount() {
    this.cancellation.cancelAll();
  }

  render() {
    const {error} = this.state;
    if (error) {
      return <ErrorNotification errorMessage={error} />;
    }
    return this.mapChildren(this.props.children);
  }

  private listenToChildLoading = (child: React.ReactElement<any>) => {
    if (child) {
      if (typeof child !== 'string' && child.props.id) {
        this.cancellation.map(
          listen({
            eventType: BuiltInEvents.ComponentLoading,
            source: child.props.id,
          })
        ).observe({
          value: e => {
            const isResultCount = componentHasType(child, ResultsNumber);
            this.props.context.notifyResultLoading(
              isResultCount
                ? {type: 'count', task: e.data as Kefir.Property<number>}
              : {type: 'other', task: e.data.map(() => {/* void */})}
            );
          },
        });
      } else {
        this.setState({
          error: `semantic-search-result child component should have the 'id' property`,
        });
      }
    }
  }

  /**
   * Goes through all children to find the one that takes query parameter
   */
  private mapChildren(children: React.ReactNode): React.ReactNode {
    return universalChildren(
      React.Children.toArray(children).map(child => {
        if (!isValidChild(child)) {
          return child;
        } else {
          if (_.has(child.props, 'query')) {
            const controlled = this.tryMakeControlled(child);
            return this.buildResultQuery(this.props, this.props.context, child.props.query).map(
              query => this.updateChildQuery(controlled, query)
            ).getOrElse(null);
          } else {
            return React.cloneElement(
              child, child.props,
              this.mapChildren(child.props.children)
            );
          }
        }
      })
    );
  }

  /**
   * Delegates holding and updating state of child component to parent component through
   * search API if child result component supports it.
   * @see {hasControlledProps}
   */
  private tryMakeControlled(child: React.ReactElement<any>) {
    if (hasControlledProps(child.type) && child.props.id) {
      const handler: ControlledPropsHandler<object> = {
        onControlledPropChange: this.onControlledPropChange,
      };
      const controlledProps = this.props.context.resultState[child.props.id] || {};
      return React.cloneElement(child, {...controlledProps, ...handler});
    }
    return child;
  }

  private onControlledPropChange = (id: string, propsChange: object) => {
    this.props.context.updateResultState(id, propsChange);
  }

  private updateChildQuery(child: React.ReactElement<any>, newQuery: string) {
    this.listenToChildLoading(child);
    let newConfig = _.assign(
      {}, child.props, {query: newQuery}
    );
    return React.cloneElement(child, newConfig, child.props.children);
  }

  private buildResultQuery = (
    props: InnerProps, context: ResultContext, query: string
  ) => {
    return context.resultQuery.map(
      subQuery => {
        const baseQuery = SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(query);
        const subQueryClone = cloneQuery(subQuery);
        baseQuery.where.unshift(...subQueryClone.where);
        const projectionVar = subQuery.variables[0] as SparqlJs.VariableTerm;

        // if subQuery projection variable is different from default we need to make sure that
        // the result is still available under default variable (?subject)
        if (projectionVar.value !== SEMANTIC_SEARCH_VARIABLES.PROJECTION_ALIAS_VAR) {
          baseQuery.where.push({
            expression: projectionVar,
            type: 'bind',
            variable: Rdf.DATA_FACTORY.variable(SEMANTIC_SEARCH_VARIABLES.PROJECTION_ALIAS_VAR),
          });
        }

        // override limit only when query doesn't already have one
        if (!baseQuery.limit && this.props.context.baseConfig.limit) {
          baseQuery.limit = context.baseConfig.limit;
        }
        // if context is set for result visualization we also need to
        // rewrite the query to take into account virtual relations
        this.bindRelationPattern(baseQuery);

        const queryWithBindings = SparqlClient.setBindings(baseQuery, this.props.context.bindings);
        return SparqlUtil.serializeQuery(
          generateQueryForMultipleDatasets(
            queryWithBindings, context.selectedDatasets, context.baseConfig.datasetsConfig
          )
        );
      }
    );
  }

  /**
   * Replace `FILTER(?__contextRelationPattern__)` with query pattern that
   * corresponds to the pattern of the selected virtual FR
   */
  private bindRelationPattern(query: SparqlJs.Query) {
    const {context} = this.props;
    const profileStore = context.searchProfileStore.getOrElse(undefined);
    if (!profileStore) {
      return;
    }
    const visualizationContext = getVisualizationContext(context);

    const group: SparqlJs.GroupPattern = {
      type: 'group',
      patterns: [],
    };
    for (const property of visualizationContext.properties) {
      const relation = property.relation;
      const patternConfig = tryGetRelationPatterns(context.baseConfig, relation)
        .find(isBindableRelationPattern);

      let patterns: SparqlJs.Pattern[];
      if (patternConfig) {
        patterns = SparqlUtil.parsePatterns(patternConfig.queryPattern, query.prefixes);

        // when we are using date-range or numeric-range virtual pattern
        // as a context we need to make sure that we replace FILTERs with simple projections
        if (patternConfig.kind === 'date-range') {
          const from = {
            begin: SEMANTIC_SEARCH_VARIABLES.DATE_BEGIN_VAR,
            end: SEMANTIC_SEARCH_VARIABLES.DATE_END_VAR,
          };
          const to = {
            begin: property.variableName,
            end: property.variableName + 'rangeEnd__',
          };
          patterns = transformRangePattern(patterns, from, to);
        } else if (patternConfig.kind === 'numeric-range') {
          const from = {
            begin: SEMANTIC_SEARCH_VARIABLES.NUMERIC_RANGE_BEGIN_VAR,
            end: SEMANTIC_SEARCH_VARIABLES.NUMERIC_RANGE_END_VAR,
          };
          const to = {
            begin: property.variableName,
            end: property.variableName + 'rangeEnd__',
          };
          patterns = transformRangePattern(patterns, from, to);
        } else if (patternConfig.kind === 'literal') {
          new VariableRenameBinder(
            SEMANTIC_SEARCH_VARIABLES.LITERAL_VAR,
            property.variableName
          ).pattern({type: 'group', patterns});
        } else if (patternConfig.kind === 'resource') {
          new VariableRenameBinder(
            SEMANTIC_SEARCH_VARIABLES.RESOURCE_VAR,
            property.variableName
          ).pattern({type: 'group', patterns});
        }
      } else {
        patterns = makeDirectResourcePatternForContextRelation(relation, property.variableName);
      }

      const optionalBlock: SparqlJs.BlockPattern = {type: 'optional', patterns};
      // bind ?__relation__ variable for each context property separately
      new VariableBinder({
        [SEMANTIC_SEARCH_VARIABLES.RELATION_VAR]: property.relation.iri
      }).pattern(optionalBlock);
      group.patterns.push(optionalBlock);

      if (visualizationContext.addProjection) {
        const contextValueVariable = Rdf.DATA_FACTORY.variable(property.variableName);
        if (query.queryType === 'SELECT'
          && !SparqlTypeGuards.isStarProjection(query.variables)
          && !hasProjectionVariable(query, contextValueVariable)
        ) {
          query.variables.push(contextValueVariable);
        }
      }
    }

    new PatternBinder(RESULT_VARIABLES.CONTEXT_RELATION_PATTERN_VAR, group.patterns)
      .sparqlQuery(query);
  }
}

const EMPTY_VISUALIZATION_CONTEXT: VisualizationContext = {
  properties: [],
  addProjection: false,
};

function getVisualizationContext(context: ResultContext): VisualizationContext {
  if (context.extendedVisualizationContext) {
    return context.extendedVisualizationContext;
  } else if (context.visualizationContext && context.visualizationContext.isJust) {
    return {
      properties: [{
        relation: context.visualizationContext.get(),
        variableName: SEMANTIC_SEARCH_VARIABLES.RESOURCE_VAR,
      }],
      addProjection: false,
    };
  } else {
    return EMPTY_VISUALIZATION_CONTEXT;
  }
}

function isBindableRelationPattern(
  pattern: Config.PatternConfig
): pattern is Config.Resource | Config.Literal | Config.DateRange | Config.NumericRange {
  switch (pattern.kind) {
    case 'resource':
    case 'literal':
    case 'date-range':
    case 'numeric-range':
      return true;
  }
  return false;
}

function makeDirectResourcePatternForContextRelation(
  relation: Model.Relation,
  objectVariableName: string
): SparqlJs.Pattern[] {
  return [{
    type: 'bgp',
    triples: [{
      subject: Rdf.DATA_FACTORY.variable(SEMANTIC_SEARCH_VARIABLES.PROJECTION_ALIAS_VAR),
      predicate: relation.iri,
      object: Rdf.DATA_FACTORY.variable(objectVariableName),
    }]
  }];
}

function hasProjectionVariable(query: SparqlJs.SelectQuery, variable: SparqlJs.Term): boolean {
  if (SparqlTypeGuards.isStarProjection(query.variables)) {
    return true;
  }
  return query.variables.some(v => {
    const projectedVariable = SparqlTypeGuards.isVariable(v) ? v : v.variable;
    return projectedVariable === variable;
  });
}

export default SemanticSearchResult;
