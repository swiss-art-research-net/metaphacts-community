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
import { ReactElement, ReactNode, ComponentClass, useState, useEffect } from 'react';
import { Cancellation } from 'platform/api/async';
import { ExtensionPoint } from 'platform/api/module-loader';

/**
 * Check if react component is a valid ReactElement element.
 * in latest html-to-react invalid node can be 'false' or 'null'.
 */
export function isValidChild(child: ReactNode): child is ReactElement<any> {
  return typeof child === 'object'
    && child !== null
    && !Array.isArray(child)
    && Boolean((child as any).type);
}

export function componentHasType<P = any>(
  child: ReactNode, type: ComponentClass<P, any>
): child is ReactElement<P> {
  return isValidChild(child) && type
    && typeof child.type === 'function'
    && typeof type === 'function'
    && hasBaseDerivedRelationship(type, child.type);
}

/**
 * Returns a human-readable name for a React child component.
 */
export function componentDisplayName(child: ReactNode) {
  if (typeof child === 'string' || typeof child === 'number') {
    return child.toString();
  } else if (isValidChild(child)) {
    if (typeof child.type === 'string') {
      return child.type;
    } else {
      type HasDisplayName = { displayName?: string; name?: string };
      return (child.type as HasDisplayName).displayName || (child.type as HasDisplayName).name;
    }
  } else {
    return undefined;
  }
}

/**
 * @returns true if class with baseConstructor is a base class of class
 *  with derivedConstructor or if classes are the same; overwise false.
 *
 * @example
 *  hasBaseDerivedRelationship(Mammal, Cat)    === true
 *  hasBaseDerivedRelationship(Dog, Dog)       === true
 *  hasBaseDerivedRelationship(Animal, Tomato) === false
 *  hasBaseDerivedRelationship(Dog, Animal)    === false
 */
export function hasBaseDerivedRelationship(baseConstructor: any, derivedConstructor: any) {
  return derivedConstructor === baseConstructor || (
    derivedConstructor.prototype &&
    derivedConstructor.prototype instanceof baseConstructor
  );
}

/**
 * Takes any {@ReactNode} children and retuns either an array or just a
 * single {@ReactElement} if the is only one child in the children array.
 * This is required to make the forms working with, for example, react-bootstrap
 * vertical tabs. See https://metaphacts.atlassian.net/browse/VD-103 and
 * https://github.com/facebook/react/issues/4424 for details.
 */
export function universalChildren(children: ReactNode): ReactNode {
 return (Array.isArray(children) && children.length === 1)
   ? children[0]
   : children;
}

export function useExtensionPoint(extensionPoint: ExtensionPoint<unknown>): boolean {
  const [loaded, setLoaded] = useState(!extensionPoint.isLoading());
  useEffect(() => {
    if (extensionPoint.isLoading()) {
      const cancellation = new Cancellation();
      extensionPoint.loadAndUpdate({
        forceUpdate: () => setLoaded(true)
      }, cancellation);
      return () => cancellation.cancelAll();
    } else if (!loaded) {
      // if it has been loaded in the meantime, just update the state
      setLoaded(true);
    }
  }, []);
  return loaded;
}
