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

import { Component } from 'platform/api/components';
import { Cancellation } from 'platform/api/async/Cancellation';
import { listen, trigger } from 'platform/api/events';
import * as KnowledgePanelEvents from 'platform/components/knowledge-panel/KnowledgePanelEvents';

import { SemanticSearchContext } from './SemanticSearchApi';

const ID = 'semantic-search-knowledge-panel';

interface Props {
  searchId: string;
  knowledgePanelId: string;
}

export class SemanticSearchKnowledgePanelController extends Component<Props, {}> {
  render() {
    return (
      <SemanticSearchContext.Consumer>
        {context =>
          <SemanticSearchKnowledgePanelControllerInner {...this.props} context={context} />
        }
      </SemanticSearchContext.Consumer>
    );
  }
}

interface InnerProps extends Props {
  context: SemanticSearchContext;
}

export class SemanticSearchKnowledgePanelControllerInner extends Component<InnerProps, {}> {
  private readonly cancellation = new Cancellation();
  private knowledgePanelPinned = false;
  private shouldOpenKnowledgePanelOnLoad = true;

  componentDidMount() {
    this.subscribeOnKnowledgePanelEvents();
  }

  componentDidUpdate(prevProps: InnerProps) {
    const {context} = this.props;
    const {context: prevContext} = prevProps;
    if (this.shouldOpenKnowledgePanelOnLoad &&
      prevContext.baseQueryStructure.isNothing && context.baseQueryStructure.isJust &&
      !prevContext.resultState[ID] && context.resultState[ID]) {
      this.shouldOpenKnowledgePanelOnLoad = false;
      this.openKnowledgePanel();
    }
    if (!this.knowledgePanelPinned) {
      const isBaseQueryChanged = (
        prevContext.baseQuery.isJust &&
        !_.isEqual(context.baseQuery.getOrElse(undefined), prevContext.baseQuery.get())
      );
      const isFacetedQueryChanged = (
        prevContext.baseQuery.isJust && prevContext.resultQuery.isJust &&
        prevContext.baseQuery !== prevContext.resultQuery &&
        !_.isEqual(context.resultQuery.getOrElse(undefined), prevContext.resultQuery.get())
      );
      if (isBaseQueryChanged || isFacetedQueryChanged) {
        this.dismissKnowledgePanel();
      }
    }
  }

  componentWillUnmount() {
    this.cancellation.cancelAll();
  }

  render(): null {
    return null;
  }

  private subscribeOnKnowledgePanelEvents() {
    const {knowledgePanelId, context} = this.props;
    this.cancellation.map(
      listen({
        eventType: KnowledgePanelEvents.Open,
        target: knowledgePanelId,
      })
    ).observe({
      value: ({data}) => {
        context.updateResultState(ID, data);
      },
    });
    this.cancellation.map(
      listen({
        eventType: KnowledgePanelEvents.Close,
        target: knowledgePanelId,
      })
    ).observe({
      value: () => {
        context.updateResultState(ID, {iri: undefined, additionalData: undefined});
        this.knowledgePanelPinned = false;
      },
    });
    this.cancellation.map(
      listen({
        eventType: KnowledgePanelEvents.Pin,
        target: knowledgePanelId,
      })
    ).observe({
      value: () => {
        this.knowledgePanelPinned = true;
      },
    });
    this.cancellation.map(
      listen({
        eventType: KnowledgePanelEvents.Unpin,
        target: knowledgePanelId,
      })
    ).observe({
      value: () => {
        this.knowledgePanelPinned = false;
      },
    });
  }

  private openKnowledgePanel() {
    const {knowledgePanelId, context} = this.props;
    const data = context.resultState[ID];
    if (data) {
      trigger({
        source: ID,
        eventType: KnowledgePanelEvents.Open,
        targets: [knowledgePanelId],
        data,
      });
    }
  }

  private dismissKnowledgePanel() {
    const {knowledgePanelId} = this.props;
    trigger({
      source: ID,
      eventType: KnowledgePanelEvents.Close,
      targets: [knowledgePanelId],
    });
  }
}
