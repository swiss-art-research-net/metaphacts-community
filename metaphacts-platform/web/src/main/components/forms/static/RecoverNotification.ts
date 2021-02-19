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
import * as D from 'react-dom-factories';
import * as assign from 'object-assign';

import { StaticComponent, StaticComponentProps } from './StaticComponent';

interface SemanticFormRecoverNotificationConfig {
  style?: React.CSSProperties;
}

export interface RecoverNotificationProps
  extends SemanticFormRecoverNotificationConfig, StaticComponentProps {
  recoveredFromStorage?: boolean;
  discardRecoveredData?: () => void;
}

const CLASS_NAME = 'semantic-form-recover-notification';

export class RecoverNotification
  extends StaticComponent<RecoverNotificationProps, { hidden?: boolean }> {

  constructor(props: RecoverNotificationProps, context: any) {
    super(props, context);
    this.state = {hidden: false};
  }

  render() {
    const showNotification = !this.state.hidden && this.props.recoveredFromStorage;
    const style = assign(
      {},
      {display: showNotification ? undefined : 'none'},
      this.props.style
    );

    return D.div(
      {
        className: CLASS_NAME,
        style: style,
      },
      D.div({className: `${CLASS_NAME}__message`},
        D.b({}, 'Form data has been recovered from browser storage!')
      ),
      D.button(
        {
          type: 'button',
          className: `${CLASS_NAME}__hide btn btn-secondary btn-sm`,
          onClick: () => this.setState({hidden: true}),
          title: 'Hide notification',
        },
        D.i({id: 'hide-i', className: 'fa fa-check'}),
        D.span({id: 'hide-span'}, ' Ok. Hide Notification.')
      ),
      D.button(
        {
          className: `${CLASS_NAME}__discard-data btn btn-secondary btn-sm `,
          onClick: this.props.discardRecoveredData,
          title: 'Reset form to default state discarding all recovered data',
        },
        D.i({id: 'discard-i', className: 'fa fa-times'}),
        D.span({id: 'discard-span'}, ' Discard recovered data.')
      )
    );
  }
}

export default RecoverNotification;
