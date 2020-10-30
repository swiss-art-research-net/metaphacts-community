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
/**
 * @author Philip Polkovnikov
 */

import * as React from 'react';
import { Component } from 'react';
import { trigger } from 'platform/api/events';
import { Cancellation } from 'platform/api/async';
import { SelectionEvents } from './SelectionEvents';
import { SelectionGroupContext, SelectionGroupContextTypes } from './SelectionGroupComponent';

interface Props {
  /**
   * Name of checkbox listener
   */
  selection: string,
  /**
   * Extra data to pass to listener, so that it's possible to
   * figure out, which of checkboxes was toggled
   */
  tag: string
  /**
   * Toggles the checkbox by default
   */
  defaultChecked?: boolean;
}

interface State {
  value: boolean
}

/**
 * Checkbox to mark rows as selected
 */
class SelectionToggleComponent extends Component<Props, State> {
  private cancellation = new Cancellation();

  static contextTypes = SelectionGroupContextTypes;
  context: SelectionGroupContext;

  constructor(props: Props, context: any) {
    super(props, context);
    this.state = {
      value: context.getSelectionValue ? context.getSelectionValue(props.tag) : false,
    };
  }

  componentDidMount() {
    if (this.props.defaultChecked) {
      this.toggleSelection();
    }
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (this.state.value !== prevState.value) {
      trigger({
        eventType: SelectionEvents.Toggle,
        source: 'SelectionToggle',
        targets: [this.props.selection],
        data: {value: this.state.value, tag: this.props.tag},
      });
    }
  }

  componentWillUnmount() {
    this.cancellation.cancelAll();
  }

  render() {
    return <input
      type='checkbox'
      checked={this.state.value}
      onChange={this.toggleSelection}
    />;
  }

  private toggleSelection = () => {
    this.setState((prevState: State): State => ({value: !prevState.value}));
  }
}

export default SelectionToggleComponent;
