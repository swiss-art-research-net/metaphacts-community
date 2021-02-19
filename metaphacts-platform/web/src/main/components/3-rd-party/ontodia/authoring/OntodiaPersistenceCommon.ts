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
import * as Immutable from 'immutable';
import {
  ElementIri, ElementTypeIri, LinkIri, LinkTypeIri, Property, ElementModel, LinkModel,
  AuthoringState, sameLink,
} from 'ontodia';

import { Rdf } from 'platform/api/rdf';

import {
  CompositeValue, EmptyValue, FieldState, FieldValue, FieldError, queryValues,
} from 'platform/components/forms';

import { EntityMetadata, LinkMetadata, isObjectProperty } from './FieldConfigurationCommon';

export function fetchInitialModel(
  subject: Rdf.Iri,
  metadata: EntityMetadata,
  fieldsToFetch = metadata.fieldByIri
): Kefir.Property<CompositeValue> {
  const initial = CompositeValue.set(CompositeValue.empty, {
    subject,
    definitions: metadata.fieldByIri,
  });

  const valuesFetching = fieldsToFetch.toArray().map(definition =>
    queryValues(definition.selectPattern, subject).map(bindings => {
      const values = bindings.map(b => FieldValue.fromLabeled(b));
      const state = FieldState.set(FieldState.empty, {values});
      return [definition.id, state] as [string, FieldState];
    })
  );

  return Kefir.zip(valuesFetching).map(fields => {
    const nonEmpty = fields.filter(([id, state]) => state.values.length > 0);
    return CompositeValue.set(initial, {fields: Immutable.Map(nonEmpty)});
  }).toProperty();
}

export function getEntityMetadata(
  elementData: ElementModel, allMetadata: ReadonlyMap<string, EntityMetadata>
): EntityMetadata | undefined {
  for (const type of elementData.types) {
    if (allMetadata.get(type)) {
      return allMetadata.get(type);
    }
  }
  return undefined;
}

export function getLinkMetadata(
  linkData: LinkModel, allMetadata: ReadonlyMap<string, LinkMetadata>
): LinkMetadata | undefined {
  return allMetadata.get(linkData.linkTypeId);
}

export function convertElementModelToCompositeValue(
  model: ElementModel,
  metadata: EntityMetadata
): CompositeValue {
  const fields = Immutable.Map<string, FieldState>().withMutations(map => {
    metadata.fieldByIri.forEach((definition, fieldId) => {
      let fieldValues: ReadonlyArray<FieldValue> = [];
      if (definition.iri === metadata.typeField.iri) {
        fieldValues = model.types.map(type =>
          FieldValue.fromLabeled({value: Rdf.iri(type)})
        );
      } else if (metadata.imageField && definition.iri === metadata.imageField.iri) {
        fieldValues = model.image ? [FieldValue.fromLabeled({value: Rdf.iri(model.image)})] : [];
      } else if (metadata.labelField && definition.iri === metadata.labelField.iri) {
        fieldValues = convertPropertyToFieldValues(model.label);
      } else {
        const property = model.properties[definition.iri];
        if (property) {
          fieldValues = convertPropertyToFieldValues(property);
        }
      }
      map.set(fieldId, {
        values: fieldValues,
        errors: FieldError.noErrors,
      });
    });
  });

  return CompositeValue.set(CompositeValue.empty, {
    subject: Rdf.iri(model.id),
    definitions: metadata.fieldByIri,
    fields,
  });
}

export function convertLinkModelToCompositeValue(
  model: LinkModel,
  metadata: LinkMetadata
): CompositeValue {
  const fields = Immutable.Map<string, FieldState>().withMutations(map => {
    metadata.fieldByIri.forEach((definition, fieldId) => {
      let fieldValues: ReadonlyArray<FieldValue> = [];
      if (definition.iri === metadata.typeField.iri) {
        const linkTypeIri = Rdf.iri(model.linkTypeId);
        fieldValues = [FieldValue.fromLabeled({value: linkTypeIri})];
      } else {
        const property = model.properties[definition.iri];
        if (property) {
          fieldValues = convertPropertyToFieldValues(property);
        }
      }
      map.set(fieldId, {
        values: fieldValues,
        errors: FieldError.noErrors,
      });
    });
  });

  return CompositeValue.set(CompositeValue.empty, {
    subject: model.linkIri ? Rdf.iri(model.linkIri) : CompositeValue.empty.subject,
    definitions: metadata.fieldByIri,
    fields,
  });
}

export function convertCompositeValueToElementModel(
  composite: CompositeValue,
  metadata: EntityMetadata
): ElementModel {
  let types: ElementTypeIri[] | undefined;
  let labels: Rdf.Literal[] | undefined;
  let image: string | undefined;
  const properties: { [id: string]: Property } = {};

  composite.fields.forEach((field, fieldId) => {
    const definition = metadata.fieldByIri.get(fieldId);
    if (definition.iri === metadata.typeField.iri) {
      types = field.values
        .map(FieldValue.asRdfNode)
        .filter(v => v && Rdf.isIri(v))
        .map(v => v.value as ElementTypeIri);
    } else if (metadata.imageField && definition.iri === metadata.imageField.iri) {
      image = FieldState.getFirst(field.values
        .map(FieldValue.asRdfNode)
        .filter(v => v && Rdf.isIri(v))
        .map(v => v.value)
      );
    } else if (metadata.labelField && definition.iri === metadata.labelField.iri) {
      field.values.forEach(v => {
        if (FieldValue.isAtomic(v) && Rdf.isLiteral(v.value)) {
          const label = FieldValue.asRdfNode(v) as Rdf.Literal;
          labels = labels ? [...labels, label] : [label];
        }
      });
    } else {
      const propertyValues = convertFieldValuesToProperty(field.values);
      if (propertyValues.length > 0) {
        properties[definition.iri] = {values: propertyValues};
      }
    }
  });

  return {
    id: composite.subject.value as ElementIri,
    types: types || [],
    label: {values: labels || []},
    image,
    properties,
  };
}

export function convertCompositeValueToLinkModel(
  composite: CompositeValue,
  target: Pick<LinkModel, 'sourceId' | 'targetId' | 'linkTypeId'>,
  metadata: LinkMetadata
): LinkModel {
  let types: LinkTypeIri[] | undefined;
  const properties: { [id: string]: Property } = {};
  composite.fields.forEach((field, fieldId) => {
    const definition = metadata.fieldByIri.get(fieldId);
    if (definition.iri === metadata.typeField.iri) {
      types = field.values
        .map(FieldValue.asRdfNode)
        .filter(v => v && Rdf.isIri(v))
        .map(v => v.value as LinkTypeIri);
    } else {
      const propertyValues = convertFieldValuesToProperty(field.values);
      if (propertyValues.length > 0) {
        properties[definition.iri] = {values: propertyValues};
      }
    }
  });
  if (!(types.length === 1 && types[0] === target.linkTypeId)) {
    throw new Error('Cannot change link type when converting from form model');
  }
  return {
    sourceId: target.sourceId,
    targetId: target.targetId,
    linkTypeId: target.linkTypeId,
    linkIri: composite.subject.value as LinkIri,
    properties,
  };
}

export function addEmptyValuesForRequiredFields(composite: CompositeValue): CompositeValue {
  let {fields} = composite;
  composite.fields.forEach((field, fieldId) => {
    const definition = composite.definitions.get(fieldId);
    if (field.values.length < definition.minOccurs) {
      const count = definition.minOccurs - field.values.length;
      const added = Array.from({length: count}, () => FieldValue.empty);
      fields = fields.set(fieldId, FieldState.set(field, {
        values: [...field.values, ...added],
      }));
    }
  });
  return fields === composite.fields ? composite : CompositeValue.set(composite, {fields});
}

export function applyEventsToCompositeValue(params: {
  elementIri: ElementIri;
  state: AuthoringState;
  metadata: EntityMetadata;
  initialModel: CompositeValue;
}): CompositeValue | EmptyValue {
  const {elementIri, state, metadata, initialModel} = params;

  let currentModel = initialModel;
  let deleted = false;
  let newIri: ElementIri;

  state.elements.forEach(event => {
    if (event.deleted) {
      const {after} = event;
      if (after.id === elementIri) {
        deleted = true;
      }
    } else {
      const changeEvent = event;
      const {after} = changeEvent;
      if (after.id === elementIri) {
        currentModel = applyElementModelToCompositeValue(after, currentModel, metadata);
        newIri = changeEvent.newIri !== currentModel.subject.value ? changeEvent.newIri : undefined;
      }
    }
  });

  state.links.forEach(event => {
    if (event.deleted) {
      const {after} = event;
      if (after.sourceId === elementIri) {
        currentModel = deleteLinkFromCompositeValue(after, currentModel, metadata);
      }
    } else if (event.before && sameLink(event.before, event.after)) {
      /* Only link properties changed -- not supported yet */
    } else {
      const {before, after} = event;
      if (before && before.sourceId === elementIri) {
        currentModel = deleteLinkFromCompositeValue(before, currentModel, metadata);
      }
      if (after.sourceId === elementIri) {
        currentModel = applyLinkModelToCompositeValue(after, currentModel, metadata);
      }
    }
  });

  // Filter out fields or field values whose target(value) was deleted
  const existingFields = currentModel.fields;
  existingFields.forEach((field, fieldId) => {
    const updater = (previous: FieldState) => {
      const newValueSet = previous.values.filter(value => {
        const relatedElementIri = FieldValue.asRdfNode(value).value as ElementIri;
        const event = state.elements.get(relatedElementIri);
        const isTargetValueDeleted = event && event.deleted;
        return !isTargetValueDeleted;
      });
      return FieldState.set(previous, {values: newValueSet});
    };
    const newFieldSet = currentModel.fields.update(fieldId, updater);
    currentModel = CompositeValue.set(currentModel, {fields: newFieldSet});
  });

  if (newIri) {
    currentModel = {
      ...currentModel,
      subject: Rdf.iri(newIri),
    };
  }

  return deleted ? FieldValue.empty : currentModel;
}

function applyLinkModelToCompositeValue(
  link: LinkModel,
  composite: CompositeValue,
  metadata: EntityMetadata
): CompositeValue {
  const value = Rdf.iri(link.targetId);
  const definition = metadata.fieldByIri.get(link.linkTypeId);
  if (!definition) {
    return composite;
  }
  const fields = composite.fields.update(
    definition.id,
    (previous = FieldState.empty) => FieldState.set(previous, {
      values: [
        ...previous.values,
        FieldValue.fromLabeled({value}),
      ],
    })
  );
  return CompositeValue.set(composite, {fields});
}

function applyElementModelToCompositeValue(
  model: ElementModel,
  composite: CompositeValue,
  metadata: EntityMetadata
): CompositeValue {
  let fields = composite.fields;

  metadata.fieldByIri.forEach((definition, fieldIri) => {
    if (isObjectProperty(definition, metadata)) { return; }
    let values: ReadonlyArray<FieldValue> = [];
    if (definition.id === metadata.typeField.id) {
      values = model.types.map(type => FieldValue.fromLabeled({value: Rdf.iri(type)}));
    } else if (metadata.labelField && definition.id === metadata.labelField.id) {
      values = convertPropertyToFieldValues(model.label);
    } else if (metadata.imageField && definition.id === metadata.imageField.id && model.image) {
      values = [FieldValue.fromLabeled({value: Rdf.iri(model.image)})];
    } else {
      const property = model.properties[fieldIri];
      if (property) {
        values = convertPropertyToFieldValues(property);
      }
    }
    fields = fields.set(definition.id, {
      values,
      errors: FieldError.noErrors,
    });
  });

  return CompositeValue.set(composite, {fields});
}

function convertPropertyToFieldValues(property: Property): FieldValue[] {
  return property.values.map(value => FieldValue.fromLabeled({value}));
}

function convertFieldValuesToProperty(
  values: ReadonlyArray<FieldValue>
): Array<Rdf.Iri | Rdf.Literal> {
  const result: Array<Rdf.Iri | Rdf.Literal> = [];
  for (const v of values) {
    const node = FieldValue.asRdfNode(v) as Rdf.Iri | Rdf.BNode | Rdf.Literal;
    if (node && (Rdf.isIri(node) || Rdf.isLiteral(node))) {
      result.push(node);
    }
  }
  return result;
}

function deleteLinkFromCompositeValue(
  link: LinkModel,
  composite: CompositeValue,
  metadata: EntityMetadata
): CompositeValue {
  const definition = metadata.fieldByIri.get(link.linkTypeId);
  if (!(definition && composite.fields.has(definition.id))) {
    return composite;
  }
  const fields = composite.fields.update(
    definition.id,
    previous => FieldState.set(previous, {
      values: previous.values
        .filter(v => FieldValue.asRdfNode(v).value !== link.targetId),
    })
  );
  return CompositeValue.set(composite, {fields});
}
