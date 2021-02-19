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
import { Component, ReactNode, ReactElement } from 'react';
import * as D from 'react-dom-factories';
import { FormattedError } from './FormattedError';

export interface ErrorPresenterProps {
  error: any;
  className?: string;
}

export class ErrorPresenter extends Component<ErrorPresenterProps, {}> {
  render() {
    if (!this.props.error) {
      return null;
    }
    return this.wrapError(this.props.error);
  }

  wrapError(error: any): ReactElement<any> {
    const response = tryExtractResponseFromError(error);
    if (response) {
      return convertLineBreaks(this.props.className, response.text);
    } else if (error instanceof FormattedError) {
      return error.formattedMessage;
    } else if (typeof error === 'object' && 'message' in error) {
      const {message} = error as { message: string };
      return convertLineBreaks(this.props.className, message);
    } else if (Array.isArray(error) && error.length > 0) {
      if (error.length === 1) {
        return this.wrapError(error[0]);
      } else {
        return D.div({className: this.props.className},
          'Multiple errors occured:',
          ...error.map(this.wrapError)
        );
      }
    } else {
      if (typeof error !== 'string') {
        error = JSON.stringify(error, undefined, 4);
      }
      return convertLineBreaks(this.props.className, error);
    }
  }
}

type ErrorResponse = { text: string; status?: number; } | undefined;

function tryExtractResponseFromError(error: any): ErrorResponse {
  if (!(error && typeof error === 'object')) { return undefined; }
  if ('status' in error && typeof error.status === 'number') {
    const response = error.response;
    let responseText: string;
    if (typeof response === 'string') {
      responseText = response;
    } else if (typeof response === 'object' && typeof response.text === 'string') {
      responseText = response.text;
    } else {
      responseText = (error.responseText || '') + ' '
        + (error.statusText || '') + ' '
        + JSON.stringify(response);
    }
    return {
      text: (error.message ? `${error.message}\n` : '') + responseText,
      status: error.status,
    };
  } else if ('message' in error && 'rawResponse' in error) {
    const {message, rawResponse} = error as { message: string; rawResponse: string; };
    return {text: `${message}\n${rawResponse}`};
  }
  return undefined;
}

function convertLineBreaks(className: string, message: string): ReactElement<any> {
  const parts = message.split('\n');
  if (parts.length === 0) { return <div className={className} />; }
  const lines: Array<ReactNode> = [parts[0]];
  for (let i = 1; i < parts.length; i++) {
    lines.push(<br />);
    lines.push(parts[i]);
  }
  return D.div({className}, ...lines);
}
