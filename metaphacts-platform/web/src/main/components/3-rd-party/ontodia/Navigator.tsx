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
import * as React from 'react';
import { Navigator as OntodiaNavigator, WidgetAttachment, WidgetDock } from 'ontodia';
import { Component, ComponentContext, ContextTypes } from 'platform/api/components';

/**
 * Birds-eye view component, helps to navigate through the diagram.
 *
 * **Can be used only inside `ontodia-canvas`.**
 */
interface NavigatorWidgetConfig {
  /**
   * Unique ID.
   */
  id?: string;
  /**
   * Position on the canvas.
   * @default "se"
   */
  dock?: WidgetDock;
  /**
   * Margin.
   * @default 25
   */
  margin?: number;
  /**
   * Width.
   * @default 300
   */
  width?: number;
  /**
   * Height.
   * @default 160
   */
  height?: number;
  /**
   * Scale padding.
   * @default 0.2
   */
  scalePadding?: number;
  /**
   * Expanded by default.
   * @default true
   */
  expanded?: boolean;
  /**
   * Background color.
   */
  backgroundColor?: string;
  /**
   * Background color of the viewport rectangle.
   */
  viewportBackgroundColor?: string;
  /**
   * Border color of the viewport rectangle.
   */
  viewportBorderColor?: string;
  /**
   * Viewport rectangle border width.
   */
  viewportBorderWidth?: number;
  /**
   * Border color of the viewport rectangle when it crosses the border of the widget.
   */
  viewportOutsideBorderColor?: string;
  /**
   * Viewport rectangle border width when it crosses the border of the widget.
   */
  viewportOutsideBorderWidth?: number;
}

export type NavigatorProps = NavigatorWidgetConfig;

type DefaultProps = Pick<NavigatorWidgetConfig,
  'id' |
  'backgroundColor' |
  'viewportBackgroundColor' |
  'viewportBorderColor' |
  'viewportBorderWidth' |
  'viewportOutsideBorderColor' |
  'viewportOutsideBorderWidth'
>;

class Navigator extends Component<NavigatorWidgetConfig, {}> {
  static defaultProps: DefaultProps = {
    id: 'navigator',
    backgroundColor: '#F9F9F9',
    viewportBackgroundColor: 'white',
    viewportBorderColor: '#F1F1EC',
    viewportBorderWidth: 1,
    viewportOutsideBorderColor: '#F1F1EC',
    viewportOutsideBorderWidth: 2,
  };
  static readonly attachment = WidgetAttachment.Viewport;

  render() {
    return <OntodiaNavigator {...this.props} />;
  }
}

export { Navigator };

export default Navigator;
