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
import * as Kefir from 'kefir';

import * as React from 'react';
import { ReactElement, createElement } from 'react';

import { Cancellation } from 'platform/api/async';
import { Rdf } from 'platform/api/rdf';
import { Component, SemanticContext, SemanticContextProvider } from 'platform/api/components';
import { ModuleRegistry } from 'platform/api/module-loader';
import { ldpc } from 'platform/api/services/ldp';
import { VocabPlatform } from 'platform/api/rdf/vocabularies/vocabularies';
import {
  DeserializedComponent, graphToComponent,
} from 'platform/api/persistence/ComponentPersistence';

import { ErrorNotification } from 'platform/components/ui/notification';
import { Spinner } from 'platform/components/ui/spinner';

export interface Props {
  iri: string;
}

interface State {
  readonly component?: ReactElement<any>;
  readonly componentContext?: SemanticContext;
  readonly error?: any;
}

/**
 * This component gets persisted component from DB by iri and renders it
 * @example
 *  <mp-persisted-component iri="<saved-component-iri>"></mp-persisted-component>
 */
export class PersistedComponent extends Component<Props, State> {
  private readonly cancellation = new Cancellation();

  constructor(props: Props, context: any) {
    super(props, context);
    this.state = {};
  }

  prepareComponent(iri: string) {
    this.setState({
      component: undefined,
      componentContext: undefined,
      error: undefined,
    });
    const componentIri = Rdf.iri(iri);
    this.cancellation.map(
      ldpc(VocabPlatform.PersistedComponentContainer.value).get(componentIri).flatMap(graph => {
        try {
          const {component, context} = graphToComponent(componentIri, graph);
          return Kefir.fromPromise(renderComponentTree(component))
            .map(rendered => ({rendered, context}));
        } catch (error) {
          return Kefir.constantError(error);
        }
      })
    ).observe({
      value: ({rendered, context}) => this.setState({
        component: rendered,
        componentContext: context,
      }),
      error: error => this.setState({error}),
    });
  }

  componentDidMount() {
    this.prepareComponent(this.props.iri);
  }

  componentWillReceiveProps(props: Props) {
    this.prepareComponent(props.iri);
  }

  componentWillUnmount() {
    this.cancellation.cancelAll();
  }

  render() {
    const {component, componentContext, error} = this.state;
    if (component) {
      return (
        <SemanticContextProvider {...componentContext.semanticContext}>
          {component}
        </SemanticContextProvider>
      );
    } else if (error) {
      return <ErrorNotification errorMessage={error} />;
    } else {
      return <Spinner />;
    }
  }
}

function renderComponentTree(root: DeserializedComponent): Promise<ReactElement<any>> {
  const {type, props, children} = root;
  return Promise.all(children.map(renderComponentTree)).then(renderedChildren => {
    if (ModuleRegistry.isWebComponent(type)) {
      return ModuleRegistry.renderWebComponent(
        type,
        props,
        renderedChildren,
        props.markupTemplateScope,
      );
    } else {
      return createElement(type, props, ...renderedChildren);
    }
  });
}

export default PersistedComponent;
