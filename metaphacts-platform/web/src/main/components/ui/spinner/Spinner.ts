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
import * as classNames from 'classnames';
import { Component, CSSProperties, createFactory } from 'react';
import * as D from 'react-dom-factories';

export interface SpinnerProps {
  className?: string;
  /** Delay before spinning gear shows up. */
  spinnerDelay?: number;
  /** Delay before wait message shows up. */
  messageDelay?: number;
  style?: CSSProperties;
}

export interface SpinnerState {
  showMessage?: boolean;
  showSpinner?: boolean;
}

/**
 * Shows spinner only if something takes more than 0.5 second.
 */
export class SpinnerComponent extends Component<SpinnerProps, SpinnerState> {
  static readonly defaultProps: Partial<SpinnerProps> = {
    spinnerDelay: 500,
    messageDelay: 2000,
  };

  private showSpinnerTimeout: any;
  private showMessageTimeout: any;

  componentDidMount() {
    if (Number.isFinite(this.props.spinnerDelay)) {
      this.showSpinnerTimeout = setTimeout(
        () => this.setState({showSpinner: true}),
        this.props.spinnerDelay
      );
    }
    if (Number.isFinite(this.props.messageDelay)) {
      this.showMessageTimeout = setTimeout(
        () => this.setState({showMessage: true}),
        this.props.messageDelay
      );
    }
  }

  componentWillUnmount() {
    if (typeof this.showSpinnerTimeout !== 'undefined') {
      clearTimeout(this.showSpinnerTimeout);
    }
    if (typeof this.showMessageTimeout !== 'undefined') {
      clearTimeout(this.showMessageTimeout);
    }
  }

  constructor(props: SpinnerProps) {
    super(props);
    this.state = {
      showMessage: false,
      showSpinner: false,
    };
  }

  render() {
    return D.span(
      {
        className: classNames('system-spinner', this.props.className),
        style: this.props.style,
      },
      this.state.showSpinner ? D.i({className: 'system-spinner__icon'}) : null,
      this.state.showMessage
        ? D.span({className: 'system-spinner__message'}, 'Please wait...')
        : null,
    );
  }
}

export const Spinner = createFactory(SpinnerComponent);
export default Spinner;
