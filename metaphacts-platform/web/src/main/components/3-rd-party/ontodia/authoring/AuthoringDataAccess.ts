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
import * as Ontodia from 'ontodia';
import * as Kefir from 'kefir';
import * as Immutable from 'immutable';

import { BatchedPool } from 'platform/api/async';

import * as Forms from 'platform/components/forms';

import { EntityMetadata } from './FieldConfigurationCommon';

export interface LoadedEntity {
  model: Ontodia.ElementModel;
  newIri: Ontodia.ElementIri | undefined;
  status: 'new' | 'changed' | 'deleted';
}

export async function generateAuthoredEntity(
  metadata: EntityMetadata,
  ct: Ontodia.CancellationToken,
  context: Ontodia.WorkspaceContext
): Promise<LoadedEntity> {
  const {editor} = context;
  const newModel = await editor.metadataApi.generateNewElement([metadata.entityType], ct);
  return {model: newModel, status: 'new', newIri: undefined};
}

export async function loadAuthoredEntity(
  elementIri: Ontodia.ElementIri,
  ct: Ontodia.CancellationToken,
  context: Ontodia.WorkspaceContext
): Promise<LoadedEntity> {
  const {model: diagramModel, editor} = context;

  let model: Ontodia.ElementModel | undefined;
  let newIri: Ontodia.ElementIri | undefined;
  let status: 'new' | 'changed' | 'deleted';
  const change = editor.authoringState.elements.get(elementIri);
  if (change) {
    if (change.deleted) {
      throw new Error(`Cannot edit deleted entity <${elementIri}>`);
    }
    model = change.after;
    newIri = change.newIri;
    status = (
      change.deleted ? 'deleted' :
      change.before ? 'changed' :
      'new'
    );
  } else {
    const pool = getOrCreateElementInfoPool(diagramModel.dataProvider);
    model = await pool.query(elementIri).toPromise();
    Ontodia.CancellationToken.throwIfAborted(ct);
    if (!(model && model.types.length > 0)) {
      throw new Error(`Failed to get entity <${elementIri}>`);
    }
    status = 'changed';
  }

  return {model, newIri, status};
}

interface ExtendedDataProvider extends Ontodia.DataProvider {
  [ELEMENT_INFO_POOL]?: BatchedPool<Ontodia.ElementIri, Ontodia.ElementModel>;
}

const ELEMENT_INFO_POOL: unique symbol = Symbol('AuthoringDataAccess.elementInfoPool');

function getOrCreateElementInfoPool(
  dataProvider: ExtendedDataProvider
): BatchedPool<Ontodia.ElementIri, Ontodia.ElementModel> {
  let pool = dataProvider[ELEMENT_INFO_POOL];
  if (!pool) {
    pool = new BatchedPool({
      fetch: elementIriSet => {
        const elementIds = elementIriSet.toArray();
        return Kefir.fromPromise(dataProvider.elementInfo({elementIds}))
          .map(models => Immutable.Map<Ontodia.ElementIri, Ontodia.ElementModel>(models))
          .toProperty();
      }
    });
    dataProvider[ELEMENT_INFO_POOL] = pool;
  }
  return pool;
}

export function validateSubject(
  validatedModel: Forms.CompositeValue,
  authoringState: Ontodia.AuthoringState
): Kefir.Property<Forms.CompositeChange> {
  const validatedSubject = validatedModel.subject;
  let hasSameSubject = false;
  authoringState.elements.forEach((change, iri) => {
    hasSameSubject = hasSameSubject
      || validatedSubject.value === iri
      || validatedSubject.value === change.newIri;
  });
  if (hasSameSubject) {
    const change: Forms.CompositeChange = model => {
      if (model.subject.value !== validatedSubject.value) {
        return model;
      }
      return Forms.setSubjectError(model, `Entity with the same IRI does already exist`);
    };
    return Kefir.later(0, change).toProperty();
  }
  return Forms.validateSubjectByQuery(
    validatedSubject,
    'ASK { FILTER(NOT EXISTS { ?subject ?p ?o }) }'
  );
}

export function noCompositeChanges() {
  return Kefir.later<Forms.CompositeChange>(0, value => value).toProperty();
}
