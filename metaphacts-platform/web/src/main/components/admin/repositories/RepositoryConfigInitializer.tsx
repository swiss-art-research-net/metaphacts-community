/*
 * Copyright (C) 2015-2019, metaphacts GmbH
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
import { Alert } from 'react-bootstrap';
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
      return <Alert bsStyle='info'> {loadingError} </Alert>;
    }
    return (
      <div data-flex-layout='row top-center'>
        <div className={styles.editorArea}>
            <h2>Please configure the default repository</h2>
            <p>There is no configuration for the default repository in the system.
             Please set the configuration of the repository you would like to use
             as the system default one and restart the platform.
             The configuration has to be expressed in the RDF Turtle format.
             You can select a template for some of the commonly used repository types.</p>
             <Alert bsStyle='info'>
                In the template, please replace all placeholders marked with {'{'}% and %{'} '}
                with your actual values.
             </Alert>
          {
           <RepositoryConfigEditor id='default'
                repositoryTemplates={repositoryTemplates}
                showRestartPrompt={ true }
                preselectedTemplate='sparql'/>
          }
        </div>
      </div>
    );
  }
}

export default RepositoryConfigInitializer;
