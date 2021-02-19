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
import { debounce } from 'lodash';

import { Rdf } from 'platform/api/rdf';

import { TemplateItem } from 'platform/components/ui/template';

import {
  FieldState, FieldError, FieldValue, EmptyValue, AtomicValue, CompositeValue,
} from '../FieldValues';
import { StaticComponent, StaticComponentProps } from './StaticComponent';

interface SemanticFormTemplateConfig {
  /**
   * Template which accepts form state as data context.
   *
   * @mpSeeResource {
   *   "name": "Client-side templating",
   *   "iri": "http://help.metaphacts.com/resource/FrontendTemplating"
   * }
   */
  template: string;
  /**
   * Debounce interval to wait after form change before updating the component.
   *
   * If equal to `0` the update will happen immediately.
   *
   * @default 0
   */
  debounce?: number;
}

interface SemanticFormTemplateTemplateData {
  model: CompositeData;
}

export interface FormTemplateProps extends SemanticFormTemplateConfig, StaticComponentProps {}

interface State {
  templateData?: SemanticFormTemplateTemplateData;
}

export class FormTemplate extends StaticComponent<FormTemplateProps, State> {
  private onModelChanged: () => void;
  private disposeDebounce: (() => void) | undefined;

  constructor(props: FormTemplateProps, context: any) {
    super(props, context);
    this.state = {
      templateData: FormTemplate.recomputeTemplateData(this.props),
    };
  }

  componentDidMount() {
    const {debounce: debounceInterval = 0} = this.props;
    this.onModelChanged = () => {
      const templateData = FormTemplate.recomputeTemplateData(this.props);
      this.setState({templateData});
    };
    if (debounceInterval > 0) {
      const debounced = debounce(this.onModelChanged, debounceInterval);
      this.onModelChanged = debounced;
      this.disposeDebounce = () => debounced.cancel();
    }
  }

  componentDidUpdate(prevProps: FormTemplateProps) {
    if (this.props.model !== prevProps.model) {
      this.onModelChanged();
    }
  }

  componentWillUnmount() {
    this.disposeDebounce?.();
  }

  private static recomputeTemplateData(
    props: FormTemplateProps
  ): SemanticFormTemplateTemplateData | undefined {
    const {model} = props;
    if (model && FieldValue.isComposite(model)) {
      return {
        model: transformFieldValueForTemplate(model) as CompositeData,
      };
    } else {
      return undefined;
    }
  }

  render() {
    const {template} = this.props;
    const {templateData} = this.state;
    if (!templateData) {
      return null;
    }
    return <TemplateItem template={{source: template, options: templateData}} />;
  }
}

type FieldValueData = EmptyData | AtomicData | CompositeData;

interface EmptyData {
  readonly type: 'empty';
  readonly errors: ReadonlyArray<FieldErrorData>;
}

interface AtomicData {
  readonly type: 'atomic';
  readonly node: Rdf.Node;
  readonly label?: string;
  readonly errors: ReadonlyArray<FieldErrorData>;
}

interface CompositeData {
  readonly type: 'composite';
  readonly subject: Rdf.Iri;
  readonly discriminator?: Rdf.Node;
  readonly fields: { [fieldId: string]: FieldStateData };
  readonly errors: ReadonlyArray<FieldErrorData>;
}

interface FieldStateData {
  readonly single: FieldValueData;
  readonly values: ReadonlyArray<FieldValueData>;
  readonly errors: ReadonlyArray<FieldErrorData>;
}

interface FieldErrorData {
  readonly message: string;
}

function transformFieldValueForTemplate(value: FieldValue): FieldValueData {
  const errors = transformErrorsForTemplate(value.errors);
  switch (value.type) {
    case EmptyValue.type:
      return {
        type: EmptyValue.type,
        errors,
      };
    case AtomicValue.type:
      return {
        type: AtomicValue.type,
        node: value.value,
        label: value.label,
        errors,
      };
    case CompositeValue.type:
      return {
        type: CompositeValue.type,
        subject: value.subject,
        discriminator: value.discriminator,
        fields: value.fields.map(transformFieldStateForTemplate).toObject(),
        errors,
      };
  }
  FieldValue.unknownFieldType(value);
}

function transformFieldStateForTemplate(state: FieldState): FieldStateData {
  const single = FieldValue.getSingle(state.values);
  return {
    single: transformFieldValueForTemplate(single),
    values: state.values.map(transformFieldValueForTemplate),
    errors: transformErrorsForTemplate(state.errors),
  };
}

function transformErrorsForTemplate(
  errors: ReadonlyArray<FieldError>
): ReadonlyArray<FieldErrorData> {
  if (errors.length === 0) {
    return FieldError.noErrors;
  }
  return errors.map((err): FieldErrorData => ({message: err.message}));
}

export default FormTemplate;
