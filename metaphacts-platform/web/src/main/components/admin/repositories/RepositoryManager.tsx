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
import * as Kefir from 'kefir';
import * as React from 'react';
import { Alert, Button } from 'react-bootstrap';
import * as classNames from 'classnames';
import * as Immutable from 'immutable';

import { Cancellation } from 'platform/api/async';
import { Component } from 'platform/api/components';

import { Spinner } from 'platform/components/ui/spinner';
import { getRepositoryStatus,
  getRepositoryConfigTemplates
} from 'platform/api/services/repository';

import * as styles from './RepositoryManager.scss';

import {RepositoryConfigEditor} from './RepositoryConfigEditor';

interface State {
  readonly repositories?: Immutable.Map<string, boolean>;
  readonly loadingError?: any;
  readonly repositoryToEdit?: string;
  readonly repositoryTemplates?: string []
}

export class RepositoryManager extends Component<{}, State> {
  private readonly cancellation = new Cancellation();

  constructor(props: {}, context: any) {
    super(props, context);
    this.state = {};
  }

  componentDidMount() {
    this.cancellation.map(
        Kefir.combine({
          repositories: getRepositoryStatus(),
          repositoryTemplates: getRepositoryConfigTemplates(),
      })
    ).observe({
        value: ({repositories, repositoryTemplates}) => this.setState({
          repositories,
          repositoryTemplates,
        }),
        error: loadingError => this.setState({loadingError}),
      });
  }

  componentWillUnmount() {
    this.cancellation.cancelAll();
  }

  render() {
    const {loadingError, repositoryToEdit, repositoryTemplates} = this.state;

    if (loadingError) {
      return <Alert variant='info'> {loadingError} </Alert>;
    }
    return (
      <div className={styles.holder} data-flex-layout='row top-center'>
        <div className={styles.RepositorySelectionArea}>
            {this.renderRepositories()}
            {repositoryToEdit && <Button
                variant='primary'
                className={styles.RepositoryButton}
                onClick={() => this.setState({repositoryToEdit: undefined})}
              >Create New </Button>
            }
        </div>
        <div className={styles.EditorArea}>
          {
           <RepositoryConfigEditor id={repositoryToEdit} repositoryTemplates={repositoryTemplates}/>
          }
        </div>
      </div>
    );
  }

  renderRepositories = () => {
    const {repositories, repositoryToEdit} = this.state;
    if (!repositories) {
        return <Spinner/>;
    }
    const rows = repositories
      .sortBy((status, id) => id.toLowerCase())
      .map((status, id) => {
      const rowCls = {
        [styles.RepositoryRow]: true,
        [styles.RepositoryRowActive]: id === repositoryToEdit,
      };
      const statusCls = status ? styles.online : styles.offline;

      return <tr
        className={classNames(rowCls)}
        onClick={() => this.onEditRepository(id)}>
          <td>{id}</td>
          <td>
            <span className={classNames(statusCls)}></span>
          </td>
        </tr>;
    }).toArray();

    return <table className='table table-striped'>
      <thead>
        <tr>
          <th>Repository ID</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows}
      </tbody>
     </table>;

  }

  onEditRepository = (id: string) => {
    this.setState({
      repositoryToEdit: id,
    });
  }
}

export default RepositoryManager;
