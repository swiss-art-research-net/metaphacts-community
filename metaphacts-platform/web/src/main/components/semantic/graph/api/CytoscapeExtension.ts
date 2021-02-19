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
import { assign } from 'lodash';
import { Component, ComponentClass, ReactNode } from 'react';
import * as maybe from 'data.maybe';

import * as CytoscapeCore from 'cytoscape/src/core/index';

import {
  CytoscapeContext, CytoscapeContextTypes, CytoscapeApi, ContextCytoscapeApi,
} from './Context';

export interface CytoscapeExtension {
  destroy(): void;
}

export interface ExtensionContext<Options> {
  cytoscapeApi: CytoscapeApi;
  options: Options;
}

export interface InitializationFunction<Options> {
  (context: ExtensionContext<Options>): Data.Maybe<CytoscapeExtension>;
}

export interface RegistrationFunction {
  (api: ContextCytoscapeApi): void;
}


/**
 * http://js.cytoscape.org/#extensions/api
 */
export type ExtensionType = 'core' | 'collection' | 'layout' | 'renderer';

export interface ExtensionParams<Options> {
  name: string;
  type: ExtensionType;
  registrationFn: RegistrationFunction;
  initializationFn: InitializationFunction<Options>;
}

export function registerCytoscapeExtension<Options>(
  { name, registrationFn, initializationFn }: ExtensionParams<Options>
): ComponentClass<Options> {
  interface ExtensionState {
    instance: Data.Maybe<CytoscapeExtension>;
  }

  return class CytoscapeExtensionComponent extends Component<Options, ExtensionState> {

    static contextTypes = CytoscapeContextTypes;
    context: CytoscapeContext;

    constructor(props: Options, context: CytoscapeContext) {
      super(props, context);

      this.state = {
        instance: maybe.Nothing<CytoscapeExtension>(),
      };
    }

    componentDidMount() {
      this.registerExtension(this.props, this.context.cytoscapeApi);
    }

    componentWillUnmount() {
      this.state.instance.map(
        instance => {
          // for layouts, instance can be actual cytoscape instance
          // we shouldn't destroy it here
          const isCyInstance =
            this.context.cytoscapeApi.instance.map(cy => cy === instance).getOrElse(false);
          if (!isCyInstance && instance.destroy) {
            instance.destroy();
          }
        }
      );
    }

    private registerExtension(props: Options, cytoscapeApi: ContextCytoscapeApi) {
      const {instance} = cytoscapeApi;

      // quick and dirty way to check if extension has been already registered,
      // it uses non-public cytoscape API
      // maybe someday there will be better solution
      // see https://github.com/cytoscape/cytoscape.js/issues/1585
      if (!CytoscapeCore.prototype[name]) {
        registrationFn(cytoscapeApi);
      }
      instance.map(
        cy => {
          const api = assign({}, cytoscapeApi, {instance: cy}) as CytoscapeApi;
          cy.ready(this.onCytoscapeReady(api, props));
        }
      );
    }

    private onCytoscapeReady =
      (api: CytoscapeApi, options: Options) => (event: Cy.EventObject) => {
      const extensionContext = {options: options, cytoscapeApi: api};
      this.setState({
        instance: initializationFn(extensionContext),
      });
    }

    render(): ReactNode {
      return null;
    }
  };
}

export default registerCytoscapeExtension;
