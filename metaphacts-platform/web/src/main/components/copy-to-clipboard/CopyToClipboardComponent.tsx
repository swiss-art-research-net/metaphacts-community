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
import * as CopyToClipboard from 'react-copy-to-clipboard';

import { addNotification } from 'platform/components/ui/notification';

export interface Props {
  /**
   * The text that will be copied to clipboard
   */
  text: string;
  /**
   * The message that will be displayed in the notification when the text has been copied
   * @default 'The content has been copied!'
   */
  message?: string;
}

/**
 * @example
 * <mp-copy-to-clipboard text='text'>
 *     <button class='btn btn-default'>
 *         <i class='fa fa-copy'></i>
 *     </button>
 * </mp-copy-to-clipboard>
 */
export class CopyToClipboardComponent extends React.Component<Props, {}> {
  static defaultProps = {
    message: 'The content has been copied!',
  };

  private onCopy = () => {
    addNotification({
      level: 'success',
      message: this.props.message,
    });
  }

  render() {
    return (
      <CopyToClipboard text={this.props.text} onCopy={this.onCopy}>
        {this.props.children}
      </CopyToClipboard>
    );
  }
}

export default CopyToClipboardComponent;
