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
import 'webvowl/deploy/js/d3.min.js';
import 'webvowl/deploy/js/webvowl.js';
import 'webvowl/deploy/js/webvowl.app.js';

import { Component, CSSProperties, createElement } from 'react';
import * as D from 'react-dom-factories';
import * as Kefir from 'kefir';
import * as request from 'platform/api/http';

import { ErrorNotification } from 'platform/components/ui/notification';

import './Vowl.scss';

const ENDPOINT = '/rest/ontologies/vowl';

const signature: string = require('raw-loader!webvowl/deploy/index.html');

interface VowlProps {
  /**
   * Full iri string of the ontology (without enclosing brackets),
   * which is used as ontology identifier
   */
  ontologyIri: string;
  /**
   * Custom styles
   */
  style?: CSSProperties;
}

export default class Vowl extends Component<VowlProps, {error?: string}>  {

  constructor(props: VowlProps) {
    super(props);
    this.state = {
      error: undefined
    };
  }

  componentWillMount() {
    if (!this.props.ontologyIri) {
      throw new Error('Configuration attribute ontology-iri must not be empty.');
    }
  }

  componentDidMount() {
    this.getVowlJson().onValue( v => {
      (window as any)['webvowl'].app().initialize(v);
    }).onError( errorMsg => this.setState({error: errorMsg}));
  }

  getVowlJson = () : Kefir.Property<string>  => {
    const req = request.get(ENDPOINT)
      .type('application/json')
      .accept('application/json')
      .query({ontologyIri: this.props.ontologyIri});
     return Kefir.fromNodeCallback<string>(
      (cb) => req.end((err, res: request.Response) => {
        cb(this.errorToString(err), res ? res.body : null);
      })
    ).toProperty();
  }

  public render() {
    if (this.state.error){
       return createElement(ErrorNotification, { errorMessage: this.state.error })
    }
    return D.div(
      { style: this.props.style,
        className: 'webvowl-import',
        dangerouslySetInnerHTML: {
              __html: signature
          }
      }
    );
  }

  private errorToString = (err: any): string => {

    if (err !== null) {
       const status = err['status'];
      if (500 === status) {
         return `Some internal server error when processing the ontology.
          Please contact your administrator.`;
      } else {
         return err.rawResponse;
      }
    }

    return null;

  }
}
