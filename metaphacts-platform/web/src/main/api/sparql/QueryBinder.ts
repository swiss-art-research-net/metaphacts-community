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
import * as SparqlJs from 'sparqljs';

import { Rdf } from 'platform/api/rdf';

import { QueryVisitor } from './QueryVisitor';
import { isTerm, isVariable } from './TypeGuards';

/**
 * Replaces variables with IRIs or literals.
 *
 * @example
 * const query = parseQuery('SELECT * WHERE { ?s ?foo ?bar }');
 * new VariableBinder({
 *   foo: Rdf.iri('http://example'),
 *   bar: Rdf.literal('Some bar'),
 * }).sparqlQuery(query);
 *
 * // result:
 * query === parseQuery('SELECT * WHERE { ?s <http://example> "Some bar" }')
 */
export class VariableBinder extends QueryVisitor {
  constructor(protected replacements: { [variableName: string]: Rdf.Node }) {
    super();
  }

  private tryReplace(termValue: string) {
    const replacement = this.replacements[termValue];
    return replacement;
  }

  variableTerm(variable: SparqlJs.VariableTerm) {
    const name = variable.value;
    return this.tryReplace(name);
  }
}

/**
 * Replaces variables in triple's predicate position with property path.
 * The specified path will be replaced with a single predicate if it's
 * consists of single item and path operation is '|' or '/'.
 *
 * @example
 * const query = parseQuery(`SELECT * WHERE {
 *   ?s ?p1 ?p1 .
 *   ?s ?p2 ?p2 .
 * }`);
 * new PropertyPathBinder({
 *   p1: {type: 'path', pathType: '/',
 *     items: ['http:a', 'http:b'] as SparqlJs.Term[]},
 *   p2: {type: 'path', pathType: '|',
 *     items: ['http:c'] as SparqlJs.Term[]},
 * }).sparqlQuery(query);
 *
 * // result:
 * query === parseQuery(`SELECT * WHERE {
 *   ?s <http:a> / <http:b> ?p1 .
 *   ?s <http:c> ?p2 .
 * }`);
 */
export class PropertyPathBinder extends QueryVisitor {
  constructor(protected replacements: {
    [propertyVariable: string]: SparqlJs.PropertyPath;
  }) {
    super();
  }

  variableTerm(variable: SparqlJs.VariableTerm): SparqlJs.Term | SparqlJs.PropertyPath {
    if (this.currentMember === 'predicate') {
      const propertyPath = this.replacements[variable.value];
      return PropertyPathBinder.normalize(propertyPath);
    }
  }

  static normalize(path: SparqlJs.PropertyPath): SparqlJs.PropertyPath | SparqlJs.Term {
    if (path === undefined) { return undefined; }
    const type = path.pathType;
    if (path.items.length === 1 && (type === '|' || type === '/')) {
      const item = path.items[0];
      return isTerm(item) ? item : PropertyPathBinder.normalize(item);
    }
    return path;
  }
}

/**
 * Applies specified RegExp to every literal.
 *
 * @example
 * const query = parseQuery('SELECT * WHERE { ?s ?p "text TOKEN othertext" }');
 * new TextBinder([
 *   {test: /TOKEN/, replace: 'replacement'}
 * ]).sparqlQuery(query);
 *
 * // result:
 * query === parseQuery('SELECT * WHERE { ?s ?p "text replacement othertext" }')
 */
export class TextBinder extends QueryVisitor {
  constructor(protected replacements: Array<{ test: RegExp, replace: string }>) {
    super();
  }

  literal(literal: SparqlJs.LiteralTerm): SparqlJs.Term {
    for (const {test, replace} of this.replacements) {
      if (test.test(literal.value)) {
        const newValue = literal.value.replace(test, replace);
        return literal.language
          ? Rdf.langLiteral(newValue, literal.language)
          : Rdf.literal(newValue, literal.datatype);
      }
    }
    return undefined;
  }
}

/**
 * Replaces `FILTER(?placeholder)` pattern with any number of other query patterns.
 *
 * @example
 * const triples = [{subject: '?s', predicate: '?p', object: '?o'}];
 * const query = parseQuery('SELECT * WHERE { FILTER(?foo) }');
 * new PatternBinder('foo', [{type: 'bgp', triples}]).sparqlQuery(query);
 *
 * // result:
 * query === parseQuery('SELECT * WHERE { ?s ?p ?o }')
 */
export class PatternBinder extends QueryVisitor {
  private readonly placeholder: SparqlJs.VariableTerm;
  private readonly patterns: ReadonlyArray<SparqlJs.Pattern>;
  private placeholderFound = false;

  constructor(filterPlaceholder: string, patterns: ReadonlyArray<SparqlJs.Pattern>) {
    super();
    this.placeholder = Rdf.DATA_FACTORY.variable(filterPlaceholder);
    this.patterns = patterns;
  }

  filter(pattern: SparqlJs.FilterPattern): SparqlJs.Pattern {
    if (isVariable(pattern.expression) && pattern.expression.equals(this.placeholder)) {
      this.placeholderFound = true;
      return undefined;
    } else {
      return super.filter(pattern);
    }
  }

  protected walkItem(nodes: any[], index: number, walk: (node: any) => any): number {
    const newIndex = super.walkItem(nodes, index, walk);
    if (this.placeholderFound) {
      this.placeholderFound = false;
      nodes.splice(index, 1, ...this.patterns);
      return index + this.patterns.length;
    }
    return newIndex;
  }
}

/**
 * Renames every `?(fromVariable)` variable to `?(toVariable)`.
 *
 * @example
 * const query = parseQuery('SELECT ?foo WHERE { ?foo ?p "bar" }');
 * new VariableRenameBinder('foo', 'qux').sparqlQuery(query);
 *
 * // result:
 * query === parseQuery('SELECT ?qux WHERE { ?qux ?p "bar" }')
 */
export class VariableRenameBinder extends QueryVisitor {
  constructor(
    private fromVariable: string,
    private toVariable: string
  ) { super(); }

  variableTerm(variable: SparqlJs.VariableTerm) {
    if (variable.value === this.fromVariable) {
      return Rdf.DATA_FACTORY.variable(this.toVariable);
    }
  }
}
