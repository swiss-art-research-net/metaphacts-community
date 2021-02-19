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
import { Accordion, Card } from 'react-bootstrap';

import { ErrorPresenter } from './ErrorPresenter';

const CLASS_NAME = 'error-notification';

interface ErrorNotificationConfig {
  title?: string;
  errorMessage?: unknown;
  className?: string;
  defaultExpanded?: boolean;
}

export interface ErrorNotificationProps extends ErrorNotificationConfig {
  children?: React.ReactNode;
}

type ErrorValue =
  | string
  | { message: string; }
  | { responseText: string }
  | { status: number; }
  | ErrorValues;

interface ErrorValues extends ReadonlyArray<ErrorValue> {}

export class ErrorNotification extends React.Component<ErrorNotificationProps, {}> {
  constructor(props: ErrorNotificationProps) {
    super(props);
  }

  componentDidMount() {
    const error = this.props.errorMessage;
    if (error && typeof error === 'object') {
      console.error(error);
    }
  }

  render() {
    const {errorMessage} = this.props;
    const isTimeout = isTimeoutError(errorMessage as ErrorValue);

    const title = this.props.title || defaultTitleForError(errorMessage as ErrorValue);
    const className = `${CLASS_NAME} ${this.props.className || ''}`;
    const errorHeader = (
      <p>
        <i className='fa fa-exclamation-triangle'
          style={{marginRight: '10px', color: 'red'}}
        />
        <span>{title}</span>
      </p>
    );

    const expanded = Boolean(isTimeout || this.props.defaultExpanded);
    return (
      <Accordion defaultActiveKey={expanded ? 'error' : undefined }>
        <Card className={className}>
          <Card.Header>
            <Accordion.Toggle eventKey='error'>{errorHeader}</Accordion.Toggle>
          </Card.Header>
          <Accordion.Collapse eventKey='error'>
            <Card.Body>
              {errorMessage
                ? <ErrorPresenter error={errorMessage} />
                : this.props.children}
            </Card.Body>
          </Accordion.Collapse>
        </Card>
      </Accordion>
    );
  }
}

function defaultTitleForError(error: ErrorValue) {
  return isTimeoutError(error)
    ? 'Request Timeout'
    : 'Error occurred! Click to see more details.';
}

function isTimeoutError(error: ErrorValue): boolean {
  if (!(error && typeof error === 'object')) { return false; }
  const {status} = error as { status: number };
  return status && status === 504;
}

export default ErrorNotification;
