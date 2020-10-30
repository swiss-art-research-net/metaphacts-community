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
import * as maybe from 'data.maybe';
import * as assign from 'object-assign';
import * as expand_collapse from 'cytoscape-expand-collapse';

import {
  DATA_LOADED_EVENT, ContextCytoscapeApi,
  registerCytoscapeExtension, CytoscapeExtension, ExtensionContext,
} from '../api/Api';

const EXPAND_COLLAPSE_DEFAULTS = {
  fisheye: true,
  animate: false,
  undoable: false,
  collapseByDefault: true,
};

export interface Config extends Cy.ExpandCollapse.Options {
  collapseByDefault: boolean;
}

function registerExpandCollapseExtension(api: ContextCytoscapeApi) {
  expand_collapse(api.cytoscape, api.jQuery);
}

function initializeExpandCollapseExtension(
  {options, cytoscapeApi}: ExtensionContext<Config>
): Data.Maybe<CytoscapeExtension> {
  const cy = cytoscapeApi.instance;
  const expandCollapseOptions =
    assign(
      {
        layoutBy: () => cytoscapeApi.actions.runLayout(),
      },
      EXPAND_COLLAPSE_DEFAULTS, options
    );

  const instance = cy.expandCollapse(expandCollapseOptions);
  if (expandCollapseOptions.collapseByDefault) {
    cy.on(DATA_LOADED_EVENT, () => instance.collapseAll());
  }
  return maybe.Just<CytoscapeExtension>(instance);
}

/**
 * This extension provides an interface to expand/collapse nodes for better management of complexity of `semantic-graph` compound nodes
 */
export interface SemanticGraphExpandCollapseExtensionConfig {
  /**
   * Whether to perform fisheye view after expand/collapse
   *
   * @default true
   */
  fisheye?: boolean

  /**
   * Whether to animate on drawing changes
   *
   * @default true
   */
  animate?: boolean

  /**
   * Whether cues are enabled
   *
   * @default true
   */
  cueEnabled?: boolean

  /**
   * Size of the expand-collapse cue
   *
   * @default 12
   */
  expandCollapseCueSize?: number

  /**
   * Size of lines used for drawing plus-minus icons
   *
   * @default 8
   */
  expandCollapseCueLineSize?: number

  /**
   * Image of the expand icon
   */
  expandCueImage?: string

  /**
   * Image of the collapse icon
   *
   */
  collapseCueImage?: string

  /**
   * Sensitivity of the expand-collapse cues
   *
   * @default 1
   */
  expandCollapseCueSensitivity?: number
}


/**
 * Initialize Cytoscape Expand-Collapse extension.
 *
 * @see https://github.com/iVis-at-Bilkent/cytoscape.js-expand-collapse
 */
export const CytoscapeExpandCollapse = registerCytoscapeExtension({
  name: 'expandCollapse',
  type: 'core',
  registrationFn: registerExpandCollapseExtension,
  initializationFn: initializeExpandCollapseExtension,
});
export default CytoscapeExpandCollapse;
