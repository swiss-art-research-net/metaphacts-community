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
import * as _ from 'lodash';

import { ErrorNotification } from 'platform/components/ui/notification';

const ERROR = '__unsafeError';
const WRAPPED_BY_CATCHER = '__wrappedByErrorCatcher';
const METHODS_TO_WRAP = [
  'componentWillMount',
  'componentDidMount',
  'componentWillReceiveProps',
  'componentWillUpdate',
  'componentDidUpdate',
  'componentWillUnmount',
];

interface WrappedComponent {
  [WRAPPED_BY_CATCHER]?: boolean;
  prototype?: {
    setState(state: any): void;
    getChildContext(): any;
    render?: Function;
    componentDidCatch?: Function;
    unstable_handleError?: Function;
  }
  getDerivedStateFromError?: Function;
}

interface WrappedComponentMethod {
  (this: any): any;
  [WRAPPED_BY_CATCHER]?: boolean
}

/**
 * Wrap component prototype functions to catch unexpected errors.
 */
function wrap(component: any) {
  return function(method: string) {
    const isMethodNotDefined =
      _.isUndefined(component.prototype) ||
      !(component.prototype.hasOwnProperty(method) && component.prototype[method]);
    if (isMethodNotDefined) {
      return;
    }

    const unsafe = component.prototype[method];
    const safe: WrappedComponentMethod = function (this: any) {
      try {
        unsafe.apply(this, arguments);
      } catch (e) {
        console.error(e);
        this.setState({[ERROR]: e});
      }
    };
    safe[WRAPPED_BY_CATCHER] = true;
    component.prototype[method] = safe;
  };
}

/**
 * Wrap react component creation functions to catch unexpected errors.
 */
function wrapComponent<F extends Function>(original: F): F {
  return function (this: any, comp: WrappedComponent) {
    if (!isClassComponent(comp) ||
      comp instanceof ErrorNotification ||
      comp[WRAPPED_BY_CATCHER] // prevent multiple wrapping
    ) {
      return original.apply(this, arguments);
    }
    comp[WRAPPED_BY_CATCHER] = true;

    if (!(comp.prototype.componentDidCatch || comp.getDerivedStateFromError)) {
      comp.prototype.componentDidCatch = defaultComponentDidCatch;
      comp.getDerivedStateFromError = defaultGetDerivedStateFromError;
    }

    const unsafeRender = comp.prototype.render;
    // Default unstable_handleError (without override) set state item
    // that leads to error message rendering
    if (!comp.prototype.unstable_handleError) {
      comp.prototype.unstable_handleError = function (e: any) {
        this.setState({[ERROR]: e});
      };
    }
    comp.prototype.render = function() {
      const error = getError(this);
      if (error !== undefined) {
        return React.createElement(ErrorNotification, {errorMessage: error});
      } else {
        try {
          return unsafeRender.apply(this);
        } catch (e) {
          console.error(e);
          return React.createElement(ErrorNotification, {errorMessage: e});
        }
      }
    };
    _.forEach(METHODS_TO_WRAP, wrap(comp));

    if (comp.prototype.getChildContext) {
      const unsafeGetChildContext = comp.prototype.getChildContext;
      comp.prototype.getChildContext = function() {
        // prevent stack overflow on error
        if (getError(this) !== undefined) { return undefined; }
        try {
          return unsafeGetChildContext.apply(this);
        } catch (e) {
          console.error(e);
          this.setState({[ERROR]: e});
          return undefined;
        }
      };
    }

    return original.apply(this, arguments);
  } as any;
}

function isClassComponent(comp: WrappedComponent) {
  return comp.prototype !== null
    && comp.prototype !== undefined
    && (comp.prototype instanceof React.Component || Boolean(comp.prototype.render));
}

function defaultGetDerivedStateFromError(error: any) {
  // Update state so the next render will show the fallback UI.
  return {[ERROR]: error};
}

function defaultComponentDidCatch(
  this: React.Component<any, any>,
  error: any,
  info: { componentStack: string }
) {
  // You can also log the error to an error reporting service
  console.error(error);
  console.error(info.componentStack);
}

function getError(componentInstance: any) {
  return componentInstance.state ? componentInstance.state[ERROR] : undefined;
}

/**
 * Wrapped versions of React.createElement and React.createFactory
 * Components created by them handle exceptions in React lifetime methods (enumerated in METHODS_TO_WRAP)
 * and display messages about exceptions if any instead of component render result
 * Also user can override unstable_handleError in order to get other desired behavior
 */
export const safeReactCreateElement = wrapComponent(React.createElement);
