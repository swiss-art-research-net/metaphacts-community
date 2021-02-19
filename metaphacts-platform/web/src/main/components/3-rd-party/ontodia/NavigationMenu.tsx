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
import * as Ontodia from 'ontodia';

import { Cancellation } from 'platform/api/async';
import { listen, trigger } from 'platform/api/events';

import * as DiagramService from './data/DiagramService';

import { OntodiaContextTypes, OntodiaContextWrapper } from './OntodiaContext';
import * as OntodiaEvents from './OntodiaEvents';

interface OntodiaNavigationMenuConfig {
  /**
   * Unique ID to register as Ontodia canvas widget and send events.
   *
   * @default "ontodia-navigation-menu"
   */
  readonly id?: string;
  /**
   * SPARQL SELECT query to get suggested properties of elements.
   *
   * The query is parametrized with a list of link IRIs using `VALUES (?property) {...}`
   * block and executed against `wikidata-property-suggester` repository.
   *
   * Expected output bindings:
   *   - `propertyIri` - link IRI;
   *   - `score` - floating point number with link rank;
   */
  readonly propertySuggestionQuery?: string;
  /**
   * Automatically switch to "All" results category when opened.
   *
   * @default false
   */
  readonly defaultOpenAll?: boolean;
  /**
   * Show link type and direction for each found element.
   *
   * @default false
   */
  readonly showReferenceLinks?: boolean;
}

export interface NavigationMenuProps extends
  OntodiaNavigationMenuConfig, Ontodia.InternalApi.PaperWidgetProps {}

export class NavigationMenu extends React.Component<NavigationMenuProps> {
  readonly context: Ontodia.WorkspaceContextWrapper & OntodiaContextWrapper;
  static contextTypes = {...Ontodia.WorkspaceContextTypes, ...OntodiaContextTypes};

  static defaultProps: Required<Pick<NavigationMenuProps, 'id'>> = {
    id: 'ontodia-navigation-menu',
  };

  static readonly attachment = Ontodia.WidgetAttachment.OverElements;

  private readonly cancellation = new Cancellation();
  private readonly commands = new Ontodia.EventSource<Ontodia.ConnectionsMenuCommands>();

  componentDidMount() {
    const {model, overlayController} = this.context.ontodiaWorkspace;
    const {ontodiaId} = this.context.ontodiaContext;
    this.cancellation.map(
      listen({eventType: OntodiaEvents.OpenConnectionsMenu, target: ontodiaId})
    ).observe({
      value: ({data}) => {
        if (data.id) {
          const target = model.getElement(data.id);
          if (target) {
            this.commands.trigger('showConnectionsMenu', {target});
          }
        } else {
          overlayController.hideDialog();
        }
      },
    });
  }

  render() {
    const {id, defaultOpenAll, showReferenceLinks, propertySuggestionQuery} = this.props;
    return (
      <Ontodia.ConnectionsMenu id={id}
        commands={this.commands}
        defaultOpenAll={defaultOpenAll}
        showReferenceLinks={showReferenceLinks}
        suggestProperties={propertySuggestionQuery ? this.suggestProperties : undefined}
      />
    );
  }

  private suggestProperties = (
    params: Ontodia.PropertySuggestionParams
  ): Promise<Ontodia.Dictionary<Ontodia.PropertyScore>> => {
    const {propertySuggestionQuery} = this.props;

    if (!params.token) {
      const {model, view} = this.context.ontodiaWorkspace;
      const element = model.getElement(params.elementId);
      params.token = element ? view.formatLabel(element.data.label.values, element.data.id) : '';
    }

    return DiagramService.suggestProperties(params, propertySuggestionQuery);
  }
}

export function subscribeOnConnectionsMenuCommands(
  commands: Ontodia.EventSource<Ontodia.ConnectionsMenuCommands>,
  props: { id: string | undefined; ontodiaId: string | undefined }
): Ontodia.EventTrigger<Ontodia.ConnectionsMenuCommands> {
  const {id, ontodiaId} = props;
  const listener = new Ontodia.EventObserver();
  listener.listen(commands, 'showConnectionsMenu', e => {
    trigger({
      source: id,
      eventType: OntodiaEvents.OpenConnectionsMenu,
      targets: ontodiaId ? [ontodiaId] : undefined,
      data: {id: e.target.id},
    });
  });
  return commands;
}

Ontodia.assertWidgetComponent(NavigationMenu);

export default NavigationMenu;
