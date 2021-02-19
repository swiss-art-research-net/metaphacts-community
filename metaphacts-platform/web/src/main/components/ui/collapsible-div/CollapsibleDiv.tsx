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

import { componentHasType } from 'platform/components/utils';
import { ErrorNotification } from 'platform/components/ui/notification';

import { CollapsibleDivTrigger, CollapsibleDivTriggerProps } from './CollapsibleDivTrigger';
import { CollapsibleDivContent, CollapsibleDivContentProps } from './CollapsibleDivContent';

/**
 * **Example**:
 * ```
 * <mp-collapsible-div expanded='true'>
 *   <mp-collapsible-div-trigger expanded-class="x" collapsed-class="y">
 *     <i class="fa fa-question-circle" aria-hidden="true"></i>
 *   </mp-collapsible-div-trigger>
 *   <mp-collapsible-div-content>Content</mp-collapsible-panel-content>
 * </mp-collapsible-div>
 * ```
 */
interface CollapsibleDivConfig {
  /**
   * Whether panel should be expanded by default.
   *
   * @default true
   */
  expanded: boolean;
}

export type CollapsibleDivProps = CollapsibleDivConfig;

interface State {
  expanded: boolean;
}

export class CollapsibleDiv extends React.Component<CollapsibleDivProps, State> {
  constructor(props: CollapsibleDivProps, context: any) {
    super(props, context);
    this.state = {
      expanded: this.props.expanded,
    };
  }

  render() {
    const {expanded} = this.state;

    const children = React.Children.toArray(this.props.children);
    const triggerComponent = children.find(
      (child): child is React.ReactElement<CollapsibleDivTriggerProps> =>
        componentHasType(child, CollapsibleDivTrigger)
    );
    const contentComponent = children.find(
      (child): child is React.ReactElement<CollapsibleDivContentProps> =>
        componentHasType(child, CollapsibleDivContent)
    );

    if (!(triggerComponent && contentComponent)) {
      const message =
        'Cannot find <mp-collapsible-div-trigger> or <mp-collapsible-div-content> ' +
        'for <mp-collapsible-div> component.';
      return <ErrorNotification errorMessage={message} />;
    }

    return (
      <div>
        {React.cloneElement(triggerComponent, {expanded, onClick: this.onTriggerClick})}
        {React.cloneElement(contentComponent, {expanded})}
      </div>
    );
  }

  private onTriggerClick = () => {
    const {expanded} = this.state;
    this.setState({expanded: !expanded});
  }
}

export default CollapsibleDiv;
