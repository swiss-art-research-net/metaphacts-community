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
import { CSSProperties } from 'react';

export interface SetManagementConfig {
  /**
   * SPARQL SELECT query to fetch sets and set items, perform search.
   *
   * Query bindings:
   *   - `?__rootSet__` refers to a set or the set container;
   *   - `?__isSearch__` is `true` when performing search otherwise false;
   *   - `?__setToSearch__` refers to a set to perform search within;
   *   - `FILTER(?__filterPatterns__)` is replaced by keyword and additional
   *     filter patterns when performing search;
   *   `?__preferredLabel__` refers to preferred label predicate for elements.
   *
   * Result tuple:
   *   - `item` refers to set IRI or set item IRI;
   *   - `itemHolder` refers to set item holder IRI which can be used to remove the item from set;
   *   - `parent` refers to IRI of set's container or item's parent set;
   *   - `kind` refers to item kind (set or set item, see `item-config`);
   *
   * **Default**:
   * ```
   *   PREFIX ldp: <http://www.w3.org/ns/ldp#>
   *   PREFIX prov: <http://www.w3.org/ns/prov#>
   *   PREFIX platform: <http://www.metaphacts.com/ontologies/platform#>
   *   PREFIX bds: <http://www.bigdata.com/rdf/search#>
   *   SELECT ?item ?itemHolder ?parent ?modificationDate ?kind WHERE {
   *     {
   *       FILTER(!(?__isSearch__)) .
   *       ?__rootSet__ ldp:contains ?itemHolder .
   *       BIND(?__rootSet__ as ?parent) .
   *       OPTIONAL { ?itemHolder platform:setItem ?setItem }
   *       BIND(COALESCE(?setItem, ?itemHolder) AS ?item) .
   *     } UNION {
   *       FILTER(?__isSearch__) .
   *       ?__rootSet__ ldp:contains ?__setToSearch__ .
   *       ?__setToSearch__ ldp:contains ?itemHolder.
   *       BIND(?__setToSearch__ as ?parent) .
   *       ?itemHolder platform:setItem ?item .
   *       FILTER(?__filterPatterns__)
   *     }
   *
   *     OPTIONAL {
   *       ?itemHolder prov:generatedAtTime ?modificationDate .
   *     }
   *
   *     OPTIONAL {
   *       ?item a platform:Set .
   *       BIND(platform:Set as ?type)
   *     }
   *     BIND(COALESCE(?type, platform:SetItem) AS ?kind) .
   *   } ORDER BY DESC(?modificationDate)
   * ```
   */
  setItemsQuery?: string;
  /**
   * SPARQL SELECT query parametrized by results of `set-items-query` and used to
   * retrieve additional metadata for sets or set items that can be used in
   * visualization templates.
   *
   * `VALUES()` bindings:
   *   - `?item` refers to set or set item;
   *   - `?kind` refers to item kind (set or set item, see `item-config`);
   *
   * Result tuple:
   *   - `item` refers to set IRI or set item IRI;
   *
   * **Default**:
   * ```
   *   SELECT ?item WHERE { }
   * ```
   */
  setItemsMetadataQuery?: string;
  /**
   * SPARQL SELECT query to fetch set item counts.
   *
   * Query bindings:
   *   - `?__rootSet__` refers to a set or the set container;
   *
   * Result tuple:
   *   - `set` refers to set IRI;
   *   - `count` refers to set item count;
   *
   * **Default**:
   * ```
   *   PREFIX ldp: <http://www.w3.org/ns/ldp#>
   *   SELECT ?set (COUNT(?item) as ?count) WHERE {
   *      ?__rootSet__ ldp:contains ?set .
   *      OPTIONAL { ?set ldp:contains ?item }
   *   } GROUP BY ?set
   * ```
   */
  setCountQuery?: string;
  /**
   * SPARQL ASK query to check whether it's allowed to add item to the set.
   *
   * Query bindings:
   *   - `?value` refers to the added item;
   */
  acceptResourceQuery?: string;
  /**
   * Mapping from item kind to it's metadata.
   */
  itemConfig?: ItemConfig;
  /**
   * Configuration for text search.
   */
  keywordFilter?: KeywordFilter;
  /**
   * Configuration for additional filters in search.
   */
  filters?: SetFilter[];
  /**
   * IRI of a top-level set container.
   */
  rootSetIri?: string;
  /**
   * IRI of a default set (which contains uncategorized items).
   */
  defaultSetIri?: string;
  /**
   * Disallow addition, deletion or changes of sets and set items.
   */
  readonly?: boolean;
  /**
   * Suffix for local storage ID.
   */
  id?: string;
  /**
   * Default view mode for set items.
   *
   * @default "list"
   */
  defaultViewMode?: ItemViewMode;
  /**
   * Whether should persist view mode to local storage.
   *
   * @default true
   */
  persistViewMode?: boolean;
  /**
   * Additional styles for component.
   */
  style?: CSSProperties;
}

export type ItemViewMode = 'list' | 'grid';

export interface ItemConfig {
  [type: string]: {
    /**
     * `true` if element is a set; otherwise `false`.
     */
    isSet: boolean;
    /**
     * Custom template for rendering item in grid mode.
     */
    gridTemplate: string;
    /**
     * Custom template for rendering item in list mode.
     */
    listTemplate: string;
  };
}

export interface KeywordFilter {
  /**
   * Placeholder text for search term input.
   */
  placeholder: string;
  /**
   * Placeholder text for search term input when a set is open.
   * If not specified `placeholder` will be used instead.
   */
  placeholderInSet?: string;
  /**
   * SPARQL query pattern inserted into search query to search for items.
   *
   * Query bindings:
   *   - `?__token__` (inside string literals) refers to the search input text;
   */
  queryPattern: string;
  /**
   * Minimal number of characters of the text input to begin the search.
   */
  minSearchTermLength?: number;
}

export interface SetFilter {
  /**
   * Placeholder text for suggestion term input.
   */
  placeholder: string;
  /**
   * SPARQL query pattern inserted into search query to filter items.
   *
   * Query bindings:
   *   - `?__value__` refers to filter's selected value;
   */
  queryPattern: string;
  /**
   * SPARQL SELECT query for filter value autosuggestion.
   *
   * Query bindings:
   *   - `?token` (inside string literals) refers to filter input text;
   */
  suggestionsQuery: string;
}
