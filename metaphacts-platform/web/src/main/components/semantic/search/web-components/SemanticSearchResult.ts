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

import {
  Component, Props as ReactProps, Children, cloneElement, ReactElement, ReactNode, createElement,
} from 'react';
import * as Kefir from 'kefir';
import * as _ from 'lodash';
import * as SparqlJs from 'sparqljs';

import { Cancellation } from 'platform/api/async';
import {
  hasBaseDerivedRelationship, hasControlledProps, ControlledPropsHandler, universalChildren,
} from 'platform/components/utils';
import {
  BuiltInEvents, listen
} from 'platform/api/events';
import { Rdf } from 'platform/api/rdf';
import { SparqlUtil, SparqlClient, PatternBinder } from 'platform/api/sparql';
import { ErrorNotification } from 'platform/components/ui/notification';

import { ResultsNumber } from 'platform/components/semantic/results';

import {
  ResultContext, ResultContextTypes,
} from './SemanticSearchApi';
import {
  SEMANTIC_SEARCH_VARIABLES, RESULT_VARIABLES,
  Resource as PatternResource, Literal as PatternLiteral,
  DateRange as PatternDateRange, NumericRange as PatternNumericRange
} from '../config/SearchConfig';
import { transformRangePattern } from '../data/Common';
import {
  tryGetRelationPatterns, generateQueryForMultipleDatasets,
} from '../data/search/SparqlQueryGenerator';

import { RelationKey } from 'platform/components/semantic/search/data/search/Model';

interface ResultComponentProps extends ReactProps<SemanticSearchResult> {}
type Bindings = {[variable: string]: Rdf.Node};

interface State {
  error?: string
}

class SemanticSearchResult extends Component<ResultComponentProps, State> {
  static contextTypes = ResultContextTypes;
  context: ResultContext;

  private readonly cancellation = new Cancellation();

  constructor(props: ResultComponentProps, context: ResultContext) {
    super(props, context);
    this.state = {};
  }

  shouldComponentUpdate(props: ResultComponentProps, state: {}, context: ResultContext) {
    if (
      !_.isEqual(context.resultQuery.getOrElse(null), this.context.resultQuery.getOrElse(null)) ||
      !_.isEqual(context.bindings, this.context.bindings) || !_.isEqual(this.state, state) ||
      !context.availableDomains.isEqual(this.context.availableDomains)
    ) {
      return true;
    } else {
      return false;
    }
  }

  componentWillUnmount() {
    this.cancellation.cancelAll();
  }

  render() {
    if (this.state.error) {
      return createElement(ErrorNotification, {errorMessage: this.state.error});
    } else {
      return this.mapChildren(this.props.children);
    }
  }


  private listenToChildLoading = (child: ReactElement<any>) => {
    if (child) {
      if (typeof child !== 'string' && child.props.id) {
        this.cancellation.map(
          listen({
            eventType: BuiltInEvents.ComponentLoading,
            source: child.props.id,
          })
        ).observe({
          value: e => {
            const isResultCount = hasBaseDerivedRelationship(ResultsNumber, child);
            this.context.notifyResultLoading(
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
  private mapChildren(children: ReactNode) {
    return universalChildren(
      Children.toArray(children).map(child => {
        if (_.isString(child) || _.isNumber(child)) {
          return child;
        } else {
          if (_.has(child.props, 'query')) {
            const controlled = this.tryMakeControlled(child);
            return this.buildResultQuery(this.props, this.context, child.props.query).map(
              query => this.updateChildQuery(controlled, query)
            ).getOrElse(null);
          } else {
            return cloneElement(
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
  private tryMakeControlled(child: ReactElement<any>) {
    if (hasControlledProps(child.type) && child.props.id) {
      const handler: ControlledPropsHandler<object> = {
        onControlledPropChange: (propsChange: object) => {
          this.context.updateResultState(child.props.id, propsChange);
        },
      };
      const controlledProps = this.context.resultState[child.props.id] || {};
      return cloneElement(child, {...controlledProps, ...handler});
    }
    return child;
  }

  private updateChildQuery(child: ReactElement<any>, newQuery: string) {
    this.listenToChildLoading(child);
    let newConfig = _.assign(
      {}, child.props, {query: newQuery}
    );
    return cloneElement(child, newConfig, child.props.children);
  }

  private buildResultQuery = (
    props: ResultComponentProps, context: ResultContext, query: string
  ) => {
    return context.resultQuery.map(
      subQuery => {
        const baseQuery = SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(query);
        baseQuery.where.unshift(...subQuery.where);
        const projectionVar = subQuery.variables[0] as string;

        // if subQuery projection variable is different from default we need to make sure that
        // the result is still available under default variable (?subject)
        if (projectionVar.substring(1) !== SEMANTIC_SEARCH_VARIABLES.PROJECTION_ALIAS_VAR) {
          baseQuery.where.push({
            expression: projectionVar as SparqlJs.Term,
            type: 'bind',
            variable: ('?' + SEMANTIC_SEARCH_VARIABLES.PROJECTION_ALIAS_VAR) as SparqlJs.Term,
          });
        }

        // override limit only when query doesn't already have one
        if (!baseQuery.limit && this.context.baseConfig.limit) {
          baseQuery.limit = context.baseConfig.limit;
        }
        // if context is set for result visualization we also need to
        // rewrite the query to take into account virtual relations
        if (_.has(context.bindings, RESULT_VARIABLES.CONTEXT_RELATION_VAR)) {
          this.bindRelationPattern(baseQuery, context.bindings);
        }

        const queryWithBindings = SparqlClient.setBindings(baseQuery, this.context.bindings);
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
  private bindRelationPattern = (query: SparqlJs.Query, bindings: Bindings) => {
    this.context.searchProfileStore.map(
      profileStore => {
        const relation =
          this.context.visualizationContext.getOrElse(profileStore.relations.first());
        const patternConfig = tryGetRelationPatterns(
          this.context.baseConfig, relation
        ).find(
          p => p.kind === 'resource' || p.kind === 'literal' || p.kind === 'date-range' || p.kind === 'numeric-range'
        ) as (PatternLiteral | PatternResource | PatternDateRange | PatternNumericRange);

        if (patternConfig) {
          let patterns =
            SparqlUtil.parsePatterns(
              patternConfig.queryPattern, query.prefixes
            );

          // when we are using date-range or numeric-range virtual pattern
          // as a context we need to make sure that we replace FILTERs with simple projections
          if (patternConfig.kind === 'date-range') {
            const range = {
              begin: SEMANTIC_SEARCH_VARIABLES.DATE_BEGING_VAR,
              end: SEMANTIC_SEARCH_VARIABLES.DATE_END_VAR,
            };
            patterns = transformRangePattern(patterns, range, range);
          } else if (patternConfig.kind === 'numeric-range') {
            const range = {
              begin: SEMANTIC_SEARCH_VARIABLES.NUMERIC_RANGE_BEGIN_VAR,
              end: SEMANTIC_SEARCH_VARIABLES.NUMERIC_RANGE_END_VAR,
            };
            patterns = transformRangePattern(patterns, range, range);
          }

          new PatternBinder(RESULT_VARIABLES.CONTEXT_RELATION_PATTERN_VAR, patterns)
            .sparqlQuery(query);
        }
        return query;
      });
  }
}

export default SemanticSearchResult;
