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
import { Children, ReactNode } from 'react';
import * as Immutable from 'immutable';
import { ElementTypeIri, LinkTypeIri, CancellationToken } from 'ontodia';

import { Component } from 'platform/api/components';
import { Rdf } from 'platform/api/rdf';
import * as FieldService from 'platform/api/services/ldp-field';

import * as Forms from 'platform/components/forms';
import { isValidChild } from 'platform/components/utils';

import { observableToCancellablePromise } from '../AsyncAdapters';
import {
  EntityMetadata, LinkMetadata, FieldInputOverride, FormOverride, FieldConfiguration,
  FieldConfigurationContext, FieldConfigurationItem, OntodiaPersistenceMode,
} from './FieldConfigurationCommon';

interface OntodiaFieldConfigurationConfigBase {
  /**
   * Switches Ontodia to authoring mode.
   *
   * Authoring mode requires entity metadata to be specified in order to work.
   *
   * @default false
   */
  authoringMode?: boolean;

  /**
   * Enables field-based validation in authoring mode.
   *
   * @default true
   */
  enableValidation?: boolean;

  /**
   * Defines persistence mode to use in authoring mode.
   * @default {"type": "form"}
   */
  persistence?: OntodiaPersistenceMode;

  /**
   * Allows to fetch field definitions from the backend API.
   * @default true
   */
  allowRequestFields?: boolean;

  /**
   * Field that is used for entity type. In most cases field should use `rdf:type` as a property.
   */
  typeIri: string;

  /**
   * Default field to be used for entity label.
   */
  defaultLabelIri?: string;

  /**
   * Default field to be used for entity image.
   */
  defaultImageIri?: string;

  /**
   * Default template to create IRIs for new entities and links.
   *
   * @mpSeeResource {
   *   "name": "Semantic Form - new-subject-template",
   *   "iri": "http://help.metaphacts.com/resource/SemanticForm"
   * }
   */
  defaultSubjectTemplate?: string;

  /**
   * Default template settings for generating IRIs for new entities and links.
   */
  defaultSubjectTemplateSettings?: Forms.SubjectTemplateSettings;

  /**
   * Forces certain fields of `xsd:anyUri` datatype to be treated as entity properties
   * to be modified inside entity form instead of object properties treated and modified
   * as an edge in the graph, like entity image IRI, or some vocabulary reference.
   */
  forceDatatypeFields?: ReadonlyArray<string>;

  /**
   * Allows to disable default label generation for entities and keep it empty.
   *
   * @default true
   */
  generatePlaceholderLabel?: boolean;

  /**
   * Renders debug info into DOM when placed as stand-alone component and also to the console.
   * @default false
   */
  debug?: boolean;
}

export interface OntodiaFieldConfigurationConfig extends OntodiaFieldConfigurationConfigBase {
  /**
   * Fields to be used in Ontodia instance. Could be populated inline or with backend helper.
   *
   * @mpSeeResource {
   *   "name": "Semantic Form - Reading Field Definitions from the Database",
   *   "iri": "http://help.metaphacts.com/resource/SemanticForm"
   * }
   */
  fields?: ReadonlyArray<Forms.FieldDefinitionConfig>;
  /**
   * Children can be any number of:
   *   - `<ontodia-entity-metadata>`
   *   - `<ontodia-link-metadata>`
   *   - `<ontodia-field-input-override>`
   */
  children: {};
}

export interface OntodiaFieldConfigurationProps extends OntodiaFieldConfigurationConfigBase {
  readonly fields: ReadonlyArray<Forms.FieldDefinitionProp>;
  readonly children: ReactNode;
}

export class OntodiaFieldConfiguration extends Component<OntodiaFieldConfigurationProps, {}> {
  render(): null { return null; }
}

export async function extractFieldConfiguration(
  props: OntodiaFieldConfigurationProps | undefined,
  ct: CancellationToken
): Promise<FieldConfiguration> {
  const collectedEntities = new Map<ElementTypeIri, EntityMetadata>();
  const collectedLinks = new Map<LinkTypeIri, LinkMetadata>();
  const collectedInputOverrides: FieldInputOverride[] = [];
  const collectedFormOverrides: FormOverride[] = [];

  let fieldByIri = Immutable.Map<string, Forms.FieldDefinition>();
  const datatypeFields = new Map<string, Forms.FieldDefinition>();

  if (!props) {
    return {
      startInAuthoringMode: false,
      enableValidation: false,
      generatePlaceholderLabel: false,
      entities: collectedEntities,
      links: collectedLinks,
      persistence: undefined,
      datatypeFields,
      inputOverrides: collectedInputOverrides,
      formOverrides: collectedFormOverrides,
    };
  }

  const {
    typeIri, defaultLabelIri, defaultImageIri,
    defaultSubjectTemplate, defaultSubjectTemplateSettings,
    allowRequestFields = true,
    fields: passedFields = [],
    forceDatatypeFields = [],
  } = props;
  if (typeof typeIri !== 'string') {
    throw new Error(`Missing 'typeIri' property for ontodia-field-configuration`);
  }

  type ConfigurationStep = {
    props: object;
    type: FieldConfigurationItem;
  };
  const steps = Children.toArray(props.children).filter(
    (child): child is ConfigurationStep =>
      isValidChild(child) && isConfigurationItem(child.type)
  );

  const requestedFields: Rdf.Iri[] = [];
  const requestedFieldSet = new Set<string>();
  for (const field of passedFields) {
    // do not request fields that were passed manually in the props
    requestedFieldSet.add(field.iri);
  }

  if (!requestedFieldSet.has(typeIri)) {
    requestedFieldSet.add(typeIri);
    requestedFields.push(Rdf.iri(typeIri));
  }

  // find all required fields from each configuration item
  for (const step of steps) {
    if (step.type.getRequiredFields) {
      for (const fieldIri of await step.type.getRequiredFields(step.props, ct)) {
        if (requestedFieldSet.has(fieldIri.value)) { continue; }
        requestedFieldSet.add(fieldIri.value);
        requestedFields.push(fieldIri);
      }
    }
  }

  let allFields = passedFields;
  if (requestedFields.length > 0) {
    if (!allowRequestFields) {
      throw new Error(
        'Fetching following fields is disallowed by configuration:\n' +
        requestedFields.map(iri => iri.toString()).join(',\n')
      );
    }
    const fetchedFields = await observableToCancellablePromise(
      FieldService.getGeneratedFieldDefinitions({fields: requestedFields}), ct
    );
    allFields = allFields.concat(fetchedFields);
  }

  fieldByIri = Immutable.Map(allFields.map(rawField => {
    let field = Forms.normalizeFieldDefinition(rawField);
    // replace field ID by field IRI
    field = {...field, id: field.iri};
    return [field.iri, field] as [string, Forms.FieldDefinition];
  }));

  for (const datatypeFieldIri of forceDatatypeFields) {
    datatypeFields.set(datatypeFieldIri, fieldByIri.get(datatypeFieldIri));
  }

  const context: FieldConfigurationContext = {
    fieldByIri,
    typeIri,
    defaultLabelIri,
    defaultImageIri,
    defaultSubjectTemplate,
    defaultSubjectTemplateSettings,
    datatypeFields: forceDatatypeFields,
    cancellationToken: ct,
    collectedEntities,
    collectedLinks,
    collectedInputOverrides,
    collectedFormOverrides,
  };

  // execute configuration steps from each configuration item
  for (const step of steps) {
    await step.type.configure(step.props, context);
  }

  const finalConfig: FieldConfiguration = {
    startInAuthoringMode: props ? Boolean(props.authoringMode) : false,
    enableValidation: props.enableValidation ?? true,
    generatePlaceholderLabel: props.generatePlaceholderLabel ?? true,
    entities: collectedEntities,
    links: collectedLinks,
    persistence: props ? props.persistence : undefined,
    datatypeFields,
    inputOverrides: collectedInputOverrides,
    formOverrides: collectedFormOverrides,
  };
  if (props.debug) {
    console.log('Ontodia field configuration:', finalConfig);
  }
  return finalConfig;
}

function isConfigurationItem(type: unknown): type is FieldConfigurationItem {
  if (typeof type !== 'function') {
    return false;
  }
  return typeof (type as Partial<FieldConfigurationItem>).configure === 'function';
}

export default OntodiaFieldConfiguration;
