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
import { Component, Children, ReactElement, cloneElement } from 'react';
import { Button, ButtonToolbar } from 'react-bootstrap';

import {
  SetManagementContextTypes, SetManagementContext,
  SetViewContext, SetViewContextTypes,
} from '../SetManagementApi';

interface Props {
  /**
   * When component is used inside react-bootstrap dropdown, we want to close the dropdown
   * when user cancels remove action, and this onSelect function passed from the
   * parent dropdown is what we can use for that purpose.
   */
  onSelect?: () => void;
}

interface State {
  showConfirmation?: boolean;
  isRemoving?: boolean;
}


/**
 * Removes currently active set from the system.
 *
 * This action can be used only inside <mp-set-management> component templates.
 *
 * @example <mp-set-management-action-remove-set></mp-set-management-action-remove-set>
 */
export class RemoveSetAction extends Component<Props, State> {
  public static contextTypes = {...SetManagementContextTypes, ...SetViewContextTypes};
  context: SetManagementContext & SetViewContext;

  private confirmationRef: HTMLElement;
  constructor(props: Props, context: any) {
    super(props, context);
    this.state = {
      showConfirmation: false,
      isRemoving: false,
    };
  }

  componentWillUnmount() {
    document.body.removeEventListener('click', this.handleClickOutside);
  }

  private onClick = (e: React.MouseEvent<unknown>) => {
    if (!this.state.showConfirmation) {
      this.setState({showConfirmation: true});
      document.body.addEventListener('click', this.handleClickOutside);
      e.stopPropagation();
    }
  }

  private onYesClick = () => {
    this.setState({isRemoving: true});
    this.context['mp-set-management'].removeSet(
      this.context['mp-set-management--set-view'].getCurrentSet()
    );
  }

  private onNoClick = () => {
    this.setState({showConfirmation: false});
    if (this.props.onSelect) {
      this.props.onSelect();
    }
  }

  /**
   * Cancel action if clicked outside of the component.
   */
  private handleClickOutside = (event: MouseEvent) => {
    if (this.confirmationRef && !this.confirmationRef.contains(event.target as Node)) {
      this.setState({showConfirmation: false});
    }
  }

  public render() {
    const child = Children.only(this.props.children) as ReactElement<any>;
    const props = {onClick: this.onClick};
    if (this.state.showConfirmation) {
      return <div className='remove-set-confirmation'
                  ref={node => (this.confirmationRef = node)}>
          <span>Are you sure?</span>
          <ButtonToolbar>
            <Button variant='secondary' size='sm' onClick={this.onNoClick}>no</Button>
            <Button variant='danger' size='sm' onClick={this.onYesClick}>
             {this.state.isRemoving ? '...' : 'yes'}
            </Button>
          </ButtonToolbar>
        </div>;
    } else {
      return cloneElement(child, props);
    }
  }
}
export default RemoveSetAction;
