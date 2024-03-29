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

import { Cancellation } from 'platform/api/async';
import { Alert } from 'react-bootstrap';
import { TemplateItem } from 'platform/components/ui/template';
import { ErrorPresenter } from 'platform/components/ui/notification';
import { GenericRestService } from 'platform/api/services/generic-rest';
import { Component } from 'platform/api/components';
import { Spinner } from 'platform/components/ui/spinner';
import * as _ from 'lodash';

/**
 * Renders a JSON result from a GET REST request as table or
 * according to the specified handlebars template.
 *
 * **Example**:
 * ```
 * <mp-json-renderer
 *   get-url='/rest/data/rdf/namespace/getRegisteredPrefixes'
 *   template='{{> t}}'>
 *   <template id='t'>
 *     <ul>{{#each this as |e|}}<li>{{@index}} : {{e}}</li> {{/each}}</ul>
 *   </template>
 * </mp-json-renderer>
 * ```
 * With default table rendering:
 * ```
 * <mp-json-renderer
 *   get-url='/rest/data/rdf/namespace/getRegisteredPrefixes'>
 * </mp-json-renderer>
 * ```
 */
interface JsonRendererConfig {
  /**
   * A handlebars template. The json object retrieved from the getUrl
   *  will be set as handlebars context if a custom template is provided
   *  i.e. available as {{this}}.
   *
   * @default
   *  a nested tabular representation of the json object
   */
  template?: string;
  /**
   * The GET REST url, relative to the platform base url.
   */
  getUrl: string;
}

export type JsonRendererProps = JsonRendererConfig;

interface State {
  isLoading: boolean;
  data?: any;
  loadingError?: any
}

export class JsonRenderer extends Component<JsonRendererProps, State> {
  private readonly cancellation = new Cancellation();

  constructor(props: JsonRendererProps, state: State) {
    super(props, state);
    this.state = {
      isLoading: true
    };
  }

  public render() {
    const {loadingError, isLoading, data} = this.state;
    const {getUrl, template} = this.props;
    if (loadingError) {
      return <Alert variant='warning'>
        <ErrorPresenter error={loadingError} />
      </Alert>;
    }
    if (isLoading) {
        return <Spinner />;
      }
    if (template && data) {
      return <TemplateItem template={
        {
          source: template,
          options: data ,
        }
      } />;
    }

    return this.renderData(this.state.data, getUrl);
  }

  componentWillUnmount() {
    this.cancellation.cancelAll();
  }

  public componentDidMount() {
    const  {getUrl} = this.props;
    this.cancellation.map(GenericRestService.getJson(getUrl)).observe({
      value: value => {
        this.setState({
          isLoading: false,
          data: value,
        });
      },
      error: error => {
        this.setState({
          isLoading: false,
          loadingError: error
        });
      }
    });
  }

  private renderData = (data: {}, dataKey: string|number): React.ReactNode => {
    if (isPrimitive(data)) {
      return (data !== (undefined || null)
        ? <span key={data.toString()}>{data.toString()}</span>
        : <span></span>);
    }
    if (Array.isArray(data)) {
      return this.renderArray(data, dataKey);
    }
    return this.renderObject(data, dataKey);
  }

  private renderArray = (data: any[], arrayKey: string|number): React.ReactNode => {
    if (data.length === 0) {
      return null;
    }

    // we check whether the array of is of flat objects / primitives only,
    // i.e. _.some checks whether function / predicate return true for element in the array
    if (data.every(isPrimitive)) {
      return data.map(obj => this.renderData(obj, arrayKey));
    }

    // get unique list of keys
    const keySet = new Set<string>();
    for (const item of data) {
      Object.keys(item).forEach(key => keySet.add(key));
    }
    const keys = Array.from(keySet);
    return (
      <table key={`${arrayKey}-table`}>
        <thead>
          <tr>
            <th>#</th>
            {keys.map(key => (
              <th key={key}>{_.startCase(key)}</th>
            ))}
          </tr>
          </thead>
        <tbody>
          {data.map((object, i) => (
            <tr key={`${arrayKey}-row-${i}`}>
              <td key={`${arrayKey}-column-key-${i}`}>{i}</td>
              {keys.map(key => (
                <td key={`${arrayKey}-column-value-${i}-${key}`}>
                  {this.renderData(object[key], i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  private renderObject = (data: any, objectKey: string|number) => {
    return (<table key={`${objectKey}-table`}>
      <tbody>
        {Object.keys(data).map(key => (
          <tr key={`${objectKey}-row-${key}`}>
            <td key={`${objectKey}-column-key-${key}`}>
              {key}
            </td>
            <td key={`${objectKey}-column-value-${key}`}>
              {this.renderData(data[key], `${objectKey}-column-nested-value-${key}`)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>);
  }
}

function isPrimitive(val: any) {
  if (typeof val === 'object') {
    return val === null;
  }
  return typeof val !== 'function';
}

export default JsonRenderer;
