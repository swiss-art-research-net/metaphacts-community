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
import * as Immutable from 'immutable';
import * as Kefir from 'kefir';
import * as SparqlJs from 'sparqljs';

import { Rdf } from 'platform/api/rdf';
import { SparqlClient, SparqlUtil, SparqlTypeGuards } from 'platform/api/sparql';

import {
  FieldConstraint, SingleFieldConstraint, MultipleFieldConstraint, hasBindingNameForField,
} from './FieldDefinition';
import { CompositeChange, formatError } from './FormModel';
import {
  FieldValue, FieldError, ErrorKind, CompositeValue, FieldState, AtomicValue,
} from './FieldValues';
import { tryMakeBindings } from './QueryValues';

export interface ValidationResult {
  constraint: FieldConstraint;
  applyChange: CompositeChange;
}

export function findChangedValues(
  targetFieldId: string,
  oldComposite: CompositeValue,
  newComposite: CompositeValue
): Rdf.Node[] {
  const oldState = oldComposite.fields.get(targetFieldId, FieldState.empty);
  const newState = newComposite.fields.get(targetFieldId, FieldState.empty);
  const changedSet = countValuesByNode(newState.values).withMutations(newSet => {
    const oldSet = countValuesByNode(oldState.values);
    oldSet.forEach((oldCount, node) => {
      const newCount = newSet.get(node, 0);
      if (newCount === oldCount) {
        newSet.delete(node);
      }
    });
  });
  return changedSet.keySeq().toArray();
}

export function clearConstraintErrors(
  targetComposite: CompositeValue,
  targetFieldId: string
): CompositeValue {
  let fields = targetComposite.fields;
  for (const constraint of targetComposite.constraints) {
    if (!hasBindingNameForField(constraint.fields, targetFieldId)) {
      continue;
    }
    for (const fieldId in constraint.fields) {
      if (!Object.prototype.hasOwnProperty.call(constraint.fields, fieldId)) { continue; }
      const fieldState = targetComposite.fields.get(fieldId);
      let hasError = false;
      for (const value of fieldState.values) {
        if (FieldValue.isEmpty(value)) { continue; }
        if (value.errors.some(e => e.source === constraint)) {
          hasError = true;
          break;
        }
      }
      if (hasError) {
        const newValues = fieldState.values.map(v => {
          return FieldValue.setErrors(v, v.errors.filter(e => e.source !== constraint));
        });
        fields = fields.set(fieldId, FieldState.set(fieldState, {values: newValues}));
      }
    }
  }
  return fields === targetComposite.fields
    ? targetComposite
    : CompositeValue.set(targetComposite, {fields});
}

/**
 * Performs validation of individual values with ({@link SingleFieldConstraint}) queries.
 */
export function tryValidateSingleField(
  constraint: SingleFieldConstraint,
  targetComposite: CompositeValue,
  targetFieldId: string,
  changedValues: ReadonlyArray<Rdf.Node>
): Kefir.Stream<ValidationResult> | undefined {
  if (changedValues.length === 0) {
    return undefined;
  }
  return Kefir.zip(
    changedValues.map(node => evaluateSingleFieldConstraint(constraint, node, targetComposite))
  ).map(results => {
    type EvaluationResult = { valid: boolean, error?: unknown };
    const resultMap = Immutable.Map<Rdf.Node, EvaluationResult>().withMutations(map => {
      for (const result of results) {
        map.set(result.value, result);
      }
    });
    const applyChange: CompositeChange = composite => {
      const fieldState = composite.fields.get(targetFieldId);
      if (!fieldState) { return composite; }
      const validatedValues = fieldState.values.map(v => {
        if (!FieldValue.isAtomic(v)) { return v; }
        const result = resultMap.get(v.value);
        if (!result) { return v; }
        return mergeConstraintResult(constraint, v, result);
      });
      return CompositeValue.set(composite, {
        fields: composite.fields.set(targetFieldId, FieldState.set(fieldState, {
          values: validatedValues,
        }))
      });
    };
    return {constraint, applyChange};
  });
}

function evaluateSingleFieldConstraint(
  constraint: SingleFieldConstraint,
  targetFieldValue: Rdf.Node,
  composite: CompositeValue
): Kefir.Property<{ value: Rdf.Node; valid: boolean; error?: unknown; }> {
  let askQuery: SparqlJs.AskQuery;
  try {
    const query = SparqlUtil.parseQuery(constraint.validatePattern);
    if (!(SparqlTypeGuards.isQuery(query) && query.queryType === 'ASK')) {
      return Kefir.constantError<any>(new Error('validatePattern is not an ASK query'));
    }
    askQuery = query;
  } catch (err) {
    return Kefir.constantError<any>(err);
  }

  const bindings: SparqlClient.Dictionary<Rdf.Node> = {
    // add 'subject' binding for backwards compatibility
    subject: composite.subject,
    value: targetFieldValue,
  };

  const parametrizedQuery = SparqlClient.setBindings(askQuery, bindings);
  return SparqlClient.ask(parametrizedQuery)
    .map(valid => ({value: targetFieldValue, valid}))
    .flatMapErrors(error => Kefir.constant({
      value: targetFieldValue,
      valid: false,
      error,
    }))
    .toProperty();
}

/**
 * Performs validation of multiple field values with ({@link MultipleFieldConstraint}) queries.
 */
export function tryValidateMultipleFields(
  constraint: MultipleFieldConstraint,
  targetComposite: CompositeValue
): Kefir.Stream<ValidationResult> | undefined {
  const bindings = tryMakeBindings(targetComposite, constraint.fields);
  if (!bindings) {
    return undefined;
  }
  if (!bindings.subject) {
    // add 'subject' binding for backwards compatibility
    bindings.subject = targetComposite.subject;
  }
  return evaluateMultipleFieldConstraint(constraint, bindings).map(result => {
    const applyChange: CompositeChange = composite => {
      let validatedFields = composite.fields;
      for (const fieldId in constraint.fields) {
        if (!Object.prototype.hasOwnProperty.call(constraint.fields, fieldId)) { continue; }
        const fieldState = validatedFields.get(fieldId);
        if (!fieldState) { continue; }
        const validatedValues = fieldState.values.map(v => {
          if (!FieldValue.isAtomic(v)) { return v; }
          return mergeConstraintResult(constraint, v, result);
        });
        validatedFields = validatedFields.set(fieldId, FieldState.set(fieldState, {
          values: validatedValues,
        }));
      }
      return CompositeValue.set(composite, {fields: validatedFields});
    };
    return {constraint, applyChange};
  }).flatMap(result => Kefir.later(0, result));
}

function evaluateMultipleFieldConstraint(
  constraint: MultipleFieldConstraint,
  bindings: SparqlClient.Dictionary<Rdf.Node>
): Kefir.Property<{ valid: boolean; error?: unknown; }> {
  let askQuery: SparqlJs.AskQuery;
  try {
    const query = SparqlUtil.parseQuery(constraint.validatePattern);
    if (!(SparqlTypeGuards.isQuery(query) && query.queryType === 'ASK')) {
      return Kefir.constantError<any>(new Error('validatePattern is not an ASK query'));
    }
    askQuery = query;
  } catch (err) {
    return Kefir.constantError<any>(err);
  }

  const parametrizedQuery = SparqlClient.setBindings(askQuery, bindings);
  return SparqlClient.ask(parametrizedQuery)
    .map(valid => ({valid}))
    .flatMapErrors(error => Kefir.constant({valid: false, error}))
    .toProperty();
}

function mergeConstraintResult(
  constraint: FieldConstraint,
  value: FieldValue,
  result: { valid: boolean; error?: unknown }
): FieldValue {
  if (!FieldValue.isAtomic(value)) { return value; }

  const errors = value.errors.filter(error => !(
    error.kind === ErrorKind.Validation &&
    error.source === constraint
  ));

  if (!result.valid) {
    errors.push({
      kind: ErrorKind.Validation,
      source: constraint,
      message: result.error
        ? `Failed to validate due to unexpected error: ${formatError(result.error)}`
        : constraint.message,
    });
    if (result.error) {
      console.error(result.error);
    }
  }

  return AtomicValue.set(value, {errors});
}

function countValuesByNode(
  values: ReadonlyArray<FieldValue>
): Immutable.Map<Rdf.Node, number> {
  return Immutable.Map<Rdf.Node, number>().withMutations(map => {
    for (const v of values) {
      if (!FieldValue.isAtomic(v)) { continue; }
      map.set(v.value, map.get(v.value, 0) + 1);
    }
  });
}

export function validateModelConstraints(value: CompositeValue): Kefir.Property<CompositeChange> {
  const tasks: Array<Kefir.Observable<CompositeChange>> = [];
  // 1. for each field call tryBeginValidation() and collect returned tasks

  const emptyValue = CompositeValue.set(value, {
    fields: CompositeValue.empty.fields,
    errors: CompositeValue.empty.errors,
  });
  value.definitions.forEach(fieldDef => {
    for (const constraint of fieldDef.constraints) {
      const changedValues = findChangedValues(fieldDef.id, emptyValue, value);
      const task = tryValidateSingleField(constraint, value, fieldDef.id, changedValues);
      if (task) {
        tasks.push(task.map(change => change.applyChange));
      }
    }
  });
  for (const constraint of value.constraints) {
    const task = tryValidateMultipleFields(constraint, value);
    if (task) {
      tasks.push(task.map(change => change.applyChange));
    }
  }

  // 2. for each nested CompositeValue call validateModelConstraints() and put into tasks

  value.fields.forEach((fieldState, fieldId) => {
    fieldState.values.forEach((fieldValue, index) => {
      if (!FieldValue.isComposite(fieldValue)) { return; }
      const change = validateModelConstraints(fieldValue).map((subChange): CompositeChange => {
        return (newModel: CompositeValue) => updateSubValue(newModel, fieldId, index, subChange);
      });
      tasks.push(change);
    });
  });

  if (tasks.length === 0) {
    return Kefir.constant(model => model);
  }

  return Kefir.merge(tasks).toProperty();
}

function updateSubValue(
  newModel: CompositeValue, fieldId: string, index: number, change: CompositeChange
) {
  return CompositeValue.set(newModel, {
    fields: newModel.fields.update(fieldId, newState => {
      if (index >= newState.values.length) { return newState; }
      const newValue = newState.values[index];
      if (!FieldValue.isComposite(newValue)) { return newState; }
      return FieldState.set(newState, {
        values: FieldState.setValueAtIndex(newState.values, index, change(newValue)),
      });
    })
  });
}

const SUBJECT_VALIDATION_SOURCE = Symbol('SemanticForm.subjectValidation');

export function clearSubjectErrors(model: CompositeValue): CompositeValue {
  const errors = model.errors.filter(err => err.source !== SUBJECT_VALIDATION_SOURCE);
  if (errors.length === model.errors.length) {
    return model;
  }
  return CompositeValue.set(model, {errors});
}

export function setSubjectError(model: CompositeValue, message: string): CompositeValue {
  const addedError: FieldError = {
    kind: ErrorKind.Validation,
    source: SUBJECT_VALIDATION_SOURCE,
    message,
  };
  const clearedModel = clearSubjectErrors(model);
  return CompositeValue.set(clearedModel, {
    errors: [...clearedModel.errors, addedError],
  });
}

/**
 * Checks subject IRI with ASK query to determine if it is unique in the database.
 *
 * Query bindings:
 *   * `?subject` - current entity to be created/edited;
 */
export function validateSubjectByQuery(
  subject: Rdf.Iri,
  askQuery: string
): Kefir.Property<CompositeChange> {
  return checkSubjectByQuery(subject, askQuery)
    .map(({valid, error}) => {
      const change: CompositeChange = model => {
        if (valid || model.subject.value !== subject.value) {
          return model;
        }
        const message = error ?? `Entity with the same IRI does already exist`;
        return setSubjectError(model, message);
      };
      return change;
    });
}

function checkSubjectByQuery(
  subject: Rdf.Iri,
  askQuery: string
): Kefir.Property<{ valid: boolean; error?: string }> {
  let parsedQuery: SparqlJs.SparqlQuery;
  try {
    parsedQuery = SparqlUtil.parseQuery(askQuery);
  } catch (err) {
    return Kefir.constant({
      valid: false,
      error: `Failed to parse query to validate subject IRI: ${formatError(err)}`,
    });
  }
  if (!(parsedQuery.type === 'query' && parsedQuery.queryType === 'ASK')) {
    return Kefir.constant({
      valid: false,
      error: `Expected ASK query to validate subject IRI`,
    });
  }
  const boundQuery = SparqlClient.setBindings(parsedQuery, {subject});
  return SparqlClient.ask(boundQuery)
    .map(valid => ({valid}))
    .flatMapErrors(err => Kefir.constant({
      valid: false,
      error: `Failed to validate due to unexpected error: ${formatError(err)}`,
    }))
    .toProperty();
}
