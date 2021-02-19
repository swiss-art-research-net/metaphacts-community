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
import * as SparqlJs from 'sparqljs';
import {
  ElementIri, ElementTypeIri, LinkIri, LinkTypeIri, PropertyTypeIri, ElementModel, LinkModel,
  MetadataApi, CancellationToken, PLACEHOLDER_ELEMENT_TYPE, Property,
} from 'ontodia';

import { Rdf } from 'platform/api/rdf';
import { rdf } from 'platform/api/rdf/vocabularies';
import { SparqlClient, SparqlUtil } from 'platform/api/sparql';
import { getLabel } from 'platform/api/services/resource-label';

import * as Forms from 'platform/components/forms';

import { observableToCancellablePromise } from '../AsyncAdapters';
import { EntityMetadata, LinkMetadata, isObjectProperty } from './FieldConfigurationCommon';
import {
  getEntityMetadata, getLinkMetadata, convertElementModelToCompositeValue,
  convertCompositeValueToElementModel, convertCompositeValueToLinkModel,
} from './OntodiaPersistenceCommon';

export interface FieldBasedMetadataApiOptions {
  generatePlaceholderLabel: boolean;
}

export class FieldBasedMetadataApi implements MetadataApi {
  constructor(
    private readonly entityMetadata: ReadonlyMap<ElementTypeIri, EntityMetadata>,
    private readonly linkMetadata: ReadonlyMap<LinkTypeIri, LinkMetadata>,
    private readonly options: FieldBasedMetadataApiOptions
  ) {}

  async generateNewElement(
    types: ReadonlyArray<ElementTypeIri>,
    ct: CancellationToken
  ): Promise<ElementModel> {
    let typeIri: ElementTypeIri | undefined;
    if (types && types.length !== 0) {
      typeIri = types[0];
    }

    let typeLabel: string;
    if (typeIri && typeIri !== PLACEHOLDER_ELEMENT_TYPE) {
      typeLabel = await observableToCancellablePromise(getLabel(Rdf.iri(typeIri)), ct);
    } else {
      typeLabel = 'Entity';
    }

    const labels = this.options.generatePlaceholderLabel ? [Rdf.literal(`New ${typeLabel}`)] : [];
    let newModel: ElementModel = {
      id: '' as ElementIri,
      types: [...types],
      label: {values: labels},
      properties: {},
    };

    const metadata = getEntityMetadata(newModel, this.entityMetadata);
    if (metadata) {
      const defaults = convertCompositeValueToElementModel(
        computeDefaultsFromMetadata(metadata),
        metadata
      );
      newModel = {
        ...newModel,
        image: defaults.image,
        properties: defaults.properties,
      };
    }

    return {
      ...newModel,
      id: this.generateIriForModel(newModel),
    };
  }

  generateIriForModel(model: ElementModel): ElementIri {
    let metadata: EntityMetadata | undefined;
    if (model.types.length > 0) {
      const firstType = model.types[0];
      if (firstType !== PLACEHOLDER_ELEMENT_TYPE) {
        metadata = this.entityMetadata.get(firstType);
      }
    }
    if (metadata) {
      const newComposite = convertElementModelToCompositeValue(
        {...model, id: '' as ElementIri}, metadata
      );
      const generatedIri = Forms.generateSubjectByTemplate(
        metadata.newSubjectTemplate, undefined, newComposite
      );
      return generatedIri.value as ElementIri;
    } else {
      const uuid = () => Math.floor((1 + Math.random()) * 0x100000000).toString(16).substring(1);
      return `NewEntity-${uuid()}` as ElementIri;
    }
  }

  async generateNewLink(
    source: ElementModel,
    target: ElementModel,
    linkType: LinkTypeIri,
    ct: CancellationToken
  ): Promise<LinkModel> {
    const metadata = this.linkMetadata.get(linkType);
    let newModel: LinkModel = {
      sourceId: source.id,
      targetId: target.id,
      linkTypeId: linkType,
      properties: {},
    };
    if (metadata && metadata.hasIdentity) {
      const generatedIri = Forms.generateSubjectByTemplate(
        metadata.newSubjectTemplate, undefined, Forms.CompositeValue.empty
      );
      const defaults = convertCompositeValueToLinkModel(
        computeDefaultsFromMetadata(metadata),
        newModel,
        metadata
      );
      newModel = {
        ...newModel,
        linkIri: generatedIri.value as LinkIri,
        properties: defaults.properties,
      };
    }
    return newModel;
  }

  async canConnect(
    source: ElementModel,
    target: ElementModel | null,
    linkType: LinkTypeIri | null,
    ct: CancellationToken
  ): Promise<boolean> {
    const sourceMetadata = getEntityMetadata(source, this.entityMetadata);
    if (!sourceMetadata) {
      return false;
    }

    let targetMetadata: EntityMetadata | undefined;
    if (target) {
      targetMetadata = getEntityMetadata(target, this.entityMetadata);
      // if target is set, we require that we know target metadata
      if (!targetMetadata) {
        return false;
      }
    }

    // if source is not editable, we should check if target is editable
    if (!await this.canEditElement(source, ct)) {
      // if called without target, we only starting editing.
      // If there's target, we need additional check
      if (target) {
        /* Checking if target is editable. This is used for allowing incoming links into ontology.
           Probably should be put under a parameter, because for field-based persistence
           it does not make sense, because we won't be able to persist this.
         */
        if (!await this.canEditElement(target, ct)) {
          return false;
        }
      } else {
        // source is not editable, but target is not specified, we just allow to continue.
        // We should expect the second call with the target set, then we'll check if it's editable
      }
    }

    const typeRequest = new BaseTypeClosureRequest();
    typeRequest.addAll(source.types);
    if (target) {
      typeRequest.addAll(target.types);
    }

    const task = typeRequest.query().map((typeClosure): boolean => {
      const hasCompatibleField = (
        from: ElementModel, fromMetadata: EntityMetadata, to: ElementModel | null
      ): boolean => {
        let found = false;
        fromMetadata.fieldByIri.forEach((field, fieldIri) => {
          const {domain, range} = field;
          const isCompatibleField = (
            isObjectProperty(field, fromMetadata) &&
            (!domain || hasCompatibleType(domain, from.types, typeClosure)) &&
            (!to || !range || hasCompatibleType(range, to.types, typeClosure)) &&
            (!linkType || linkType === fieldIri)
          );
          if (isCompatibleField) {
            found = true;
          }
        });
        return found;
      };
      return hasCompatibleField(source, sourceMetadata, target)
        || (target && hasCompatibleField(target, targetMetadata, source));
    });
    return observableToCancellablePromise(task, ct);
  }

  possibleLinkTypes(
    source: ElementModel,
    target: ElementModel,
    ct: CancellationToken
  ): Promise<LinkTypeIri[]> {
    const possibleLinkTypesTask = this.getPossibleLinkTypes(source, target);
    return observableToCancellablePromise(possibleLinkTypesTask, ct);
  }

  private getPossibleLinkTypes(
    source: ElementModel,
    target: ElementModel
  ): Kefir.Property<LinkTypeIri[]> {
    const sourceMetadata = getEntityMetadata(source, this.entityMetadata);
    const targetMetadata = getEntityMetadata(target, this.entityMetadata);
    if (!(sourceMetadata && targetMetadata)) {
      return Kefir.constant([]);
    }

    const typeRequest = new BaseTypeClosureRequest();
    typeRequest.addAll(source.types);
    typeRequest.addAll(target.types);

    return typeRequest.query().map(typeClosure => {
      const possibleLinks = new Set<LinkTypeIri>();

      sourceMetadata.fieldByIri.forEach((field, fieldIri) => {
        const isCompatibleField =
          isObjectProperty(field, sourceMetadata) &&
          hasCompatibleType(field.domain, source.types, typeClosure) &&
          hasCompatibleType(field.range, target.types, typeClosure);
        if (isCompatibleField) {
          possibleLinks.add(fieldIri as LinkTypeIri);
        }
      });

      return Array.from(possibleLinks);
    });
  }

  typesOfElementsDraggedFrom(
    source: ElementModel, ct: CancellationToken
  ): Promise<ElementTypeIri[]> {
    const metadata = getEntityMetadata(source, this.entityMetadata);
    if (!metadata) {
      return Promise.resolve([]);
    }

    const typeRequest = new BaseTypeClosureRequest();
    typeRequest.addAll(source.types);

    const task = typeRequest.query().map(typeClosure => {
      const targetTypes = new Set<ElementTypeIri>();

      metadata.fieldByIri.forEach(field => {
        const isCompatibleField =
          isObjectProperty(field, metadata) &&
          hasCompatibleType(field.domain, source.types, typeClosure);
        if (isCompatibleField) {
          for (const rangeType of field.range) {
            const entityType = rangeType.value as ElementTypeIri;
            if (this.entityMetadata.has(entityType)) {
              targetTypes.add(entityType);
            }
          }
        }
      });

      this.entityMetadata.forEach(otherMetadata => {
        otherMetadata.fieldByIri.forEach(field => {
          const isCompatibleField = (
            isObjectProperty(field, otherMetadata) &&
            field.range && hasCompatibleType(field.range, source.types, typeClosure)
          );
          if (isCompatibleField) {
            for (const domainType of field.domain) {
              const entityType = domainType.value as ElementTypeIri;
              if (this.entityMetadata.has(entityType)) {
                targetTypes.add(entityType);
              }
            }
          }
        });
      });

      return Array.from(targetTypes);
    });
    return observableToCancellablePromise(task, ct);
  }

  propertiesForType(type: ElementTypeIri, ct: CancellationToken): Promise<PropertyTypeIri[]> {
    return Promise.resolve([]);
  }

  canDeleteElement(element: ElementModel, ct: CancellationToken): Promise<boolean> {
    return this.canEditElement(element, ct);
  }

  filterConstructibleTypes(
    types: ReadonlySet<ElementTypeIri>, ct: CancellationToken
  ): Promise<ReadonlySet<ElementTypeIri>> {
    const constructibleTypes = new Set<ElementTypeIri>();
    this.entityMetadata.forEach((metadata, key) => {
        if (types.has(key as ElementTypeIri)) {
          constructibleTypes.add(key as ElementTypeIri);
        }
      }
    );
    return Promise.resolve(constructibleTypes);
  }

  async canEditElement(element: ElementModel, ct: CancellationToken): Promise<boolean> {
    const metadata = getEntityMetadata(element, this.entityMetadata);
    if (!metadata || !metadata.editableWhen) {
      return Promise.resolve(Boolean(metadata));
    }

    for (const property in metadata.editableWhen) {
      if (Object.prototype.hasOwnProperty.call(metadata.editableWhen, property)) {
        const propertyValue = metadata.editableWhen[property];
        const elementValues = element.properties[property];
        if (!elementValues || !elementValues.values.some(value => value.value === propertyValue)) {
          return false;
        }
      }
    }
    return true;
  }

  async canDeleteLink(
    link: LinkModel, source: ElementModel, target: ElementModel, ct: CancellationToken
  ): Promise<boolean> {
    return this.checkLinkModifiable(link, source, ct);
  }

  async canEditLink(
    link: LinkModel, source: ElementModel, target: ElementModel, ct: CancellationToken
  ): Promise<boolean> {
    const metadata = getLinkMetadata(link, this.linkMetadata);

    if (!metadata) {
      // we don't have metadata for the link, so there is nothing to edit
      return false;
    }

    // check if we have permission to modify the link at all
    if (!this.checkLinkModifiable(link, source, ct)) {
      // cannot modify link at all
      return false;
    }

    // calculate which fields can be reasonably edited by the link editor
    const editableFields = metadata.fields.filter(field => {
      if (field.id === rdf.type.value) {
        // skip auto-provided type field
        return false;
      }
      for (const property in metadata.editableWhen) {
        if (Object.prototype.hasOwnProperty.call(metadata.editableWhen, property)) {
          if (field.id === property) {
            // skip properties that affect checks (most likely to be defined outside)
            return false;
          }
        }
      }
      // pass along everything else
      return true;
    });

    // if we don't have practically editable fields, we do not show the edit dialog
    return editableFields.length > 0;
  }

  private checkLinkModifiable(link: LinkModel, source: ElementModel, ct: CancellationToken) {
    const metadata = getLinkMetadata(link, this.linkMetadata);
    // if we have no metadata or metadata does not contain editableWhen
    if (!metadata || !metadata.editableWhen) {
      // we don't have constraints, assume we can edit if the source is editable and knows our link
      const sourceMetadata = getEntityMetadata(source, this.entityMetadata);
      if (Boolean(sourceMetadata) && sourceMetadata.fieldByIri.has(link.linkTypeId)) {
        const sourceEditable = this.canEditElement(source, ct);
        // source is not editable
        return sourceEditable;
      } else {
        // source is unknown for us
        return false;
      }
    } else {
      // check if constraints are met
      return this.checkEditableConstraints(link.properties, metadata.editableWhen);
    }
  }

  private checkEditableConstraints(
    entityProperty: { [id: string]: Property; },
    editableProperties: { [property: string]: string; }
  ) {
    for (const property in editableProperties) {
      if (Object.prototype.hasOwnProperty.call(editableProperties, property)) {
        const propertyValue = editableProperties[property];
        const entityPropertyValues = entityProperty[property];
        if (!entityPropertyValues) {
          return false;
        }
        return entityPropertyValues.values.some(value => value.value === propertyValue);
      }
    }
    return true;
  }
}

export class BaseTypeClosureRequest {
  private static BASE_TYPES_QUERY = SparqlUtil.parseQuerySync<SparqlJs.SelectQuery>(
    'PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n' +
    'SELECT REDUCED ?type ?base WHERE { ?type rdfs:subClassOf* ?base }'
  );

  readonly derivedTypes = new Set<ElementTypeIri>();

  addAll(types: ReadonlyArray<ElementTypeIri>) {
    for (const type of types) {
      this.derivedTypes.add(type);
    }
  }

  query(): Kefir.Property<Map<ElementTypeIri, Set<ElementTypeIri>>> {
    const values: Array<{ type: Rdf.Iri }> = [];
    this.derivedTypes.forEach(type => {
      values.push({type: Rdf.iri(type)});
    });
    const preparedQuery =
      SparqlClient.prepareParsedQuery(values)(BaseTypeClosureRequest.BASE_TYPES_QUERY);
    return SparqlClient.select(preparedQuery).map(({results}) => {
      const baseTypes = new Map<ElementTypeIri, Set<ElementTypeIri>>();
      for (const binding of results.bindings) {
        const type = binding.type.value as ElementTypeIri;
        const base = binding.base.value as ElementTypeIri;
        let baseSet = baseTypes.get(type);
        if (!baseSet) {
          baseSet = new Set<ElementTypeIri>();
          baseTypes.set(type, baseSet);
        }
        baseSet.add(base);
      }
      return baseTypes;
    });
  }
}

export function hasCompatibleType(
  requiredTypes: ReadonlyArray<Rdf.Iri>,
  targetTypes: ReadonlyArray<ElementTypeIri>,
  targetTypesClosure: Map<ElementTypeIri, Set<ElementTypeIri>>
) {
  for (const targetType of targetTypes) {
    const closure = targetTypesClosure.get(targetType);
    for (const requiredType of requiredTypes) {
      if (closure.has(requiredType.value as ElementTypeIri)) {
        return true;
      }
    }
  }
  return false;
}

function computeDefaultsFromMetadata(metadata: EntityMetadata | LinkMetadata) {
  let fields = Forms.CompositeValue.empty.fields;
  // set value for datatype fields
  for (const field of metadata.fields) {
    if (!isObjectProperty(field, metadata) && field.defaultValues) {
      const defaults = field.defaultValues.map(v => Forms.createDefaultValue(v, field));
      const fieldState = Forms.FieldState.set(Forms.FieldState.empty, {values: defaults});
      fields = fields.set(field.id, fieldState);
    }
  }
  // set value for type field
  const typeIri = Rdf.iri(metadata.type === 'entity' ? metadata.entityType : metadata.linkType);
  const typeState = Forms.FieldState.set(Forms.FieldState.empty, {
    values: [Forms.FieldValue.fromLabeled({value: typeIri})],
  });
  fields = fields.set(metadata.typeField.id, typeState);
  return Forms.CompositeValue.set(Forms.CompositeValue.empty, {fields});
}
