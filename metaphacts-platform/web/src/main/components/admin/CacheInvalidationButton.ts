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
import { Component, createFactory, createElement } from 'react';
import * as D from 'react-dom-factories';

import * as ReactBootstrap from 'react-bootstrap';
import * as maybe from 'data.maybe';

import { invalidateAllCaches } from 'platform/api/services/cache';
import { getOverlaySystem } from 'platform/components/ui/overlay';
import { ConfirmationDialog } from 'platform/components/ui/confirmation-dialog';
import {Alert, AlertType, AlertConfig} from 'platform/components/ui/alert';

const Button = createFactory(ReactBootstrap.Button);

interface State {
  alert: Data.Maybe<AlertConfig>;
}

class InvalidateCacheButton extends Component<{}, State>  {
  constructor(props: {}) {
    super(props);
    this.state = {
      alert: maybe.Nothing<AlertConfig>()
    };
  }

  public render() {
    return D.div({}, [
      createElement(Alert, this.state.alert.map(config => config).getOrElse(
        { alert: AlertType.NONE, message: '' }
      )),
      D.div({ id: 'localStorageId', style: { display: 'none' }}, [
        createElement(Alert,
          { alert: AlertType.SUCCESS, message: 'Successfully invalidated frontend caches.' }
        ),
      ]),
      Button({
          type: 'submit',
          bsSize: 'small',
          bsStyle: 'primary',
          className: 'btn btn-default',
          onClick: this.invalidateBackendCache,
        }, 'Invalidate Backend Caches'),
        Button({
          type: 'submit',
          bsSize: 'small',
          bsStyle: 'primary',
          className: 'btn btn-default',
          onClick: this.invalidateFrontendCache,
          style: {marginLeft: '11px'}
        }, 'Invalidate Frontend Caches'),
      ]);
  }

  private invalidateFrontendCache = (): void => {
    const dialogRef = 'invalidate-frontend-cache';
    const localStorageId = document.getElementById('localStorageId');
    const onHide = () => getOverlaySystem().hide(dialogRef);
    const props = {
      message: 'Certain user specific settings (e.g. locale, language selector, ..) are stored in the browser’s cache. This action will invalidate the frontend caches for the current domain. Do you want to continue?',
      onHide,
      onConfirm: (confirm: boolean) => {
        onHide();
        if (confirm) {
          localStorageId.style.display = 'block';
          localStorage.clear();
        }
      },
    };
    getOverlaySystem().show(dialogRef,
      createElement(ConfirmationDialog, props));
  }


  private invalidateBackendCache = (): void => {
    invalidateAllCaches().onValue(
      v => this.setState({
        alert: maybe.Just({
          message: v,
          alert: AlertType.SUCCESS,
        }),
      })
    ).onError(
      e => this.setState({
        alert: maybe.Just({
          message: 'Cache invalidation failed: ' + e,
          alert: AlertType.DANGER,
        }),
      })
    );
  }
}

export type component = InvalidateCacheButton;
export const component = InvalidateCacheButton;
export const factory = createFactory(component);
export default component;
