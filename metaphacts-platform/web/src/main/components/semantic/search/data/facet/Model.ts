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
import * as _ from 'lodash';
import * as SparqlJs from 'sparqljs';

import * as SearchModel from '../search/Model';

/**
 * Representation of Facet's state.
 */
export interface Ast {
  conjuncts: Conjuncts
}

export interface Actions {
  /**
   * Update base query for the facets.
   */
  setBaseQuery: (query: SparqlJs.SelectQuery) => void

  /**
   * Action which is triggered when user select category in the category filter.
   */
  selectCategory: (category: SearchModel.Category) => void

  /**
   * Action which is triggered when user de-select category in the category filter.
   */
  deselectCategory: () => void


  /**
   * Action which is triggered when user expands facet relation.
   */
  selectRelation: (relation: SearchModel.Relation) => void

  /**
   * Action which is triggered when user collapse facet relation.
   */
  deselectRelation: () => void

  selectFacetValue: (relation: SearchModel.Relation) => (value: FacetValue) => void
  deselectFacetValue: (relation: SearchModel.Relation) => (value: FacetValue) => void

  /**
   * Action which is triggered when user removes all selected facets for relation.
   */
  removeConjunct: (conjunct: SearchModel.RelationConjunct) => void
}

export type Conjuncts = Array<FacetRelationConjunct>;
export type FacetRelationConjunct = SearchModel.RelationConjunct<FacetRelationDisjunct>;
export type FacetRelationDisjunct =
  SearchModel.ResourceDisjunct | SearchModel.DateRangeDisjunct |
  SearchModel.LiteralDisjunct | SearchModel.NumericRangeDisjunct;

export { DateRange, Literal, NumericRange } from '../search/Model';
export type FacetValue =
  SearchModel.Resource | SearchModel.DateRange | SearchModel.Literal | SearchModel.NumericRange;

/**
 * Only for Resource and Literal facet values
 */
export function partialValueEquals(x: FacetValue, y: FacetValue): boolean {
  if (_.has(x, 'literal') && _.has(y, 'literal')) {
    return (x as SearchModel.Literal).literal.equals((y as SearchModel.Literal).literal);
  } else if (_.has(x, 'iri') && _.has(y, 'iri')) {
    return (x as SearchModel.Resource).iri.equals((y as SearchModel.Resource).iri);
  } else {
    return false;
  }
}
