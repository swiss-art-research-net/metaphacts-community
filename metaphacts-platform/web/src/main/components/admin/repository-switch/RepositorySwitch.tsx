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
import { ReactNode } from 'react';
import * as Immutable from 'immutable';
import { FormControl } from 'react-bootstrap';
import * as URI from 'urijs';

import { Component } from 'platform/api/components';
import { getRepositoryStatus } from 'platform/api/services/repository';
import { Cancellation } from 'platform/api/async';

import * as styles from './RepositorySwitch.scss';

/**
 * This component occurs to change repository context for components on the current page,
 * which support listening to the semantic-context. Switch any repository from select and
 * get result for each components on the current page.
 *
 * Note: this is an internal component and not supported for general use.
 *
 * @example
 * <mp-admin-repository-switch></mp-admin-repository-switch>
 */

interface State {
  readonly repositoryStatus: Immutable.Map<string, boolean>;
  readonly currentRepository: string;
}

export class RepositorySwitch extends Component<{}, State> {
  private readonly cancellation = new Cancellation();

  constructor(props: {}, context: any) {
    super(props, context);
    this.state = {
      repositoryStatus: undefined,
      currentRepository: undefined,
    };
  }

  componentDidMount() {
    this.cancellation.map(getRepositoryStatus()).onValue(repositoryStatus => {
      const url = new URL(window.location.href);
      const currentRepository = url.searchParams.get('repository');
      if (currentRepository) {
        this.setState({repositoryStatus, currentRepository});
      } else {
        this.setState({repositoryStatus});
      }
    });
  }

  private selectRepository(event: React.ChangeEvent<HTMLSelectElement>) {
    const currentRepository = event.target.value;
    const uri = new URI(window.location.href);
    if (currentRepository) {
      uri.setQuery('repository', currentRepository);
    } else {
      uri.removeQuery('repository');
    }
    window.location.href = uri.href();
  }

  private renderRepositorySelector() {
    const {repositoryStatus, currentRepository} = this.state;
    const options: ReactNode[] = [];
    if (repositoryStatus) {
      options.push(<option key='@empty' value=''>(from context)</option>);
      repositoryStatus
        .sortBy((running, repository) => repository.toLowerCase())
        .forEach((running, repository) => {
        options.push(
          <option key={repository}
            disabled={!running}
            value={repository} >
            {repository}
          </option>
        );
      });
    } else {
      options.push(<option key='@loading' value=''>Loading...</option>);
    }
    return (
      <div className={styles.repositorySelector}>
        <div className={styles.repositoryTitle}>Repository:</div>
        <FormControl as='select'
          className={styles.repositorySelectorDropdown}
          value={currentRepository}
          onChange={(event: React.ChangeEvent<HTMLSelectElement>) => this.selectRepository(event)}>
          {options}
        </FormControl>
      </div>
    );
  }

  render() {
    return this.renderRepositorySelector();
  }
}

export default RepositorySwitch;
