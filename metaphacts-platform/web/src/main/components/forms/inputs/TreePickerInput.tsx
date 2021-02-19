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
import * as Immutable from 'immutable';
import * as Kefir from 'kefir';

import { Rdf, vocabularies } from 'platform/api/rdf';

import {
  SemanticTreeInput, Node as TreeNode, SelectionNode, TreeSelection, ComplexTreePatterns,
  createDefaultTreeQueries,
} from 'platform/components/semantic/lazy-tree';
import { RemovableBadge } from 'platform/components/ui/inputs';

import { FieldDefinition, getPreferredLabel } from '../FieldDefinition';
import {
  FieldValue, AtomicValue, ErrorKind, EmptyValue, CompositeValue, FieldError,
} from '../FieldValues';
import {
  MultipleValuesInput,
  MultipleValuesConfig,
  MultipleValuesProps,
  MultipleValuesHandlerProps,
  MultipleValuesHandler,
  ValuesWithErrors,
  checkCardinalityAndDuplicates,
} from './MultipleValuesInput';
import { NestedModalForm, tryExtractNestedForm } from './NestedModalForm';

/**
 * Component to select one or many values from a hierarchy represented by a tree selector.
 *
 * **Example**:
 * ```
 * <semantic-form-tree-picker-input for='place'>
 * </semantic-form-tree-picker-input>
 * ```
 */
interface SemanticFormTreePickerInputConfig extends MultipleValuesConfig {
  placeholder?: string;
}

export interface TreePickerInputProps
  extends SemanticFormTreePickerInputConfig, MultipleValuesProps {}

interface State {
  readonly treeVersionKey?: number;
  readonly treeQueries?: ComplexTreePatterns;
  readonly treeSelection?: ReadonlyArray<Rdf.Iri>;
  readonly treeSelectionSet?: Immutable.Set<Rdf.Iri>;
  readonly nestedFormOpen?: boolean;
}

const CLASS_NAME = 'semantic-form-tree-picker-input';

export class TreePickerInput extends MultipleValuesInput<TreePickerInputProps, State> {
  constructor(props: TreePickerInputProps, context: any) {
    super(props, context);
    const config = this.props.definition.treePatterns || {type: 'simple'};
    const treeQueries: ComplexTreePatterns = config.type === 'full'
      ? config : createDefaultTreeQueries(config);
    this.state = {treeVersionKey: 0, treeQueries};
  }

  componentWillReceiveProps(nextProps: TreePickerInputProps) {
    const previousValues = this.state.treeSelectionSet;
    const nextValues = toSetOfIris(nextProps.values);
    const isValuesSame = !previousValues && nextValues.size === 0
      || previousValues && previousValues.equals(
        // workaround for broken typyings for ImmutableJS with TypeScript 2.6.0
        // (Set<T> not assignable to Iterable<T, T>)
        nextValues as Immutable.Iterable<Rdf.Iri, Rdf.Iri>
      );

    if (!isValuesSame) {
      this.setState((state): State => ({
        treeVersionKey: state.treeVersionKey + 1,
        treeSelection: nextValues.toArray(),
        treeSelectionSet: nextValues,
      }));
    }
  }

  render() {
    const {values} = this.props;
    const {maxOccurs} = this.props.definition;
    const {treeSelection} = this.state;
    const nestedForm = tryExtractNestedForm(this.props.children);
    const showCreateNewButton = (
      nestedForm && (!treeSelection || treeSelection.length < maxOccurs)
    );
    const incorrectValues: AtomicValue[] = [];
    values.forEach(value => {
      if (FieldValue.isAtomic(value) && !Rdf.isIri(value.value)) {
        incorrectValues.push(value);
      }
    });
    return (
      <div className={CLASS_NAME}>
        <div className={`${CLASS_NAME}__tree-input`}>
          {this.renderTreePicker()}
          {showCreateNewButton ? this.renderCreateNewButton() : null}
          {this.state.nestedFormOpen ? (
            <NestedModalForm definition={this.props.definition}
              onSubmit={this.onNestedFormSubmit}
              onCancel={() => this.setState({nestedFormOpen: false})}>
              {nestedForm}
            </NestedModalForm>
          ) : null}
        </div>
        {incorrectValues.length > 0
          ? this.renderRemovableBadge(incorrectValues)
          : null}
      </div>
    );
  }

  private renderRemovableBadge(incorrectValues: AtomicValue[]) {
    return (
      <div className={`${CLASS_NAME}__non-resources-panel`}>
        <div className={`${CLASS_NAME}__title`}>
          Non-resources, which will be removed as soon as any
          resource in the tree above is modified:
        </div>
        {incorrectValues.map(value => {
          const incorrectValue = value.value;
          return (
            <RemovableBadge key={incorrectValue.toString()}
              title={incorrectValue.toString()}
              className={`${CLASS_NAME}__removable-badge`}
              onRemove={() => {
                const {values} = this.props;
                const newValues = values.filter(oldValue => {
                  if (FieldValue.isAtomic(oldValue)) {
                    return !oldValue.value.equals(incorrectValue);
                  }
                });
                this.onValuesChanged(newValues);
            }}>
              {incorrectValue.value}
            </RemovableBadge>
          );
        })}
      </div>
    );
  }

  private onNestedFormSubmit = (value: AtomicValue) => {
    this.setState({nestedFormOpen: false});
    const values = this.props.values.concat(value);
    this.onValuesChanged(values);
  }

  private renderTreePicker() {
    const {treeVersionKey, treeQueries, treeSelection} = this.state;
    const {
      rootsQuery, childrenQuery, parentsQuery, searchQuery,
      // tslint:disable-next-line: deprecation
      escapeLuceneSyntax, tokenizeLuceneQuery,
    } = treeQueries;

    const placeholder = typeof this.props.placeholder === 'string'
      ? this.props.placeholder : createDefaultPlaceholder(this.props.definition);

    return (
      <SemanticTreeInput key={treeVersionKey}
        className={`${CLASS_NAME}__picker`}
        placeholder={placeholder}

        rootsQuery={rootsQuery}
        childrenQuery={childrenQuery}
        parentsQuery={parentsQuery}
        searchQuery={searchQuery}
        escapeLuceneSyntax={escapeLuceneSyntax}
        tokenizeLuceneQuery={tokenizeLuceneQuery}

        initialSelection={treeSelection}
        multipleSelection={true}
        onSelectionChanged={selection => {
          const selectionLeafs = TreeSelection.leafs(selection);
          const selectionSet = selectionLeafs.map(leaf => leaf.iri).toSet();
          this.setState({
            treeSelection: selectionSet.toArray(),
            treeSelectionSet: selectionSet,
            nestedFormOpen: false,
          }, () => this.onTreeSelectionChanged(selectionLeafs));
        }}
      />
    );
  }

  private onTreeSelectionChanged(leafs: Immutable.List<SelectionNode<TreeNode>>) {
    const values = leafs.map(({iri, label}) => FieldValue.fromLabeled({
      value: iri,
      label: label ? label.value : undefined,
    })).toArray();
    this.onValuesChanged(values);
  }

  private onValuesChanged(values: ReadonlyArray<FieldValue>) {
    const {updateValues, handler} = this.props;
    updateValues(({errors}) => handler.validate({values, errors}));
  }

  private renderCreateNewButton() {
    return (
      <Button
        className={`${CLASS_NAME}__create-button`}
        variant='secondary'
        onClick={this.toggleNestedForm}>
        <span className='fa fa-plus' />
        {' Create new'}
      </Button>
    );
  }

  private toggleNestedForm = () => {
    this.setState((state): State => ({nestedFormOpen: !state.nestedFormOpen}));
  }

  static makeHandler(props: MultipleValuesHandlerProps<TreePickerInputProps>) {
    return new TreePickerInputHandler(props);
  }
}

export class TreePickerInputHandler implements MultipleValuesHandler {
  private definition: FieldDefinition;

  constructor(props: MultipleValuesHandlerProps<MultipleValuesProps>) {
    this.definition = props.definition;
  }

  validate({values, errors}: ValuesWithErrors): ValuesWithErrors {
    const newErrors: FieldError[] = [];
    const cardinalityErrors = checkCardinalityAndDuplicates(values, this.definition);
    if (this.definition.xsdDatatype &&
      this.definition.xsdDatatype.equals(vocabularies.xsd.anyURI)) {
      values.forEach(value => {
        if (FieldValue.isAtomic(value) && !Rdf.isIri(value.value)) {
          newErrors.push({
            kind: ErrorKind.Input,
            message: `Current value "${value.value.value}" is not IRI`,
          });
        }
      });
    }
    return {
      values: values,
      errors: errors.filter(e => e.kind !== ErrorKind.Input)
        .concat(cardinalityErrors)
        .concat(newErrors)
    };
  }

  finalize(
    values: ReadonlyArray<FieldValue>,
    owner: EmptyValue | CompositeValue
  ): Kefir.Property<ReadonlyArray<FieldValue>> {
    return MultipleValuesInput.defaultHandler.finalize(values, owner);
  }
}

function toSetOfIris(values: ReadonlyArray<FieldValue>) {
  return Immutable.Set<Rdf.Iri>(values
    .filter(v => FieldValue.isAtomic(v) && Rdf.isIri(v.value))
    .map(v => (v as AtomicValue).value as Rdf.Iri)
  );
}

function createDefaultPlaceholder(definition: FieldDefinition): string {
  const entityLabel = (getPreferredLabel(definition.label) || 'entity').toLocaleLowerCase();
  return `Search or browse for values of ${entityLabel} here...`;
}

MultipleValuesInput.assertStatic(TreePickerInput);

export default TreePickerInput;
