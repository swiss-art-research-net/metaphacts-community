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
import * as Kefir from 'kefir';
import {
  InstancesSearch as OntodiaInstancesSearch, EventObserver, EventSource, EventTrigger,
  InstancesSearchCommands, SearchCriteria, ElementTypeIri,
} from 'ontodia';

import { Cancellation } from 'platform/api/async';
import { listen, trigger } from 'platform/api/events';
import { getLabel } from 'platform/api/services/resource-label';
import { Rdf } from 'platform/api/rdf';

import * as InstancesSearchEvents from './InstancesSearchEvents';

/**
 * Searches instances of a class.
 */
export interface InstancesSearchConfig {
  /**
   * Unique ID, should be used to receive commands from a specific class tree.
   */
  id?: string;
}

export type InstancesSearchProps = InstancesSearchConfig;

export class InstancesSearch extends React.Component<InstancesSearchProps, {}> {
  private readonly cancellation = new Cancellation();
  private readonly commands = new EventSource<InstancesSearchCommands>();

  componentDidMount() {
    const {id} = this.props;
    this.cancellation.map(
      listen({eventType: InstancesSearchEvents.SetCriteria, target: id})
    ).flatMap(({data}) => completeCriteria(data.criteria)).observe({
      value: criteria => this.commands.trigger('setCriteria', {criteria}),
    });
  }

  componentWillUnmount() {
    this.cancellation.cancelAll();
  }

  render() {
    return <OntodiaInstancesSearch commands={this.commands} />;
  }
}

function completeCriteria(
  criteria: InstancesSearchEvents.SearchCriteria
): Kefir.Property<SearchCriteria> {
  const isComplete = (
    (!criteria.elementType || criteria.elementType.labels) &&
    (!criteria.refElementLink || criteria.refElementLink.labels) &&
    (!criteria.refElement || criteria.refElement.labels)
  );
  if (isComplete) { return Kefir.constant(criteria as SearchCriteria); }

  const ensureLabels = (
    item: InstancesSearchEvents.LabeledIri | undefined
  ): Kefir.Property<InstancesSearchEvents.LabeledIri | undefined> => {
    if (!item || item.labels) { return Kefir.constant(item); }
    return getLabel(Rdf.iri(item.iri)).map(label => ({
      iri: item.iri,
      labels: [Rdf.literal(label)],
    }));
  };

  return Kefir.combine({
    elementType: ensureLabels(criteria.elementType),
    refElement: ensureLabels(criteria.refElement),
    refElementLink: ensureLabels(criteria.refElementLink),
  }, ({elementType, refElement, refElementLink}): SearchCriteria => {
    return {
      ...criteria,
      elementType: elementType as any,
      refElement: refElement as any,
      refElementLink: refElementLink as any,
    };
  }).toProperty();
}

export function subscribeOnInstancesSearchCommands(
  commands: EventSource<InstancesSearchCommands>,
  props: { id?: string; instancesSearchId?: string }
): EventTrigger<InstancesSearchCommands> {
  const {id, instancesSearchId} = props;
  const listener = new EventObserver();
  listener.listen(commands, 'setCriteria', e => {
    trigger({
      source: id,
      eventType: InstancesSearchEvents.SetCriteria,
      targets: instancesSearchId ? [instancesSearchId] : undefined,
      data: {criteria: e.criteria},
    });
  });
  return commands;
}

export default InstancesSearch;
