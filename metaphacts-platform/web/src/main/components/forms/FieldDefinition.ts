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
 * Copyright (C) 2015-2020, metaphacts GmbH
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
import * as _ from 'lodash';

import { Rdf, XsdDataTypeValidation } from 'platform/api/rdf';
import { xsd } from 'platform/api/rdf/vocabularies/vocabularies';

import { selectPreferredLabel } from 'platform/api/services/language';

import {
  ComplexTreePatterns, LightweightTreePatterns,
} from 'platform/components/semantic/lazy-tree';

export interface FieldDefinitionConfig {
  /**
   * Unique identifier of the field definition.
   *
   * In most cases it will be the IRI of the field definition, but might be an alias as well.
   */
  id: string;
  /**
   * IRI of field definition.
   */
  iri?: string;
  /**
   * Label used to refer to field on form (e.g. in validation messages) and
   * rendering the field, for example as an HTML input label before the input element.
   */
  label?: string;
  /**
   * Description of a field, might be rendered e.g. as a tooltip on hover or
   * using an info icon next to the field.
   */
  description?: string;
  /**
   * An unordered set of categories as additional metadata for improved organization.
   */
  categories?: ReadonlyArray<string>;
  /**
   * Domain restriction on classes this field applicable to.
   */
  domain?: string | ReadonlyArray<string>;
  /**
   * A full or prefix XSD IRI datatype identifier as specified
   * in [RDF 1.1](https://www.w3.org/TR/rdf11-concepts/#xsd-datatypes)
   */
  xsdDatatype?: string;
  /**
   * Range restriction on allowed classes of objects for the field values.
   * Only applicable if `xsdDatatype` is `xsd:anyURI`.
   */
  range?: string | ReadonlyArray<string>;
  /**
   * XSD schema min cardinality (inclusive) or `'unbound'` (i.e. 0).
   *
   * @default 'unbound'
   */
  minOccurs?: number | 'unbound';
  /**
   * XSD schema max cardinality (inclusive) or `'unbound'` (i.e. infinite).
   *
   * @default 'unbound'
   */
  maxOccurs?: number | 'unbound';
  /**
   * Number used for ordering field definitions.
   */
  order?: number;
  /**
   * An array of default values (represented as text) assigned to the field
   * if subject doesn't contain a value for it.
   */
  defaultValues?: ReadonlyArray<string>;
  /**
   * SPARQL SELECT query string to read initial values for the field.
   *
   * Query bindings:
   *   * `?subject` - current entity to be created/edited;
   *
   * Exposed projection variables:
   *   * `?value` - current atomic values, connected to `?subject` through the graph pattern;
   *   * (optional) `?label` - label for `?value`; further projection variables might be exposed
   *     to format the rendering within the input element;
   *   * (optional) `?index` - see `orderedWith` property;
   */
  selectPattern?: string;
  /**
   * SPARQL DELETE query to remove previous value from the database
   * before inserting a new one.
   *
   * Query bindings:
   *   * `?subject` - current entity to be created/edited;
   *   * `?value` - inserted atomic values, connected to `?subject` through the graph pattern;
   */
  deletePattern?: string;
  /**
   * SPARQL INSERT query to add new value to the database.
   *
   * Query bindings:
   *   * `?subject` - current entity to be created/edited;
   *   * `?value` - deleted atomic values, connected to `?subject` through the graph pattern;
   *   * (optional) `?index` - see `orderedWith` property;
   */
  insertPattern?: string;
  /**
   * Single constraint (SPARQL ASK query) to to validate values entered by
   * the user against the database.
   *
   * Query bindings:
   *   * `?value` - validated field value;
   *
   * If both `askPattern` and `constraints` are specified then all of them will
   * be evaluated for each validated value.
   */
  askPattern?: string;
  /**
   * Constraints (SPARQL ASK queries) to validate values entered by
   * the user against the database.
   */
  constraints?: ReadonlyArray<SingleFieldConstraint>;
  /**
   * SPARQL SELECT query to generate a fixed list (choices) of values
   * that the user may choose from.
   *
   * Exposed projection variables:
   *   * `?value` - set of values for user to choose from;
   *   * (optional) `?label` - label for `?value`;
   *   * (optional) further projection variables might be exposed
   *     to format the rendering within the input element;
   */
  valueSetPattern?: string;
  /**
   * SPARQL SELECT query to generate a dynamic suggestion list based on
   * text index or regex search.
   *
   * Query bindings:
   *   * `?__token__` - text token the user is typing;
   *
   * Exposed projection variables:
   *   * `?value` - suggested value for the field;
   *   * (optional) `?label` - label for `?value`; further projection variables might be exposed
   *     to format the rendering within the input element;
   *
   * Example:
   * ```
   * PREFIX lookup: <http://www.metaphacts.com/ontologies/platform/repository/lookup#>
   * SELECT ?value ?label WHERE {
   *   SERVICE Repository:lookup {
   *     ?value lookup:token ?__token__ .
   *     # ?value lookup:type :MyType
   *   }
   * }
   * ```
   */
  autosuggestionPattern?: string;
  /**
   * SPARQL configuration to select terms from an hierarchical thesaurus.
   * Can be either `simple` or `full` (specified in the `type` attribute).
   */
  treePatterns?: TreeQueriesConfig;
  /**
   * Test subject IRI that is used for forms preview in the field editor.
   * @ignore
   */
  testSubject?: string;
  /**
   * Enables values ordering. Supported value: `index-property`.
   *
   * `index-property` means that the `?index` variable in the query will bind a literal value
   * of type `xsd:integer` representing the node's index.
   *
   * The following conventions apply:
   *   * `insertPattern` MUST have an `?index` variable to bind;
   *   * `selectPattern` MUST expose an `?index` projection variable;
   *   * `maxOccurs` MUST be > 1 or `'unbound'`;
   *
   * Note that the index must be bound as property to an object resource.
   * For ordering literal values consider adding an intermediate node, i.e.:
   * ```
   * ?subj :hasOrderedItem ?itemNode .
   * ?itemNode :hasItemValue ?value .
   * ?itemNode :hasIndex ?index .
   * ```
   */
  orderedWith?: 'index-property';
}

export interface SingleFieldConstraint {
  /**
   * SPARQL ASK pattern to validate if the constraint holds.
   *
   * Query bindings:
   *   * `?value` - validated field value;
   */
  validatePattern: string;
  /** Error message to display if constraint is violated. */
  message: string;
}

export interface MultipleFieldConstraint extends SingleFieldConstraint {
  /**
   * Maps the ID of a constrained field to the variable name that can be used
   * in the `validatePattern`.
   */
  fields: { readonly [fieldId: string]: string };
  /**
   * SPARQL ASK pattern to validate if the constraint holds. The value of the
   * constrained field is injected as additional binding as defined in the `fields`
   * mapping.
   *
   * Query bindings:
   *   * `?(constrainedFieldVariable)` - value for each constrained field;
   */
  validatePattern: string;
  /** Error message to display if constraint is violated. */
  message: string;
}

export type FieldConstraint = SingleFieldConstraint | MultipleFieldConstraint;

export type TreeQueriesConfig = SimpleTreeConfig | FullTreeConfig;

export interface SimpleTreeConfig extends LightweightTreePatterns {
  type: 'simple';
}

export interface FullTreeConfig extends ComplexTreePatterns {
  type: 'full';
}

export interface FieldDependency {
  /** Dependent field ID. */
  field: string;
  /**
   * Maps a field ID (to depend on) to the variable name that can be used in the
   * `autosuggestionPattern` and `valueSetPattern` queries. The value
   * of the dependent field is injected as additional binding into the
   * queries. */
  dependencies: { readonly [fieldId: string]: string };
  /**
   * SPARQL SELECT query to generate a fixed list (choices) of values
   * that the user may choose from. The value of the dependent field
   * is injected as additional binding as defined in the `dependencies`
   * mapping.
   *
   * Query bindings:
   *   * `?(dependentOnFieldVariable)` - value for each dependent on field;
   *
   * Exposed projection variables:
   *   * `?value` - set of values for user to choose from;
   *   * (optional) `?label` - label for `?value`; further projection variables might be exposed
   *     to format the rendering within the input element;
   */
  valueSetPattern?: string;
  /**
   * SPARQL SELECT query to generate a dynamic suggestion list based on
   * text index or regex search. The value of the dependend field
   * is injected as additional binding as defined in the dependencies
   * mapping.
   *
   * Query bindings:
   *   * `?token` - text token the user is typing;
   *   * `?(dependentOnFieldVariable)` - value for each depended on field;
   *
   * Exposed projection variables:
   *   * `?value` - suggested value for the field;
   *   * (optional) `?label` - label for `?value`; further projection variables might be exposed
   *     to format the rendering within the input element;
   */
  autosuggestionPattern?: string;
}

/**
 * `FieldDefinition` is a normalized version of `FieldDefinitionProp` to be
 * used inside semantic form implementation.
 *
 * @see FieldDefinitionConfig
 */
export interface FieldDefinition {
  id: string;
  iri?: string;
  label?: ReadonlyArray<Rdf.Literal>;
  description?: string;
  categories: ReadonlyArray<Rdf.Iri>;
  domain?: ReadonlyArray<Rdf.Iri>;
  xsdDatatype?: Rdf.Iri;
  range?: ReadonlyArray<Rdf.Iri>;
  minOccurs: number;
  maxOccurs: number;
  order: number;
  defaultValues: ReadonlyArray<string>;
  selectPattern?: string;
  constraints: ReadonlyArray<SingleFieldConstraint>;
  valueSetPattern?: string;
  deletePattern?: string;
  insertPattern?: string;
  autosuggestionPattern?: string;
  treePatterns?: TreeQueriesConfig;
  testSubject?: Rdf.Iri;
  orderedWith?: 'index-property';
}

/**
 * `FieldDefinitionProp` is union between `FieldDefinition` and `FieldDefinitionConfig`
 * which allows to pass either one of them to the actual semantic form implementation.
 *
 * @see FieldDefinitionConfig
 */
export interface FieldDefinitionProp {
  id: string;
  iri?: string;
  label?: string | ReadonlyArray<Rdf.Literal>;
  description?: string;
  categories?: ReadonlyArray<string | Rdf.Iri>;
  domain?: string | Rdf.Iri | ReadonlyArray<string | Rdf.Iri>;
  xsdDatatype?: string | Rdf.Iri;
  range?: string | Rdf.Iri | ReadonlyArray<string | Rdf.Iri>;
  minOccurs?: number | 'unbound';
  maxOccurs?: number | 'unbound';
  order?: number | 'unbound';
  defaultValues?: ReadonlyArray<string>;
  selectPattern?: string;
  askPattern?: string;
  constraints?: ReadonlyArray<SingleFieldConstraint>;
  valueSetPattern?: string;
  deletePattern?: string;
  insertPattern?: string;
  autosuggestionPattern?: string;
  treePatterns?: TreeQueriesConfig;
  testSubject?: string | Rdf.Iri;
  orderedWith?: 'index-property';
}

export function normalizeFieldDefinition(
  definitionProp: FieldDefinitionProp
): FieldDefinition {
  const definition: { [K in keyof FieldDefinitionProp]?: any } = _.cloneDeep(definitionProp);

  if (typeof definition.label === 'string') {
    definition.label = [Rdf.langLiteral(definition.label, '')];
  }

  if (Array.isArray(definition.categories)) {
    definition.categories = definition.categories.map(category =>
      typeof category === 'string' ? Rdf.iri(category) : category);
  } else {
    definition.categories = [];
  }

  if (typeof definition.minOccurs !== 'number') {
    if (!definition.minOccurs || definition.minOccurs === 'unbound') {
      definition.minOccurs = 0;
    } else {
      definition.minOccurs = parseInt(definition.minOccurs, 10);
    }
  }

  if (typeof definition.maxOccurs !== 'number') {
    if (!definition.maxOccurs || definition.maxOccurs === 'unbound') {
      definition.maxOccurs = Infinity;
    } else {
      definition.maxOccurs = parseInt(definition.maxOccurs, 10);
    }
  }

  if (typeof definition.order !== 'number') {
    if (!definition.order || definition.order === 'unbound') {
      definition.order = 0;
    } else {
      definition.order = parseInt(definition.order, 10);
    }
  }

  if (typeof definition.domain === 'string') {
    definition.domain = [Rdf.iri(definition.domain)];
  } else if (Array.isArray(definition.domain)) {
    definition.domain = definition.domain.map(domain => {
      if (typeof domain === 'string') {
        return Rdf.iri(domain);
      }
      return domain;
    });
  }

  if (typeof definition.range === 'string') {
    definition.range = Rdf.iri(definition.range);
  } else if (Array.isArray(definition.range)) {
    definition.range = definition.range.map(range => {
      if (typeof range === 'string') {
        return Rdf.iri(range);
      }
      return range;
    });
  }

  if (typeof definition.xsdDatatype === 'string') {
    const datatype = XsdDataTypeValidation.parseXsdDatatype(definition.xsdDatatype);
    definition.xsdDatatype = datatype
      ? datatype.iri : Rdf.iri(definition.xsdDatatype);
  }

  if (definition.xsdDatatype) {
    definition.xsdDatatype = XsdDataTypeValidation.replaceDatatypeAliases(definition.xsdDatatype);
  } else if (definition.range) {
    definition.xsdDatatype = xsd.anyURI;
  }

  if (!definition.defaultValues) {
    definition.defaultValues = [];
  }

  if (typeof definition.testSubject === 'string') {
    definition.testSubject = Rdf.iri(definition.testSubject);
  }

  if (typeof definition.askPattern === 'string') {
    const sparqlAskConstraint = {
      validatePattern: definition.askPattern,
      message: 'Value does not pass the SPARQL ASK test.',
    };
    if (Array.isArray(definition.constraints)) {
      definition.constraints.push(sparqlAskConstraint);
    } else {
      definition.constraints = [sparqlAskConstraint];
    }
    // askPattern has been converted to a constraint. To avoid duplicate constraints if
    // this function is called multiple times, the askPattern property is deleted.
    delete definition.askPattern;
  } else if (!Array.isArray(definition.constraints)) {
    definition.constraints = [];
  }
  return definition as FieldDefinition;
}

// tslint:disable-next-line:no-unused-variable
function compileTimeAssertDefinitionAssignableToProp() {
  const normalized: FieldDefinition = {} as any;
  const config: FieldDefinitionConfig = {} as any;
  // Checks the following assignment compatibility:
  //   - `FieldDefinition` -> `FieldDefinitionProp`
  //   - `FieldDefinitionConfig` -> `FieldDefinitionProp`
  // (It should be possible to pass "normalized" definition to another component.)
  const prop1: FieldDefinitionProp = normalized;
  const prop2: FieldDefinitionProp = config;
}

export function getPreferredLabel(
  label: string | ReadonlyArray<Rdf.Literal> | undefined
): string | undefined {
  if (typeof label === 'undefined' || typeof label === 'string') {
    return label;
  }
  const selected = selectPreferredLabel(label);
  return selected ? selected.value : undefined;
}

export function hasBindingNameForField(
  fields: { readonly [fieldId: string]: string },
  targetFieldId: string
) {
  return Object.prototype.hasOwnProperty.call(fields, targetFieldId);
}
