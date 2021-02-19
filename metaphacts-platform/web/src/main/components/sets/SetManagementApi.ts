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
import * as Kefir from 'kefir';
import * as PropTypes from 'prop-types';

import { Rdf } from 'platform/api/rdf';

import { SetItem } from './SetsModel';

/**
 * API exposed by <mp-set-management> through the React context.
 */
export interface SetManagementApi {
  /**
   * Remove set item from the set.
   */
  removeSetItem(set: Rdf.Iri, item: Rdf.Iri): void;

  /**
   * Remove set by IRI.
   */
  removeSet(set: Rdf.Iri): void;

  /**
   * Puts set into renaming mode.
   */
  startRenamingSet(set: Rdf.Iri): void;

  /**
   * Fetches set items of a selected set
   */
  fetchSetItems(set: Rdf.Iri): Kefir.Stream<ReadonlyArray<SetItem>>;
}

// TODO revise when https://github.com/Microsoft/TypeScript/issues/13948 is fixed
export const SetManagementContextKey = 'mp-set-management';
export type SetManagementContext = {
  [K in typeof SetManagementContextKey]: SetManagementApi;
};

export const SetManagementContextTypes = {
  [SetManagementContextKey]: PropTypes.any.isRequired,
};

/**
 * API exposed by set view component through the React context.
 */
export interface SetViewApi {
  getCurrentSet(): Rdf.Iri;
}

export const SetViewContextKey = 'mp-set-management--set-view';
export type SetViewContext = {
  [K in typeof SetViewContextKey]: SetViewApi;
};
export const SetViewContextTypes = {
  [SetViewContextKey]: PropTypes.any.isRequired,
};

/**
 * API exposed by set item view component through the React context.
 */
export interface SetItemViewApi {
  getItem(): Rdf.Iri;
  getSetItemIri(): Rdf.Iri;
}

export const SetItemViewContextKey = 'mp-set-management--set-item-view';
export type SetItemViewContext = {
  [K in typeof SetItemViewContextKey]: SetItemViewApi;
};
export const SetItemViewContextTypes = {
  [SetItemViewContextKey]: PropTypes.any.isRequired,
};
