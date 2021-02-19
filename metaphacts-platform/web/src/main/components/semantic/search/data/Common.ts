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
import { OrderedMap } from 'immutable';
import * as _ from 'lodash';
import * as SparqlJs from 'sparqljs';

import { Rdf } from 'platform/api/rdf';
import { SparqlClient, QueryVisitor, SparqlTypeGuards } from 'platform/api/sparql';

export interface Resource {
  readonly iri: Rdf.Iri
  readonly label: string
  readonly description?: string
  readonly tuple: SparqlClient.Binding
}
export type Resources = OrderedMap<Rdf.Iri, Resource>;

import { Record, List } from 'immutable';

export interface EntityI {
  iri: Rdf.Iri
  label: string
  tuple: SparqlClient.Binding
}

export type Entity = Record.IRecord<EntityI>;
export type Entities = List<Entity>;
export const Entity =
    Record<EntityI>({
      iri: null,
      label: null,
      tuple: null,
    });

export function bindingsToEntities(
  bindings: SparqlClient.Bindings, iriBindingName: string, labelBindingName: string
): List<Entity> {
  var entities =
      _.map(
        bindings, binding => bindingToEntity(binding, iriBindingName, labelBindingName)
      );
  return List(entities);
}

export function bindingToEntity(
  binding: SparqlClient.Binding, iriBindingName: string, labelBindingName: string
): Entity {
  var iri = binding[iriBindingName];
  return Entity({
    tuple: binding,
    iri: <Rdf.Iri>iri,
    label: binding[labelBindingName].value,
  });
}

export type ValueRange = { begin: string; end: string; };

/**
 * Replaces filters which restrict ranges with bind patterns.
 *
 * @example
 * {
 *    $subject ?__relation__ ?date .
 *    ?date crm:P82a_begin_of_the_begin ?begin ;
 *      crm:P82b_end_of_the_end ?end .
 *    FILTER(?begin <= ?__dateEndValue__) .
 *    FILTER(?end >= ?__dateBeginValue__) .
 * }
 *
 * // result:
 * {
 *    $subject ?__relation__ ?date .
 *    ?date crm:P82a_begin_of_the_begin ?begin ;
 *      crm:P82b_end_of_the_end ?end .
 *    BIND(?begin as ?dateEndValue) .
 *    BIND(?end as ?dateBeginValue) .
 * }
 */
export function transformRangePattern(
  pattern: SparqlJs.Pattern[], range: ValueRange, rangeTo: ValueRange
) {
  const clonedPattern = _.cloneDeep(pattern);

  // Replace range filter patterns with bind patterns
  // Find variables names in the ranges filters
  const visitor = new (class extends QueryVisitor {
    public begin: SparqlJs.Term;
    public end: SparqlJs.Term;

    private findSecondVariable(args: SparqlJs.Expression[], variable: SparqlJs.VariableTerm) {
      return _.find(args, v =>
        SparqlTypeGuards.isVariable(v) && !v.equals(variable)
      ) as SparqlJs.VariableTerm;
    }

    private hasVariable(args: SparqlJs.Expression[], variable: SparqlJs.VariableTerm): boolean {
      return _.some(args, v =>
        SparqlTypeGuards.isVariable(v) && v.equals(variable)
      );
    }

    private getBindPattern(
      variable: SparqlJs.VariableTerm, expression: SparqlJs.Expression
    ): SparqlJs.BindPattern {
      return {type: 'bind', variable, expression};
    }

    filter(pattern: SparqlJs.FilterPattern): SparqlJs.Pattern {
      const {type, operator, args} = pattern.expression as SparqlJs.OperationExpression;

      if (type !== 'operation') {
        return super.filter(pattern);
      }

      const rangeVariables = {
        begin: Rdf.DATA_FACTORY.variable(range.begin),
        end: Rdf.DATA_FACTORY.variable(range.end),
      };
      const rangeToVariables = {
        begin: Rdf.DATA_FACTORY.variable(rangeTo.begin),
        end: Rdf.DATA_FACTORY.variable(rangeTo.end),
      };

      if (operator === '>=' && this.hasVariable(args, rangeVariables.begin)) {
        this.end = this.findSecondVariable(args, rangeVariables.begin);
        return this.getBindPattern(rangeToVariables.end, this.end);
      }

      if (operator === '<=' && this.hasVariable(args, rangeVariables.end)) {
        this.begin = this.findSecondVariable(args, rangeVariables.end);
        return this.getBindPattern(rangeToVariables.begin, this.begin);
      }

      return super.filter(pattern);
    }
  });

  clonedPattern.forEach(p => visitor.pattern(p));

  if (!visitor.begin || !visitor.end) {
    console.warn(
      'The following query pattern',
      JSON.stringify(pattern),
      'can\'t be automatically used for selection of facet values,',
      'pattern is expected to have two FILTERs which restrict ranges.',
    );
  }

  return clonedPattern;
}
