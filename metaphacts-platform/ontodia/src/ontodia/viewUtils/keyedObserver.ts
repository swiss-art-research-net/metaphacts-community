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
import { ElementTypeIri, LinkTypeIri, PropertyTypeIri } from '../data/model';

import { RichClassEvents, LinkTypeEvents, RichPropertyEvents } from '../diagram/elements';
import { DiagramModel } from '../diagram/model';

import { Unsubscribe, Listener } from './events';

export class KeyedObserver<Key extends string> {
    private observedKeys = new Map<string, Unsubscribe>();

    constructor(readonly subscribe: (key: Key) => Unsubscribe | undefined) {}

    observe(keys: ReadonlyArray<Key>) {
        if (keys.length === 0 && this.observedKeys.size === 0) {
            return;
        }
        const newObservedKeys = new Map<string, Unsubscribe>();

        for (const key of keys) {
            if (newObservedKeys.has(key)) { continue; }
            let unsubscribe = this.observedKeys.get(key);
            if (!unsubscribe) {
                unsubscribe = this.subscribe(key);
            }
            if (unsubscribe) {
                newObservedKeys.set(key, unsubscribe);
            }
        }

        this.observedKeys.forEach((unsubscribe, key) => {
            if (!newObservedKeys.has(key)) {
                unsubscribe();
            }
        });

        this.observedKeys = newObservedKeys;
    }

    stopListening() {
        this.observe([]);
    }
}

export function observeElementTypes<Event extends keyof RichClassEvents>(
    model: DiagramModel, event: Event, listener: Listener<RichClassEvents, Event>
) {
    return new KeyedObserver<ElementTypeIri>(key => {
        const type = model.getClass(key);
        if (type) {
            type.events.on(event, listener);
            return () => type.events.off(event, listener);
        }
        return undefined;
    });
}

export function observeProperties<Event extends keyof RichPropertyEvents>(
    model: DiagramModel, event: Event, listener: Listener<RichPropertyEvents, Event>
) {
    return new KeyedObserver<PropertyTypeIri>(key => {
        const property = model.getProperty(key);
        if (property) {
            property.events.on(event, listener);
            return () => property.events.off(event, listener);
        }
        return undefined;
    });
}

export function observeLinkTypes<Event extends keyof LinkTypeEvents>(
    model: DiagramModel, event: Event, listener: Listener<LinkTypeEvents, Event>
) {
    return new KeyedObserver<LinkTypeIri>(key => {
        const type = model.createLinkType(key);
        if (type) {
            type.events.on(event, listener);
            return () => type.events.off(event, listener);
        }
        return undefined;
    });
}
