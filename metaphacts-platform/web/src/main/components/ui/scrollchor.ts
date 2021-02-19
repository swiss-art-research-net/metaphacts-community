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
import { createFactory } from 'react';
import {default as ReactScrollchor} from 'react-scrollchor';

/**
 * A trigger component to scroll to target element by ID or to the page top.
 *
 * **Example**:
 * ```
 * <mp-anchor to="#section123">Click to scroll</mp-anchor>
 * <div style="padding-top:2000px;">Lorem ipsum dolor sit amet</div>
 * <section id="section123"></section>
 * ```
 *
 * **Example**:
 * ```
 * <mp-anchor to="#section456"
 *   animate='{"offset": 20, "duration": 6000}'>
 *   Click to scroll
 * </mp-anchor>
 * <div style="padding-top:2000px;">Lorem ipsum dolor sit amet</div>
 * <section id="section456"></section>
 * ```
 */
interface ScrollAnchorConfig {
  /**
   * ID of the target node to scroll to (leading `#` can be omitted).
   *
   * Set to empty string (`to=''`) to scroll to the page top.
   */
  to: string;
  /**
   * Options for smooth scrolling animation:
   *
   * @default {"offset": 0, "duration": 400, "easing": "easeOutQuad"}
   */
  animate?: {
    offset?: number;
    duration?: number;
    easing?: string;
  };
}

/**
 * This is just a small wrapper around react-scrollchor
 * @example
 *  <mp-anchor to="#section123">Click to scroll</mp-anchor>
 *  <div style="padding-top:2000px;">Lorem ipsum dolor sit amet</div>
 *  <section id="section123"></section>
 *
 * @example
 *  <mp-anchor
 *      to="#section456"
 *      animate='{"offset": 20, "duration": 6000}'>
 *  Click to scroll</mp-anchor>
 *  <div style="padding-top:2000px;">Lorem ipsum dolor sit amet</div>
 *  <section id="section456"></section>
 */
export const component = ReactScrollchor;
export const factory = createFactory(component);
export default component;
