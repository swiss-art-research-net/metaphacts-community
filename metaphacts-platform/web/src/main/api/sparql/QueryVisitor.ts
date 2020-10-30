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
import * as Immutable from 'immutable';
import * as _ from 'lodash';
import * as SparqlJs from 'sparqljs';

import { Rdf } from 'platform/api/rdf';

import {
  isQuery, isStarProjection, isPattern, isBlockPattern, isExpression, isQuads,
  isTerm, isVariable, isLiteral, isBlank, isIri,
  isInsertDeleteOperation, isManagementOperation,
} from './TypeGuards';

export type QueryNodeCollection =
  | 'from.default' | 'from.named'
  | 'updates' | 'insert' | 'delete'
  | 'template' | 'variables' | 'where' | 'group' | 'having' | 'order'
  | 'triples' | 'patterns' | 'args' | 'items';
export type QueryNodeMember =
  | 'expression' | 'name' | 'variable' | 'values'
  | 'subject' | 'predicate' | 'object';

export class QueryVisitor {
  private nodeMember: QueryNodeCollection | QueryNodeMember;

  protected get currentMember() { return this.nodeMember; }

  protected visitMember<Node, Member extends (keyof Node) & QueryNodeMember>(
    node: Node,
    member: Member,
    visit: (this: this, x: Node[Member]) => Node[Member] | undefined
  ): Node[Member] | undefined {
    this.nodeMember = member;
    const memberName: Member = member;
    const result = visit.call(this, node[memberName]);
    if (result !== undefined) {
      node[memberName] = result;
    }
    return result;
  }

  sparqlQuery(sparqlQuery: SparqlJs.SparqlQuery): SparqlJs.SparqlQuery {
    if (sparqlQuery.type === 'query') {
      return this.query(sparqlQuery);
    } else if (sparqlQuery.type === 'update') {
      return this.update(sparqlQuery);
    }
  }

  query(query: SparqlJs.Query): SparqlJs.Query {
    if (query.queryType === 'SELECT') {
      const result = this.select(query);
      if (result === undefined) {
        return undefined;
      } else if (isQuery(result)) {
        return result;
      } else {
        throwUnexpected(
          result, {expected: 'Query', transformed: 'SelectQuery'});
      }
    } else if (query.queryType === 'CONSTRUCT') {
      return this.construct(query);
    } else if (query.queryType === 'ASK') {
      return this.ask(query);
    } else if (query.queryType === 'DESCRIBE') {
      return this.describe(query);
    }
  }

  update(update: SparqlJs.Update): SparqlJs.Update {
    this.walkArray('updates', update.updates, this.updateOperation);
    return undefined;
  }

  updateOperation(update: SparqlJs.UpdateOperation): SparqlJs.UpdateOperation {
    if (isInsertDeleteOperation(update)) {
      return this.insertDelete(update);
    } else if (isManagementOperation(update)) {
      return this.managementOperation(update);
    } else {
      console.warn(`Unknown UpdateOperation object ${JSON.stringify(update)}`);
      return undefined;
    }
  }

  insertDelete(
    operation: SparqlJs.InsertDeleteOperation
  ): SparqlJs.UpdateOperation {
    this.walkArray('insert', operation.insert, this.quads);
    this.walkArray('delete', operation.delete, this.quads);
    this.walkArray('where', operation.where, this.pattern);
    return undefined;
  }

  managementOperation(
    operation: SparqlJs.ManagementOperation
  ): SparqlJs.UpdateOperation {
    return undefined;
  }

  valuesRows(rows: SparqlJs.ValuePatternRow[]): SparqlJs.ValuePatternRow[] {
    const transforms = this.walkValuesVariables(rows);
    rows.forEach(row => {
      for (const variable in row) {
        if (row.hasOwnProperty(variable)) {
          let resultVariable = variable;

          const transformedVariable = transforms.get(variable);
          if (transformedVariable !== undefined) {
            row[transformedVariable] = row[variable];
            delete row[variable];
            resultVariable = transformedVariable;
          }

          const value = row[resultVariable];
          const valueResult = this.term(value);
          if (valueResult !== undefined) {
            row[resultVariable] = coerce(
              valueResult, isValuesRowValue,
              {expected: 'Term', transformed: 'VALUES row value'});
          }
        }
      }
    });
    return undefined;
  }

  /**
   * @return replacements for VALUES() block variables, in a form
   *   { oldVariableTerm -> newVariableTerm }
   */
  protected walkValuesVariables(
    rows: SparqlJs.ValuePatternRow[]
  ): Immutable.Map<string, string> {
    // find complete set of VALUES pattern variables
    // e.g. VALUES(?v1 ?v2 ?v3) -> {?v1, ?v2, ?v3}
    const variables = Immutable.List(rows).reduce((vars, row) => {
      for (const variable in row) {
        if (!row.hasOwnProperty(variable)) { continue; }
        vars = vars.add(variable);
      }
      return vars;
    }, Immutable.Set<string>());
    // try to transform each variable (walk over it)
    return variables.reduce((transforms, variable) => {
      // remove leading '?' from variable name
      const synthesizedVariable = Rdf.DATA_FACTORY.variable(variable.substring(1));
      const result = this.variableTerm(synthesizedVariable);
      if (result === undefined) {
        return transforms;
      } else if (isVariable(result)) {
        return transforms.set(variable, '?' + result.value);
      } else {
        throwUnexpected(result,
          {expected: 'Variable', transformed: 'variable Term'});
      }
    }, Immutable.Map<string, string>());
  }

  select(select: SparqlJs.SelectQuery): SparqlJs.Query | SparqlJs.Pattern {
    this.walkBaseQuery(select);
    this.walkProjectionVariables(select.variables);

    if (select.from) {
      const walkOnlyIri = (iri: SparqlJs.IriTerm) => coerce(
        this.iri(iri), isIri,
        {expected: 'IriTerm', transformed: 'SelectQuery.from'});
      this.walkArray('from.default', select.from.default, walkOnlyIri);
      this.walkArray('from.named', select.from.named, walkOnlyIri);
    }

    this.walkArray('group', select.group, this.grouping);
    this.walkArray('having', select.having, this.expression);
    this.walkArray('order', select.order, this.ordering);
    return undefined;
  }

  grouping(grouping: SparqlJs.Grouping): SparqlJs.Grouping {
    this.visitMember(grouping, 'expression', this.expression);
    return undefined;
  }

  ordering(ordering: SparqlJs.Ordering): SparqlJs.Ordering {
    this.visitMember(ordering, 'expression', this.expression);
    return undefined;
  }

  construct(construct: SparqlJs.ConstructQuery): SparqlJs.Query {
    this.walkBaseQuery(construct);
    this.walkArray('template', construct.template, this.triple);
    return undefined;
  }

  ask(ask: SparqlJs.AskQuery): SparqlJs.Query {
    this.walkBaseQuery(ask);
    return undefined;
  }

  describe(describe: SparqlJs.DescribeQuery): SparqlJs.Query {
    this.walkBaseQuery(describe);
    this.walkProjectionVariables(describe.variables);
    return undefined;
  }

  pattern(pattern: SparqlJs.Pattern): SparqlJs.Pattern {
    if (pattern.type === 'bgp') {
      return coerce(
        this.bgp(pattern), isPattern,
        {expected: 'Pattern', transformed: 'BgpPattern'});
    } else if (isBlockPattern(pattern)) {
      return this.block(pattern);
    } else if (pattern.type === 'filter') {
      return this.filter(pattern);
    } else if (pattern.type === 'bind') {
      return this.bind(pattern);
    } else if (pattern.type === 'values') {
      return this.valuesPattern(pattern);
    } else if (isQuery(pattern)) {
      const queryType: string = pattern.queryType;
      if (queryType !== 'SELECT') {
        throw new Error(
          `Invalid query Pattern: unexpected ${queryType} query`);
      }
      return coerce(
        this.select(pattern), isPattern,
        {expected: 'Pattern', transformed: 'SelectQuery'});
    } else {
      console.warn(`Unknown pattern '${JSON.stringify(pattern)}'`);
      return undefined;
    }
  }

  quads(quads: SparqlJs.Quads): SparqlJs.Quads {
    if (quads.type === 'bgp') {
      return coerce(
        this.bgp(quads), isQuads,
        {expected: 'Quads', transformed: 'BGP'});
    } else if (quads.type === 'graph') {
      return this.graphQuads(quads);
    } else {
      console.warn(`Unknown quads '${JSON.stringify(quads)}'`);
      return undefined;
    }
  }

  bgp(bgp: SparqlJs.BgpPattern): SparqlJs.Expression | SparqlJs.Pattern | SparqlJs.Quads {
    this.walkArray('triples', bgp.triples, this.triple);
    return undefined;
  }

  graphQuads(graphQuads: SparqlJs.GraphQuads): SparqlJs.Quads {
    this.visitMember(graphQuads, 'name', name => {
      const term = this.term(name);
      return coerce(
        term, isIri,
        {expected: 'IriTerm', transformed: 'GraphQuads.name'});
    });
    this.walkArray('triples', graphQuads.triples, this.triple);
    return undefined;
  }

  block(pattern: SparqlJs.BlockPattern): SparqlJs.Pattern {
    switch (pattern.type) {
      case 'optional':
        return this.optional(pattern);
      case 'union':
        return this.union(pattern);
      case 'group':
        return this.group(pattern);
      case 'graph':
        return this.graph(pattern);
      case 'minus':
        return this.minus(pattern);
      case 'service':
        return this.service(pattern);
      default: {
        const block = pattern as SparqlJs.BaseBlockPattern;
        console.warn(`Unknown block pattern type: "${block.type}"`);
        this.walkArray('patterns', block.patterns, this.pattern);
        return undefined;
      }
    }
  }

  optional(optional: SparqlJs.OptionalPattern): SparqlJs.Pattern {
    this.walkArray('patterns', optional.patterns, this.pattern);
    return undefined;
  }

  union(union: SparqlJs.UnionPattern): SparqlJs.Pattern {
    this.walkArray('patterns', union.patterns, this.pattern);
    return undefined;
  }

  group(group: SparqlJs.GroupPattern): SparqlJs.GroupPattern {
    this.walkArray('patterns', group.patterns, this.pattern);
    return undefined;
  }

  graph(graph: SparqlJs.GraphPattern): SparqlJs.Pattern {
    this.visitMember(graph, 'name', name => {
      const term = this.term(name);
      return coerce(
        term, isIri,
        {expected: 'IriTerm', transformed: 'GraphPattern.name'});
    });
    this.walkArray('patterns', graph.patterns, this.pattern);
    return undefined;
  }

  minus(minus: SparqlJs.MinusPattern): SparqlJs.Pattern {
    this.walkArray('patterns', minus.patterns, this.pattern);
    return undefined;
  }

  service(service: SparqlJs.ServicePattern): SparqlJs.Pattern {
    this.visitMember(service, 'name', name => {
      const term = this.term(name);
      return coerce(
        term, isIri,
        {expected: 'IriTerm', transformed: 'ServicePattern.name'});
    });
    this.walkArray('patterns', service.patterns, this.pattern);
    return undefined;
  }

  filter(pattern: SparqlJs.FilterPattern): SparqlJs.Pattern {
    this.visitMember(pattern, 'expression', this.expression);
    return undefined;
  }

  bind(pattern: SparqlJs.BindPattern): SparqlJs.Pattern {
    this.visitMember(pattern, 'expression', this.expression);
    this.visitMember(pattern, 'variable', variable => {
      const variableTerm = this.variableTerm(variable);
      return coerce(
        variableTerm, isVariable,
        {expected: 'VariableTerm', transformed: 'BindPattern.variable'});
    });
    return undefined;
  }

  valuesPattern(pattern: SparqlJs.ValuesPattern): SparqlJs.Pattern {
    this.visitMember(pattern, 'values', this.valuesRows);
    return undefined;
  }

  expression(expression: SparqlJs.Expression): SparqlJs.Expression {
    if (Array.isArray(expression)) {
      return this.tuple(expression);
    } else if (isTerm(expression)) {
      return coerce(
        this.term(expression) as unknown, isExpression,
        {expected: 'Expression', transformed: 'term-like Expression'});
    } else if (expression.type === 'operation') {
      return this.operation(expression);
    } else if (expression.type === 'functionCall') {
      return this.functionCall(expression);
    } else if (expression.type === 'aggregate') {
      return this.aggregate(expression);
    } else if (isPattern(expression)) {
      return this.walkPatternLikeExpression(expression);
    } else {
      console.warn(`Unknown expression '${JSON.stringify(expression)}'`);
      return undefined;
    }
  }

  protected walkPatternLikeExpression(
    expression: SparqlJs.Pattern & { type: 'bgp' | 'graph' | 'group' }
  ): SparqlJs.Expression {
    let result: SparqlJs.Expression | SparqlJs.Pattern | SparqlJs.Quads = undefined;
    if (expression.type === 'bgp') {
      result = this.bgp(expression);
    } else if (expression.type === 'graph' || expression.type === 'group') {
      result = this.block(expression);
    } else {
      console.warn(
        `Unknown pattern-like Expression type '${(expression as SparqlJs.Pattern).type}'`
      );
    }

    return coerce(
      result, isExpression,
      {expected: 'Expression', transformed: 'pattern-like Expression'});
  }

  operation(operation: SparqlJs.OperationExpression): SparqlJs.Expression {
    this.walkArray('args', operation.args, this.expression);
    return undefined;
  }

  functionCall(functionCall: SparqlJs.FunctionCallExpression): SparqlJs.Expression {
    this.walkArray('args', functionCall.args, this.expression);
    return undefined;
  }

  aggregate(aggregate: SparqlJs.AggregateExpression): SparqlJs.Expression {
    this.visitMember(aggregate, 'expression', this.expression);
    return undefined;
  }

  variable(variable: SparqlJs.Variable): SparqlJs.Variable {
    if (isTerm(variable)) {
      const variableTerm = this.variableTerm(variable);
      return coerce(
        variableTerm, isVariable,
        {expected: '?variable', transformed: 'variable Term'});
    } else {
      this.visitMember(variable, 'expression', this.expression);
      this.visitMember(variable, 'variable', variableName => {
        const variableTerm = this.variableTerm(variableName);
        return coerce(
          variableTerm, isVariable,
          {expected: '?variable', transformed: 'Variable.variable'});
      });
      return undefined;
    }
  }

  tuple(tuple: SparqlJs.Tuple): SparqlJs.Expression {
    this.walkArray<SparqlJs.Expression>(undefined, tuple, this.expression);
    return undefined;
  }

  triple(triple: SparqlJs.Triple): SparqlJs.Triple {
    this.visitMember(triple, 'subject', subject => {
      const term = this.term(subject);
      return coerce(
        term, isSubjectTerm,
        {expected: 'Term', transformed: 'Triple.subject'});
    });

    this.visitMember(triple, 'predicate', predicate => {
      const term = isTerm(predicate)
        ? this.term(predicate)
        : this.propertyPath(predicate);
      return coerce(
        term, isPredicateTerm,
        {expected: 'Predicate term', transformed: 'Triple.predicate'}
      );
    });

    this.visitMember(triple, 'object', object => {
      const term = this.term(object);
      return coerce(
        term, isTerm,
        {expected: 'Term', transformed: 'Triple.object'});
    });

    return undefined;
  }

  term(term: SparqlJs.Term): SparqlJs.Term | SparqlJs.PropertyPath {
    if (term === undefined) {
      return undefined;
    } else if (isVariable(term)) {
      return this.variableTerm(term);
    } else if (isLiteral(term)) {
      return this.literal(term);
    } else if (isBlank(term)) {
      return this.blank(term);
    } else if (isIri(term)) {
      return this.iri(term);
    }
    return undefined;
  }

  variableTerm(variable: SparqlJs.VariableTerm): SparqlJs.Term | SparqlJs.PropertyPath {
    return undefined;
  }

  literal(literal: SparqlJs.LiteralTerm): SparqlJs.Term | SparqlJs.PropertyPath {
    return undefined;
  }

  blank(blank: SparqlJs.BlankTerm): SparqlJs.Term | SparqlJs.PropertyPath {
    return undefined;
  }

  iri(iri: SparqlJs.IriTerm): SparqlJs.Term | SparqlJs.PropertyPath {
    return undefined;
  }

  propertyPath(
    path: SparqlJs.PropertyPath
  ): SparqlJs.IriTerm | SparqlJs.VariableTerm | SparqlJs.PropertyPath {
    this.walkArray('items', path.items, item => {
      const term = isTerm(item) ? this.term(item) : this.propertyPath(item);
      return coerce(
        term, isPropertyPathItem,
        {expected: 'PropertyPath item', transformed: 'PropertyPath.items'}
      );
    });
    return undefined;
  }

  protected walkBaseQuery(query: SparqlJs.Query) {
    if (query.where) {
      this.walkArray('where', query.where, this.pattern);
    }
    if (query.values) {
      this.visitMember(query, 'values', this.valuesRows);
    }
  }

  protected walkProjectionVariables(variables: SparqlJs.Variable[] | [SparqlJs.Wildcard]) {
    if (!isStarProjection(variables)) {
      this.walkArray('variables', variables, this.variable);
    }
  }

  protected walkArray<T>(
    collectionName: QueryNodeCollection,
    nodes: T[],
    walk: (this: this, node: T) => T
  ) {
    if (nodes === null || nodes === undefined) { return; }
    this.nodeMember = collectionName;
    let index = 0;
    while (index < nodes.length) {
      if (nodes[index]) {
        index = this.walkItem(nodes, index, walk);
      } else {
        index++;
      }
    }
  }

  protected walkItem<T>(nodes: T[], index: number, walk: (this: this, node: T) => T): number {
    const result = walk.call(this, nodes[index]);
    if (result !== undefined) {
      nodes[index] = result;
    }
    return index + 1;
  }
}

function isValuesRowValue(
  node: any
): node is SparqlJs.IriTerm | SparqlJs.BlankTerm | SparqlJs.LiteralTerm | undefined {
  if (typeof node === 'undefined') {
    return true;
  } else if (!isTerm(node)) {
    return false;
  }
  switch (node.termType) {
    case 'NamedNode':
    case 'Literal':
    case 'BlankNode':
      return true;
    default:
      return false;
  }
}

function isSubjectTerm(
  node: SparqlJs.Term | SparqlJs.PropertyPath
): node is SparqlJs.Triple['subject'] {
  if (!isTerm(node)) { return false; }
  switch (node.termType) {
    case 'NamedNode':
    case 'BlankNode':
    case 'Variable':
    case 'Quad':
      return true;
    default:
      return false;
  }
}

function isPredicateTerm(
  node: SparqlJs.Term | SparqlJs.PropertyPath
): node is SparqlJs.Triple['predicate'] {
  if (!isTerm(node)) { return true; }
  switch (node.termType) {
    case 'NamedNode':
    case 'Variable':
    case 'Quad':
      return true;
    default:
      return false;
  }
}

function isPropertyPathItem(
  node: SparqlJs.Term | SparqlJs.PropertyPath
): node is SparqlJs.IriTerm | SparqlJs.PropertyPath {
  if (!isTerm(node)) { return true; }
  return node.termType === 'NamedNode';
}

function coerce<Value, Coerced extends Value>(
  value: Value | undefined,
  matches: (input: Value) => input is Coerced,
  names: { expected: string; transformed: string; }
): Coerced | undefined {
  if (value === undefined) { return undefined; }
  if (matches(value)) {
    return value;
  } else {
    throwUnexpected(value, names);
  }
}

function throwUnexpected<T>(
  value: T, names: { expected: string; transformed: string; }
) {
  throw new Error(
    `${names.expected} is expected as result of ${names.transformed} ` +
    `transformation but ${JSON.stringify(value)} was given`);
}

/**
 * Creates a full deep clone of SparqlQuery object from SparqlJS library.
 *
 * By default when parsing query using SparqlJs.Parser component
 * SparqlQuery.prefixes property will be initialized to empty object
 * with [[Prototype]] set to prefixes map passed to Parser's constructor.
 * This method preserves a prototype of the prefixes object.
 */
export function cloneQuery<T extends SparqlJs.SparqlQuery>(query: T): T {
  const clone = _.cloneDeep(query);
  if (query.prefixes &&
    Object.getPrototypeOf(query.prefixes) !==
    Object.getPrototypeOf(clone.prefixes)
  ) {
    clone.prefixes = Object.create(Object.getPrototypeOf(query.prefixes));
    for (const key in query.prefixes) {
      if (query.prefixes.hasOwnProperty(key)) {
        clone.prefixes[key] = query.prefixes[key];
      }
    }
  }
  return clone;
}

export default QueryVisitor;
