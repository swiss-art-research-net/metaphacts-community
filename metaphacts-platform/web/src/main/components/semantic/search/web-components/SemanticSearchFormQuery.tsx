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
import * as React from 'react';
import { each } from 'lodash';
import * as SparqlJs from 'sparqljs';
import { Just } from 'data.maybe';

import { WrappingError } from 'platform/api/async';
import { Rdf, XsdDataTypeValidation, vocabularies } from 'platform/api/rdf';
import {
  SparqlUtil, SparqlClient, QueryVisitor, VariableBinder, PatternBinder, SparqlTypeGuards,
} from 'platform/api/sparql';

import { isValidChild } from 'platform/components/utils';

import {
  SemanticForm, SemanticFormProps, FieldDefinition, FieldDefinitionConfig, FieldDefinitionProp,
  AtomicValue, CompositeValue, FieldValue, DataState, FieldState, FieldError, ErrorKind,
  EmptyValue, FieldDependency, MultipleFieldConstraint, normalizeFieldDefinition, readyToSubmit,
} from 'platform/components/forms';

import { SemanticSearchContext, InitialQueryContext } from './SemanticSearchApi';
import { setSearchDomain } from '../commons/Utils';
import * as Model from 'platform/components/semantic/search/data/search/Model';

export interface SemanticFormBasedQueryConfig {
  /**
   * Query template for form parametrization. Each query argument must have
   * corresponding form field definition.
   */
  queryTemplate: QueryTemplate;
  /**
   * Definitions for form fields. Every field `id` must be map exactly to a
   * single argument as defined in the arguments map of the `queryTemplate`
   * as well as must be referenced by the `for=` attribute of the HTML form input elements.
   *
   * - `maxOccurs` will be overridden to 1 (if the `multi` property set to `false`);
   * - `minOccurs` will be overridden to 0 or 1 depending on whether
   * corresponding query argument is optional or not.
   */
  fields: ReadonlyArray<FieldDefinitionConfig>;
  /**
   * An array of multi-field constraints on field values.
   */
  fieldConstraints?: ReadonlyArray<MultipleFieldConstraint>;
  /**
   * Definitions for dependencies between field values.
   */
  fieldDependencies?: ReadonlyArray<FieldDependency>;

  /**
   * Specifies the search domain category IRI (full IRI enclosed in <>).
   * Required, if component is used together with facets.
   */
  domain?: string;

  domainField?: string;

  /**
   * Enables multi-value injection.
   *
   * If set to `true`, VALUES clause will be used to parametrize
   * the base query for arguments with more than one value.
   *
   * If set to `false`, the first value will be used to parametrize
   * the base query by replacement of the binding variable.
   *
   * To disable multi-value parameterization for particular variables,
   * one can explicitly set `maxOccurs: 1` for corresponding fields.
   *
   * @default false
   */
  multi?: boolean;
}

export interface QueryTemplate {
  /**
   * The SPARQL query string, which is supposed to be parameterized, i.e. the query must
   * have query variables as listed in the arguments maps.
   *
   * For composite arguments the query should use `FILTER(?argumentId)` as a marker to indicate
   * where to insert parametrized patterns.
   */
  queryString: string;
  /**
   * A map of query arguments.
   *
   * Each entry key corresponds to the query variable in the SPARQL queryString.
   */
  arguments: { [id: string]: QueryTemplateArgument };
}

export type QueryTemplateArgument = AtomicTemplateArgument | CompositeTemplateArgument;

export interface AtomicTemplateArgument {
  /**
   * The RDF datatype of the expected value, i.e. xsd:anyURI, xsd:string, xsd:integer etc.
   */
  type: string;
  /**
   * Whether the argument is optional.
   * @default false
   */
  optional?: boolean;
}

export interface CompositeTemplateArgument {
  /**
   * Determines whether parametrized patterns should be combined:
   *  - `or`: with UNION clause;
   *  - `and`: nested group intersection;
   */
  operator: 'or' | 'and';
  /**
   * SPARQL pattern parametrized with nested composite input state.
   *
   * To insert parametrized patterns use `FILTER(?argumentId)` marker statement.
   */
  pattern: string;
  /**
   * Set of variable names to preserve, i.e. do not transform during pattern parameterization.
   *
   * In addition, any variable specified or referenced in the projection clause of the base query
   * is also automatically preserve it's name.
   */
  projectedVariables?: ReadonlyArray<string>;
  /**
   * A map of query arguments.
   *
   * Each entry key corresponds to the query variable in the SPARQL pattern.
   */
  arguments: { [id: string]: QueryTemplateArgument };
}

/**
 * Virtual subject for search form to make sure that it sends `selectPattern` queries to
 * simulate default values for fields. Currently the form assumes as an optimization
 * that every field is empty because form subject is a placeholder (subject IRI == <>).
 */
const PLACEHOLDER_SUBJECT = Rdf.iri(vocabularies.VocabPlatform._NAMESPACE + 'FormQuerySubject');

/**
 * Form-based query formulation component, where the fields in the form
 * are used to provide values for a parameterized query (template).
 *
 * @example
 *  <semantic-search-form-query
 *    query-template='{
 *      "queryString": "SELECT * WHERE { ?s a ?type }",
 *      "arguments": {
 *        "type": {"type": "xsd:anyURI"},
 *        "label": {"type": "xsd:string"}
 *      }
 *    }'
 *    fields='[
 *      {
 *        "id": "type",
 *        "label": "Type",
 *        "description": "The type of the instance",
 *        "xsdDatatype": "xsd:anyURI",
 *        "minOccurs": "1",
 *        "maxOccurs": "2",
 *        "valueSetPattern": "SELECT $value $label WHERE { VALUES ($value $label)
 *        { (<http://www.cidoc-crm.org/cidoc-crm/E22_Man-Made_Object> \"Man Made Object\")
 *        (<http://www.cidoc-crm.org/cidoc-crm/E73_Information_Object> \"Information Object\") } }",
 *        "selectPattern": "SELECT $value WHERE { $subject a $value }"
 *      },
 *      {"id": "label", "label": "Label", "xsdDatatype": "xsd:string"}
 *    ]'>
 *      <semantic-form-select-input for="type"></semantic-form-select-input>
 *      <semantic-form-text-input for="label"></semantic-form-text-input>
 *      <button type='button' name='submit' className='btn btn-default'>Search</button>
 *  </semantic-search-form-query>
 */
export class FormQuery extends React.Component<SemanticFormBasedQueryConfig> {
  render() {
    return (
      <SemanticSearchContext.Consumer>
        {context => <FormQueryInner {...this.props} context={context} />}
      </SemanticSearchContext.Consumer>
    );
  }
}

interface InnerProps extends SemanticFormBasedQueryConfig {
  context: InitialQueryContext;
}

interface State {
  readonly definitions: ReadonlyArray<FieldDefinition>;
  readonly model?: CompositeValue;
  readonly modelState?: DataState;
  readonly appliedStructure: boolean;
  readonly version: number;
  readonly formHandlers: FormHandlers;
  readonly isLoading?: boolean;
}

type FormHandlers = Pick<SemanticFormProps, 'onChanged' | 'onUpdateState'>;

class FormQueryInner extends React.Component<InnerProps, State> {
  private form: SemanticForm;

  private isFirstExecution: boolean;

  constructor(props: InnerProps) {
    super(props);
    const version = 1;
    this.state = {
      definitions: adjustDefinitionsToTemplate({
        queryTemplate: this.props.queryTemplate,
        defs: this.props.fields,
        multi: this.props.multi,
      }),
      appliedStructure: false,
      version,
      formHandlers: this.makeHandlers(version),
      isLoading: true,
    };
  }

  componentWillReceiveProps(nextProps: InnerProps) {
    const {context} = this.props;
    const {context: nextContext} = nextProps;
    if (nextContext.searchProfileStore.isJust && nextContext.domain.isNothing) {
      setSearchDomain(nextProps.domain, nextContext);
    }
    if (nextContext.baseQueryStructure.isJust &&
      context.baseQueryStructure.isNothing &&
      !this.state.isLoading &&
      !this.isFirstExecution
    ) {
      this.setState(state => {
        const model = applyBaseQueryStructure(
          state.model, nextContext.baseQueryStructure.get()
        );
        const newVersion = state.version + 1;
        return {
          model,
          appliedStructure: true,
          version: newVersion,
          formHandlers: this.makeHandlers(newVersion),
          isLoading: true,
        };
      });
    }
  }

  render() {
    const {fieldConstraints, fieldDependencies} = this.props;
    const {version, definitions, formHandlers, model} = this.state;
    return (
      <SemanticForm key={version}
        ref={this.setFormRef}
        fields={definitions}
        fieldConstraints={fieldConstraints}
        fieldDependencies={fieldDependencies}
        model={model || FieldValue.fromLabeled({value: PLACEHOLDER_SUBJECT})}
        {...formHandlers}>
        <div onKeyDown={this.onKeyDown}>
          {this.mapChildren(this.props.children)}
        </div>
      </SemanticForm>
    );
  }

  private onKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.keyCode === 13) {
      e.preventDefault();
      this.executeSearch();
    }
  }

  private setFormRef = (form: SemanticForm) => {
    this.form = form;
  }

  private makeHandlers(version: number): FormHandlers {
    return {
      onChanged: model => {
        this.setState(state => {
          if (state.version !== version) { return null; }
          return {model};
        });
      },
      onUpdateState: (modelState, loadedModel) => {
        if (loadedModel) {
          let executeSearch = false;
          this.setState((state, props) => {
            if (state.version !== version) { return null; }

            const {queryTemplate, context} = props;

            const validationErrors: FieldError[] = [];
            each(queryTemplate.arguments, (argument, argumentId) => {
              const field = loadedModel.definitions.get(argumentId);
              validateArgumentAndField(argumentId, argument, field, validationErrors);
            });
            let model = CompositeValue.set(loadedModel, {
              errors: loadedModel.errors.concat(validationErrors),
            });

            if (context.baseQueryStructure.isJust && !state.appliedStructure) {
              model = applyBaseQueryStructure(model, context.baseQueryStructure.get());
              const newVersion = state.version + 1;
              return {
                model,
                modelState,
                appliedStructure: true,
                version: newVersion,
                formHandlers: this.makeHandlers(newVersion),
                isLoading: true,
              };
            } else {
              executeSearch = state.appliedStructure;
              return {
                model,
                modelState,
                appliedStructure: state.appliedStructure,
                version: state.version,
                formHandlers: state.formHandlers,
                isLoading: false
              };
            }
          }, () => {
            if (executeSearch) {
              this.executeSearch();
            }
          });
        } else {
          this.setState(state => {
            if (state.version !== version) { return null; }
            return {modelState};
          });
        }
      }
    };
  }

  private mapChildren = (children: React.ReactNode): React.ReactNode => {
    return React.Children.map(children, element => {
      if (!isValidChild(element)) { return element; }
      const {type, props} = element;

      if (type === 'button') {
        if (props.name === 'submit') {
          return React.cloneElement(element, {
            disabled: !this.canSubmit(this.state.model),
            onClick: this.executeSearch,
          });
        }
      }

      if (props.children && props.children.length > 0) {
         return React.cloneElement(element, {}, this.mapChildren(props.children));
      }

      return element;
    });
  }

  private executeSearch = () => {
    const model = this.form.validate(this.state.model);
    this.setState({model});

    if (!this.canSubmit(model)) { return; }

    const {domainField, queryTemplate, context} = this.props;
    if (domainField) {
      setSearchDomain(
        '<' + FieldValue.asRdfNode(
          FieldState.getFirst(model.fields.get(domainField).values)
        ).value + '>',
        context
      );
    }

    const parsedQuery = SparqlUtil.parseQuery(queryTemplate.queryString);
    if (parsedQuery.type !== 'query' || parsedQuery.queryType !== 'SELECT') {
      throw new Error('Query must be SELECT SPARQL query');
    }
    bindQueryArguments(parsedQuery, queryTemplate.arguments, model);

    this.isFirstExecution = context.baseQueryStructure.isNothing;

    context.setBaseQuery(Just(parsedQuery));
    context.setBaseQueryStructure(
      Just({
        kind: Model.SearchKind.FormBased,
        model: model,
        domain: context.domain.getOrElse(undefined),
      })
    );
  }

  private canSubmit(model: CompositeValue) {
    return this.state.modelState === DataState.Ready
      && readyToSubmit(model, error => true);
  }
}

function isAtomicArgument(arg: QueryTemplateArgument): arg is AtomicTemplateArgument {
  return !(arg as Partial<CompositeTemplateArgument>).pattern;
}

function adjustDefinitionsToTemplate(
  {queryTemplate, defs, multi}: {
    queryTemplate: QueryTemplate;
    defs: ReadonlyArray<FieldDefinitionProp>;
    multi: boolean;
  }
) {
  return defs.map(normalizeFieldDefinition)
    .map<FieldDefinition>(def => {
      const argument = queryTemplate.arguments[def.id];
      if (!(argument && isAtomicArgument(argument))) { return def; }
      return {...def, maxOccurs: multi ? def.maxOccurs : 1, minOccurs: argument.optional ? 0 : 1};
    });
}

/**
 * Performs configuration validation for query `argument` with ID `argumentId`
 * and corresponding field definition `field` and writes any detected errors
 * into `validationErrors`.
 *
 * Currently checks for:
 * - missing field definition for argument;
 * - invalid XSD datatype for query argument;
 * - mismatched datatypes of query argument and field definition.
 */
function validateArgumentAndField(
  argumentId: string,
  argument: QueryTemplateArgument,
  field: FieldDefinition,
  validationErrors: FieldError[]
) {
  if (!field) {
    validationErrors.push({
      kind: ErrorKind.Configuration,
      message: `Missing field definition or input for argument '${argumentId}'`,
    });
    return;
  }

  if (isAtomicArgument(argument)) {
    const argumentType = XsdDataTypeValidation.parseXsdDatatype(argument.type);
    if (argumentType) {
      if (!XsdDataTypeValidation.sameXsdDatatype(argumentType.iri, field.xsdDatatype)) {
        validationErrors.push({
          kind: ErrorKind.Configuration,
          message:
            `Mismatched argument type ${argumentType.iri} and field type ${field.xsdDatatype}`,
        });
      }
    } else {
      validationErrors.push({
        kind: ErrorKind.Configuration,
        message: `Invalid XSD datatype '${argument.type}' for argument '${argumentId}'`,
      });
    }
  }
}

function bindQueryArguments(
  query: SparqlJs.SelectQuery,
  queryArguments: { [argumentId: string]: QueryTemplateArgument },
  model: CompositeValue
) {
  const bindContext: BindArgumentContext = {
    prefixes: query.prefixes,
    projectedVariables: VariableCollector.findProjectedVariables(query),
  };
  bindPatternArguments(query, '', queryArguments, model, bindContext);
}
// export only for tests
export const _bindQueryArguments = bindQueryArguments;

class VariableCollector extends QueryVisitor {
  constructor(readonly foundVariables: Set<string>) {
    super();
  }

  variableTerm(variable: SparqlJs.VariableTerm): undefined {
    const name = variable.value;
    this.foundVariables.add(name);
    return undefined;
  }

  static findProjectedVariables(query: SparqlJs.SelectQuery): Set<string> {
    const visitor = new VariableCollector(new Set<string>());
    if (!SparqlTypeGuards.isStarProjection(query.variables)) {
      for (const variable of query.variables) {
        if (SparqlTypeGuards.isVariable(variable)) {
          visitor.variableTerm(variable);
        } else {
          visitor.expression(variable.expression);
        }
      }
    }
    return visitor.foundVariables;
  }
}

interface BindArgumentContext {
  readonly prefixes: { [prefix: string]: string };
  readonly projectedVariables: ReadonlySet<string>;
}

function bindPatternArguments(
  target: SparqlJs.BlockPattern | SparqlJs.SelectQuery,
  variablePostfix: string,
  blockArguments: { [argumentId: string]: QueryTemplateArgument },
  model: CompositeValue,
  context: BindArgumentContext
): void {
  const targetBlock: SparqlJs.BlockPattern = target.type === 'query'
    ? {type: 'group', patterns: target.where}
    : target;

  const bindings: SparqlClient.Dictionary<Rdf.Node> = {};

  for (const argumentId of Object.keys(blockArguments)) {
    const argument = blockArguments[argumentId];

    const {values} = model.fields.get(argumentId);
    const {maxOccurs} = model.definitions.get(argumentId);

    if (isAtomicArgument(argument)) {
      if (values.length === 0) {
        if (!argument.optional) {
          throw new Error(`No field value for query argument '${argumentId}'`);
        }
      } else if (maxOccurs === 1 || values.length === 1) {
        // use variable replacement if an argument has
        // cardinality === 1 or it has only one value
        const rdfNode = FieldValue.asRdfNode(FieldState.getFirst(values));
        if (!rdfNode) {
          if (!argument.optional) {
            throw new Error(`Empty field value for query argument '${argumentId}'`);
          }
        }
        bindings[argumentId] = rdfNode;
      } else {
        const parameters: SparqlClient.Dictionary<Rdf.Node>[] = [];
        values.forEach(value => {
          const rdfNode = FieldValue.asRdfNode(value);
          if (!rdfNode) {
            if (argument.optional) { return; }
            throw new Error(`Empty field value for query argument '${argumentId}'`);
          }
          parameters.push({[argumentId]: rdfNode});
        });
        SparqlClient.prependValuesClause(targetBlock.patterns, parameters);
      }
    } else {
      bindCompositeArgument(targetBlock, variablePostfix, argumentId, argument, values, context);
    }
  }

  const binder = new VariableBinder(bindings);
  if (target.type === 'query') {
    binder.select(target);
  } else {
    binder.pattern(targetBlock);
  }
}

function bindCompositeArgument(
  targetBlock: SparqlJs.BlockPattern,
  variablePostfix: string,
  argumentId: string,
  argument: CompositeTemplateArgument,
  values: ReadonlyArray<FieldValue>,
  context: BindArgumentContext
): void {
  const preservedVariables = new Set<string>(argument.projectedVariables || []);
  context.projectedVariables.forEach(v => preservedVariables.add(v));

  const nestedGroups: SparqlJs.BlockPattern[] = [];
  values.forEach((value, index) => {
    if (!FieldValue.isComposite(value)) {
      throw new Error(
        `Failed to parametrize composite argument '${argumentId}' by non-composite value`
      );
    }
    if (isDeeplyEmptyValue(value)) {
      // skip completely empty composite (e.g. each field has no actual values)
      return;
    }
    let patterns: SparqlJs.Pattern[];
    try {
      patterns = SparqlUtil.parsePatterns(argument.pattern, context.prefixes);
    } catch (err) {
      throw new WrappingError(`Failed to parse SPARQL pattern for argument '${argumentId}'`, err);
    }
    const nestedGroup: SparqlJs.BlockPattern = {type: 'group', patterns};
    const newPostfix = `${variablePostfix}_${index}`;
    bindPatternArguments(nestedGroup, newPostfix, argument.arguments, value, context);
    if (nestedGroup.patterns.length > 0) {
      new VariablePostfixBinder(newPostfix, preservedVariables).pattern(nestedGroup);
      nestedGroups.push(nestedGroup);
    }
  });

  let resultPatterns: SparqlJs.Pattern[];
  if (argument.operator === 'or') {
    const union: SparqlJs.BlockPattern = {
      type: 'union',
      patterns: nestedGroups.map(
        group => group.patterns.length === 1 ? group.patterns[0] : group
      )
    };
    resultPatterns = [union];
  } else {
    resultPatterns = nestedGroups;
  }

  new PatternBinder(argumentId, resultPatterns).pattern(targetBlock);
}

class VariablePostfixBinder extends QueryVisitor {
  constructor(
    private readonly postfix: string,
    private readonly except: ReadonlySet<string>
  ) {
    super();
  }

  variableTerm(variable: SparqlJs.VariableTerm) {
    const name = variable.value;
    if (this.except.has(name)) {
      return undefined;
    }
    return Rdf.DATA_FACTORY.variable(name + this.postfix);
  }
}

function isDeeplyEmptyValue(value: FieldValue): boolean {
  switch (value.type) {
    case EmptyValue.type:
      return true;
    case AtomicValue.type:
      return false;
    case CompositeValue.type:
      return value.fields.every(
        state => state.values.every(isDeeplyEmptyValue)
      );
  }
  FieldValue.unknownFieldType(value);
}

function applyBaseQueryStructure(model: CompositeValue, search: Model.Search): CompositeValue {
  // Do not apply the state of another search
  // if there are multiple form based searches on the same page
  if (search.kind !== Model.SearchKind.FormBased ||
    model.definitions.size !== search.model.fields.size) {
    return model;
  }
  for (const definition of model.definitions.toArray()) {
    if (!search.model.fields.has(definition.id)) {
      return model;
    }
  }
  return CompositeValue.set(model, {
    fields: search.model.fields,
  });
}

export default FormQuery;
