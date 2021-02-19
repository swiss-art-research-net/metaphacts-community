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
import { Component, Children, ReactElement, cloneElement } from 'react';

import { Cancellation } from 'platform/api/async';
import { trigger } from 'platform/api/events';
import { SetManagementEvents } from 'platform/api/services/ldp-set/SetManagementEvents';

import {
  SetManagementContextTypes, SetManagementContext, SetViewContext, SetViewContextTypes,
} from '../SetManagementApi';

export interface Props {
  id: string;
}

/**
 * Fetches set items of a selected set
 *
 * This action can be used only inside <mp-set-management> component templates.
 *
 * @example <mp-set-management-action-fetch-set-items></mp-set-management-action-fetch-set-items>
 */
export class FetchSetItemsAction extends Component<Props, {}> {
  public static contextTypes = {...SetManagementContextTypes, ...SetViewContextTypes};
  context: SetManagementContext & SetViewContext;

  private readonly cancellation = new Cancellation();
  private fetchingItemsCancellation = this.cancellation.derive();

  componentWillUnmount() {
    this.cancellation.cancelAll();
  }

  private onClick = () => {
    const {id: source} = this.props;
    this.fetchingItemsCancellation = this.cancellation.deriveAndCancel(
      this.fetchingItemsCancellation
    );
    const set = this.context['mp-set-management--set-view'].getCurrentSet();
    this.fetchingItemsCancellation.map(
      this.context['mp-set-management'].fetchSetItems(set)
    ).onValue(items => {
      const iris = items.map(item => item.iri.value);
      trigger({source, eventType: SetManagementEvents.ItemsFetched, data: {iris}});
    });
  }

  public render() {
    const child = Children.only(this.props.children) as ReactElement<any>;
    const props = {onClick: this.onClick};
    return cloneElement(child, props);
  }
}
export default FetchSetItemsAction;
