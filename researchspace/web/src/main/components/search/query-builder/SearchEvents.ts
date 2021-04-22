/*
 * Copyright (C) 2015-2020, © Trustees of the British Museum
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
import { EventMaker } from 'platform/api/events';

/**
 * @mpSchemaMetadata {"kind": "events"}
 */
export interface SemanticSearchQueryBuilderEventData {
  /**
   * Event which should be triggered when domain or range or predicate is selected.
   */
  'Search.CategoryOrRelationSelected': string;
  /**
   * Event which should be triggered when tree selector selection is submitted.
   */
  'Search.TreeInputSelected': string;
  /**
   * Event which should be triggered when AND conjunction is clicked.
   */
  'Search.AndConjunctSelected': {};
  /**
   * Event which should be triggered when AND conjunction is clicked.
   */
  'Search.OrDisjunctSelected': {};
  /**
   * Event which should be triggered when date format dropdown is selected.
   */
  'Search.SelectDateFormatOpened': {};
  /**
   * Event which should be triggered when date format is selected.
   */
  'Search.DateFormatSelected': string;
  /**
   * Event which should be triggered when date format is submitted.
   */
  'Search.DateFormatSubmitted': {};
}

/**
 * @mpSchemaMetadata {"kind": "events"}
 */
export interface SemanticSearchFacetEventData {
  /**
   * Event which should be triggered when facets are toggled.
   */
  'Search.FilterToggled': {};
  /**
  * Event which should be triggered when a facet category is selected.
  */
  'Search.FacetCategorySelected': string;
  /**
  * Event which should be triggered when a facet property is selected.
  */
  'Search.FacetPropertySelected': string;
}

const event: EventMaker<
  SemanticSearchQueryBuilderEventData & SemanticSearchFacetEventData
> = EventMaker;

export const CategoryOrRelationSelected = event('Search.CategoryOrRelationSelected');
export const SearchTreeInputSelected = event('Search.TreeInputSelected');
export const SearchAndConjunctSelected = event('Search.AndConjunctSelected');
export const SearchOrDisjunctSelected = event('Search.OrDisjunctSelected');
export const SearchSelectDateFormatOpened = event('Search.SelectDateFormatOpened');
export const SearchDateFormatSelected = event('Search.DateFormatSelected');
export const SearchDateFormatSubmitted = event('Search.DateFormatSubmitted');

export const SearchFilterToggled = event('Search.FilterToggled');
export const SearchFacetCategorySelected = event('Search.FacetCategorySelected');
export const SearchFacetPropertySelected = event('Search.FacetPropertySelected');
