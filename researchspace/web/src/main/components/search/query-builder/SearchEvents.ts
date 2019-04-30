/*
 * Copyright (C) 2015-2019, © Trustees of the British Museum
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

import { EventType } from 'platform/api/events';

/**
 * Event which should be triggered when domain or range or predicate is selected.
 */
export const CategoryOrRelationSelected: EventType<string> = 'Search.CategoryOrRelationSelected';
/**
 * Event which should be triggered when tree selector selection is submitted.
 */
export const SearchTreeInputSelected: EventType<string> = 'Search.TreeInputSelected';
/**
 * Event which should be triggered when AND conjunction is clicked.
 */
export const SearchAndConjunctSelected: EventType<void> = 'Search.AndConjunctSelected';
/**
 * Event which should be triggered when AND conjunction is clicked.
 */
export const SearchOrDisjunctSelected: EventType<void> = 'Search.OrDisjunctSelected';
/**
 * Event which should be triggered when date format dropdown is selected.
 */
export const SearchSelectDateFormatOpened: EventType<void> = 'Search.SelectDateFormatOpened';
/**
 * Event which should be triggered when date format is selected.
 */
export const SearchDateFormatSelected: EventType<string> = 'Search.DateFormatSelected';
/**
 * Event which should be triggered when date format is submitted.
 */
export const SearchDateFormatSubmitted: EventType<void> = 'Search.DateFormatSubmitted';
/**
 * Event which should be triggered when facets are toggled.
 */
export const SearchFilterToggled: EventType<void> = 'Search.FilterToggled';
/**
 * Event which should be triggered when a facet category is selected.
 */
export const SearchFacetCategorySelected: EventType<string> = 'Search.FacetCategorySelected';
/**
 * Event which should be triggered when a facet property is selected.
 */
export const SearchFacetPropertySelected: EventType<string> = 'Search.FacetPropertySelected';
