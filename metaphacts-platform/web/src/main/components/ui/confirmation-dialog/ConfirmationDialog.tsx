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
import { Modal, Button, ButtonGroup } from 'react-bootstrap';

export interface ConfirmationDialogProps {
  message: string;
  detailMessage?: string;
  confirmLabel?: string;
  /**
   * @default "primary"
   */
  confirmVariant?: 'primary' | 'danger';
  cancelLabel?: string;
  onHide: () => void;
  onConfirm: (confirm: boolean) => void;
}

export class ConfirmationDialog extends React.Component<ConfirmationDialogProps, {}> {
  render() {
    const {message, detailMessage: detailMessage, confirmLabel, confirmVariant,
      cancelLabel, onHide, onConfirm} = this.props;
    return (
      <Modal onHide={onHide} show={true}>
        <Modal.Body>
          <Modal.Title>{message}</Modal.Title>
          {detailMessage ? <div>{detailMessage}</div> : null}
        </Modal.Body>
        <Modal.Footer>
          <ButtonGroup>
            <Button variant={confirmVariant ?? 'primary'} onClick={() => onConfirm(true)}>
              {confirmLabel ?? 'Confirm'}
            </Button>
            <Button variant='secondary' onClick={() => onConfirm(false)}>
              {cancelLabel ?? 'Cancel'}
            </Button>
          </ButtonGroup>
        </Modal.Footer>
      </Modal>
    );
  }
}
