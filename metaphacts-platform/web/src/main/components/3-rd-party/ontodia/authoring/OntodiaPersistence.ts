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
import { AuthoringState, DataProvider, ElementIri, ElementTypeIri, ElementModel } from 'ontodia';

import { EntityMetadata } from './FieldConfigurationCommon';

export interface OntodiaPersistence {
  readonly supportsIriEditing: boolean;
  persist(params: OntodiaPersistenceParams): Kefir.Property<OntodiaPersistenceResult>;
}

export interface OntodiaPersistenceParams {
  readonly dataProvider: DataProvider;
  readonly entityMetadata: ReadonlyMap<ElementTypeIri, EntityMetadata>;
  readonly state: AuthoringState;
  fetchModel(iri: ElementIri): Kefir.Property<ElementModel>;
}

export interface OntodiaPersistenceResult {
  /**
   * Result entities data after persistence operation completed.
   * `null` value for an entity indicates that it was deleted.
   */
  finalizedEntities: Map<ElementIri, ElementModel | null>;
}

// This interface defined here instead of next to implementation to be able to
// expose it in Ontodia props interface and the documentation
export interface OntologyPersistenceProps {
  type: 'ontology' | 'ontology-legacy';
  targetGraphIri: string;
  ontology: string;
  repository: string;
  typePattern?: string;
  debug?: boolean;
}
