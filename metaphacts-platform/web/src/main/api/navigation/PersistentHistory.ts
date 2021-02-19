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
import * as h from 'history';
import * as Kefir from 'kefir';

import { BrowserPersistence } from 'platform/api/persistence/BrowserPersistence';

const BH_RECENT_PAGES = 'recentPages';
const MAX_BH_RECENT_QUERIES = 12;
let recentPages = BrowserPersistence.getItem(BH_RECENT_PAGES);
if (!recentPages || recentPages.toArray().length === 0) {
  recentPages = [];
} else {
  recentPages = recentPages.toArray();
}

/**
 * Persistent History
 *
 * Use MemoryHistory from the 'history' API to store page changes
 * and persist them to the browser, for use in BrowseHistoryComponent
 *
 * @author Mike Kelly <mkelly@britishmuseum.org>
 */
export const MemoryHistory = h.createMemoryHistory({
  initialEntries: recentPages,
  initialIndex: 0,
});

export function init(
  onInit: (location: Location) => Kefir.Property<Data.Maybe<uri.URI>>,
) {
  MemoryHistory.listen(
    (location) =>
      onInit(location)
  );
}

export function clearPersistedRecentPages() {
  const noPages: string[] = [];
  BrowserPersistence.setItem(BH_RECENT_PAGES, noPages);
}

export function persistRecentPages(newUrl: string): void {
  let  memoryEntries = MemoryHistory.entries.map(entry => entry.pathname + entry.search);
  if (memoryEntries.find(entry => entry === newUrl) === undefined) {
    MemoryHistory.push(newUrl);
  } else {
    MemoryHistory.entries.push(MemoryHistory.entries.splice(
      MemoryHistory.entries.findIndex(entry => entry.pathname + entry.search === newUrl), 1
    )[0]);
  }

  let pages = MemoryHistory.entries.map(location => location.pathname + location.search);
  if (pages.length > MAX_BH_RECENT_QUERIES) { pages.pop(); }
  BrowserPersistence.setItem(BH_RECENT_PAGES, pages);
}

export function resetMemoryHistory() {
  MemoryHistory.entries = [];
}
