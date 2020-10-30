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
import { DataQuery } from 'platform/api/dataClient';

export interface SemanticSimpleSearchBaseConfig {
  /**
   * User input variable name.
   *
   * @default __token__
   */
  searchTermVariable?: string;

  /**
   * Minimum number of input characters that triggers the search.
   *
   * @default 3
   */
  minSearchTermLength?: number;

  /**
   * Input placeholder.
   */
  placeholder?: string;

  /**
   * A flag determining whether any special Lucene syntax will be escaped.
   * When `false` lucene syntax in the user input is not escaped.
   *
   * Deprecated: escaping will be applied automatically based on SPARQL query.
   *
   * @deprecated Escaping will be applied automatically based on SPARQL query.
   */
  escapeLuceneSyntax?: boolean;

  /**
   * A flag determining whether the user input is tokenized by whitespace into
   * words postfixed by `*`.
   * E.g. the search for `Hello World` becomes `Hello* World*`.
   *
   * Deprecated: tokenization will be applied automatically based on SPARQL query.
   *
   * @deprecated Tokenization will be applied automatically based on SPARQL query.
   */
  tokenizeLuceneQuery?: boolean;
}

export interface SemanticSimpleSearchConfig extends SemanticSimpleSearchBaseConfig {
  /**
   * SPARQL SELECT query string or <semantic-link uri='http://help.metaphacts.com/resource/DataClient'>DataClient</semantic-link> query.
   *
   * Needs to have a variable `?__token__` serving as placeholder for the user input.
   * Note that the name of this variable can be customized using `searchTermVariable`.
   *
   * Default value:
   * ```
   * PREFIX lookup: <http://www.metaphacts.com/ontologies/platform/repository/lookup#>
   * SELECT ?resource WHERE {
   *    SERVICE Repository:lookup {
   *      ?resource lookup:token ?__token__ .
   *    }
   * }
   * ```
   */
  query?: string | DataQuery;

  /**
   * SPARQL SELECT query string or <semantic-link uri='http://help.metaphacts.com/resource/DataClient'>DataClient</semantic-link> query to show default
   * suggestions without the need for the user to type anything if specified.
   */
  defaultQuery?: string | DataQuery;

  /**
   * Name of the binding being used for result.
   */
  resourceBindingName?: string;

  /**
   * <semantic-link uri='http://help.metaphacts.com/resource/FrontendTemplating'>Template</semantic-link> for suggestion item.
   */
  template?: string;
}
