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
import { cloneDeep } from 'lodash';
import * as SparqlJs from 'sparqljs';

import { Rdf } from 'platform/api/rdf';
import {
  SparqlUtil, VariableBinder, VariableRenameBinder, PatternBinder,
} from 'platform/api/sparql';
import { ConfigHolder } from 'platform/api/services/config-holder';

import { ComplexTreePatterns } from './SemanticTreeInput';

export interface LightweightTreePatterns {
  /**
   * Binds to `?__scheme__` variable in the `schemePattern`
   */
  scheme?: string;
  /**
   * Input bindings: `?__scheme__`
   * Output bindings: `?item`
   */
  schemePattern?: string;
  /**
   * Output bindings: `?item`, `?parent`
   */
  relationPattern?: string;
}

export const DefaultLightweightPatterns = {
  schemePattern: '?item <http://www.w3.org/2004/02/skos/core#inScheme> ?__scheme__',
  relationPattern: '?item <http://www.w3.org/2004/02/skos/core#broader> ?parent',
};

export function createDefaultTreeQueries(
  params: LightweightTreePatterns = {}
): ComplexTreePatterns {
  const {
    schemePattern = DefaultLightweightPatterns.schemePattern,
    relationPattern = DefaultLightweightPatterns.relationPattern,
  } = params;

  const prefixes = SparqlUtil.parseQuery('SELECT * WHERE {}').prefixes;
  const relation = typeof relationPattern === 'string'
    ? SparqlUtil.parsePatterns(relationPattern, prefixes) : relationPattern;

  let scheme: ReadonlyArray<SparqlJs.Pattern> = [];
  if (params.scheme || params.schemePattern) {
    scheme = SparqlUtil.parsePatterns(schemePattern, prefixes);
    if (params.scheme) {
      const schemeIri = Rdf.iri(params.scheme);
      const binder = new VariableBinder({__scheme__: schemeIri});
      scheme.forEach(p => binder.pattern(p));
    }
  }

  const patterns = {relation, scheme};
  return {
    rootsQuery: SparqlUtil.serializeQuery(createRootsQuery(patterns)),
    childrenQuery: SparqlUtil.serializeQuery(createChildrenQuery(patterns)),
    parentsQuery: SparqlUtil.serializeQuery(createParentsQuery(patterns)),
    searchQuery: SparqlUtil.serializeQuery(createSearchQuery(patterns)),
  };
}

interface TreePatterns {
  /** Output bindings: `?item`, `?parent` */
  relation: ReadonlyArray<SparqlJs.Pattern>;
  /** Output bindings: `?item` */
  scheme: ReadonlyArray<SparqlJs.Pattern>;
}

function createRootsQuery({relation, scheme}: TreePatterns) {
  const {labelPropertyPattern} = ConfigHolder.getUIConfig();
  const query = SparqlUtil.parseQuery(`
    SELECT DISTINCT ?item ?label ?hasChildren WHERE {
      FILTER(?__scheme__)
      FILTER NOT EXISTS { { FILTER(?__relation__) } }
      ?item ${labelPropertyPattern} ?label .
      OPTIONAL { FILTER(?__childRelation__) }
      BIND(BOUND(?child) as ?hasChildren)
    } ORDER BY ?label
  `);
  const childRelation = bindTreePatterns(relation, {itemVar: 'child', parentVar: 'item'});
  new PatternBinder('__childRelation__', childRelation).sparqlQuery(query);
  new PatternBinder('__relation__', relation).sparqlQuery(query);
  new PatternBinder('__scheme__', scheme).sparqlQuery(query);
  return query;
}

function createChildrenQuery({relation, scheme}: TreePatterns) {
  const {labelPropertyPattern} = ConfigHolder.getUIConfig();
  const query = SparqlUtil.parseQuery(`
    SELECT DISTINCT ?item ?label ?hasChildren WHERE {
      FILTER(?__relation__)
      FILTER(?__scheme__)
      ?item ${labelPropertyPattern} ?label .
      OPTIONAL { FILTER(?__childRelation__) }
      BIND(BOUND(?child) as ?hasChildren)
    } ORDER BY ?label
  `);
  const childRelation = bindTreePatterns(relation, {itemVar: 'child', parentVar: 'item'});
  new PatternBinder('__childRelation__', childRelation).sparqlQuery(query);
  new PatternBinder('__relation__', relation).sparqlQuery(query);
  new PatternBinder('__scheme__', scheme).sparqlQuery(query);
  return query;
}

function createParentsQuery({relation, scheme}: TreePatterns) {
  const {labelPropertyPattern} = ConfigHolder.getUIConfig();
  const query = SparqlUtil.parseQuery(`
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
    select distinct ?item ?parent ?parentLabel where {
      FILTER(?__parentScheme__)
      FILTER(?__relation__)
      ?parent ${labelPropertyPattern} ?parentLabel .
    }
  `);
  const parentScheme = bindTreePatterns(scheme, {itemVar: 'parent'});
  new PatternBinder('__parentScheme__', parentScheme).sparqlQuery(query);
  new PatternBinder('__relation__', relation).sparqlQuery(query);
  return query;
}

function createSearchQuery({relation, scheme}: TreePatterns) {
  const query = SparqlUtil.parseQuery(`
    PREFIX lookup: <http://www.metaphacts.com/ontologies/platform/repository/lookup#>
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
    SELECT DISTINCT ?item ?label ?score ?hasChildren WHERE {
      SERVICE Repository:lookup {
        ?item lookup:token ?__token__;
          lookup:limit 400 .
      }
      FILTER(?__scheme__)
      OPTIONAL { FILTER(?__childRelation__) }
      BIND(BOUND(?child) AS ?hasChildren)
    }
    ORDER BY DESC(?score) ?label
    LIMIT 200
  `);
  const childRelation = bindTreePatterns(relation, {itemVar: 'child', parentVar: 'item'});
  new PatternBinder('__childRelation__', childRelation).sparqlQuery(query);
  new PatternBinder('__scheme__', scheme).sparqlQuery(query);
  return query;
}

function bindTreePatterns(
  treePattern: ReadonlyArray<SparqlJs.Pattern>,
  {itemVar, parentVar}: { itemVar: string; parentVar?: string; },
): SparqlJs.Pattern[] {
  const patternClone = cloneDeep(treePattern) as SparqlJs.Pattern[];

  if (itemVar !== 'item') {
    const sourceRenamer = new VariableRenameBinder('item', itemVar);
    patternClone.forEach(p => sourceRenamer.pattern(p));
  }

  if (parentVar && parentVar !== 'parent') {
    const targetRenamer = new VariableRenameBinder('parent', parentVar);
    patternClone.forEach(p => targetRenamer.pattern(p));
  }

  return patternClone;
}
