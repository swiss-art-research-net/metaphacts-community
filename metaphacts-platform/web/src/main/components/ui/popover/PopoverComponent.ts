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
import { Component, createFactory, Children, ReactElement, cloneElement } from 'react';
import * as ReactBootstrap from 'react-bootstrap';
import * as _ from 'lodash';

import { componentHasType } from 'platform/components/utils';

import { PopoverContentComponent } from './PopoverContentComponent';
import { PopoverTriggerComponent } from './PopoverTriggerComponent';

const OverlayTrigger = createFactory(ReactBootstrap.OverlayTrigger);
const Popover = createFactory(ReactBootstrap.Popover);

export interface Props {
  /**
   * Popover title.
   * If empty/undefined, not title will be visible in the popover.
   */
  title: string;
}

/**
 * @example
 * <mp-popover title="my popover">
 *     <mp-popover-trigger placement="left" trigger='["click","hover","focus"]' root-close='false'>
 *         <i class="fa fa-question-circle" aria-hidden="true"></i>
 *     </mp-popover-trigger>
 *     <mp-popover-content>Content</mp-popover-content>
 * </mp-popover>
 */
export class PopoverComponentClass extends Component<Props, {}> {
  render() {
    const {title} = this.props;

    const children = Children.toArray(this.props.children);
    const triggerComponent =
      _.find(children, child => componentHasType(child, PopoverTriggerComponent));
    const contentComponent =
      _.find(children, child => componentHasType(child, PopoverContentComponent));

    const triggerChildren = (Children.only(triggerComponent) as ReactElement<any>).props.children;
    const contentChildren = (Children.only(contentComponent)  as ReactElement<any>).props.children;

    const popover = Popover({id: 'mp-popover', title: title}, contentChildren);
    const trigger = (Children.only(triggerComponent) as ReactElement<any>).props.trigger;
    const placement = (Children.only(triggerComponent) as ReactElement<any>).props.placement;
    const rootClose = (Children.only(triggerComponent) as ReactElement<any>).props.rootClose;
    return OverlayTrigger({
        overlay: popover,
        trigger: trigger || ['click'],
        placement: placement,
        rootClose: rootClose || true,
      },
      cloneElement(triggerChildren, {})
    );
  }
}

export type component = PopoverComponentClass;
export const component = PopoverComponentClass;
export const factory = createFactory(component);
export default component;
