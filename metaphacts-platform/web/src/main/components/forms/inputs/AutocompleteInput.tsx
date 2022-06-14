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
import { Button } from 'react-bootstrap';

import { Rdf } from 'platform/api/rdf';
import { AutoCompletionInput } from 'platform/components/ui/inputs';
import { SparqlClient } from 'platform/api/sparql';

import { DataQuery } from 'platform/api/dataClient/dataClient';
import { FieldDefinition, getPreferredLabel } from '../FieldDefinition';
import { FieldValue, AtomicValue, EmptyValue } from '../FieldValues';
import { NestedModalForm, tryExtractNestedForm } from './NestedModalForm';
import {
  SingleValueInput, SingleValueInputConfig, AtomicValueInput, AtomicValueInputProps,
} from './SingleValueInput';
import { ValidationMessages } from './Decorations';

interface SemanticFormAutocompleteInputConfig extends SingleValueInputConfig {
  template?: string;
  placeholder?: string;
  lookupQuery?: DataQuery;
  valueBindingName?: string;
}

export interface AutocompleteInputProps
  extends SemanticFormAutocompleteInputConfig, AtomicValueInputProps {}

interface State {
  readonly nestedFormOpen?: boolean;
}

const CLASS_NAME = 'autocomplete-text-field';
const MINIMUM_LIMIT = 3;
const DEFAULT_TEMPLATE = '<span title="{{label.value}}">{{label.value}}</span>';
const DEFAULT_VALUE_BINDING_NAME = 'value';

export class AutocompleteInput extends AtomicValueInput<AutocompleteInputProps, State> {
  private tupleTemplate: string = null;

  constructor(props: AutocompleteInputProps, context: any) {
    super(props, context);
    this.state = {nestedFormOpen: false};
    this.tupleTemplate = this.tupleTemplate || this.compileTemplate();
  }

  private compileTemplate() {
    return this.props.template ? this.props.template.replace(/\\/g, '') : DEFAULT_TEMPLATE;
  }

  render() {
    const nestedForm = tryExtractNestedForm(this.props.children);
    const showCreateNewButton = Boolean(nestedForm);
    return (
      <div className={CLASS_NAME}>
        {this.renderSelect(showCreateNewButton)}
        <ValidationMessages errors={FieldValue.getErrors(this.props.value)} />
        {this.state.nestedFormOpen ? (
          <NestedModalForm definition={this.props.definition}
            onSubmit={this.onNestedFormSubmit}
            onCancel={() => this.setState({nestedFormOpen: false})}>
            {nestedForm}
          </NestedModalForm>
        ) : null}
      </div>
    );
  }

  private onNestedFormSubmit = (value: AtomicValue) => {
    this.setState({nestedFormOpen: false});
    this.setAndValidate(value);
  }

  private renderSelect(showCreateNewButton: boolean) {
    const {definition} = this.props;
    const rdfNode = FieldValue.asRdfNode(this.props.value);
    const placeholder = typeof this.props.placeholder === 'undefined'
      ? this.createDefaultPlaceholder(definition) : this.props.placeholder;
    const value = FieldValue.isAtomic(this.props.value) ? {
      value: rdfNode,
      label: Rdf.literal(this.props.value.label || rdfNode.value),
    } : undefined;

    return (
      <div className={`${CLASS_NAME}__main-row`}>
        <AutoCompletionInput
          key={definition.id}
          className={`${CLASS_NAME}__select`}
          droppable={this.props.droppable}
          autofocus={false}
          query={this.getAutosuggestionQuery()}
          defaultQuery={this.getValueSetQuery()}
          placeholder={placeholder}
          value={value}
          valueBindingName={this.props.valueBindingName}
          templates={{suggestion: this.tupleTemplate}}
          actions={{
            // TODO due to the typing in AutocompleteInput, this accepts only a Dictionary<Rdf.Node>
            // however, what will be passed in is a SelectValue
            onSelected: this.onChange as (val: any) => void,
          }}
          minimumInput={MINIMUM_LIMIT}
        />
        {showCreateNewButton && value === undefined ? (
          <Button
            className={`${CLASS_NAME}__create-button`}
            variant='secondary'
            onClick={this.toggleNestedForm}>
            <span className='fa fa-plus' />
            {' Create new'}
          </Button>
        ) : null}
      </div>
    );
  }

  private getAutosuggestionQuery(): DataQuery | string | undefined {
    const {definition, lookupQuery, dependencyContext} = this.props;
    if (lookupQuery) {
      return lookupQuery;
    } else if (dependencyContext) {
      return dependencyContext.autosuggestionPattern;
    } else {
      return definition.autosuggestionPattern;
    }
  }

  private getValueSetQuery(): string | undefined {
    const {definition, dependencyContext} = this.props;
    if (dependencyContext) {
      return dependencyContext.valueSetPattern;
    } else {
      return definition.valueSetPattern;
    }
  }

  private toggleNestedForm = () => {
    this.setState((state): State => ({nestedFormOpen: !state.nestedFormOpen}));
  }

  private onChange = (selected: SparqlClient.Binding | null): void => {
    let value: AtomicValue | EmptyValue;
    if (selected) {
      value = FieldValue.fromLabeled({
        value: selected[this.props.valueBindingName || DEFAULT_VALUE_BINDING_NAME],
        label: selected.label.value,
      });
    } else {
      value = FieldValue.empty;
    }
    this.setState({nestedFormOpen: false});
    this.setAndValidate(value);
  }

  private createDefaultPlaceholder(definition: FieldDefinition): string {
    const fieldName = (getPreferredLabel(definition.label) || 'entity').toLocaleLowerCase();
    return `Search and select ${fieldName} here...`;
  }

  static makeHandler = AtomicValueInput.makeAtomicHandler;
}

SingleValueInput.assertStatic(AutocompleteInput);

export default AutocompleteInput;
