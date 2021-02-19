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
import { CSSProperties, ReactElement, HTMLProps, createElement } from 'react';
import * as Kefir from 'kefir';

import { Rdf } from 'platform/api/rdf';
import { Component } from 'platform/api/components';
import { HighlightComponent } from 'platform/components/ui/highlight';
import { ErrorNotification } from 'platform/components/ui/notification';
import { Spinner } from 'platform/components/ui/spinner';

import * as LabelsService from 'platform/api/services/resource-label';

/**
 * **Example**:
 * ```
 * <mp-label iri='some:resource'></mp-label>
 * ```
 */
interface ResourceLabelConfig {
  /**
   * IRI of resource to fetch label for
   */
  iri: string;
  /**
   * Additional class names for component root element
   */
  className?: string;
  /**
   * Additional styles for label element
   */
  style?: CSSProperties;
  /**
   * Substring to highlight
   */
  highlight?: string;
  /**
   * Props for highlighted substring span
   */
  highlightProps?: {};
}

export interface ResourceLabelProps extends ResourceLabelConfig {
  highlightProps?: HTMLProps<HTMLSpanElement>;
}

interface State {
  label?: string;
  error?: any;
}

export class ResourceLabel extends Component<ResourceLabelProps, State> {
  private subscription: Kefir.Subscription | undefined;

  constructor(props: ResourceLabelProps, context: any) {
    super(props, context);
    this.state = {};
  }

  componentDidMount() {
    this.fetchLabel(Rdf.iri(this.props.iri));
  }

  componentDidUpdate(prevProps: ResourceLabelProps) {
    const {iri} = this.props;
    if (prevProps.iri !== iri) {
      this.fetchLabel(Rdf.iri(iri));
    }
  }

  componentWillUnmount() {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = undefined;
    }
  }

  private fetchLabel = (iri: Rdf.Iri) => {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = undefined;
    }
    if (iri.value) {
      const context = this.context.semanticContext;
      this.subscription = LabelsService.getLabel(iri, {context}).observe({
        value: label => this.setState({label: label, error: undefined}),
        error: error => this.setState({label: undefined, error: error}),
      });
    } else {
      this.setState({label: '', error: undefined});
    }
  }

  render(): ReactElement<any> {
    const {className, style, highlight, highlightProps} = this.props;
    const {label, error} = this.state;

    if (error) {
      return createElement(ErrorNotification, {errorMessage: error});
    }

    return typeof label === 'string'
      ? createElement(
          HighlightComponent,
          {className, style, highlight, highlightProps},
          label
        )
      : createElement(Spinner);
  }
}

export default ResourceLabel;
