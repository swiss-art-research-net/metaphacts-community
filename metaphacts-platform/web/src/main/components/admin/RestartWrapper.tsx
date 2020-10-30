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
import * as Kefir from 'kefir';
import { Alert } from 'react-bootstrap';
import { Cancellation, requestAsProperty } from 'platform/api/async';
import { addNotification, ErrorPresenter } from 'platform/components/ui/notification';
import * as request from 'platform/api/http';
import { ConfirmationDialog } from 'platform/components/ui/confirmation-dialog';
import { getOverlaySystem } from 'platform/components/ui/overlay';

/**
 * @example
 * <mp-restart-wrapper>
 *  <Button><i class="fa fa-power-off fa-5x" aria-hidden="true"></i></Button>
 * </mp-restart-wrapper>
 */
export class RestartWrapper extends React.Component {
  private readonly cancellation = new Cancellation();

  private onClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    showRestartConfirmationDialog(restart => {
      if (restart) {
        this.cancellation.map(
          this.executePost()
        ).observe({
          value: iri => {
            addNotification({
              autoDismiss: 57,
              message: 'System is restarting. Please reload the page and log in again when the system has restarted.',
              level: 'success',
          });
          },
          error: error => {
            addNotification({
              message: 'Restarting failed.',
              level: 'error',
            });
          },
        });
      }
    });
  }

  private executePost(): Kefir.Property<void> {
    const req = request.post('/rest/admin/system/restart');
    return requestAsProperty(req).map(() => { return undefined; });
  }

  componentWillUnmount() {
    this.cancellation.cancelAll();
  }

  render() {
    return <div className='mp-restart-wrapper'>
      {this.renderBody()}
    </div>;
  }

  private renderBody() {
    const {children} = this.props;
    const childrenNumber = React.Children.count(children);
    if (childrenNumber !== 1) {
      return <Alert bsStyle='warning'>
        <ErrorPresenter error={new Error(
          `Expected children number is 1, but provided ${childrenNumber}`
        )}/>
      </Alert>;
    }

    const child = React.Children.only(children);
    if (typeof child === 'object') {
      const childComponent = child as React.ReactElement<any>;
      return React.cloneElement(childComponent, {...childComponent.props, onClick: this.onClick});
    } else {
      return child;
    }
  }
}

export default RestartWrapper;

function showRestartConfirmationDialog(execute: (b: boolean) => void) {
  const dialogRef = 'mp-restart-confirmation-dialog';
  const onHide = () => getOverlaySystem().hide(dialogRef);
  getOverlaySystem().show(
    dialogRef,
    <ConfirmationDialog
      message={'Are you sure you want to restart the system?'}
      onHide={onHide}
      onConfirm={confirm => {
        onHide();
        if (confirm) {
          execute(confirm);
        }
      }}
    />
  );
}
