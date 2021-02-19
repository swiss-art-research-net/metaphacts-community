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
import { identity } from 'core.lambda';

import { registerCytoscapeLayout } from '../api/Api';

/**
 * The breadthfirst layout puts nodes in a hierarchy, based on a breadthfirst traversal of the graph
 */
export interface SemanticGraphBreadthFirstLayoutConfig {

  /**
   * Array of full IRIs that should be treated as tree roots
   */
  roots: Array<string>

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
   * Prevents node overlap, may overflow bounding-box and radius if not enough space
   *
   * @default true
   */
  avoidOverlap?: boolean

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

  /**
   * Whether the tree is directed downwards (or edges can point in any direction if false)
   *
   * @default false
   */
  directed?: boolean

  /**
   * Put depths in concentric circles if true, put depths top down if false
   *
   * @default false
   */
  circle?: boolean

  /**
   * Positive spacing factor, larger => more space between nodes (N.B. n/a if causes overlap)
   *
   * @default 1.75
   */
  spacingFactor?: number

  /**
   * How many times to try to position the nodes in a maximal way (i.e. no backtracking)
   *
   * @default 0
   */
  maximalAdjustments?: number
}


/**
 * Register built-in cytoscape grid layout.
 *
 * @example
 *   <graph-layout-breadthfirst></graph-layout-breadthfirst>
 *
 * @see http://js.cytoscape.org/#layouts/breadthfirst
 */
export const BreadthFirstLayout = registerCytoscapeLayout('breadthfirst', identity);
export default BreadthFirstLayout;
