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
import { createElement } from 'react';
import * as Kefir from 'kefir';
import * as _ from 'lodash';

import { Rdf } from 'platform/api/rdf';
import { Component } from 'platform/api/components';
import { TemplateItem } from 'platform/components/ui/template';
import { Spinner } from 'platform/components/ui/spinner';
import { getCurrentResource } from 'platform/api/navigation';

import {
  FieldDefinitionConfig, FieldDefinitionProp, normalizeFieldDefinition,
} from './FieldDefinition';
import { queryValues } from './QueryValues';
import {SparqlBindingValue } from './FieldValues';

interface FieldBasedVisualizationConfigBase {
  /**
   * The IRI of the resource that needs to be visualized.
   */
  subject?: string;

 /**
  * Template, that gets the `fields` value with the list of field definitions
  * injected as template context.
  * [each helper](http://handlebarsjs.com/builtin_helpers.html#iteration) can be used
  * to iterate over the fields.
  *
  * Every field has corresponding metadata (label, xsdDatatype, etc.), as well as list of `values`.
  *
  * @mpSeeResource [{
  *   "name": "Client-side templating",
  *   "iri": "http://help.metaphacts.com/resource/FrontendTemplating"
  * }, {
  *   "name": "Semantic Form and Field Definitions",
  *   "iri": "http://help.metaphacts.com/resource/Help:SemanticForm"
  * }]
  */
  template: string;
}

// exported for documentation
interface FieldBasedVisualizationConfig extends FieldBasedVisualizationConfigBase {
  /**
   * Definition for fields that need to be visualized.
   *
   * @mpSeeResource {
   *   "name": "Semantic Form and Field Definitions",
   *   "iri": "http://help.metaphacts.com/resource/Help:SemanticForm"
   * }
   */
  fields: ReadonlyArray<FieldDefinitionConfig>;
}

export interface FieldBasedVisualizationProps extends FieldBasedVisualizationConfigBase {
  fields: ReadonlyArray<FieldDefinitionProp>;
}

export interface FieldDefinitionWithData extends FieldDefinitionProp {
  values: Array<SparqlBindingValue>;
}

interface State {
  fieldsData: Array<FieldDefinitionWithData>;
  isLoading: boolean
}

export class FieldBasedVisualization extends Component<FieldBasedVisualizationProps, State> {
  constructor(props: FieldBasedVisualizationProps, context: any) {
    super(props, context);
    this.state = {
      fieldsData: [],
      isLoading: false,
    };
  }

  private getSubject() {
    return this.props.subject ? Rdf.iri(this.props.subject) : getCurrentResource();
  }

  componentDidMount() {
    this.fetchFieldValues();
  }

  render() {
    return this.state.isLoading ? createElement(Spinner) : this.renderResult();
  }

  private renderResult() {
    return createElement(TemplateItem, {
      template: {
        source: this.props.template,
        options: {
          subject: this.getSubject().value,
          fields: this.state.fieldsData,
        },
      },
    });
  }

  private fetchFieldValues() {
    const {fields} = this.props;
    const subjectIri = this.getSubject();
    Kefir.combine(
      fields.map(
        normalizeFieldDefinition
      ).map(
        field => queryValues(
          field.selectPattern, subjectIri, {context: this.context.semanticContext}
        ).map(
          values => {
            const f = _.cloneDeep(field as FieldDefinitionWithData);
            f.values = _.isEmpty(values) ? null : values;
            return f;
          }
        )
      )
    ).onValue(
      values => this.setState({fieldsData: values})
    );
  }
}

export default FieldBasedVisualization;
