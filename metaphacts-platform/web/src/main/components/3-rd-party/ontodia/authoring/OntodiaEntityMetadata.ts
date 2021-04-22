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
import * as React from 'react';
import { ReactNode } from 'react';
import * as Immutable from 'immutable';
import { ElementTypeIri, CancellationToken } from 'ontodia';

import { Rdf } from 'platform/api/rdf';
import * as Forms from 'platform/components/forms';

import {
  FieldConfigurationContext, EntityMetadata,
  assertFieldConfigurationItem, validateFormFieldsDatatype,
} from './FieldConfigurationCommon';

/**
 * **Example**:
 * ```
 * <!-- entity with auto-generated form -->
 * <ontodia-entity-metadata
 *   entity-type-iri='http://example.com/Person'
 *   fields='["field-iri-1", "field-iri-2", ...]'
 *   label-iri='http://www.example.com/fields/personName'
 *   new-subject-template='http://www.example.com/person/{{UUID}}'>
 * </ontodia-entity-metadata>
 * ```
 *
 * **Example**:
 * ```
 * <ontodia-entity-metadata
 *   entity-type-iri='http://example.com/Company'
 *   fields='["field-iri-1", "field-iri-2", ...]'
 *   label-iri='http://www.example.com/fields/companyName'
 *   image-iri='http://www.example.com/fields/hasType'
 *   new-subject-template='http://www.example.com/company/{{UUID}}'
 *   force-iris='["datatype-field-1", ...]'>
 *
 *   <semantic-form-text-input for='http://www.example.com/fields/companyName'>
 *   </semantic-form-text-input>
 *
 *   <semantic-form-composite-input
 *     for='http://www.example.com/fields/companyAddress'
 *     fields='...'>
 *     <!-- inputs for addressCountry, addressCity, etc) -->
 *   </semantic-form-composite-input>
 *
 *   <semantic-form-errors></semantic-form-errors>
 *   <button name="submit" class="btn btn-secondary">Save</button>
 *   <button name="reset" class="btn btn-secondary">Reset</button>
 * </ontodia-entity-metadata>
 * ```
 */
interface OntodiaEntityMetadataConfig {
  /**
   * Iri of the type to be configured. For example, 'http://xmlns.com/foaf/0.1/person'
   */
  entityTypeIri: string;

  /**
   * Ordered list of fields to be used for this entity. Automatically generated forms will honor
   * the order of the fields specified here.
   */
  fields: ReadonlyArray<string>;

  /**
   * Field IRI for entity label override.
   */
  labelIri?: string;

  /**
   * Field IRI for entity image override.
   */
  imageIri?: string;

  /**
   * **Experimental** Field IRIs the values of which should be tracked as owned by this entity.
   *
   * Being owned by entity means:
   *   - all changes in owned entities will be reflected as change in owner entity;
   *   - discarding changes for owner entity will also discard all changes in owned entities;
   */
  ownedFields?: ReadonlyArray<string>;

  /**
   * Subject template override for generating IRIs for new entities of this type.
   */
  newSubjectTemplate?: string;

  /**
   * Subject template settings override for generating IRIs for new entities of this type.
   */
  newSubjectTemplateSettings?: Forms.SubjectTemplateSettings;

  /**
   * Entity properties required for the entity to be editable
   */
  editableWhen?: { [property: string]: string };

  /**
   * Semantic form override. If developer wants to override auto-generated form,
   * it should be placed inside `<ontodia-entity-metadata>`.
   */
  children?: {};
}

export interface OntodiaEntityMetadataProps extends OntodiaEntityMetadataConfig {
  children?: ReactNode;
}

export class OntodiaEntityMetadata extends React.Component<OntodiaEntityMetadataProps, {}> {
  render(): null { return null; }

  static getRequiredFields(
    props: OntodiaEntityMetadataProps,
    ct: CancellationToken
  ): Promise<Rdf.Iri[]> {
    const fieldIris: Rdf.Iri[] = [];
    if (props.labelIri) {
      fieldIris.push(Rdf.iri(props.labelIri));
    }
    if (props.imageIri) {
      fieldIris.push(Rdf.iri(props.imageIri));
    }
    for (const otherField of props.fields) {
      fieldIris.push(Rdf.iri(otherField));
    }
    return Promise.resolve(fieldIris);
  }

  static async configure(
    props: OntodiaEntityMetadataProps,
    context: FieldConfigurationContext
  ): Promise<void> {
    extractAuthoringMetadata(props, context);
  }
}

assertFieldConfigurationItem(OntodiaEntityMetadata);

function extractAuthoringMetadata(
  props: OntodiaEntityMetadataProps,
  context: FieldConfigurationContext
): void {
  const {fieldByIri: allFieldByIri, typeIri, datatypeFields} = context;
  const {
    entityTypeIri,
    fields,
    editableWhen,
    labelIri = context.defaultLabelIri,
    imageIri = context.defaultImageIri,
    ownedFields = [],
    newSubjectTemplate = context.defaultSubjectTemplate,
    newSubjectTemplateSettings = context.defaultSubjectTemplateSettings,
  } = props;

  if (typeof entityTypeIri !== 'string') {
    throw new Error(`Missing 'entity-type-iri' property for <ontodia-entity-metadata>`);
  }
  if (!fields) {
    throw new Error(`Missing 'fields' property for <ontodia-entity-metadata>`);
  }

  const typeField = allFieldByIri.get(typeIri);
  const labelField = labelIri ? allFieldByIri.get(labelIri) : null;
  const imageField = imageIri ? allFieldByIri.get(imageIri) : null;

  if (!typeField) {
    throw new Error(
      `<ontodia-entity-metadata> for <${entityTypeIri}>: missing type field <${typeIri}>`
    );
  }

  for (const ownedField of ownedFields) {
    if (!allFieldByIri.has(ownedField)) {
      throw new Error(
        `<ontodia-entity-metadata> for <${entityTypeIri}>: missing owned field <${ownedField}>`
      );
    }
  }

  const mappedFields = fields.map(fieldIri => {
    const field = allFieldByIri.get(fieldIri);
    if (!field) {
      throw new Error(
        `<ontodia-entity-metadata> for <${entityTypeIri}>: missing field <${fieldIri}>`
      );
    }
    return field;
  });

  const headFields = [typeField];
  if (labelField) {
    headFields.push(labelField);
  }
  if (imageField) {
    headFields.push(imageField);
  }

  const entityFields = [...headFields, ...mappedFields];
  const fieldByIri = Immutable.Map(
    entityFields.map(f => [f.iri, f] as [string, Forms.FieldDefinition])
  );

  const metadata: EntityMetadata = {
    type: 'entity',
    entityType: entityTypeIri as ElementTypeIri,
    editableWhen,
    fields: entityFields,
    fieldByIri,
    datatypeFields: Immutable.Set<string>(
      datatypeFields.filter(fieldIri => fieldByIri.has(fieldIri))
    ),
    typeField,
    labelField,
    imageField,
    ownedFields: new Set(ownedFields),
    newSubjectTemplate,
    newSubjectTemplateSettings,
    formChildren: props.children,
  };

  validateFormFieldsDatatype(metadata.formChildren, metadata);

  context.collectedEntities.set(metadata.entityType, metadata);
}

export default OntodiaEntityMetadata;
