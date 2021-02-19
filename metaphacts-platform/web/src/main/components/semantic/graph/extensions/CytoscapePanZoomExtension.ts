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
import * as panzoom from 'cytoscape-panzoom';
import 'cytoscape-panzoom/cytoscape.js-panzoom.css';

import {
  ContextCytoscapeApi, registerCytoscapeExtension, ExtensionContext,
} from '../api/Api';

function registerPanZoomExtension(api: ContextCytoscapeApi) {
  panzoom(api.cytoscape, api.jQuery);
}

function initializePanZoomExtension(
  {cytoscapeApi, options}: ExtensionContext<Cy.Panzoom.Options>
): Data.Maybe<Cy.Panzoom.Instance> {
  return maybe.Just(cytoscapeApi.instance.panzoom(options));
}

/**
 * This extension creates a controls that lets the user pan and zoom about a graph. This complements the built-in gesture support for panning and zooming by giving less savvy users a more traditional UI -- similar to controls on map.
 */
export interface SemanticGraphPanZoomExtensionConfig {
  /**
   * Zoom factor per zoom tick
   *
   * @default 0.05
   */
  zoomFactor?: number

  /**
   * How many milliseconds between zoom ticks
   *
   * @default 45
   */
  zoomDelay?: number

  /**
   * Min zoom level
   *
   * @default 0.1
   */
  minZoom?: number

  /**
   * Max zoom level
   *
   * @default 10
   */
  maxZoom?: number

  /**
   * Padding when fitting
   *
   * @default 50
   */
  fitPadding?: number

  /**
   * How many milliseconds in between pan ticks
   *
   * @default 10
   */
  panSpeed?: number

  /**
   * Max pan distance per ticks
   *
   * @default 10
   */
  panDistance?: number

  /**
   * The length of the pan drag box in which the vector for panning is calculated (bigger = finer control of pan speed and direction)
   *
   * @default 75
   */
  panDragAreaSize?: number

  /**
   * The slowest speed we can pan by (as a percent of panSpeed)
   *
   * @default 0.25
   */
  panMinPercentSpeed?: number

  /**
   * Radius of inactive area in pan drap box
   *
   * @default 8
   */
  panInactiveArea?: number

  /**
   * Min opacity of pan indicator (the draggable nib); scales from this to 1.0
   *
   * @default 0.5
   */
  panIndicatorMinOpacity?: number

  /**
   * A minimal version of the ui only with zooming (useful on systems with bad mousewheel resolution)
   *
   * @default false
   */
  zoomOnly?: boolean

  /**
   * Slider handle icon CSS classes
   *
   * @default 'fa fa-minus'
   */
  sliderHandleIcon?: string

  /**
   * Zoom-in button icon CSS classes
   *
   * @default 'fa fa-plus'
   */
  zoomInIcon?: string

  /**
   * Zoom-out button icon CSS classes
   *
   * @default 'fa fa-minus'
   */
  zoomOutIcon?: string

  /**
   * Reset button icon CSS classes
   *
   * @default 'fa fa-expand'
   */
  resetIcon?: string
}

/*
 * Cytoscape extension which adds Pan-Zoom controls.
 *
 * @see https://github.com/cytoscape/cytoscape.js-panzoom
 */
export const CytoscapePanZoom = registerCytoscapeExtension(
  {
    name: 'panzoom',
    type: 'core',
    registrationFn: registerPanZoomExtension,
    initializationFn: initializePanZoomExtension,
  }
);
export default CytoscapePanZoom;
export type Config = Cy.Panzoom.Options;
