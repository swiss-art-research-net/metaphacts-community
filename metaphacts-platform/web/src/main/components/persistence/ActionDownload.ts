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
import { createFactory, Children } from 'react';
import * as D from 'react-dom-factories';
import * as ReactBootstrap from 'react-bootstrap';

import { Component } from 'platform/api/components';
import { SparqlUtil } from 'platform/api/sparql';
import { factory as SparqlDownload } from 'platform/components/semantic/results/SparqlDownloadComponent';

const Button = createFactory(ReactBootstrap.Button);


interface Props {
  /**
   * Component to get query prop from
   */
  component?: any
  /**
   * (optional) result mime type header
   */
  header?: SparqlUtil.ResultFormat
  /**
   * (optional) file name
   */
  filename?: string
}

interface State {
  header?: SparqlUtil.ResultFormat
  filename?: string
}

export class ActionDownloadComponent extends Component<Props, State> {
  constructor(props: Props, context: any) {
    super(props, context);
    this.state = {};
  }

  componentDidMount() {
    this.parseQuery(this.props);
  }
  componentWillReceiveProps(props: Props) {
    this.parseQuery(props);
  }

  parseQuery(props: Props) {
    let header = props.header;
    let filename = props.filename;
    if (!header) {
      const parsedQuery = SparqlUtil.parseQuerySync(props.component.props.query);
      if (parsedQuery.type !== 'query') {
        throw 'query type is not supported, expected SELECT or CONSTRUCT';
      }
      if (parsedQuery.queryType === 'SELECT') {
        header = 'text/csv';
        filename = props.filename || 'file.csv';
      } else if (parsedQuery.queryType === 'CONSTRUCT') {
        header = 'text/turtle';
        filename = props.filename || 'file.ttl';
      }
    }
    this.setState({header, filename});
  }

  render() {
    const query = this.props.component.props.query;
    const {header, filename} = this.state;
    const child = Children.count(this.props.children) === 1 ?
      Children.only(this.props.children) :
      Button(
        {title: 'Download data'},
        D.i({className: 'fa fa-download'})
      );
    return SparqlDownload(
      {query, header, filename},
      child
    );
  }
}

export default ActionDownloadComponent;
