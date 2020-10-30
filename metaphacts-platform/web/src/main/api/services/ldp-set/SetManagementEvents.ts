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
import { EventMaker } from 'platform/api/events';

export interface SetManagementEventData {
  'Components.SetManagement.SetAdded': void;
  'Components.SetManagement.SetRenamed': void;
  'Components.SetManagement.SetRemoved': void;
  'Components.SetManagement.ItemAdded': void;
  'Components.SetManagement.ItemRemoved': void;
  'Components.SetManagement.ItemSelected': string;
  'Components.SetManagement.ItemsReordered': void;
  'Components.SetManagement.ItemsFiltered': ItemsFilteredData;
  'Components.SetManagement.ItemsFetched': { iris: Array<string> };
}
const event: EventMaker<SetManagementEventData> = EventMaker;

export type SetManagementEvents = typeof SetManagementEvents;
export namespace SetManagementEvents {
  export const SetAdded = event('Components.SetManagement.SetAdded');
  export const SetRenamed = event('Components.SetManagement.SetRenamed');
  export const SetRemoved = event('Components.SetManagement.SetRemoved');
  export const ItemAdded = event('Components.SetManagement.ItemAdded');
  export const ItemRemoved = event('Components.SetManagement.ItemRemoved');
  export const ItemSelected = event('Components.SetManagement.ItemSelected');
  export const ItemsReordered = event('Components.SetManagement.ItemsReordered');
  export const ItemsFiltered = event('Components.SetManagement.ItemsFiltered');
  export const ItemsFetched = event('Components.SetManagement.ItemsFetched');
}

export type SetManagementEventType = SetManagementEvents[keyof SetManagementEvents];

export interface ItemsFilteredData {
  iris?: Array<string>;
}
