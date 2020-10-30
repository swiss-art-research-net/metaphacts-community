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

export function isQuery(node: unknown): node is SparqlJs.Query {
  return typeof node === 'object' && (node as Partial<SparqlJs.Query>).type === 'query';
}

export function isSelectQuery(query: SparqlJs.Query): query is SparqlJs.SelectQuery {
  return query.queryType === 'SELECT';
}

export function isConstructQuery(query: SparqlJs.Query): query is SparqlJs.ConstructQuery {
  return query.queryType === 'CONSTRUCT';
}

export function isAskQuery(query: SparqlJs.Query): query is SparqlJs.AskQuery {
  return query.queryType === 'ASK';
}

export function isDescribeQuery(query: SparqlJs.Query): query is SparqlJs.DescribeQuery {
  return query.queryType === 'DESCRIBE';
}


export function isStarProjection(
  variables: SparqlJs.SelectQuery['variables']
): variables is [SparqlJs.Wildcard] {
  return Array.isArray(variables)
    && variables.length === 1
    && (variables[0] as Partial<SparqlJs.Wildcard>).termType === 'Wildcard';
}

export function isPattern(node: unknown): node is SparqlJs.Pattern {
  if (typeof node === 'object') {
    switch ((node as Partial<SparqlJs.Pattern>).type) {
      case 'bgp':
      case 'optional':
      case 'union':
      case 'group':
      case 'minus':
      case 'graph':
      case 'service':
      case 'filter':
      case 'values':
        return true;
    }
  }
  return false;
}

export function isGroupPattern(
  pattern: SparqlJs.Pattern
): pattern is SparqlJs.GroupPattern {
  return pattern.type === 'group';
}

export function isBlockPattern(
  pattern: SparqlJs.Pattern
): pattern is SparqlJs.BlockPattern {
  switch (pattern.type) {
    case 'optional':
    case 'union':
    case 'group':
    case 'minus':
    case 'graph':
    case 'service':
      return true;
    default:
      return false;
  }
}

export function isExpression(node: unknown): node is SparqlJs.Expression {
  if (Array.isArray(node)) {
    return true;
  } else if (typeof node === 'object') {
    if (isTerm(node as LeafNode)) {
      return true;
    }
    switch ((node as { type?: string }).type) {
      // expressions
      case 'operation':
      case 'functionCall':
      case 'aggregate':
      // expression-like patterns
      case 'bgp':
      case 'group':
        return true;
    }
  }
  return false;
}

export function isQuads(node: any): node is SparqlJs.Quads {
  return (node.type === 'bgp' || node.type === 'graph') && 'triples' in node;
}

type LeafNode =
  SparqlJs.Expression |
  SparqlJs.PropertyPath |
  SparqlJs.VariableExpression |
  SparqlJs.Term;

export function isTerm(
  node: LeafNode
): node is SparqlJs.Term {
  return typeof (node as Partial<SparqlJs.Term>).termType === 'string';
}

export function isVariable(term: LeafNode): term is SparqlJs.VariableTerm {
  return (term as Partial<SparqlJs.Term>).termType === 'Variable';
}

export function isLiteral(term: LeafNode): term is SparqlJs.LiteralTerm {
  return (term as Partial<SparqlJs.Term>).termType === 'Literal';
}

export function isBlank(term: LeafNode): term is SparqlJs.BlankTerm {
  return (term as Partial<SparqlJs.Term>).termType === 'BlankNode';
}

export function isIri(term: LeafNode): term is SparqlJs.IriTerm {
  return (term as Partial<SparqlJs.Term>).termType === 'NamedNode';
}

export function isUpdateOperation(update: any) {
  return isInsertDeleteOperation(update) || isManagementOperation(update);
}

export function isInsertDeleteOperation(
  update: SparqlJs.UpdateOperation
): update is SparqlJs.InsertDeleteOperation {
  if (typeof update !== 'object') { return false; }
  const updateType = (update as SparqlJs.InsertDeleteOperation).updateType;
  return updateType && (
    updateType === 'insert' ||
    updateType === 'delete' ||
    updateType === 'deletewhere' ||
    updateType === 'insertdelete'
  );
}

export function isManagementOperation(
  update: SparqlJs.UpdateOperation
): update is SparqlJs.ManagementOperation {
  if (typeof update !== 'object') { return false; }
  const type = (update as SparqlJs.ManagementOperation).type;
  return type && (
    type === 'load' ||
    type === 'copy' ||
    type === 'move' ||
    type === 'add'
  );
}
