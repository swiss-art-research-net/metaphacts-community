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
import * as Kefir from 'kefir';
import * as SparqlJs from 'sparqljs';

import { Rdf } from 'platform/api/rdf';
import { SearchProfileStore } from '../data/profiles/SearchProfileStore';
import * as Model from '../data/search/Model';
import * as FacetModel from '../data/facet/Model';
import { Dataset, Alignment } from '../data/datasets/Model';
import { SemanticSearchConfig } from '../config/SearchConfig';

export type ExtendedSearchValue = Model.Resource | { label: string; query: SparqlJs.SelectQuery };

export type SemanticSearchContext =
  InitialQueryContext & ResultContext & FacetContext & ConfigurationContext & GraphScopeContext;

export const SemanticSearchContext = React.createContext<SemanticSearchContext>(undefined);

export interface BaseSearchContext {
  readonly domain: Data.Maybe<Model.Category>;
  readonly availableDomains: Data.Maybe<Model.AvailableDomains>;
  readonly baseConfig: SemanticSearchConfig;
  readonly searchProfileStore: Data.Maybe<SearchProfileStore>;
  readonly availableDatasets: Array<Dataset>;
  readonly selectedDatasets: Array<Dataset>;
  readonly selectedAlignment: Data.Maybe<Alignment>;
  readonly visualizationContext: Data.Maybe<Model.Relation>;
}

export interface ConfigurationContext extends BaseSearchContext {
  setSelectedDatasets(datasets: Array<Dataset>): void;
  setSelectedAlignment(alignment: Data.Maybe<Alignment>): void;
}

export interface InitialQueryContext extends BaseSearchContext {
  readonly extendedSearch: Data.Maybe<{ value: ExtendedSearchValue; range: Model.Category }>;
  readonly baseQueryStructure: Data.Maybe<Model.Search>;
  setDomain(domain: Model.Category): void;
  setAvailableDomains(availableDomains: Model.AvailableDomains): void;
  setBaseQuery(query: Data.Maybe<SparqlJs.SelectQuery>): void;
  setBaseQueryStructure(queryStructure: Data.Maybe<Model.Search>): void;
  setSearchProfileStore(profileStore: SearchProfileStore): void;
}

export interface FacetContext extends BaseSearchContext {
  readonly baseQuery: Data.Maybe<SparqlJs.SelectQuery>;
  readonly baseQueryStructure: Data.Maybe<Model.Search>;
  readonly resultsStatus: { loaded: boolean; count: number | undefined };
  readonly facetStructure: Data.Maybe<FacetModel.Ast>;
  readonly facetActions: Data.Maybe<FacetModel.Actions>;
  setFacetStructure(structure: FacetModel.Ast): void;
  setFacetedQuery(query: SparqlJs.SparqlQuery): void;
  setFacetActions(actions: FacetModel.Actions): void;
}

export type ResultOperation =
  { type: 'count'; task: Kefir.Property<number> } |
  { type: 'other'; task: Kefir.Property<void> };

export interface ResultContext extends BaseSearchContext {
  readonly resultQuery: Data.Maybe<SparqlJs.SelectQuery>;
  readonly baseQueryStructure: Data.Maybe<Model.Search>;
  readonly facetStructure: Data.Maybe<FacetModel.Ast>;
  useInExtendedFcFrSearch(
    item: { value: ExtendedSearchValue; range: Model.Category }
  ): void;
  readonly bindings: { [variable: string]: Rdf.Node };
  notifyResultLoading(operation: ResultOperation): void;
  readonly resultState: { [componentId: string]: object };
  updateResultState(componentId: string, stateChange: object): void;
  setVisualizationContext(relation: Data.Maybe<Model.Relation>): void;
  readonly extendedVisualizationContext?: VisualizationContext;
}

export interface VisualizationContext {
  readonly properties: ReadonlyArray<VisualizationContextProperty>;
  readonly addProjection: boolean;
}

export interface VisualizationContextProperty {
  readonly relation: Model.Relation;
  /** SPARQL variable name without leading "?" or "$". */
  readonly variableName: string;
}

export interface GraphScopeContext extends BaseSearchContext {
  readonly graphScopeResults: Data.Maybe<Model.GraphScopeResults>;
  setGraphScopeResults(graphScopeResults: Data.Maybe<Model.GraphScopeResults>): void;
}
