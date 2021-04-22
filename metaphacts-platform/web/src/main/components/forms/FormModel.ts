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
import * as uuid from 'uuid';
import * as Immutable from 'immutable';
import * as Kefir from 'kefir';
import * as URI from 'urijs';
import { escapeRegExp, sortBy } from 'lodash';

import { Rdf, XsdDataTypeValidation, vocabularies } from 'platform/api/rdf';

import { FieldDefinition } from './FieldDefinition';
import {
  FieldValue, FieldError, ErrorKind, CompositeValue, FieldState, AtomicValue,
} from './FieldValues';
import { FieldMapping, InputMapping } from './FieldMapping';
import { queryValues, restoreLabel } from './QueryValues';

export interface CompositeChange {
  (value: CompositeValue): CompositeValue;
}

const DEFAULT_SUBJECT_TEMPLATE = '{{UUID}}';

export interface SubjectTemplateSettings {
  readonly placeholders?: {
    readonly [name: string]: SubjectTemplateFieldSettings;
  }
}

interface SubjectTemplateFieldSettings {
  /**
   * Default value to substitute if there is no such field or it is empty.
   *
   * @default ""
   */
  default?: string;
  /**
   * Defines how substituted values are transformed:
   *   - `none`: no transformation;
   *   - `sanitize`: replace IRI-unsafe characters as defined
   *     by `disallowRegex` with `replaceCharacter`;
   *
   * @default "sanitize"
   */
  transform?: 'none' | 'sanitize';
  /**
   * Regex pattern to match character sets to replace with `replaceValue`
   * when substituting the field value in the IRI.
   *
   * Default pattern matches:
   *   - ASCII control characters and space: `0x00-0x20`
   *   - common illegal path characters: `<` `>` `:` `?` `*` `"` `|`
   *   - path separators: `/` `\`
   *   - recommended to avoid by AWS S3: `&` `$` `@` `=` `;` `+` `,` `#` `0x7f-0xFF`
   *   - escape character: `%`
   *
   * **Default**:
   * ```
   * {
   *   "transform": "sanitize",
   *   "disallowRegex": "[\\u0000-\\u0020<>:?*\"|/\\\\&$@=+,#\\u007f-\\u00ff%\\s]",
   *   "replaceCharacter": "_"
   * }
   * ```
   */
  disallowRegex?: string;
  /**
   * Character to replace with when sanitizing value.
   *
   * Sequences of this string are collapsed into a single value.
   *
   * @default "_"
   */
  replaceCharacter?: string;
}

const DEFAULT_DISALLOW_REGEX = /[\u0000-\u0020<>:?*"|/\\&$@=+,#\u007f-\u00ff%\s]/ig;
const DEFAULT_REPLACE_CHARACTER = '_';
const DEFAULT_COLLAPSE_REGEX = /_+/ig;

export type SubjectReplacer = (placeholder: Placeholder, composite?: CompositeValue) => string;

export type Placeholder =
  { type: 'UUID' } |
  { type: 'FieldValue'; id: string };

export function generateSubjectByTemplate(
  template: string | undefined,
  ownerSubject: Rdf.Iri | undefined,
  composite: CompositeValue | undefined,
  templateSettings?: SubjectTemplateSettings,
  replacer = makeDefaultSubjectReplacer(templateSettings)
): Rdf.Iri {
  if (composite && !CompositeValue.isPlaceholder(composite.subject)) {
    return composite.subject;
  }

  const iriTemplate = template || DEFAULT_SUBJECT_TEMPLATE;
  const subject = generatePathFromTemplate(iriTemplate, composite, replacer);

  const isAbsoluteUri = URI(subject).scheme();
  if (isAbsoluteUri || !ownerSubject) {
    return Rdf.iri(subject);
  } else if (subject === '.' && ownerSubject) {
    return ownerSubject;
  }

  const combinedPath = URI.joinPaths(ownerSubject.value, subject).toString();
  return Rdf.iri(URI(ownerSubject.value).pathname(combinedPath).toString());
}

export function generatePathFromTemplate(
  template: string,
  composite: CompositeValue | undefined,
  replacer: SubjectReplacer
): string {
  return template.replace(/{{([^{}]+)}}/g, (match, placeholder: string) => {
    const p: Placeholder = (
      placeholder === 'UUID' ? {type: 'UUID'} :
      {type: 'FieldValue', id: placeholder}
    );
    return replacer(p, composite);
  });
}

export function wasSubjectGeneratedByTemplate(
  generatedSubject: string,
  template: string | undefined,
  templateSettings: SubjectTemplateSettings | undefined,
  ownerSubject: Rdf.Iri | undefined,
  composite: CompositeValue | undefined
): boolean {
  const replacer = makeDefaultSubjectReplacer(templateSettings);
  const escapeTable: { [K in Placeholder['type']]: string | undefined } = {
    'UUID': uuid.v4(),
    'FieldValue': undefined,
  };
  const newGeneratedIri = generateSubjectByTemplate(
    template ?? DEFAULT_SUBJECT_TEMPLATE,
    ownerSubject,
    composite,
    templateSettings,
    (p, comp) => {
      const escaped = escapeTable[p.type];
      return escaped ? escaped : replacer(p, comp);
    }
  );
  const regexpEscaped = escapeRegExp(newGeneratedIri.value).replace(
    escapeRegExp(escapeTable.UUID),
    '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
  );
  return new RegExp(`^${regexpEscaped}$`).test(generatedSubject);
}

export function computeIfSubjectWasSuggested(
  composite: CompositeValue,
  template: string | undefined,
  templateSettings: SubjectTemplateSettings | undefined
): CompositeValue {
  return CompositeValue.set(composite, {
    editableSubject: true,
    suggestSubject: wasSubjectGeneratedByTemplate(
      composite.subject.value,
      template,
      templateSettings,
      undefined,
      CompositeValue.set(composite, {
        subject: CompositeValue.empty.subject
      })
    ),
  });
}

export function makeDefaultSubjectReplacer(
  templateSettings: SubjectTemplateSettings | undefined
): SubjectReplacer {
  const {placeholders: fields = {}} = templateSettings ?? {};
  return (placeholder, composite) => {
    if (placeholder.type === 'UUID') {
      return uuid.v4();
    } else if (placeholder.type === 'FieldValue') {
      const fieldSettings = Object.prototype.hasOwnProperty.call(fields, placeholder.id)
        ? fields[placeholder.id] : {};

      const state = composite
        ? composite.fields.get(placeholder.id, FieldState.empty)
        : FieldState.empty;
      const selected = FieldValue.getSingle(state.values);
      const valueContent = FieldValue.isAtomic(selected)
        ? selected.value.value : (fieldSettings.default ?? '');

      switch (fieldSettings.transform) {
        case undefined:
        case 'sanitize':
          return sanitizeIriPart(valueContent, fieldSettings);
        case 'none':
          return valueContent;
      }
    } else {
      return '';
    }
  };
}

function sanitizeIriPart(value: string, settings: SubjectTemplateFieldSettings) {
  let disallowRegex: RegExp;
  if (settings.disallowRegex) {
    disallowRegex = new RegExp(settings.disallowRegex, 'ig');
  } else {
    disallowRegex = DEFAULT_DISALLOW_REGEX;
    disallowRegex.lastIndex = 0;
  }

  let replaceCharacter: string;
  let collapseRegex: RegExp | undefined;
  if (settings.replaceCharacter === '') {
    replaceCharacter = settings.replaceCharacter;
  } else if (settings.replaceCharacter) {
    replaceCharacter = settings.replaceCharacter;
    collapseRegex = new RegExp(`(?:${replaceCharacter})+`, 'ig');
  } else {
    replaceCharacter = DEFAULT_REPLACE_CHARACTER;
    collapseRegex = DEFAULT_COLLAPSE_REGEX;
    collapseRegex.lastIndex = 0;
  }

  let transformed = value;
  transformed = transformed.replace(disallowRegex, replaceCharacter);
  if (collapseRegex) {
    transformed = transformed.replace(collapseRegex, replaceCharacter);
  }
  return transformed;
}

export function readyToSubmit(
  composite: CompositeValue,
  isConsideredError: (error: FieldError) => boolean
): boolean {
  const freeOfErrors = (errors: ReadonlyArray<FieldError>) => {
    for (const error of errors) {
      if (isConsideredError(error)) { return false; }
    }
    return true;
  };
  return freeOfErrors(composite.errors) &&
    composite.fields.every(state =>
      freeOfErrors(state.errors) &&
      state.values.every(value =>
        FieldValue.isComposite(value)
        ? readyToSubmit(value, isConsideredError)
        : freeOfErrors(FieldValue.getErrors(value))
      )
    );
}

/**
 * @returns a tuple of new "loading" state of form and a promise of
 *  changes with initial field values.
 */
export function loadDefaults(
  composite: CompositeValue,
  inputs: Immutable.Map<string, ReadonlyArray<InputMapping>>
): Kefir.Stream<CompositeChange> {

  interface FetchedValues {
    def: FieldDefinition;
    values?: ReadonlyArray<FieldValue>;
    error?: string;
  }

  const initialValues = composite.definitions.map(def => {
    const mappings = inputs.get(def.id);
    const mapping = mappings && mappings.length > 0 ? mappings[0] : undefined;
    return loadInitialOrDefaultValues(composite.subject, def, mapping)
      .map<FetchedValues>(values => ({def, values}))
      .flatMapErrors<FetchedValues>(error => Kefir.constant({
        def, error: `Failed to load initial values: ${formatError(error)}`,
      }));
  }).toArray();

  if (initialValues.length === 0) {
    return noChanges();
  }

  const mergeFetchedIntoModel = (model: CompositeValue, results: FetchedValues[]) => {
    return CompositeValue.set(model, {
      fields: model.fields.withMutations(states => {
        for (const {def, values, error} of results) {
          let state = states.get(def.id);
          if (values && values.length > 0) {
            state = FieldState.set(state, {values});
          } else if (error) {
            state = FieldState.set(state, {errors: [...state.errors, {
              kind: ErrorKind.Loading,
              message: error,
            }]});
          }
          states.set(def.id, state);
        }
      }),
    });
  };

  return Kefir.zip(initialValues).map(results => {
    return (model: CompositeValue) => mergeFetchedIntoModel(model, results);
  });
}

function loadInitialOrDefaultValues(
  subject: Rdf.Iri, def: FieldDefinition, mapping?: InputMapping
): Kefir.Property<FieldValue[]> {
  const isPlaceholderSubject = CompositeValue.isPlaceholder(subject);
  const shouldLoadInitials = !isPlaceholderSubject && def.selectPattern;
  const shouldLoadDefaults = isPlaceholderSubject && mapping;

  const loadingValues = (
    shouldLoadInitials ? fetchInitialValues(def, subject, mapping) :
    shouldLoadDefaults ? lookForDefaultValues(def, mapping) :
    Kefir.constant([])
  );

  return loadingValues.map(values => {
    let requiredCount = Math.max(values.length, def.minOccurs);
    if (!FieldMapping.isInputGroup(mapping)) {
      // load at least one empty values for non-composites
      requiredCount = Math.max(requiredCount, 1);
    }
    return setSizeAndFill(values, requiredCount, FieldValue.empty);
  });
}

function fetchInitialValues(
  def: FieldDefinition, subject: Rdf.Iri, mapping: InputMapping
): Kefir.Property<FieldValue[]> {
  return queryValues(def.selectPattern, subject).map(values => {
    const sortedValues = def.orderedWith ? sortBy(values, v => v.index || 0) : values;
    let fieldValues: FieldValue[] = sortedValues.map(v => FieldValue.fromLabeled(v));

    // fill loaded values with empty values to always show user at least minOccurs
    const initialValueCount = Math.max(def.minOccurs, fieldValues.length);
    fieldValues = setSizeAndFill(fieldValues, initialValueCount, FieldValue.empty);

    return fieldValues;
  });
}

function setSizeAndFill<T>(list: ReadonlyArray<T>, newSize: number, fillValue: T): Array<T> {
  const clone = [...list];
  clone.length = newSize;
  for (let i = list.length; i < newSize; i++) {
    clone[i] = fillValue;
  }
  return clone;
}

function lookForDefaultValues(
  def: FieldDefinition, mapping: InputMapping
): Kefir.Property<FieldValue[]> {
  const {defaultValue, defaultValues} = mapping.element.props;
  if (defaultValue !== undefined || defaultValues) {
    const values = defaultValue !== undefined ? [String(defaultValue)] : defaultValues;
    const fieldValues = values.map(value => parseDefaultValue(value, def));
    if (fieldValues.length > 0) {
      return Kefir.zip(fieldValues).toProperty();
    }
  } else if (def.defaultValues.length > 0) {
    const fieldValues = def.defaultValues.map(value => parseDefaultValue(value, def));
    return Kefir.zip(fieldValues).toProperty();
  }
  return Kefir.constant([]);
}

function parseDefaultValue(value: string, def: FieldDefinition) {
  const atomic = createDefaultValue(value, def);
  return restoreLabel(atomic);
}

export function createDefaultValue(value: string, def: FieldDefinition): AtomicValue {
  if (!def.xsdDatatype) {
    return FieldValue.fromLabeled({value: Rdf.literal(value)});
  } else if (XsdDataTypeValidation.sameXsdDatatype(def.xsdDatatype, vocabularies.xsd.anyURI)) {
    return FieldValue.fromLabeled({value: Rdf.iri(value)});
  }
  const literal = Rdf.literal(value, def.xsdDatatype);
  const {success, message} = XsdDataTypeValidation.validate(literal);
  if (success) {
    return FieldValue.fromLabeled({value: literal});
  } else {
    return AtomicValue.set(FieldValue.fromLabeled({value: literal}), {
      errors: [{
        kind: ErrorKind.Loading,
        message: `Default value doesn't match XSD datatype: ${message}`,
      }]
    });
  }
}

export function formatError(error: any): string {
  if (typeof error === 'string') {
    return error;
  } else if (error && typeof error.message === 'string') {
    return error.message;
  } else if (error && typeof error.status === 'number') {
    return 'query error';
  } else {
    return 'unknown error occurred';
  }
}

function noChanges(): Kefir.Stream<CompositeChange> {
  return Kefir.later(0, value => value);
}

export function fieldInitialState(def: FieldDefinition): FieldState {
  // display N empty fields where (minOccurs <= N <= maxOccurs)
  const valueCount = Math.min(def.minOccurs, def.maxOccurs);
  const values = Array.from({length: valueCount})
    .map(() => FieldValue.empty);
  return FieldState.set(FieldState.empty, {values});
}
