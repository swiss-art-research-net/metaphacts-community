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

import * as PropTypes from 'prop-types';
import * as Kefir from 'kefir';
import * as SparqlJs from 'sparqljs';

import { Rdf } from 'platform/api/rdf';
import { SearchProfileStore } from '../data/profiles/SearchProfileStore';
import * as Model from '../data/search/Model';
import * as FacetModel from '../data/facet/Model';
import { Dataset, Alignment } from '../data/datasets/Model';
import { SemanticSearchConfig } from '../config/SearchConfig';

export type ExtendedSearchValue = Model.Resource | {label: string; query: SparqlJs.SelectQuery}

export type SemanticSearchContext =
  InitialQueryContext & ResultContext & FacetContext & ConfigurationContext & GraphScopeContext;

export interface BaseSearchContext {
  domain: Data.Maybe<Model.Category>
  availableDomains: Data.Maybe<Model.AvailableDomains>
  baseConfig: SemanticSearchConfig
  searchProfileStore: Data.Maybe<SearchProfileStore>
  availableDatasets: Array<Dataset>
  selectedDatasets: Array<Dataset>
  selectedAlignment: Data.Maybe<Alignment>
  isConfigurationEditable: boolean
  visualizationContext: Data.Maybe<Model.Relation>
}

export const BaseSearchContextTypes: Record<keyof BaseSearchContext, any> = {
  domain: PropTypes.any.isRequired,
  availableDomains: PropTypes.any.isRequired,
  baseConfig: PropTypes.any.isRequired,
  searchProfileStore: PropTypes.any.isRequired,
  availableDatasets: PropTypes.any.isRequired,
  selectedDatasets: PropTypes.any.isRequired,
  selectedAlignment: PropTypes.any.isRequired,
  isConfigurationEditable: PropTypes.bool.isRequired,
  visualizationContext: PropTypes.any.isRequired,
};

export interface ConfigurationContext extends BaseSearchContext {
  setSelectedDatasets(datasets: Array<Dataset>)
  setSelectedAlignment(alignment: Data.Maybe<Alignment>)
}

export const ConfigurationContextTypes: Record<keyof ConfigurationContext, any> = {
  ...BaseSearchContextTypes,
  setSelectedDatasets: PropTypes.func.isRequired,
  setSelectedAlignment: PropTypes.func.isRequired,
};


export interface InitialQueryContext extends BaseSearchContext {
  extendedSearch: Data.Maybe<{value: ExtendedSearchValue, range: Model.Category}>
  baseQueryStructure: Data.Maybe<Model.Search>
  setDomain(domain: Model.Category)
  setAvailableDomains(availableDomains: Model.AvailableDomains)
  setBaseQuery(query: Data.Maybe<SparqlJs.SelectQuery>)
  setBaseQueryStructure(queryStructure: Data.Maybe<Model.Search>)
  setSearchProfileStore(profileStore: SearchProfileStore);
}

export const InitialQueryContextTypes: Record<keyof InitialQueryContext, any> = {
  ...BaseSearchContextTypes,
  extendedSearch: PropTypes.any.isRequired,
  baseQueryStructure: PropTypes.any.isRequired,
  setDomain: PropTypes.func.isRequired,
  setAvailableDomains: PropTypes.func.isRequired,
  setBaseQuery: PropTypes.func.isRequired,
  setBaseQueryStructure: PropTypes.func.isRequired,
  setSearchProfileStore: PropTypes.func.isRequired,
};

export interface FacetContext extends BaseSearchContext {
  baseQuery: Data.Maybe<SparqlJs.SelectQuery>
  baseQueryStructure: Data.Maybe<Model.Search>
  resultsStatus: { loaded: boolean; count: number | undefined; }
  facetStructure: Data.Maybe<FacetModel.Ast>
  facetActions: Data.Maybe<FacetModel.Actions>
  setFacetStructure(structure: FacetModel.Ast)
  setFacetedQuery(query: SparqlJs.SparqlQuery)
  setFacetActions(actions: FacetModel.Actions)
}

export const FacetContextTypes: Record<keyof FacetContext, any> = {
  ...BaseSearchContextTypes,
  baseQuery: PropTypes.any.isRequired,
  baseQueryStructure: PropTypes.any.isRequired,
  resultsStatus: PropTypes.object.isRequired,
  facetStructure: PropTypes.any.isRequired,
  facetActions: PropTypes.any.isRequired,
  setFacetStructure: PropTypes.func.isRequired,
  setFacetedQuery: PropTypes.func.isRequired,
  setFacetActions: PropTypes.func.isRequired,
};

export type ResultOperation =
  { type: 'count'; task: Kefir.Property<number> } |
  { type: 'other'; task: Kefir.Property<void> };

export interface ResultContext extends BaseSearchContext {
  resultQuery: Data.Maybe<SparqlJs.SelectQuery>
  baseQueryStructure: Data.Maybe<Model.Search>
  facetStructure: Data.Maybe<FacetModel.Ast>
  useInExtendedFcFrSearch(
    item: {value: ExtendedSearchValue, range: Model.Category}
  )
  bindings: {[variable: string]: Rdf.Node}
  notifyResultLoading(operation: ResultOperation)
  resultState: { [componentId: string]: object }
  updateResultState(componentId: string, stateChange: object)
  setVisualizationContext(relation: Data.Maybe<Model.Relation>)
}

export const ResultContextTypes: Record<keyof ResultContext, any> = {
  ...BaseSearchContextTypes,
  resultQuery: PropTypes.any.isRequired,
  baseQueryStructure: PropTypes.any.isRequired,
  facetStructure: PropTypes.any.isRequired,
  useInExtendedFcFrSearch: PropTypes.any.isRequired,
  bindings: PropTypes.any.isRequired,
  notifyResultLoading: PropTypes.func.isRequired,
  resultState: PropTypes.object.isRequired,
  updateResultState: PropTypes.func.isRequired,
  setVisualizationContext: PropTypes.func.isRequired,
};

export interface GraphScopeContext extends BaseSearchContext {
  graphScopeStructure: Data.Maybe<Model.GraphScopeSearch>;
  graphScopeResults: Data.Maybe<Model.GraphScopeResults>;
  setGraphScopeStructure(graphScopeStructure: Data.Maybe<Model.GraphScopeSearch>);
  setGraphScopeResults(graphScopeResults: Data.Maybe<Model.GraphScopeResults>);
}

export const GraphScopeContextTypes: Record<keyof GraphScopeContext, any> = {
  ...BaseSearchContextTypes,
  graphScopeStructure: PropTypes.any.isRequired,
  graphScopeResults: PropTypes.any.isRequired,
  setGraphScopeStructure: PropTypes.func.isRequired,
  setGraphScopeResults: PropTypes.func.isRequired,
}
