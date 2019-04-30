/*
 * Copyright (C) 2015-2019, metaphacts GmbH
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

import { Component, Children, ReactElement, cloneElement } from 'react';

import {
  SetManagementContextTypes, SetManagementContext, SetViewContext, SetViewContextTypes,
} from '../SetManagementApi';

/**
 * Puts active set into renaming mode.
 *
 * This action can be used only inside <mp-set-management> component templates.
 *
 * @example <mp-set-management-action-rename-set></mp-set-management-action-rename-set>
 */
export class RenameSetAction extends Component<{}, void> {
  static readonly contextTypes = {...SetManagementContextTypes, ...SetViewContextTypes};
  context: SetManagementContext & SetViewContext;

  private onClick = () => {
    this.context['mp-set-management'].startRenamingSet(
      this.context['mp-set-management--set-view'].getCurrentSet()
    );
  }

  public render() {
    const child = Children.only(this.props.children) as ReactElement<any>;
    return cloneElement(child, {onClick: this.onClick});
  }
}
export default RenameSetAction;
