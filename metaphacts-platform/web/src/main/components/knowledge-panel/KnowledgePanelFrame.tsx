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
import * as PropTypes from 'prop-types';

import { Component, ComponentPropTypes } from 'platform/api/components';
import { Cancellation } from 'platform/api/async/Cancellation';
import { listen } from 'platform/api/events';
import { TemplateItem } from 'platform/components/ui/template';
import { ControlledPropsHandler } from 'platform/components/utils/ControlledProps';

import * as KnowledgePanelEvents from './KnowledgePanelEvents';

import './KnowledgePanelFrame.scss';

function getDefaultTemplate(noPin?: boolean) {
  return `{{#if iri}}
      <style>
        *[data-knowledge-panel-iri='{{iri}}'] {
          background: lightblue;
        }
        *[data-knowledge-panel-iri="{{iri}}"] .knowledge-panel-trigger__button {
                opacity: 1;
                visibility: visible;
              }
      </style>
      <div
        class='knowledge-panel-frame'
        data-flex-self='size-1of3'>
        <div class='knowledge-panel-frame__buttons'>
          ${noPin ? '' : `
          {{#if pinned}}
            <mp-event-trigger type='KnowledgePanel.Unpin' targets='["{{knowledgePanelId}}"]'>
              <button title='Unpin' class='knowledge-panel-frame__button knowledge-panel-frame__pin active'>
                <i class='fa fa-thumb-tack'></i>
              </button>
            </mp-event-trigger>
          {{else}}
            <mp-event-trigger type='KnowledgePanel.Pin' targets='["{{knowledgePanelId}}"]'>
              <button title='Pin' class='knowledge-panel-frame__button knowledge-panel-frame__pin'>
                <i class='fa fa-thumb-tack'></i>
              </button>
            </mp-event-trigger>
          {{/if}}
          `}
          <mp-event-trigger type='KnowledgePanel.Close' targets='["{{knowledgePanelId}}"]'>
            <button class='knowledge-panel-frame__button'>
              <i class='fa fa-times'></i>
            </button>
          </mp-event-trigger>
        </div>
        <mp-knowledge-panel iri='{{iri}}'></mp-knowledge-panel>
      </div>
  {{/if}}`;
}

export interface KnowledgePanelFrameConfig {
  /**
   * Unique ID to be used in the event system. Default value is `undefined`.
   */
  id?: string;
  /**
   * Knowledge Panel Trigger component ID. Default value is `undefined`.
   */
  trigger?: string;
  /**
   * Custom template that gets resource IRI and knowledge panel ID as parameters `{{iri}}` and `{{knowledgePanelId}}` respectively.
   */
  template?: string;
  /**
   * If this parameter is equal to 'true', 'pin' button is removed from default template.
   */
  noPin?: boolean;
}

type Props = KnowledgePanelFrameConfig;

interface State {
  iri?: string;
  additionalTemplateOptions?: {};
  pinned?: boolean;
}

export class KnowledgePanelFrame extends Component<Props, State> {
  static propTypes: Partial<Record<keyof (Props & ControlledPropsHandler<any>), any>> = {
    ...ComponentPropTypes,
    onControlledPropChange: PropTypes.func,
  };

  private readonly cancellation = new Cancellation();

  constructor(props: Props, context: any) {
    super(props, context);
    this.state = {
      pinned: false,
    };
  }

  componentDidMount() {
    const {id, trigger} = this.props;
    this.cancellation.map(
      listen({
        source: trigger,
        eventType: KnowledgePanelEvents.Open,
        target: id,
      })
    ).observe({
      value: ({data}) => {
        const {iri, additionalData} = data;
        this.setState({iri, additionalTemplateOptions: additionalData});
      },
    });
    this.cancellation.map(
      listen({
        eventType: KnowledgePanelEvents.Close,
        target: id,
      })
    ).observe({
      value: () => {
        this.closeKnowledgePanel();
      },
    });
    this.cancellation.map(
      listen({
        eventType: KnowledgePanelEvents.Pin,
        target: id,
      })
    ).observe({
      value: () => {
        this.setState({pinned: true});
      },
    });
    this.cancellation.map(
      listen({
        eventType: KnowledgePanelEvents.Unpin,
        target: id,
      })
    ).observe({
      value: () => {
        this.setState({pinned: false});
      },
    });
  }

  componentWillUnmount() {
    this.cancellation.cancelAll();
  }

  render() {
    const {id} = this.props;
    const template = this.template;
    const {iri, pinned, additionalTemplateOptions} = this.state;
    return <TemplateItem template={{
      source: template,
      options: {iri: iri, pinned, knowledgePanelId: id, ...additionalTemplateOptions}}
    } />;
  }

  private get template() {
    return this.props.template || getDefaultTemplate(this.props.noPin);
  }

  private closeKnowledgePanel() {
    this.setState({iri: undefined, additionalTemplateOptions: undefined, pinned: false});
  }
}

export default KnowledgePanelFrame;
