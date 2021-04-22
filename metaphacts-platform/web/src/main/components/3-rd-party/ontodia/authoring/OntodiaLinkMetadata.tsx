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
import * as Immutable from 'immutable';
import { LinkTypeIri, CancellationToken } from 'ontodia';

import { Rdf } from 'platform/api/rdf';
import * as Forms from 'platform/components/forms';

import {
  FieldConfigurationContext, LinkMetadata,
  assertFieldConfigurationItem, validateFormFieldsDatatype,
} from './FieldConfigurationCommon';

interface OntodiaLinkMetadataConfig {
  /**
   * Iri of the type to be configured. For example, 'http://xmlns.com/foaf/0.1/knows'
   */
  linkTypeIri: string;

  /**
   * Defines whether the link has separate identity IRI which allows multiple links
   * of the same type between source and target entities.
   *
   * @default false
   */
  hasIdentity?: boolean;

  /**
   * Ordered list of fields to be used for this link. Automatically generated forms will honor
   * the order of the fields specified here.
   */
  fields?: ReadonlyArray<string>;

  /**
   * Subject template override for generating IRIs for new links of this type.
   */
  newSubjectTemplate?: string;

  /**
   * Subject template settings override for generating IRIs for new links of this type.
   */
  newSubjectTemplateSettings?: Forms.SubjectTemplateSettings;

  /**
   * Link properties required for the link to be editable
   */
  editableWhen?: { [property: string]: string };

  /**
   * Semantic form override. If developer wants to override auto-generated form,
   * it should be placed inside `<ontodia-entity-metadata>`.
   */
  children?: {};
}

export interface OntodiaLinkMetadataProps extends OntodiaLinkMetadataConfig {
  children?: React.ReactNode;
}

export class OntodiaLinkMetadata extends React.Component<OntodiaLinkMetadataProps, {}> {
  render(): null { return null; }

  static getRequiredFields(
    props: OntodiaLinkMetadataProps,
    ct: CancellationToken
  ): Promise<Rdf.Iri[]> {
    const fieldIris: Rdf.Iri[] = [];
    fieldIris.push(Rdf.iri(props.linkTypeIri));
    for (const otherField of props.fields) {
      fieldIris.push(Rdf.iri(otherField));
    }
    return Promise.resolve(fieldIris);
  }

  static async configure(
    props: OntodiaLinkMetadataProps,
    context: FieldConfigurationContext
  ): Promise<void> {
    extractAuthoringMetadata(props, context);
  }
}

assertFieldConfigurationItem(OntodiaLinkMetadata);

function extractAuthoringMetadata(
  props: OntodiaLinkMetadataProps,
  context: FieldConfigurationContext
): void {
  const {fieldByIri: allFieldByIri, typeIri} = context;
  const {
    linkTypeIri,
    hasIdentity = false,
    fields,
    newSubjectTemplate = context.defaultSubjectTemplate,
    newSubjectTemplateSettings = context.defaultSubjectTemplateSettings,
    editableWhen,
  } = props;

  if (typeof linkTypeIri !== 'string') {
    throw new Error(`Missing 'link-type-iri' property for <ontodia-link-metadata>`);
  }
  if (!fields) {
    throw new Error(`Missing 'fields' property for <ontodia-link-metadata>`);
  }

  const typeField = allFieldByIri.get(typeIri);
  if (!typeField) {
    throw new Error(
      `<ontodia-link-metadata> for <${linkTypeIri}>: missing type field <${typeIri}>`
    );
  }

  const selfField = allFieldByIri.get(linkTypeIri);
  if (!selfField) {
    throw new Error(
      `<ontodia-link-metadata> for <${linkTypeIri}>: missing self field for link type`
    );
  }

  const mappedFields = fields.map(fieldIri => {
    const field = allFieldByIri.get(fieldIri);
    if (!field) {
      throw new Error(
        `<ontodia-link-metadata> for <${linkTypeIri}>: missing field <${fieldIri}>`
      );
    }
    return field;
  });

  const entityFields = [typeField, ...mappedFields];
  const fieldByIri = Immutable.Map(
    entityFields.map(f => [f.iri, f] as [string, Forms.FieldDefinition])
  );

  const metadata: LinkMetadata = {
    type: 'link',
    linkType: linkTypeIri as LinkTypeIri,
    hasIdentity,
    selfField,
    fields: entityFields,
    fieldByIri,
    typeField,
    ownedFields: new Set(),
    newSubjectTemplate,
    newSubjectTemplateSettings,
    formChildren: props.children,
    editableWhen,
  };

  validateFormFieldsDatatype(metadata.formChildren, metadata);

  context.collectedLinks.set(metadata.linkType, metadata);
}

export default OntodiaLinkMetadata;
