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
import * as Kefir from 'kefir';

import { ConfigHolder } from 'platform/api/services/config-holder';
import { Util as SecurityService } from 'platform/api/services/security';

import { hasComponent } from './ComponentsStore';

export function isComponentBasedSecurityEnabled() {
  return ConfigHolder.getUIConfig().enableUiComponentBasedSecurity;
}

const LOADED_PERMISSIONS = new Map<string, boolean>();

export function loadPermittedComponents(
  components: ReadonlySet<string>
): Kefir.Property<Set<string>> {
  if (!isComponentBasedSecurityEnabled() || components.size === 0) {
    return Kefir.constant(new Set<string>(components));
  }
  const permittedComponents = new Set<string>();
  const tasks: Kefir.Property<void>[] = [];
  components.forEach(tagName => {
    if (!hasComponent(tagName)) {
      return;
    }
    const permissionString = 'ui:component:view:' + tagName.replace(/-/g, ':');
    const task = SecurityService.isPermitted(permissionString).map(permitted => {
      LOADED_PERMISSIONS.set(tagName, permitted);
      if (permitted) {
        permittedComponents.add(tagName);
      }
    });
    tasks.push(task);
  });
  return Kefir.zip(tasks).map(() => permittedComponents).toProperty();
}

/**
 * With default platform configuration all component are enabled by default
 * one need to explicitly enable security check for components in ui.prop
 */
export function isComponentPermittedSync(componentName: string): boolean {
  if (!(isComponentBasedSecurityEnabled() && hasComponent(componentName))) {
    return true;
  }
  if (!LOADED_PERMISSIONS.has(componentName)) {
    throw new Error(
      `Cannot synchronously check if component is permitted as the info is not preloaded: ` +
      `<${componentName}>`
    );
  }
  return LOADED_PERMISSIONS.get(componentName);
}

