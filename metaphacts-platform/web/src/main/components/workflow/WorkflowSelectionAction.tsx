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

import { Component, ComponentContext } from 'platform/api/components';
import { listen } from 'platform/api/events';
import { Cancellation } from 'platform/api/async';
import { isValidChild, componentHasType, universalChildren } from 'platform/components/utils';
import {
  SelectionEvents, SelectionGroupContext, SelectionGroupContextTypes,
} from 'platform/components/ui/selection';

import { WorkflowManagerComponent } from './WorkflowManagerComponent';

/**
 * Listens to the `Components.Selection.Toggle` event, collects selected
 * workflow instantiations and propagates them to the `<mp-workflow-manager>` component.
 *
 * **Example**:
 * ```
 * <mp-selection-group>
 *   <!-- checkbox -->
 *   <mp-selection-toggle selection='workflow-instantiations-selection'
 *     tag='http://example.com/workflow/instantiation'>
 *   </mp-selection-toggle>
 *
 *   <!-- workflow manager -->
 *   <mp-workflow-selection-action selection="workflow-instantiations-selection">
 *     <mp-workflow-manager definition='http://example.com/workflow/definition'>
 *     </mp-workflow-manager>
 *   </mp-workflow-selection-action>
 * </mp-selection-group>
 * ```
 */
interface WorkflowSelectionActionConfig {
  /**
   * Identifier
   */
  selection: string;
}

export interface WorkflowSelectionActionProps extends WorkflowSelectionActionConfig {}

interface State {
  values?: { [tag: string]: boolean };
}

export class WorkflowSelectionAction extends Component<WorkflowSelectionActionProps, State> {
  private readonly cancellation = new Cancellation();

  static contextTypes = {
    ...Component.contextTypes,
    ...SelectionGroupContextTypes,
  };
  context: ComponentContext & SelectionGroupContext;

  constructor(props: WorkflowSelectionActionProps, context: any) {
    super(props, context);
    this.state = {
      values: {},
    };
  }

  componentDidMount() {
    this.cancellation.map(
      listen({
        eventType: SelectionEvents.Toggle,
        target: this.props.selection,
      })
        // batch selections
        .bufferWithTimeOrCount(300, 100)
        .filter(events => events.length > 0)
    ).onValue(events =>
      this.setState((prevState): State => {
        const values: { [tag: string]: boolean } = {};
        events.forEach(({data}) =>
          values[data.tag] = data.value
        );
        return {values: {...prevState.values, ...values}};
      })
    );
  }

  componentDidUpdate(prevProps: WorkflowSelectionActionProps, prevState: State) {
    if (this.state.values !== prevState.values && this.context.onChange) {
      this.context.onChange(this.state.values);
    }
  }

  componentWillUnmount() {
    this.cancellation.cancelAll();
  }

  private mapChildren(children: React.ReactNode): React.ReactNode {
    return universalChildren(React.Children.map(children, child => {
      if (isValidChild(child)) {
        if (componentHasType(child, WorkflowManagerComponent)) {
          const {values} = this.state;
          const selectedValues = Object.keys(values).filter(iri => values[iri]);
          return React.cloneElement(child, {iris: selectedValues});
        }
        if (child.props.children) {
          return React.cloneElement(child, {}, this.mapChildren(child.props.children));
        }
      }
      return child;
    }));
  }

  render() {
    return this.mapChildren(this.props.children);
  }
}

export default WorkflowSelectionAction;
