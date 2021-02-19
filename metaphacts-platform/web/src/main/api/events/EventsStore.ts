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
import * as Kefir from 'kefir';

import { Cancellation } from 'platform/api/async';

import { Event, EventFilter, EventType } from './EventsApi';

interface Subscriber {
  eventFilter: EventFilter<any>;
  emitter: Kefir.Emitter<Event<any>>;
}

const subscribers = new Set<Subscriber>();

/**
 * Exposed only for testing purposes.
 */
export function test_clearSubscribers() {
  subscribers.clear();
}

/**
 * Listen to all events that satisfies given 'eventFilter'.
 */
export function listen<Data>(eventFilter: EventFilter<Data>): Kefir.Stream<Event<Data>> {
  return Kefir.stream(emitter => {
    const subscriber: Subscriber = {eventFilter, emitter};
    subscribers.add(subscriber);

    // Emits the event if it has the current value
    const currentValue = EventSourceStore.getCurrentValue(eventFilter);
    if (currentValue) {
      emitter.emit(currentValue);
    }

    return () => subscribers.delete(subscriber);
  });
}

/**
 * Trigger event.
 */
export function trigger<Data>(event: Event<Data>) {
  subscribers.forEach(({eventFilter, emitter}) => {
    if (
      (!eventFilter.eventType || eventFilter.eventType === event.eventType) &&
      (!eventFilter.source || eventFilter.source === event.source) &&
      targetFilterMatchesEvent(eventFilter.target, event)
    ) {
      emitter.emit(event);
    }
  });
  EventSourceStore.updateCurrentValue(event);
}

function targetFilterMatchesEvent(target: string | undefined, event: Event<any>) {
  if (!target) { return true; }
  return event.targets ? event.targets.indexOf(target) >= 0 : false;
}

export interface EventSourceParam<Data> {
  source: string | undefined;
  eventType: EventType<Data>;
  cancellation: Cancellation;
  initialData?: Data;
}

export function registerEventSource<Data>(eventSourceParam: EventSourceParam<Data>) {
  const {source, eventType, cancellation, initialData} = eventSourceParam;
  const eventSource: EventSource = {
    source,
    eventType,
    currentValue: initialData ? {source, eventType, data: initialData} : undefined,
  };
  EventSourceStore.addEventSource(eventSource);
  cancellation.onCancel(() => {
    EventSourceStore.deleteEventSource(eventSource);
  });
}

interface EventSource {
  source: string | undefined;
  eventType: EventType<any>;
  currentValue?: Event<any>;
}
namespace EventSourceStore {
  const sourceByType = new Map<EventType<any>, EventSource[]>();

  export function getCurrentValue<Data>(eventFilter: EventFilter<Data>): Event<Data> | undefined {
    if (!eventFilter.eventType) {
      return undefined;
    }
    const sources = sourceByType.get(eventFilter.eventType);
    if (sources) {
      for (const source of sources) {
        if (!eventFilter.source || source.source === eventFilter.source) {
          return source.currentValue;
        }
      }
    }
    return undefined;
  }

  export function updateCurrentValue<Data>(event: Event<Data>) {
    const sources = sourceByType.get(event.eventType);
    if (sources) {
      for (const source of sources) {
        if (source.source === event.source) {
          source.currentValue = event;
        }
      }
    }
  }

  export function addEventSource(eventSource: EventSource) {
    let sources = sourceByType.get(eventSource.eventType);
    if (!sources) {
      sources = [];
      sourceByType.set(eventSource.eventType, sources);
    }
    sources.push(eventSource);
  }

  export function deleteEventSource(eventSource: EventSource) {
    const sources = sourceByType.get(eventSource.eventType);
    if (sources) {
      const index = sources.indexOf(eventSource);
      if (index >= 0) {
        sources.splice(index, 1);
      }
    }
  }
}
