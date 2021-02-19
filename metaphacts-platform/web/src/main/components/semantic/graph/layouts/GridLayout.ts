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
import { has } from 'lodash';
import { identity } from 'core.lambda';
import { createFactory } from 'react';

import { registerCytoscapeLayout, CytoscapeApi } from '../api/Api';
import { sort, getNumberValueForProperty } from '../api/LayoutHelpers';

/**
 * Register built-in cytoscape grid layout.
 *
 * @example
 *   <graph-layout-grid></graph-layout-grid>
 *
 * @see http://js.cytoscape.org/#layouts/grid
 */
export const component = registerCytoscapeLayout('grid', identity, mapOptions);
export const factory = createFactory(component);
export default component;

function mapOptions(api: CytoscapeApi, options: Cy.LayoutOptions): Cy.LayoutOptions {
  if (has(options, 'sortBy')) {
    const sortBy = (options as any)['sortBy'];
    (options as any)['sort'] = sort(sortBy);
  }
  if (has(options, 'positionRow') || has(options, 'positionCol')) {
    (options as any)['position'] = positionBy(
      (options as any)['positionRow'], (options as any)['positionCol']
    );
  }

  return options;
}

/**
 * Transform position properties to position function required by the layout.
 */
function positionBy(x: string | undefined, y: string | undefined) {
  const xFn = maybe.fromNullable(x).map(getNumberValueForProperty).getOrElse(maybe.Nothing);
  const yFn = maybe.fromNullable(y).map(getNumberValueForProperty).getOrElse(maybe.Nothing);
  return function(element: Cy.CollectionFirstNode): {row: number; col: number} {
    return {
      row: xFn(element).getOrElse(undefined),
      col: yFn(element).getOrElse(undefined),
    };
  };
}
