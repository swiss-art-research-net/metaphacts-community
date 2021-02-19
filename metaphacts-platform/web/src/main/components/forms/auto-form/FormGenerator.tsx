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

import { vocabularies } from 'platform/api/rdf';

import * as Inputs from '../inputs';
import { FormErrors } from '../static';
import { FieldDefinition } from '../FieldDefinition';

const {rdf, xsd} = vocabularies;

export interface GenerateFormFromFieldsParams {
  fields: ReadonlyArray<FieldDefinition>;
  overrides: ReadonlyArray<InputOverride>;
  /** @default false */
  omitFooter?: boolean;
}

export interface InputOverride {
  readonly target: InputOverrideTarget;
  readonly input: FieldInputElement;
}

export interface InputOverrideTarget {
  fieldIri?: string;
  datatype?: string;
}

export type FieldInputElement =
  React.ReactElement<Inputs.SingleValueInputProps | Inputs.MultipleValuesProps>;

export function generateFormFromFields(params: GenerateFormFromFieldsParams): React.ReactNode[] {
  const content: React.ReactNode[] = [];
  for (const field of params.fields) {
    let lastMatched: FieldInputElement | undefined;
    for (const override of params.overrides) {
      const {fieldIri, datatype} = override.target;
      if (fieldIri && fieldIri === field.iri) {
        lastMatched = override.input;
      } else if (datatype && field.xsdDatatype && field.xsdDatatype.value === datatype) {
        lastMatched = override.input;
      }
    }
    const generatedInput = lastMatched
      ? React.cloneElement(lastMatched, {for: field.id})
      : generateInputForField(field);
    content.push(React.cloneElement(generatedInput, {key: field.id}));
  }
  if (!params.omitFooter) {
    content.push(<FormErrors key='generated-form-errors' />);
    content.push(
      <button key='generated-save-button'
        name='submit'
        className='btn btn-secondary'>
        Save
      </button>
    );
    content.push(
      <button key='generated-rest-button'
        name='reset'
        className='btn btn-secondary'>
        Reset
      </button>
    );
  }
  return content;
}

function generateInputForField(field: FieldDefinition): React.ReactElement<any> {
  if (field.treePatterns) {
    return <Inputs.TreePickerInput for={field.id} />;
  }

  if (field.autosuggestionPattern) {
    return <Inputs.AutocompleteInput for={field.id} />;
  }

  if (field.valueSetPattern) {
    return <Inputs.SelectInput for={field.id} />;
  }

  if (field.xsdDatatype) {
    switch (field.xsdDatatype.value) {
      case xsd.date.value:
      case xsd.time.value:
      case xsd.dateTime.value: {
        return <Inputs.DatePickerInput for={field.id} />;
      }
      case xsd.boolean.value: {
        return <Inputs.CheckboxInput for={field.id} />;
      }
      case xsd._string.value:
      case rdf.langString.value: {
        return <Inputs.PlainTextInput for={field.id} />;
      }
    }
  }

  return <Inputs.PlainTextInput for={field.id} />;
}
