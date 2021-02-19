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
import * as maybe from 'data.maybe';

import { Rdf } from 'platform/api/rdf';

/**
 * Convert predicate to sort function that can be used in many cytoscape layouts.
 */
export function sort(sortBy: string) {
  const getValue = getNumberValueForProperty(sortBy);
  return function(a: Cy.CollectionFirstNode, b: Cy.CollectionFirstNode): number {
    const cmp =
      getValue(a).chain(
        aValue => getValue(b).map(bValue => aValue - bValue)
      );

    if (cmp.isNothing) {
      console.warn('Graph Layout: trying to sort by non numerical property ' + sortBy);
    }
    return cmp.getOrElse(0);
  };
}

/**
 * Function to get number value from some node property.
 */
export function getNumberValueForProperty(prop: string) {
  return function(element: Cy.CollectionFirstNode): Data.Maybe<number> {
    const propValue = element.data(prop); // Array of property values
    return propValue ? getLiteralNumberValue(propValue[0]) : maybe.Nothing<number>();
  };
}

/**
 * Try to parse node value as number.
 */
export function getLiteralNumberValue(node: Rdf.Node): Data.Maybe<number> {
  if (Rdf.isLiteral(node)) {
    // trying to parse literal value as a number
    if (!isNaN(+node.value)) {
      return maybe.Just(+node.value);
    } else {
      // literal value can't be parsed as a number
      return maybe.Nothing<number>();
    }
  } else {
    // not a literal data-type
    return maybe.Nothing<number>();
  }
}
