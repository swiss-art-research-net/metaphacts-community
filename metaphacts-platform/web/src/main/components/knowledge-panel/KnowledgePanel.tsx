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
import * as React from 'react';
import { ReactElement } from 'react';

import { Cancellation } from 'platform/api/async';
import { Component } from 'platform/api/components';
import { ModuleRegistry } from 'platform/api/module-loader';
import { extractParams } from 'platform/api/navigation/NavigationUtils';
import { PageService } from 'platform/api/services/page';

import { Alert, AlertType } from 'platform/components/ui/alert';
import { Spinner } from 'platform/components/ui/spinner';

export interface KnowledgePanelConfig {
  /**
   * Resource IRI.
   */
  iri: string;
}

type Props = KnowledgePanelConfig;

interface State {
  knowledgePanelContent?: Array<ReactElement<any>> | ReactElement<any>;
  loading?: boolean;
  error?: string;
}

export class KnowledgePanel extends Component<Props, State> {
  private readonly cancellation = new Cancellation();

  constructor(props: Props, context: any) {
    super(props, context);
    this.state = {
      knowledgePanelContent: [],
    };
  }

  componentDidMount() {
    const {iri} = this.props;
    if (iri) {
      this.loadKnowledgePanelContent(iri);
    }
  }

  componentDidUpdate(prevProps: Props) {
    const {iri} = this.props;
    if (iri && iri !== prevProps.iri) {
      this.loadKnowledgePanelContent(iri);
    }
  }

  componentWillUnmount() {
    this.cancellation.cancelAll();
  }

  render() {
    const {loading, error, knowledgePanelContent} = this.state;
    if (loading) {
      return <Spinner />;
    }
    if (error) {
      return <Alert alert={AlertType.DANGER} message={error} />;
    }
    return <>{knowledgePanelContent}</>;
  }

  private loadKnowledgePanelContent(iri: string) {
    this.setState({loading: true, error: undefined});
    const params = extractParams(this.props);
    PageService.loadKnowledgePanelTemplate(iri, params).flatMap(data =>
      ModuleRegistry.parseHtmlToReact(data.templateHtml)
    ).observe({
      value: knowledgePanelContent => this.setState({knowledgePanelContent, loading: false}),
      error: error => {
        this.setState({loading: false, error});
      },
    });
  }
}

export default KnowledgePanel;
