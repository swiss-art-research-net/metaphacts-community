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
import * as regCose from 'cytoscape-cose-bilkent';

import { registerCytoscapeLayout } from '../api/Api';

/**
 * The CoSE layout for Cytoscape.js by the i-Vis group in Bilkent University. It is an evolution of the CoSE algorithm that is more computationally expensive but produces near-perfect results
 */
export interface SemanticGraphCoseBilkentLayoutConfig {
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
  animate?: 'during' | 'end' | false

  /**
   * Number of iterations between consecutive screen positions update (0 -> only updated on the end)
   *
   * @default 30
   */
  refresh?: number

  /**
   * Randomize the initial positions of the nodes (true) or use existing positions (false)
   *
   * @default true
   */
  randomize?: boolean

  /**
   * Node repulsion (non overlapping) multiplier
   *
   * @default 4500
   */
  nodeRepulsion?: number

  /**
   * Ideal edge (non nested) length
   *
   * @default 50
   */
  idealEdgeLength?: number

  /**
   * Divisor to compute edge forces
   *
   * @default 0.45
   */
  edgeElasticity?: number

  /**
   * Nesting factor (multiplier) to compute ideal edge length for nested edges
   *
   * @default 0.1
   */
  nestingFactor?: number

  /**
   * Gravity force (constant)
   *
   * @default 0.25
   */
  gravity?: number

  /**
   * Maximum number of iterations to perform
   *
   * @default 2500
   */
  numIter?: number

  /**
   * For enabling tiling
   *
   * @default true
   */
  tile?: boolean

  /**
   * Represents the amount of the vertical space to put between the zero degree members during the tiling operation
   *
   * @default 10
   */
  tilingPaddingVertical?: number

  /**
   * Represents the amount of the horizontal space to put between the zero degree members during the tiling operation
   *
   * @default 10
   */
  tilingPaddingHorizontal?: number

  /**
   * Gravity range (constant) for compounds
   *
   * @default 1.5
   */
  gravityRangeCompound?: number

  /**
   * Gravity force (constant) for compounds
   *
   * @default 1.0
   */
  gravityCompound?: number

  /**
   * Gravity range (constant)
   *
   * @default 3.8
   */
  gravityRange?: number
}

/**
 * CoSE layout for graphs with compound nodes.
 *
 * @see https://github.com/cytoscape/cytoscape.js-cose-bilkent
 */
export const CoseBilkentLayout = registerCytoscapeLayout(
  'cose-bilkent',
  (cytoscape: Cy.Static) => regCose(cytoscape)
);
export default CoseBilkentLayout;
