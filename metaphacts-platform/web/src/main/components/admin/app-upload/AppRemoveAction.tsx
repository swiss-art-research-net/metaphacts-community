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
import { Button } from 'react-bootstrap';
import * as request from 'platform/api/http';
import { Component } from 'platform/api/components';
import { Cancellation, requestAsProperty } from 'platform/api/async';
import { refresh } from 'platform/api/navigation';
import { getOverlaySystem, OverlayDialog } from 'platform/components/ui/overlay';
import { Alert, AlertConfig, AlertType } from 'platform/components/ui/alert';
import { ErrorPresenter, addNotification } from 'platform/components/ui/notification';
import { RestartWrapper } from 'platform/components/admin/RestartWrapper';

interface State {
    error: AlertConfig | undefined;
}

export const REST_ENDPOINT = '/rest/admin/apps';
export const DELETE_CONFIRMATION_DIALOG_REF = 'confirm-app-deleting';
export const RESTART_CONFIRMATION_DIALOG_REF = 'confirm-platform-restarting';

export interface AppRemoveActionProps {
  applicationId: string;
}

/**
 * Allow user to remove applications using platforms UI.
 * @example
 *  <mp-app-remove application-id="{{id}}">
 *    <button class="btn btn-danger btn-sm">Remove</button>
 *  </mp-app-remove>
*/
export class AppRemoveAction extends Component<AppRemoveActionProps, State> {
  public static defaultProps = {
    postAction: 'reload',
  };
  private cancellation = new Cancellation();

  constructor(props: AppRemoveActionProps, context: any) {
      super(props, context);
      this.state = {error: undefined};
  }

  private restartSystem = (): void => {
    this.cancellation.cancelAll();
    this.cancellation = new Cancellation();
    this.cancellation.map(
      requestAsProperty(request.post('/rest/admin/system/restart'))
    ).observe({
      value: iri => {
        this.hideRestartConfirmationDialog();
        addNotification({
          autoDismiss: 57,
          message: 'System is restarting. Please reload the page and log in again when the system has restarted.',
          level: 'success',
      });
      },
      error: error => {
        this.hideRestartConfirmationDialog();
        addNotification({
          message: 'Restarting failed.',
          level: 'error',
        });
      },
    });
  }

  private removeApp = (): void => {
    this.setState({error: undefined});
    const req = request.delete(
      `${REST_ENDPOINT}/${this.props.applicationId}`
    );
    this.cancellation.cancelAll();
    this.cancellation = new Cancellation();
    this.cancellation.map(requestAsProperty(req)).observe({
      value: () => {
        this.hideRemoveConfirmationDialog();
        this.openRestartConfirmationDialog();
      },
      error: (error: Error) => {
        this.hideRemoveConfirmationDialog();
        this.setState((): State => {
          return {
              error: {
                  alert: AlertType.WARNING ,
                  message: error.message,
                  children: <ErrorPresenter error={error} />
              },
          };
      });
      }
    });
  }

  private openRemoveConfirmationDialog = (): void => {
    getOverlaySystem().show(
      DELETE_CONFIRMATION_DIALOG_REF,
      React.createElement(OverlayDialog, {
        show: true,
        title: 'Remove application',
        onHide: this.hideRemoveConfirmationDialog,
        children: <div>
          <p>
            Are you sure you want to remove the application ‘{this.props.applicationId}'?
            <br/><br/>
            This will irrevocably delete all application content provided by the app.
            It is highly recommended to create a backup.
            <br/><br/>
            Note: the removal of the app does not delete any data that has been loaded 
            into a repository (e.g. LDP assets will remain as RDF in the <i>assets</i> 
            repository).
            <br/><br/>
            Do you want to continue?
          </p>
          <Button bsStyle='danger' onClick={this.removeApp}>Yes</Button>
          <Button bsStyle='default' onClick={this.hideRemoveConfirmationDialog}>No</Button>
        </div>,
      })
    );
  }

  private openRestartConfirmationDialog = (): void => {
    getOverlaySystem().show(
      RESTART_CONFIRMATION_DIALOG_REF,
      React.createElement(OverlayDialog, {
        show: true,
        title: 'Do you want to restart the platform',
        onHide: this.hideRestartConfirmationDialog,
        children: <div>
          <p>
            The application has been removed.
            <br></br>
            In order to complete the removal, a restart of the platform is required.
          </p>
          <Button bsStyle='primary' onClick={this.restartSystem}>Restart Now</Button>
          <Button bsStyle='default' onClick={this.hideRestartConfirmationDialog}>Close</Button>
        </div>,
      })
    );
  }

  hideRemoveConfirmationDialog = () => getOverlaySystem().hide(DELETE_CONFIRMATION_DIALOG_REF);
  hideRestartConfirmationDialog = () => getOverlaySystem().hide(RESTART_CONFIRMATION_DIALOG_REF);

  componentWillUnmount() {
      this.cancellation.cancelAll();
  }

  render() {
    const child = React.Children.only(this.props.children) as React.ReactElement<any>;
    const props = {
      onClick: this.openRemoveConfirmationDialog,
    };
    const {error} = this.state;
    return <div>
      {React.cloneElement(child, props)}
      {error ? <Alert {...error} /> : null}
    </div>;
  }
}

export default AppRemoveAction;
