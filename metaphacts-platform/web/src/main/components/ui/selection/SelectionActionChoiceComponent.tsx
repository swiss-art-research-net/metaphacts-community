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
import { Component, Children, ReactNode, cloneElement, ReactElement, SyntheticEvent } from 'react';
import { DropdownButton } from 'react-bootstrap';
import * as _ from 'lodash';
import { Event, listen } from 'platform/api/events';
import { Cancellation } from 'platform/api/async';
import { SelectionEvents } from 'platform/components/ui/selection';
import { SelectionGroupContext, SelectionGroupContextTypes } from './SelectionGroupComponent';

interface Props {
  /**
   * id prop is required to make dropdown available to screen reader software
   */
  id: string,

  /**
   * Action group name
   */
  selection: string

  /**
   * Dropdown caption
   */
  title: string

  /**
   * CSS style
   */
  style?: any

  /**
   * CSS class
   */
  className?: string
}

interface State {
  values?: { [tag: string]: boolean; };

  open?: boolean;
}

export class SelectionActionChoiceComponent extends Component<Props, State> {
  private cancellation = new Cancellation();

  static contextTypes = SelectionGroupContextTypes;
  context: SelectionGroupContext;

  constructor(props: Props, context: any) {
    super(props, context);
    this.state = {
      values: {},
      open: false,
    };
  }

  componentDidMount() {
    this.cancellation.map(
      listen({
        eventType: SelectionEvents.Toggle,
        target: this.props.selection,
      })
    ).onValue(this.onSelectionChange);
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (this.state.values !== prevState.values && this.context.onChange) {
      this.context.onChange(this.state.values);
    }
  }

  componentWillUnmount() {
    this.cancellation.cancelAll();
  }

  onSelectionChange = (event: Event<any>) => {
    const data = event.data;
    this.setState((prevState: State): State =>
      ({values: {...prevState.values, [data.tag]: data.value}})
    );
  }

  render() {
    return this.renderTypeSelector();
  }

  private renderTypeSelector = () => {
    const selection = (_.toPairs(this.state.values) as [string, boolean][])
      .filter((pair) => pair[1])
      .map(([key, value]) => key);
    const {style, title, children} = this.props;
    return <DropdownButton
      id={this.props.id}
      disabled={_.isEmpty(this.state.values) ||
                _.every(this.state.values, val => val === false)}
      open={this.state.open}
      onToggle={this.onDropdownToggle}
      style={style}
      title={title}
    >
      {Children.map(children, child =>
        cloneElement(child as ReactElement<any>, {selection, closeMenu: this.closeMenu})
      )}
    </DropdownButton>;
  }

  private closeMenu = () => {
    this.setState({open: false});
  }

  private onDropdownToggle = (isOpen: boolean) => {
    this.setState({open: isOpen});
  }
}
export default SelectionActionChoiceComponent;
