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

import { Cancellation } from 'platform/api/async';
import { Component } from 'platform/api/components';
import { registerEventSource, trigger } from 'platform/api/events';

import { ResourceLinkComponent } from 'platform/components/navigation';
import { ResourceLabel } from 'platform/components/ui/resource-label';

import * as KnowledgePanelEvents from './KnowledgePanelEvents';
import './KnowledgePanelTrigger.scss';

interface KnowledgePanelTriggerConfig {
  /**
   * Resource IRI.
   */
  iri: string;
  /**
   * Unique ID to be used in the event system.
   */
  id?: string;
  /**
   * Knowledge Panel Frame component ID.
   */
  target?: string;
  /**
   * Additional data that can be passed with the event.
   */
  data?: object;
  /**
   * Custom CSS class.
   */
  className?: string;
  /**
   * Custom CSS styles.
   */
  style?: React.CSSProperties;
  /**
   * Mode - chooses which element acts as Knowledge panel trigger.
   * icon: The link navigates to page, the icon opens the knowledge panel.
   * full: Both the label and icon open the knowledge panel.
   *
   * @default icon
   */
  mode?: 'icon' | 'full';
  /**
   * Inner markup that should be used instead of the default modes. Will override 'modes' parameter.
   */
  children: {};
}

export type KnowledgePanelTriggerProps = KnowledgePanelTriggerConfig;

export class KnowledgePanelTrigger extends Component<KnowledgePanelTriggerProps, {}> {
  private readonly cancellation = new Cancellation();

  componentDidMount() {
    registerEventSource({
      source: this.props.id,
      eventType: KnowledgePanelEvents.Open,
      cancellation: this.cancellation,
    });
  }

  componentWillUnmount() {
    this.cancellation.cancelAll();
  }

  render() {
    const {iri, style, children, mode = 'icon'} = this.props;
    if (children) {
      const child = React.Children.only(children) as React.ReactElement<any>;
      return React.cloneElement(child, {onClick: this.onClick});
    }
    if (mode === 'icon') {
      return (
        <span
          className={`knowledge-panel-trigger ${this.props.className}`}
          data-knowledge-panel-iri={iri}>
          <ResourceLinkComponent iri={iri} />
          {' '}
          <button onClick={this.onClick}
            className='btn btn-link btn-sm knowledge-panel-trigger__button'
            style={style}>
            <i className='fa fa-info-circle'></i>
          </button>
        </span>
      );
    } else {
      return (
        <a
          className={`knowledge-panel-trigger ${this.props.className}`}
          data-knowledge-panel-iri={iri}
          onClick={this.onClick}>
          <ResourceLabel iri={iri} />
          {' '}
          <button
            className='btn btn-link btn-sm knowledge-panel-trigger__button'
            style={style}>
            <i className='fa fa-info-circle'></i>
          </button>
        </a>
      );
    }
  }

  private onClick = (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    const {id, iri, target, data = {}} = this.props;
    trigger({
      source: id,
      eventType: KnowledgePanelEvents.Open,
      targets: target ? [target] : [],
      data: {iri, additionalData: data},
    });
  }
}

export default KnowledgePanelTrigger;
