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
import * as SparqlJs from 'sparqljs';

import { Rdf } from 'platform/api/rdf';
import { SparqlUtil, SparqlTypeGuards } from 'platform/api/sparql';
import {
  isValidChild, componentDisplayName, hasBaseDerivedRelationship, universalChildren,
} from 'platform/components/utils';

import {
  FieldDefinition, FieldDefinitionProp, FieldDependency, MultipleFieldConstraint,
} from './FieldDefinition';
import { DependencyContext } from './FieldDependencies';
import {
  FieldValue, CompositeValue, FieldError, ErrorKind, DataState, FieldState,
} from './FieldValues';

// explicitly import base input classes from their respective modules instead of
// importing from './input' to prevent cyclic dependencies when importing from CompositeInput
import { SingleValueInput, SingleValueInputGroup } from './inputs/SingleValueInput';
import {
  MultipleValuesInput, MultipleValuesProps, MultipleValuesHandler, ValuesWithErrors,
} from './inputs/MultipleValuesInput';
import { InputDecorator } from './inputs/Decorations';
import { StaticComponent, StaticComponentProps } from './static/StaticComponent';

export type FieldMapping = InputMapping | StaticMapping | OtherElementMapping;
export namespace FieldMapping {
  export function isInput(mapping: FieldMapping): mapping is InputMapping {
    return 'inputType' in mapping;
  }

  export function isInputGroup(
    mapping: FieldMapping,
    groupType?: SingleValueInputGroup['inputGroupType']
  ): mapping is InputMapping {
    if (isInput(mapping) && mapping.singleValueInputType) {
      const inputGroup = mapping.singleValueInputType as Partial<SingleValueInputGroup>;
      return groupType
        ? inputGroup.inputGroupType === groupType
        : Boolean(inputGroup.inputGroupType);
    }
    return false;
  }

  export function isStatic(mapping: FieldMapping): mapping is StaticMapping {
    return 'staticType' in mapping;
  }

  export function isOtherElement(mapping: FieldMapping): mapping is OtherElementMapping {
    return 'child' in mapping && 'children' in mapping;
  }

  export function assertNever(mapping: never): never {
    console.error('Invalid mapping', mapping);
    throw new Error('Invalid mapping');
  }
}

export interface InputMapping {
  for: string | undefined;
  inputType: React.ComponentClass<any>;
  singleValueInputType?: React.ComponentClass<any>;
  element: React.ReactElement<MultipleValuesProps>;
}

export interface StaticMapping {
  for: string | undefined;
  staticType: React.ComponentClass<any>;
  element: React.ReactElement<StaticComponentProps>;
}

export interface OtherElementMapping {
  child: React.ReactElement<any>;
  children: any;
}

export interface FieldMappingContext {
  cardinalitySupport: React.ComponentClass<MultipleValuesProps, any>;
}

/**
 * Creates mapping description for single field in a form of `FieldMapping`.
 *
 * Inputs derived from `SingleValueInput` are automatically wrapped by
 * `cardinalityWrapper` input component (usually `CardinalitySupport`).
 */
export function mapChildToComponent(
  child: React.ReactNode,
  context: FieldMappingContext
): FieldMapping | undefined {
  if (!isValidChild(child)) { return undefined; }

  const element = child as React.ReactElement<any>;

  if (hasBaseDerivedRelationship(SingleValueInput, element.type)) {
    const singleValueInputType = element.type as React.ComponentClass<any>;
    return {
      for: element.props.for,
      inputType: context.cardinalitySupport,
      singleValueInputType,
      element: React.createElement(context.cardinalitySupport, {
        ...element.props,
        children: element,
      }),
    };
  } else if (hasBaseDerivedRelationship(MultipleValuesInput, element.type)) {
    const inputType = element.type as React.ComponentClass<any>;
    return {for: element.props.for, inputType, element};
  } else if (hasBaseDerivedRelationship(StaticComponent, element.type)) {
    const staticType = element.type as React.ComponentClass<any>;
    return {for: element.props.for, staticType, element};
  } else if (element.props.children) {
    return {child, children: element.props.children};
  } else {
    return undefined;
  }
}

export interface FieldConfiguration {
  inputs: Immutable.Map<string, ReadonlyArray<InputMapping>>;
  errors: ReadonlyArray<FieldError>;
}

/**
 * Creates (and checks if it's correct) mapping description for
 * the whole form children producing `FieldConfiguration`.
 *
 * Use `renderFields()` to render this description into actual React elements.
 */
export function validateFieldConfiguration(
  definitions: Immutable.Map<string, FieldDefinition>,
  constraints: ReadonlyArray<MultipleFieldConstraint>,
  dependencies: ReadonlyArray<FieldDependency>,
  children: React.ReactNode,
  context: FieldMappingContext
): FieldConfiguration {
  const inputs = Immutable.Map<string, ReadonlyArray<InputMapping>>().asMutable();
  const errors: FieldError[] = [];

  collectFieldConfiguration(definitions, children, context, inputs, errors);
  inputs.forEach((mapping, key) => {
    const definition = definitions.get(key);
    if (definition) {
      collectDefinitionErrors(definition, errors);
    }
  });

  collectConstraintErrors(definitions, constraints, errors);
  collectDependencyErrors(definitions, dependencies, errors);

  return {inputs: inputs.asImmutable(), errors};
}

function collectFieldConfiguration(
  definitions: Immutable.Map<string, FieldDefinition>,
  children: React.ReactNode,
  context: FieldMappingContext,
  collectedInputs: Immutable.Map<string, ReadonlyArray<InputMapping>>,
  collectedErrors: FieldError[]
): void {
  return React.Children.forEach(children, child => {
    const mapping = mapChildToComponent(child, context);
    if (!mapping) { return; }

    if (FieldMapping.isInput(mapping)) {
      if (mapping.for) {
        const definition = definitions.get(mapping.for);
        if (!definition) {
          collectedErrors.push({
            kind: ErrorKind.Configuration,
            message: `Field definition '${mapping.for}' not found`,
          });
        }
        const mappings = collectedInputs.get(mapping.for);
        collectedInputs.set(mapping.for, mappings ? [...mappings, mapping] : [mapping]);
      } else {
        collectedErrors.push({
          kind: ErrorKind.Configuration,
          message: `Missing 'for' attribute on ${componentDisplayName(child)}`,
        });
      }
    } else if (FieldMapping.isStatic(mapping)) {
      if (mapping.for) {
        const definition = definitions.get(mapping.for);
        if (!definition) {
          collectedErrors.push({
            kind: ErrorKind.Configuration,
            message: `Field definition '${mapping.for}' not found`,
          });
        }
      }
    } else if (FieldMapping.isOtherElement(mapping)) {
      collectFieldConfiguration(
        definitions, mapping.children, context, collectedInputs, collectedErrors
      );
    } else {
      FieldMapping.assertNever(mapping);
    }
  });
}

export interface RenderFieldsContext {
  inputHandlers: Immutable.Map<string, ReadonlyArray<MultipleValuesHandler>>;
  getDataState: (fieldId: string) => DataState;
  updateField: (
    field: FieldDefinition,
    reducer: (previous: ValuesWithErrors) => ValuesWithErrors
  ) => void;
  onInputMounted: (inputId: string, index: number, input: MultipleValuesInput<any, any>) => void;
  dependencyContexts: ReadonlyMap<string, DependencyContext | undefined>;
  mappingContext: FieldMappingContext;
  setSuggestSubject: (suggest: boolean) => void;
  updateSubject: (newSubject: Rdf.Iri) => void;
}

export function renderFields(
  inputChildren: React.ReactNode,
  model: CompositeValue,
  context: RenderFieldsContext
) {
  const inputIndices = new Map<string, number>();

  function mapChild(child: React.ReactNode): React.ReactNode {
    const mapping = mapChildToComponent(child, context.mappingContext);
    if (!mapping) {
      return child;
    } else if (FieldMapping.isInput(mapping)) {
      if (!mapping.for) { return null; }
      const definition = model.definitions.get(mapping.for);

      if (!definition) { return null; }
      const state = model.fields.get(mapping.for, FieldState.empty);

      const index = inputIndices.get(mapping.for) || 0;
      inputIndices.set(mapping.for, index + 1);

      const handlers = context.inputHandlers.get(mapping.for);
      if (index >= handlers.length) {
        throw new Error(`Missing handler for field ${mapping.for} (at index ${index})`);
      }
      const handler = handlers[index];

      // save a reference to mapped component for validation
      // and lazy selectPattern evaluation
      const onMounted = (input: MultipleValuesInput<any, any>) => {
        context.onInputMounted(mapping.for, index, input);
      };

      const baseProvidedProps: Partial<MultipleValuesProps> = {
        definition,
        handler,
        dataState: context.getDataState(mapping.for),
        values: state.values,
        errors: state.errors,
        updateValues: reducer => context.updateField(definition, reducer),
        dependencyContext: context.dependencyContexts.get(mapping.for),
      };
      const inputOverride: Partial<MultipleValuesProps> & React.ClassAttributes<any> = {
        ...baseProvidedProps,
        ref: onMounted,
      };
      return React.createElement(
        InputDecorator,
        {...mapping.element.props, ...baseProvidedProps},
        React.cloneElement(mapping.element, inputOverride)
      );
    } else if (FieldMapping.isStatic(mapping)) {
      const {element} = mapping;
      const override: Partial<StaticComponentProps> = {
        model,
        setSuggestSubject: context.setSuggestSubject,
        updateSubject: context.updateSubject,
      };
      if (element.props.for) {
        const definition = model.definitions.get(element.props.for);
        if (!definition) { return null; }
        override.definition = definition;
      }
      return React.cloneElement(mapping.element, override);
    } else if (FieldMapping.isOtherElement(mapping)) {
      const mappedChildren = mapChildren(mapping.children);
      return React.cloneElement(mapping.child, {}, mappedChildren);
    } else {
      throw new Error('Invalid mapping');
    }
  }

  function mapChildren(children: React.ReactNode) {
    return universalChildren(React.Children.map(children, mapChild));
  }

  return mapChildren(inputChildren);
}

/**
 * @returns list of errors in the field definition.
 */
export function collectDefinitionErrors(definition: FieldDefinition, errors: FieldError[]) {
  const resultErrors: string[] = [];
  function store(member: keyof FieldDefinitionProp, error: ValidationError | undefined) {
    if (error instanceof ValidationError) {
      errors.push({
        kind: ErrorKind.Configuration,
        message: `Invalid ${member} of field '${definition.id}': ${error.message}`,
      });
    }
  }

  if (definition.selectPattern) {
    store('selectPattern', validateQueryPattern(definition.selectPattern, 'SELECT'));
  }
  if (definition.valueSetPattern) {
    store('valueSetPattern', validateQueryPattern(definition.valueSetPattern, 'SELECT'));
  }
  if (definition.deletePattern) {
    store('deletePattern', validateDeletePattern(definition.deletePattern));
  }
  if (definition.insertPattern) {
    store('insertPattern', validateInsertPattern(definition.insertPattern));
  }
  if (definition.autosuggestionPattern) {
    store('autosuggestionPattern',
      validateQueryPattern(definition.autosuggestionPattern, 'SELECT'));
  }
  for (const constraint of definition.constraints) {
    store('askPattern', validateQueryPattern(constraint.validatePattern, 'ASK'));
  }
}

function collectConstraintErrors(
  definitions: Immutable.Map<string, FieldDefinition>,
  constraints: ReadonlyArray<MultipleFieldConstraint>,
  errors: FieldError[]
) {
  let index = 0;
  for (const constraint of constraints) {
    const patternError = validateQueryPattern(constraint.validatePattern, 'ASK');
    if (patternError instanceof ValidationError) {
      errors.push({
        kind: ErrorKind.Configuration,
        message: `Invalid "validatePattern" for ` +
          `field constraint #${index}: ${patternError.message}`,
      });
    }

    if (typeof constraint.message !== 'string') {
      errors.push({
        kind: ErrorKind.Configuration,
        message: `Missing or non-string "message" for field constraint #${index}`,
      });
    }

    const fieldsError = validateFieldBindingNames(definitions, constraint.fields);
    if (fieldsError) {
      errors.push({
        kind: ErrorKind.Configuration,
        message: `Invalid field constraint #${index}: ${fieldsError.message}`,
      });
    }

    index++;
  }
}

function collectDependencyErrors(
  definitions: Immutable.Map<string, FieldDefinition>,
  dependencies: ReadonlyArray<FieldDependency>,
  errors: FieldError[]
) {
  let index = 0;
  const dependentFieldIds = new Set<string>();
  for (const dependency of dependencies) {
    if (typeof dependency.field === 'string') {
      if (dependentFieldIds.has(dependency.field)) {
        errors.push({
          kind: ErrorKind.Configuration,
          message: `Duplicate dependency #${index} for field "${dependency.field}"`,
        });
      }

      const fieldsError = validateFieldBindingNames(definitions, dependency.dependencies);
      if (fieldsError) {
        errors.push({
          kind: ErrorKind.Configuration,
          message: `Invalid field dependency for field ` +
            `"${dependency.field}": ${fieldsError.message}`,
        });
      }
    } else {
      errors.push({
        kind: ErrorKind.Configuration,
        message: `Missing or non-string "field" property for field dependency #${index}`,
      });
    }

    index++;
  }
}

function validateInsertPattern(pattern: string): ValidationError | undefined {
  const query = parseQuery(pattern);
  if (query instanceof ValidationError) { return query; }
  if (query.type !== 'update') {
    return new ValidationError(`should be INSERT query but was: '${query.type}'`);
  }
  for (const update of query.updates) {
    const isInsertWhere =
      SparqlTypeGuards.isInsertDeleteOperation(update) &&
      update.updateType === 'insertdelete' &&
      update.delete.length === 0;
    if (!isInsertWhere) {
      return new ValidationError('query should include only INSERT WHERE operations');
    }
  }
  return undefined;
}

function validateDeletePattern(pattern: string): ValidationError | undefined {
  const query = parseQuery(pattern);
  if (query instanceof ValidationError) { return query; }
  if (query.type !== 'update') {
    return new ValidationError(`should be DELETE query but was: '${query.type}'`);
  }
  for (const update of query.updates) {
    const isDeleteWhere =
      SparqlTypeGuards.isInsertDeleteOperation(update) &&
      update.updateType === 'insertdelete' &&
      update.insert.length === 0;
    if (!isDeleteWhere) {
      return new ValidationError('query should include only DELETE WHERE operations');
    }
  }
  return undefined;
}

function validateQueryPattern(
  pattern: string,
  queryType: SparqlJs.Query['queryType']
): ValidationError | undefined {
  const query = parseQuery(pattern);
  if (query instanceof ValidationError) { return query; }
  if (query.type !== 'query') {
    return new ValidationError(`should be ${queryType} query but was: '${query.type}'`);
  }
  if (query.queryType !== queryType) {
    return new ValidationError(`should be ${queryType} query but was: '${query.queryType}'`);
  }
  return undefined;
}

function validateFieldBindingNames(
  definitions: Immutable.Map<string, FieldDefinition>,
  fields: { readonly [fieldId: string]: string }
): ValidationError | undefined {
  if (typeof fields !== 'object') {
    return new ValidationError(`invalid (non-object) "fields" property`);
  }
  for (const fieldId in fields) {
    if (!Object.prototype.hasOwnProperty.call(fields, fieldId)) { continue; }
    if (!definitions.has(fieldId)) {
      return new ValidationError(`missing referenced field "${fieldId}"`);
    }
    const bindingName = fields[fieldId];
    if (typeof bindingName !== 'string') {
      return new ValidationError(`invalid (non-string) binding name for field "${fieldId}"`);
    }
  }
}

function parseQuery(query: string): SparqlJs.SparqlQuery | ValidationError {
  try {
    return SparqlUtil.parseQuery(query);
  } catch (err) {
    return new ValidationError(err.message);
  }
}

class ValidationError {
  constructor(readonly message: string) {}
}
