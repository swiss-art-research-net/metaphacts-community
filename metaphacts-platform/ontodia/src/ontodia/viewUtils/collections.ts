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
export function objectValues<T>(obj: { [key: string]: T | undefined }): T[] {
    const items: T[] = [];
    for (const key in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, key)) { continue; }
        const item = obj[key];
        if (item !== undefined) {
            items.push(item);
        }
    }
    return items;
}

export function isEmptyMap(map: object) {
    for (const key in map) {
        if (Object.prototype.hasOwnProperty.call(map, key)) { return false; }
    }
    return true;
}

/**
 * Clones `Map` collection.
 * @deprecated Use `new Map<K, V>(map)` instead. (Was used for IE11 compatibility.)
 */
export function cloneMap<K, V>(map: ReadonlyMap<K, V>): Map<K, V> {
    return new Map<K, V>(map);
}

/**
 * Clones Set collection.
 * @deprecated Use `new Set<T>(map)` instead. (Was used for IE11 compatibility.)
 */
export function cloneSet<T>(set: ReadonlySet<T>): Set<T> {
    return new Set<T>(set);
}

export function getOrCreateArrayInMap<K, V>(map: Map<K, V[]>, key: K): V[] {
    let values = map.get(key);
    if (!values) {
        values = [];
        map.set(key, values);
    }
    return values;
}

export function getOrCreateSetInMap<K, V>(map: Map<K, Set<V>>, key: K): Set<V> {
    let values = map.get(key);
    if (!values) {
        values = new Set();
        map.set(key, values);
    }
    return values;
}

export class OrderedMap<V> {
    private mapping = new Map<string, V>();
    private ordered: V[] = [];

    reorder(compare: (a: V, b: V) => number) {
        this.ordered.sort(compare);
    }

    get items(): ReadonlyArray<V> {
        return this.ordered;
    }

    get(key: string): V | undefined {
        return this.mapping.get(key);
    }

    push(key: string, value: V) {
        if (this.mapping.has(key)) {
            const previous = this.mapping.get(key)!;
            if (previous === value) { return; }
            const index = this.ordered.indexOf(previous);
            this.ordered.splice(index, 1);
        }
        this.mapping.set(key, value);
        this.ordered.push(value);
    }

    delete(key: string): V | undefined {
        if (!this.mapping.has(key)) {
            return undefined;
        }
        const previous = this.mapping.get(key)!;
        const index = this.ordered.indexOf(previous);
        this.ordered.splice(index, 1);
        this.mapping.delete(key);
        return previous;
    }
}

export enum MoveDirection {
    ToStart = -1,
    ToEnd = 1,
}

export function makeMoveComparator<T>(
    items: ReadonlyArray<T>,
    selected: ReadonlyArray<T>,
    moveDirection: MoveDirection,
): (a: T, b: T) => number {
    const orderMap = new Map<T, number>();
    const selectionIndexOffset = moveDirection * items.length;

    items.forEach((item, index) => {
        orderMap.set(item, index);
    });

    for (const selectedItem of selected) {
        orderMap.set(selectedItem, selectionIndexOffset + orderMap.get(selectedItem)!);
    }

    return (a: T, b: T) => {
        const orderA = orderMap.get(a)!;
        const orderB = orderMap.get(b)!;
        return (
            orderA > orderB ? 1 :
            orderA < orderB ? -1 :
            0
        );
    };
}
