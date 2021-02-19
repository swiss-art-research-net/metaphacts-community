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
import { Alert, Row, Col } from 'react-bootstrap';
import { Cancellation } from 'platform/api/async';
import { Component } from 'platform/api/components';

import { getRepositoryConfigTemplates } from 'platform/api/services/repository';
import {RepositoryConfigEditor} from './RepositoryConfigEditor';

import * as styles from './RepositoryConfigInitializer.scss';



interface State {
  readonly loadingError?: any;
  readonly repositoryTemplates?: string []
}

export class RepositoryConfigInitializer extends Component<{}, State> {
  private readonly cancellation = new Cancellation();

  constructor(props: {}, context: any) {
    super(props, context);
    this.state = {};
  }

  componentDidMount() {
    this.cancellation.map(
        getRepositoryConfigTemplates()
    ).observe({
        value: (repositoryTemplates) => this.setState({
          repositoryTemplates,
        }),
        error: loadingError => this.setState({loadingError}),
      });
  }

  componentWillUnmount() {
    this.cancellation.cancelAll();
  }

  render() {
    const {loadingError, repositoryTemplates} = this.state;

    if (loadingError) {
      return <Alert variant='info'> {loadingError} </Alert>;
    }
    return (
      <div data-flex-layout='row top-center'>
        <div className={styles.editorArea}>
            <h2>Please configure the default repository</h2>
            <p>There is no configuration for the default repository in the system.
             Please set the configuration of the repository you would like to use
             as the system default, then validate the connection and confirm with Update Config.
             The configuration has to be expressed in the RDF Turtle format.
             You can select a template for some of the commonly used repository types.</p>
            <Row>
              <Col sm={2}>
                  <b>neptune</b>
                  <p>For use with Amazon Neptune.</p>
              </Col>
              <Col sm={2}>
                  <b>stardog</b>
                  <p>For use with a Stardog repository.</p>
              </Col>
              <Col sm={2}>
                  <b>graphdb</b>
                  <p>For use with Ontotext GraphDB.</p>
              </Col>
              <Col sm={3}>
                  <b>sparql</b>
                  <p>Use with any SPARQL 1.1 compliant database endpoint where authentication is not required, e.g. Blazegraph, RDF4J.</p>
              </Col>
              <Col sm={3}>
                  <b>sparql-basic</b>
                  <p>Same as "sparql", but includes basic authentication.</p>
              </Col>

            </Row>
             <Alert variant='info'>
                In the template, please replace all placeholders marked with {'{'}% and %{'} '}
                with your actual values.
             </Alert>
          {
           <RepositoryConfigEditor id='default'
                repositoryTemplates={repositoryTemplates}
                showRestartPrompt={ true }
                reloadPageOnSuccess={ true }
                initializerMode={ true }
                preselectedTemplate='sparql'/>
          }
        </div>
      </div>
    );
  }
}

export default RepositoryConfigInitializer;
