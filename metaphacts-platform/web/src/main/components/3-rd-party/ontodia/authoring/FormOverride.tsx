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
import * as Ontodia from 'ontodia';

import {
  FieldConfigurationContext, ApplyOnState, assertFieldConfigurationItem,
} from './FieldConfigurationCommon';

/**
 * Overrides default or generated form for a given entity or link type.
 */
interface OntodiaFormOverrideConfig {
  /**
   * Entity type IRI for which form have to be overridden.
   *
   * Cannot be specified together with `for-link-type`.
   */
  forEntityType?: string;
  /**
   * Link type IRI for which form have to be overridden.
   *
   * Cannot be specified together with `for-entity-type`.
   */
  forLinkType?: string;
  /**
   * Restricts in which states to override target input.
   */
  applyOn?: ReadonlyArray<ApplyOnState>;
  /**
   * Form markup to override with.
   */
  children: {};
}

export interface FormOverrideProps extends OntodiaFormOverrideConfig {
  children: React.ReactNode;
}

export class FormOverride extends React.Component<FormOverrideProps> {
  static async configure(
    props: FormOverrideProps,
    context: FieldConfigurationContext
  ): Promise<void> {
    const {forEntityType, forLinkType, applyOn, children} = props;
    if (forEntityType && forLinkType) {
      throw new Error(
        `Cannot set both "for-entity-type" and "for-link-type" for <ontodia-form-override>`
      );
    }
    if (!(forEntityType || forLinkType)) {
      throw new Error(
        `Either "for-entity-type" or "for-link-type" is required for <ontodia-form-override>`
      );
    }
    context.collectedFormOverrides.push({
      target: {
        entityType: forEntityType as Ontodia.ElementTypeIri,
        linkType: forLinkType as Ontodia.LinkTypeIri,
      },
      applyOn,
      formChildren: children,
    });
  }
}

assertFieldConfigurationItem(FormOverride);

export default FormOverride;
