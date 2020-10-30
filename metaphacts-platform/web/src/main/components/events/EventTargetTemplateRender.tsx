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

import { Component } from 'platform/api/components';
import { listen, BuiltInEvents } from 'platform/api/events';
import { Cancellation } from 'platform/api/async/Cancellation';
import { TemplateItem } from 'platform/components/ui/template';

export interface EventTargetTemplateRenderConfig {
  /**
   * Identifier which will be used as event target id.
   */
  id: string;
  /**
   * <semantic-link uri='http://help.metaphacts.com/resource/FrontendTemplating'>Template</semantic-link>
   * that will be rendered with data passed as context variables.
   */
  template: string;
}
type Props = EventTargetTemplateRenderConfig;

export interface State {
  key?: number;
  data?: object;
}

/**
 * Updates the template component and passes it new properties.
 *
 * @example
 * <mp-event-trigger id='event-trigger' type='Component.TemplateUpdate' targets='["event-target"]'
 *     data='{"iri": "http://example.com/resource"}'>
 *     <button>Update</button>
 * </mp-event-trigger>
 *
 * <mp-event-target-template-render id='event-target' template='{{> template}}'>
 *     <template id='template'>
 *        <div>
 *          {{#if iri}}
 *            <mp-label iri='{{iri}}'></mp-label>
 *          {{/if}}
 *        </div>
 *     </template>
 * </mp-event-target-template-render>
 */
export class EventTargetTemplateRender extends Component<Props, State> {
  private readonly cancellation = new Cancellation();

  constructor(props: Props, context: any) {
    super(props, context);
    this.state = {
      key: 0,
      data: {},
    };
  }

  componentDidMount() {
    this.cancellation.map(
      listen({
        eventType: BuiltInEvents.ComponentTemplateUpdate,
        target: this.props.id,
      })
    ).observe({
      value: ({data}) =>
        this.setState((prevState: State): State =>
          ({key: prevState.key + 1, data})
        ),
    });
  }

  componentWillUnmount() {
    this.cancellation.cancelAll();
  }

  render() {
    const {template: source} = this.props;
    const {key, data: options} = this.state;
    return <TemplateItem key={key} template={{source, options}} />;
  }
}

export default EventTargetTemplateRender;
