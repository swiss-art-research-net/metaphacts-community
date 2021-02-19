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
import { assign } from 'lodash';
import * as maybe from 'data.maybe';
import * as cytoscapeNavigator from 'cytoscape-navigator';
import 'cytoscape-navigator/cytoscape.js-navigator.css';

import { ModuleRegistry } from 'platform/api/module-loader';
import {
  ContextCytoscapeApi, registerCytoscapeExtension, ExtensionContext,
} from '../api/Api';

function registerNavigatorExtension(api: ContextCytoscapeApi) {
  cytoscapeNavigator(api.cytoscape, api.jQuery);
}

function initializeNavigatorExtension(
  {cytoscapeApi, options}: ExtensionContext<Cy.Navigator.Options>
): Data.Maybe<Cy.Navigator.Instance> {
  const container = createNavigatorContainer(options);
  const config = assign({}, options, {container: container});

  // add navigator container to cytoscape container
  cytoscapeApi.instance.container().appendChild(container);
  return maybe.Just(cytoscapeApi.instance.navigator(config));
}

function createNavigatorContainer(config: Cy.Navigator.Options): HTMLDivElement {
  const container = document.createElement('div');
  container.className = 'cytoscape-navigator';

  // propagate style attribute value from component attribute to navigator container
  container.setAttribute('style', (config as any)[ModuleRegistry.RAW_STYLE_ATTRIBUTE]);

  // assumption here is that cytoscape instance container has relative position
  // so navigator container absolutely positioned in it
  container.style.position = 'absolute';
  return container;
}

/**
 * Bird's eye view pan and zoom control for `semantic-graph` component
 */
export interface SemanticGraphNavigatorExtensionConfig {

  /**
   * Additional CSS styles for navigation container
   */
  style?: string

  /**
   * Set `false` to update graph pan only on drag end; set `0` to do it instantly; set a number (frames per second) to update not more than N times per second
   *
   * @default 0
   */
  viewLiveFramerate?: number | false

  /**
   * Max thumbnail's updates per second triggered by graph updates
   *
   * @default 30
   */
  thumbnailEventFramerate?: number

  /**
   * Max thumbnail's updates per second. Set false to disable
   *
   * @default false
   */
  thumbnailLiveFramerate?: number | false

  /**
   * Double-click delay in milliseconds
   *
   * @default 200
   */
  dblClickDelay?: number

  /**
   * Milliseconds to throttle rerender updates to the panzoom for performance
   *
   * @default 100
   */
  rerenderDelay?: number
}

/**
 * Cytoscape extension for birds-eye style navigation.
 *
 * @see https://github.com/cytoscape/cytoscape.js-navigator
 */
export const CytoscapeNavigator = registerCytoscapeExtension({
  name: 'navigator',
  type: 'core',
  registrationFn: registerNavigatorExtension,
  initializationFn: initializeNavigatorExtension,
});
export default CytoscapeNavigator;
export type Config = Cy.Navigator.Options;
