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
export interface BaseSplitPaneConfig<T> {
  /**
   * Width of closed sidebar
   */
  minSize: number;
  /**
   * Width of open sidebar
   * @default 300
   */
  defaultSize?: number;
  /**
   * SplitPane custom class name
   */
  className?: string;
  /**
   * Resizer custom class name
   */
  resizerClassName?: string;
  /**
   * SplitPane custom style
   */
  style?: React.CSSProperties;
  /**
   * Resizer custom style, accepts JSON object with camelCased properties
   */
  resizerStyle?: T;
  /**
   * Pane1 custom style, accepts JSON object with camelCased properties
   */
  sidebarStyle?: T;
  /**
   * Pane2 custom style, accepts JSON object with camelCased properties
   */
  contentStyle?: T;
  /**
   * Persisting the current size to local storage
   * @default true
   */
  persistResize?: boolean;
  /**
   * Whether should be open by default.
   * @default true
   */
  defaultOpen?: boolean;
  /**
   * Prefix for the local storage identifier
   */
  id?: string;
  /**
   * Dock mode
   */
  dock?: boolean;
  /**
   * Height of page elements above sidebar; used to set height of sidebar.
   *
   * Applicable only when `dock` is set to `true`.
   */
  navHeight?: number;
  /**
   * Threshold which used for switch the state of the sidebar
   */
  snapThreshold?: number;

  /**
   * Splitting mode
   */
  split?: 'vertical' | 'horizontal';
  /**
   * Defined which pane will be used as a sidebar.
   */
  primary?: 'first' | 'second';
}

/**
 * **Example**:
 * ```
 * <mp-splitpane min-size=5 default-size=100>
 *   <div>
 *     <mp-splitpane-toggle-on>
 *       <button></button>
 *     </mp-splitpane-toggle-on>
 *     <mp-splitpane-toggle-off>
 *       <button></button>
 *     </mp-splitpane-toggle-off>
 *     <mp-splitpane-sidebar-open>
 *       <!-- sidebar content -->
 *     </mp-splitpane-sidebar-open>
 *   </div>
 *   <div><!-- main component --></div>
 * </mp-splitpane>
 * ```
 *
 * **Example**:
 * Using the split-pane as left-side sidebar menu by utilizing
 * the pre-defined `split-pane__leftsidebar-*` CSS classes:
 * ```
 * <mp-splitpane min-size=30 nav-height=103 footer-height=180 dock=true default-size=300
 *   id="my-panel" persist-resize=true style="margin-top:-60px;" snap-threshold=50>
 *   <div class="split-pane__leftsidebar">
 *     <mp-splitpane-toggle-on>
 *       <div class="split-pane__leftsidebar-caption">SIDEBAR TITLE</div>
 *     </mp-splitpane-toggle-on>
 *     <mp-splitpane-sidebar-open>
 *       <h1> Sidebar </h1>
 * 			<!--side bar content here -->
 *     </mp-splitpane-sidebar-open>
 *     <div class="split-pane__leftsidebar-footer">
 *       <mp-splitpane-toggle-on>
 *         <div class="split-pane__leftsidebar-toggle">&raquo;</div>
 *       </mp-splitpane-toggle-on>
 *       <mp-splitpane-toggle-off>
 *         <div class="split-pane__leftsidebar-toggle" >&laquo;</div>
 *       </mp-splitpane-toggle-off>
 *     </div>
 *   </div>
 *   <div>
 *     <!-- main content here -->
 *   </div>
 * </mp-splitpane>
 * ```
 */
export type SplitPaneConfig = BaseSplitPaneConfig<any>;
