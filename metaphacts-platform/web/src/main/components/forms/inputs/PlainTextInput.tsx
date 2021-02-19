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
import { FormGroup, FormControl } from 'react-bootstrap';
import ReactSelect, { OnChangeSingleHandler } from 'react-select';
import TextareaAutosize from 'react-textarea-autosize';

import { Rdf, vocabularies, XsdDataTypeValidation } from 'platform/api/rdf';

import { FieldDefinition, getPreferredLabel } from '../FieldDefinition';
import { FieldValue, AtomicValue, EmptyValue, FieldError, DataState } from '../FieldValues';
import {
  SingleValueInputConfig, SingleValueInput, AtomicValueInput, AtomicValueInputProps,
} from './SingleValueInput';
import { ValidationMessages } from './Decorations';

interface SemanticFormTextInputConfig extends SingleValueInputConfig {
  placeholder?: string;
  /**
   * Display as `<input>` field or `<textarea>`.
   */
  multiline?: boolean;
  /**
   * Maximum number of rows to show when `multiline=true`.
   *
   * @default 7
   */
  maxRows?: number;
  languages?: ReadonlyArray<string>;
  requireLanguage?: boolean;
}

export interface PlainTextInputProps
  extends SemanticFormTextInputConfig, AtomicValueInputProps {}

interface State {
  mutableState: MutableState;
  text: string;
  /** See `Rdf.Literal.language` */
  language: string;
}

interface MutableState {
  hasFocus: boolean;
}

type ValidationStyle = 'success' | 'warning' | 'error' | undefined;

export class PlainTextInput extends AtomicValueInput<PlainTextInputProps, State> {
  constructor(props: PlainTextInputProps, context: any) {
    super(props, context);
    this.state = {
      mutableState: {hasFocus: false},
      text: '',
      language: '',
    };
  }

  static getDerivedStateFromProps(props: PlainTextInputProps, state: State): Partial<State> | null {
    if (state.mutableState && state.mutableState.hasFocus) {
      // ignore value updates if input has focus
      return null;
    }
    return deriveStateFromProps(props, state);
  }

  render() {
    const languageSelect = this.renderLanguageSelect();
    const withLanguage = languageSelect ? 'plain-text-field--with-language' : '';
    return (
      <div className={`plain-text-field ${withLanguage}`}>
        <div className='plain-text-field__inputs'>
          {this.renderElement()}
          {languageSelect}
        </div>
        <ValidationMessages errors={FieldValue.getErrors(this.props.value)} />
      </div>
    );
  }

  private getStyle(): ValidationStyle {
    if (this.props.dataState === DataState.Verifying) {
      return undefined;
    }
    const value = this.props.value;
    const errors = FieldValue.getErrors(value);
    if (errors.length > 0) {
      return errors.some(FieldError.isPreventSubmit) ? 'error' : 'warning';
    } else if (!FieldValue.isEmpty(value)) {
      return 'success';
    } else {
      return undefined;
    }
  }

  private renderElement(): React.ReactNode {
    const {definition, multiline, maxRows = 7} = this.props;
    const rdfNode = FieldValue.asRdfNode(this.props.value);
    const {mutableState} = this.state;

    const placeholder = typeof this.props.placeholder === 'undefined'
      ? this.createDefaultPlaceholder(definition) : this.props.placeholder;

    if (multiline) {
      return (
        <TextareaAutosize
          className='plain-text-field__text'
          style={getTextAreaStyle(this.getStyle())}
          maxRows={maxRows}
          value={this.state.text}
          placeholder={placeholder}
          onChange={this.onTextChanged}
        />
      );
    } else {
      const validationState = this.getStyle();
      return (
        <FormGroup>
          <FormControl
            className='plain-text-field__text'
            value={this.state.text}
            type='text'
            isValid={validationState === 'success'}
            isInvalid={validationState === 'error'}
            placeholder={placeholder}
            onChange={this.onTextChanged}
            onFocus={() => { mutableState.hasFocus = true; }}
            onBlur={() => {
              mutableState.hasFocus = false;
              this.setState(deriveStateFromProps(this.props, this.state));
            }}
            title={rdfNode ? rdfNode.toString() : undefined}
            readOnly={!this.canEdit}
          />
        </FormGroup>
      );
    }
  }

  private onTextChanged = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const {value, definition} = this.props;
    const text = event.target.value;
    const language = this.state.language;
    this.setState({text, language});
    this.setAndValidate(amendValue(value, definition, text, language));
  }

  private renderLanguageSelect() {
    const valueHasLanguage = FieldValue.isAtomic(this.props.value)
      && Rdf.isLiteral(this.props.value.value)
      && this.props.value.value.language;

    if (!(valueHasLanguage || this.props.languages && this.props.languages.length > 0)) {
      return undefined;
    }

    const options = this.getOptionsForLanguageSelect();
    const language = this.state.language;
    let selectedOption = options.find(option => option.key === language);
    if (!selectedOption) {
      selectedOption = options[0];
    }

    return (
      <ReactSelect
        className='plain-text-field__language'
        onChange={this.onLanguageChanged}
        options={options}
        value={selectedOption}
        disabled={options.length < 1}
        clearable={false}
      />
    );
  }

  private getOptionsForLanguageSelect() {
    const availableLanguages = this.props.languages ? [...this.props.languages] : [];

    const rdfNode = FieldValue.asRdfNode(this.props.value);
    if (rdfNode && Rdf.isLiteral(rdfNode) && rdfNode.language) {
      if (availableLanguages.indexOf(rdfNode.language) < 0) {
        availableLanguages.unshift(rdfNode.language);
      }
    }

    const options = availableLanguages.map(language => ({
      key: language,
      label: language,
    }));
    if (!this.props.requireLanguage) {
      options.unshift({key: '', label: '\u2014'});
    }

    return options;
  }

  private onLanguageChanged: OnChangeSingleHandler<string> = option => {
    const {value, definition} = this.props;
    const text = this.state.text;
    this.setState({text, language: option.key});
    if (!FieldValue.isEmpty(this.props.value)) {
      // create new value only if there was an old value
      this.setAndValidate(amendValue(value, definition, text, option.key));
    }
  }

  private createDefaultPlaceholder(definition: FieldDefinition): string {
    return `Enter ${(getPreferredLabel(definition.label) || 'value').toLocaleLowerCase()} here...`;
  }

  static makeHandler = AtomicValueInput.makeAtomicHandler;
}

function deriveStateFromProps(props: PlainTextInputProps, state: State) {
  const rdfNode = FieldValue.asRdfNode(props.value);
  return {
    text: rdfNode ? rdfNode.value : '',
    language: rdfNode ? getLanguageFromNode(rdfNode) : state.language,
  };
}

function getLanguageFromNode(node: Rdf.Node): string | undefined {
  if (!(node && Rdf.isLiteral(node))) { return undefined; }
  return node.language ? node.language : undefined;
}

function amendValue(
  base: EmptyValue | AtomicValue,
  definition: FieldDefinition,
  text: string,
  language: string
): AtomicValue | EmptyValue {
  if (text.length === 0) {
    return FieldValue.empty;
  }

  let datatype = definition.xsdDatatype || vocabularies.xsd._string;
  if (!language && XsdDataTypeValidation.sameXsdDatatype(datatype, vocabularies.rdf.langString)) {
    // Replace rdf:langString -> xsd:string if no language specified
    datatype = vocabularies.xsd._string;
  }

  let value: Rdf.Node;
  if (language) {
    value = Rdf.langLiteral(text, language);
  } else if (XsdDataTypeValidation.sameXsdDatatype(datatype, vocabularies.xsd.anyURI)) {
    value = Rdf.iri(text);
  } else {
    value = Rdf.literal(text, datatype);
  }

  return AtomicValue.set(base, {value});
}

function getTextAreaStyle(style: ValidationStyle): React.CSSProperties {
  switch (style) {
    case 'success': return {borderColor: '#43ac6a'};
    case 'warning': return {borderColor: '#e99002'};
    case 'error':   return {borderColor: '#d32a0e'};
    default: return {};
  }
}

SingleValueInput.assertStatic(PlainTextInput);

export default PlainTextInput;
