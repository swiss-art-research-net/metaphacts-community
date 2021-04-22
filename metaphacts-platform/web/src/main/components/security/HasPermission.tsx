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
import { Component } from 'react';
import * as Kefir from 'kefir';

import { Cancellation } from 'platform/api/async';
import { Util as Security } from 'platform/api/services/security';

/**
 * Displays child component if user has the required permission; otherwise displays nothing.
 *
 * If multiple options of `permission`, `any-of` and `all-of` are provided, they all need
 * to be fulfilled.
 *
 * **Examples**:
 * ```
 * <mp-has-permission permission='delete:all:data'></mp-has-permission>
 * <mp-has-permission any-of='["data:create", "data:update"]'></mp-has-permission>
 * ```
 */
interface HasPermissionConfig {
  /**
   * Required permission key to display a child component.
   */
  permission?: string;

  /**
   * At least one of these permissions needs to be granted.
   */
  anyOf?: ReadonlyArray<string>;

  /**
   * All of these permissions need to be granted.
   */
  allOf?: ReadonlyArray<string>;
}

export type HasPermissionProps = HasPermissionConfig;

interface State {
  readonly allowedToSee?: boolean;
}

export class HasPermission extends Component<HasPermissionProps, State> {
  private readonly cancellation = new Cancellation();

  constructor(props: HasPermissionProps) {
    super(props);
    this.state = {allowedToSee: false};
  }

  componentWillMount() {
    const {permission, anyOf, allOf} = this.props;
    let permissions = permission ? [permission] : [];
    permissions = permissions.concat(anyOf ?? [], allOf ?? []);
    if (permissions.length === 0) {
      this.setState({allowedToSee: true});
    } else {
      this.cancellation.map(
        Kefir.combine(
          permissions.map(perm => Security.isPermitted(perm))
        ).takeErrors(1)
      ).observe({
        value: (result) => {
          const permissionMap = new Map<string, boolean>();
          permissions.forEach((permissionName, i) => {
            permissionMap.set(permissionName, result[i]);
          });
          this.setState({allowedToSee: this.checkPermissions(permissionMap)});
        }
      });
    }
  }

  private checkPermissions(permissions: Map<string, boolean>): boolean {
    const {permission, anyOf, allOf} = this.props;
    if (permission && !permissions.get(permission)) {
      return false;
    }
    if (anyOf && !anyOf.some(perm => permissions.get(perm))) {
      return false;
    }
    if (allOf && !allOf.every(perm => permissions.get(perm))) {
      return false;
    }
    return true;
  }

  render() {
    if (this.state.allowedToSee) {
      return this.props.children;
    } else {
      return null;
    }
  }
}

export default HasPermission;
