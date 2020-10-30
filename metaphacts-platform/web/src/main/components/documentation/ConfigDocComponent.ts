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
import { Component } from 'react';
import * as D from 'react-dom-factories';
import { doc } from 'docson';
import * as _ from 'lodash';

import { JsonSchema } from './JsonSchema';
import 'docson/css/docson.css';
import './ConfigDocComponent.scss';

const box: string = require('raw-loader!./templates/box.html');
const signature: string = require('raw-loader!./templates/signature.html');

const allSchemas: { [schemaName: string]: JsonSchema } = require('platform-schemas');

interface Props {
  type: string;
  disableTransformAttributes?: boolean;
  hideRequiredLabel?: boolean;
}

type PropertyTransformer =
  (fn: (key: string, value?: any) => string) => (json: JsonSchema) => JsonSchema;

/**
 * Displays generated JSON schema for specified interface type.
 *
 * To generate a schema for any TypeScript interface, execute the following
 * command at `project/webpack` directory:
 *   `yarn run generate-schema <project-name> <interface-name>`
 *
 * @example
 * <mp-documentation type="<interface-name>"></mp-documentation>
 */
export default class ConfigDocComponent extends Component<Props, {}>  {

  private container: HTMLElement;

  componentDidMount() {
    this.renderDocson(allSchemas[this.props.type]);
  }

  private renderDocson = (jsonSchema: JsonSchema) => {
    let renderedSchema = jsonSchema;
    if (!this.props.disableTransformAttributes) {
      renderedSchema = this.handleProperties(renderedSchema);
    }
    if (this.props.hideRequiredLabel) {
      renderedSchema = {...renderedSchema, required: []};
    }
    doc(
      this.container,
      renderedSchema,
      {box: box, signature: signature}
    );
  }

  public render() {
    return D.div(
      {},
      D.div({ref: container => this.container = container}),
      !this.props.hideRequiredLabel ?
        D.span({className: 'typingsRequiredLabel'}, '* - required') : null
    );
  }

  private transformPropertyName: PropertyTransformer = fn => json  => {
    json.properties = _.mapKeys(json.properties, (val, key: string) => fn(key));
    json.required = _.map(json.required, fn);
    json.propertyOrder = _.map(json.propertyOrder, fn);
    if (json.anyOf) {
      _.forEach(json.anyOf, ({$ref}) => {
        const refName = _.last(_.split($ref, '/'));
        json.definitions[refName] = this.transformPropertyName(fn)(json.definitions[refName]);
      });
    }
    return json;
  }

  private transformPropertyValue: PropertyTransformer = fn => json  => {
    json.properties = _.mapValues(json.properties, (val, key) => fn(key, val));
    if (json.anyOf) {
      _.forEach(json.anyOf, ({$ref}) => {
        const refName = _.last(_.split($ref, '/'));
        json.definitions[refName] = this.transformPropertyValue(fn)(json.definitions[refName]);
      });
    }
    return json;
  }


  private handleClassNameProperty = (key: string) =>
    key === 'className' ? 'class' : key

  private handleStyleValue = (key: string, value: any) => {
    if (key === 'style' && value.$ref === '#/definitions/React.CSSProperties') {
      delete value.$ref;
      value.type = 'string';
    }
    return value;
  }

  private transformJsonToHtmlAttributes = this.transformPropertyName(_.kebabCase);
  private transformClassNameAttribute = this.transformPropertyName(this.handleClassNameProperty);
  private transformStyleAttribute = this.transformPropertyValue(this.handleStyleValue);

  private handleProperties(json: JsonSchema): JsonSchema {
    let schema = json;
    schema = this.transformJsonToHtmlAttributes(schema);
    schema = this.transformClassNameAttribute(schema);
    schema = this.transformStyleAttribute(schema);
    return schema;
  }
}
