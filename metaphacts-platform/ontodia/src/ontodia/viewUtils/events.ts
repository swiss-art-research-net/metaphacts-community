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
export type Listener<Data, Key extends keyof Data> = (data: Data[Key], key: Key) => void;
export type AnyListener<Data> = (data: Partial<Data>, key: string) => void;
export type Unsubscribe = () => void;

export interface PropertyChange<Source, Value> {
    source: Source;
    previous: Value;
}

export interface AnyEvent<Data> {
    key: string;
    data: Partial<Data>;
}

export interface Events<Data> {
    on<Key extends keyof Data>(eventKey: Key, listener: Listener<Data, Key>): void;
    off<Key extends keyof Data>(eventKey: Key, listener: Listener<Data, Key>): void;
    onAny(listener: AnyListener<Data>): void;
    offAny(listener: AnyListener<Data>): void;
}

export interface EventTrigger<Data> {
    trigger<Key extends keyof Data>(eventKey: Key, data: Data[Key]): void;
}

export class EventSource<Data> implements Events<Data>, EventTrigger<Data> {
    private listeners = new Map<keyof Data, Array<Listener<Data, any>>>();
    private anyListeners: Array<AnyListener<Data>> | undefined;

    on<Key extends keyof Data>(eventKey: Key, listener: Listener<Data, Key>): void {
        let listeners = this.listeners.get(eventKey);
        if (!listeners) {
            listeners = [];
            this.listeners.set(eventKey, listeners);
        }
        listeners.push(listener);
    }

    onAny(listener: AnyListener<Data>): void {
        let listeners = this.anyListeners;
        if (!listeners) {
            listeners = [];
            this.anyListeners = listeners;
        }
        listeners.push(listener);
    }

    off<Key extends keyof Data>(eventKey: Key, listener: Listener<Data, Key>): void {
        const listeners = this.listeners.get(eventKey);
        if (!listeners) { return; }
        const index = listeners.indexOf(listener);
        if (index >= 0) {
            listeners.splice(index, 1);
        }
    }

    offAny(listener: AnyListener<Data>): void {
        const listeners = this.anyListeners;
        if (!listeners) { return; }
        const index = listeners.indexOf(listener);
        if (index >= 0) {
            listeners.splice(index, 1);
        }
    }

    trigger<Key extends keyof Data>(eventKey: Key, data: Data[Key]): void {
        const listeners = this.listeners.get(eventKey);
        if (listeners) {
            for (const listener of listeners) {
                listener(data, eventKey);
            }
        }

        if (this.anyListeners) {
            for (const anyListener of this.anyListeners) {
                anyListener({[eventKey]: data} as any, eventKey as string);
            }
        }
    }
}

export class EventObserver {
    private unsubscribeByKey = new Map<string, Unsubscribe[]>();
    private onDispose: Array<Unsubscribe> = [];

    listen<Data, Key extends keyof Data>(
        events: Events<Data>, eventKey: Key, listener: Listener<Data, Key>
    ) {
        events.on(eventKey, listener);
        this.onDispose.push(() => events.off(eventKey, listener));
    }

    listenAny<Data>(events: Events<Data>, listener: AnyListener<Data>) {
        events.onAny(listener);
        this.onDispose.push(() => events.offAny(listener));
    }

    listenOnce<Data, Key extends keyof Data>(
        events: Events<Data>, eventKey: Key, listener: Listener<Data, Key>
    ) {
        let handled = false;
        const onceListener: Listener<Data, Key> = (data, key) => {
            handled = true;
            events.off(eventKey, onceListener);
            listener(data, key);
        };
        events.on(eventKey, onceListener);
        this.onDispose.push(() => {
            if (handled) { return; }
            events.off(eventKey, onceListener);
        });
    }

    stopListening() {
        for (const unsubscribe of this.onDispose) {
            unsubscribe();
        }
        this.onDispose.length = 0;

        this.unsubscribeByKey.forEach(unsubscribers => {
            for (const unsubscribe of unsubscribers) {
                unsubscribe();
            }
        });
        this.unsubscribeByKey.clear();
    }
}
