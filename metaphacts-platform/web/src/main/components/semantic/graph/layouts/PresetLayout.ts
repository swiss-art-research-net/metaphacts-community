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
import { has } from 'lodash';
import { identity } from 'core.lambda';

import { registerCytoscapeLayout, CytoscapeApi } from '../api/Api';
import { getNumberValueForProperty } from '../api/LayoutHelpers';

/**
 * The preset layout puts nodes in the positions you specify manually
 */
export interface SemanticGraphPresetLayoutConfig {
  /**
   * Full IRI of the property that points to node X position value
   */
  positionX: string

  /**
   * Full IRI of the property that points to node Y position value
   */
  positionY: string

  /**
   * Zoom level to set, `fit` property need to be set to false
   */
  zoom?: number

  /**
   * The pan level to set, `fit` property need to be set to false
   */
  pan?: Cy.Position

  /**
   * Whether to fit the viewport to the graph
   *
   * @default true
   */
  fit?: boolean

  /**
   * The padding on fit in pixels
   *
   * @default 30
   */
  padding?: number

  /**
   * Whether to transition the node positions
   *
   * @default false
   */
  animate?: boolean

  /**
   * Duration of animation in ms if enabled
   *
   * @default 500
   */
  animationDuration?: boolean

  /**
   * Easing of animation if enabled. For possible values see `transition-timing-function` at [easing](http://js.cytoscape.org/#style/transition-animation)
   */
  animationEasing?: string
}

/**
 * Register built-in cytoscape preset layout.
 *
 * @example
 *   <graph-layout-preset position-x="<propXiri>" position-y="<propYiri>"></graph-layout-preset>
 *
 * @see http://js.cytoscape.org/#layouts/preset
 */
export const PresetLayout = registerCytoscapeLayout('preset', identity, mapOptions);
export default PresetLayout;

// TODO create proper type definitions for PresetLayout options;
export type Props = Cy.LayoutOptions;

function mapOptions(api: CytoscapeApi, options: Cy.LayoutOptions): Cy.LayoutOptions {
  if (has(options, 'positionX') && has(options, 'positionY')) {
    (options as any)['positions'] = positionBy(
      (options as any)['positionX'], (options as any)['positionY']
    );
  } else {
    // TODO think about proper error handling in graph component API
    console.error('Graph Preset Layout: position-x and position-y attributes are required!');
  }

  return options;
}

/**
 * Transform position properties to position function required by the layout.
 */
function positionBy(xProp: string, yProp: string) {
  const xFn = getNumberValueForProperty(xProp);
  const yFn = getNumberValueForProperty(yProp);
  return function(element: Cy.CollectionFirstNode): {x: number; y: number} {
    return xFn(element).chain(
      x => yFn(element).map(y => { return {x: x, y: y}; })
    ).getOrElse({x: undefined, y: undefined});
  };
}
