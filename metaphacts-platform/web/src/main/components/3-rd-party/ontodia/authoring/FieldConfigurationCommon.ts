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
import * as Ontodia from 'ontodia';

import { Rdf } from 'platform/api/rdf';
import { xsd } from 'platform/api/rdf/vocabularies';

import * as Forms from 'platform/components/forms';

import { FormBasedPersistenceProps } from './FormBasedPersistence';
import { OntologyPersistenceProps } from './OntodiaPersistence';

export interface FieldConfiguration {
  readonly startInAuthoringMode: boolean;
  readonly enableValidation: boolean;
  readonly generatePlaceholderLabel: boolean;
  readonly entities: ReadonlyMap<Ontodia.ElementTypeIri, EntityMetadata>;
  readonly links: ReadonlyMap<Ontodia.LinkTypeIri, LinkMetadata>;
  readonly persistence: OntodiaPersistenceMode | undefined;
  readonly datatypeFields: ReadonlyMap<string, Forms.FieldDefinition>;
  readonly inputOverrides: ReadonlyArray<FieldInputOverride>;
  readonly formOverrides: ReadonlyArray<FormOverride>;
}

export type OntodiaPersistenceMode = FormBasedPersistenceProps | OntologyPersistenceProps;

export interface FieldConfigurationItem {
  getRequiredFields?(props: any, ct: Ontodia.CancellationToken): Promise<ReadonlyArray<Rdf.Iri>>;
  configure(props: any, context: FieldConfigurationContext): Promise<void>;
}

export interface FieldConfigurationContext {
  readonly fieldByIri: Immutable.Map<string, Forms.FieldDefinition>;
  readonly typeIri: string;
  readonly datatypeFields: ReadonlyArray<string>;
  readonly defaultLabelIri?: string;
  readonly defaultImageIri?: string;
  readonly defaultSubjectTemplate?: string;

  readonly cancellationToken: Ontodia.CancellationToken;
  readonly collectedEntities: Map<Ontodia.ElementTypeIri, EntityMetadata>;
  readonly collectedLinks: Map<Ontodia.LinkTypeIri, LinkMetadata>;
  readonly collectedInputOverrides: FieldInputOverride[];
  readonly collectedFormOverrides: FormOverride[];
}

interface BaseTypeMetadata {
  readonly fields: ReadonlyArray<Forms.FieldDefinition>;
  readonly fieldByIri: Immutable.Map<string, Forms.FieldDefinition>;
  readonly typeField: Forms.FieldDefinition;
  readonly newSubjectTemplate: string;
  readonly formChildren: React.ReactNode;
}

export type TypeMetadata = EntityMetadata | LinkMetadata;

export interface EntityMetadata extends BaseTypeMetadata {
  readonly type: 'entity';
  readonly entityType: Ontodia.ElementTypeIri;
  readonly datatypeFields: Immutable.Set<string>;
  readonly labelField?: Forms.FieldDefinition;
  readonly imageField?: Forms.FieldDefinition;
  readonly editableWhen?: { [property: string]: string };
}

export interface LinkMetadata extends BaseTypeMetadata {
  readonly type: 'link';
  readonly linkType: Ontodia.LinkTypeIri;
  readonly hasIdentity: boolean;
  readonly selfField: Forms.FieldDefinition;
  readonly editableWhen?: { [property: string]: string };
}

export interface FieldInputOverride extends Forms.InputOverride {
  readonly applyOn?: ReadonlyArray<ApplyOnState>;
}

export interface FormOverride {
  readonly target: {
    entityType?: Ontodia.ElementTypeIri;
    linkType?: Ontodia.LinkTypeIri;
  }
  readonly applyOn?: ReadonlyArray<ApplyOnState>;
  readonly formChildren: React.ReactNode;
}

export type ApplyOnState = 'create' | 'edit';

export function assertFieldConfigurationItem(item: FieldConfigurationItem) {
  if (typeof item.configure !== 'function') {
    throw new Error('Invalid field configuration item');
  }
}

export function isObjectProperty(field: Forms.FieldDefinition, metadata: TypeMetadata) {
  if (metadata.type === 'link') {
    return false;
  }
  const isImageField = metadata.imageField && metadata.imageField.iri === field.iri;
  const isForceField = metadata.datatypeFields.has(field.iri);
  return !isImageField && !isForceField &&
    (!field.xsdDatatype || Rdf.equalTerms(field.xsdDatatype, xsd.anyURI));
}

export function validateFormFieldsDatatype(
  children: React.ReactNode | undefined,
  metadata: TypeMetadata
): void {
  if (!children) { return; }
  React.Children.forEach(children, child => {
    const mapping = Forms.mapChildToComponent(child, {
      cardinalitySupport: Forms.CardinalitySupport,
    });
    if (!mapping || Forms.FieldMapping.isInputGroup(mapping, 'composite')) { return; }
    if (Forms.FieldMapping.isInput(mapping)) {
      const field = metadata.fieldByIri.get(mapping.element.props.for);
      if (isObjectProperty(field, metadata)) {
        throw new Error(`XSD Datatype of the field <${field.iri}> isn't literal`);
      }
    } else if (Forms.FieldMapping.isOtherElement(mapping)) {
      validateFormFieldsDatatype(mapping.children, metadata);
    }
  });
}

export function filterOverriddenInputs(
  overrides: ReadonlyArray<FieldInputOverride>,
  applyState: ApplyOnState | undefined
): ReadonlyArray<FieldInputOverride> {
  if (!applyState) {
    return overrides;
  }
  return overrides.filter(override =>
    !override.applyOn || override.applyOn.indexOf(applyState) >= 0
  );
}

export function getOverriddenForm(
  config: FieldConfiguration,
  target: FormOverride['target'],
  applyState?: ApplyOnState
): React.ReactNode | null {
  let defaultOverride: FormOverride | undefined;
  let specificOverride: FormOverride | undefined;
  for (const override of config.formOverrides) {
    const matchesTarget = (
      (!target.entityType || override.target.entityType === target.entityType) &&
      (!target.linkType || override.target.linkType === target.linkType)
    );
    if (matchesTarget) {
      if (!override.applyOn) {
        defaultOverride = override;
      } else if (applyState && override.applyOn.indexOf(applyState) >= 0) {
        specificOverride = override;
      }
    }
  }
  const foundOverride = specificOverride ?? defaultOverride;
  const metadata = (
    target.entityType ? config.entities.get(target.entityType) :
    target.linkType ? config.links.get(target.linkType) :
    undefined
  );
  return foundOverride?.formChildren ?? metadata?.formChildren;
}
