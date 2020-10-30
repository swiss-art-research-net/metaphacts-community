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
import * as React from 'react';
import * as _ from 'lodash';
import * as request from 'platform/api/http';
import * as Kefir from 'kefir';
import { Cancellation, requestAsProperty } from 'platform/api/async';
import { addNotification, ErrorPresenter } from 'platform/components/ui/notification';
import { Alert } from 'react-bootstrap';
import * as styles from './LoggingProfileSelector.scss';

const REST_PROFILE_URL = '/rest/admin/logs/profile';

type LoggingProfile = 'log4j2' | 'log4j2-debug' | 'log4j2-trace';

interface LoggingProfileSelectorState {
  profileError?: any;
  submittedProfile?: LoggingProfile;
  loggingProfile: LoggingProfile;
  submitting: boolean,
}

export class LoggingProfileSelector extends React.Component<{}, LoggingProfileSelectorState> {
  private readonly cancellation = new Cancellation();

  constructor(props: {}) {
    super(props);
    this.state = {
      profileError: undefined,
      submittedProfile: undefined,
      loggingProfile: 'log4j2',
      submitting: false,
    };
  }

  componentWillUnmount() {
    this.cancellation.cancelAll();
  }

  onSubmit = () => {
    this.setState({profileError: null});
    const profileToSubmit = this.state.loggingProfile;

    this.cancellation.map(
      this.executePost()
    ).observe({
      value: iri => {
        addNotification({
          message: 'Logging profile has been changed.',
          level: 'success',
        });
        this.setState({
          profileError: null,
          submittedProfile: profileToSubmit,
        });
      },
      error: error => {
        addNotification({
          message: 'Changing profile has failed.',
          level: 'error',
        });
        this.setState({profileError: error});
      },
    });
  }

  private executePost(): Kefir.Property<void> {
    const req = request.post(REST_PROFILE_URL)
      .type('form')
      .send({logprofile: this.state.loggingProfile});
    return requestAsProperty(req).map(() => { return undefined; });
  }

  render() {
    const {profileError, loggingProfile, submittedProfile, submitting} = this.state;
    const isSubmitted = loggingProfile === submittedProfile;

    return <div>
        {
          profileError ?
            <Alert bsStyle='warning'>
              <ErrorPresenter error={profileError} />
            </Alert> : null
        }
        <div>
          <select
            className={styles.adminProfileSelector}
            value={loggingProfile}
            onChange={this.onChangeProfile}>
            <option value='log4j2'>Default</option>
            <option value='log4j2-debug'>Debug</option>
            <option value='log4j2-trace'>Trace</option>
          </select>
          <button
            disabled={isSubmitted && !submitting}
            title={isSubmitted ? 'Profile is already submitted' : 'Submit  profile'}
            onClick={this.onSubmit}
          >Submit</button>
        </div>
      </div>;
  }

  protected onChangeProfile = (event: React.SyntheticEvent<HTMLSelectElement>) => {
    const value: LoggingProfile = event.currentTarget.value as any;
    this.setState({loggingProfile: value});
  }

}
export default LoggingProfileSelector;
