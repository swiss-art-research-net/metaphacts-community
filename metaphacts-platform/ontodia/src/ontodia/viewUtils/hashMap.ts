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
export interface ReadonlyHashMap<K, V> {
    readonly size: number;
    has(key: K): boolean;
    get(key: K): V | undefined;
    forEach(callback: (value: V, key: K, map: ReadonlyHashMap<K, V>) => void): void;
    clone(): HashMap<K, V>;
}

export class HashMap<K, V> implements ReadonlyHashMap<K, V> {
    private readonly map = new Map<number, Array<{ key: K; value: V }>>();
    private _size = 0;

    constructor(
        private hashKey: (key: K) => number,
        private equalKeys: (k1: K, k2: K) => boolean,
    ) {}

    get size() {
        return this._size;
    }

    has(key: K): boolean {
        const items = this.map.get(this.hashKey(key));
        if (!items) { return false; }
        for (const item of items) {
            if (this.equalKeys(item.key, key)) { return true; }
        }
        return false;
    }

    get(key: K): V | undefined {
        const items = this.map.get(this.hashKey(key));
        if (!items) { return undefined; }
        for (const item of items) {
            if (this.equalKeys(item.key, key)) { return item.value; }
        }
        return undefined;
    }

    set(key: K, value: V): this {
        const hash = this.hashKey(key);
        let items = this.map.get(hash);
        if (items) {
            let index = -1;
            for (let i = 0; i < items.length; i++) {
                if (this.equalKeys(items[i].key, key)) {
                    index = i;
                    break;
                }
            }
            if (index >= 0) {
                items.splice(index, 1);
            } else {
                this._size++;
            }
            items.push({key, value});
        } else {
            items = [{key, value}];
            this.map.set(hash, items);
            this._size++;
        }
        return this;
    }

    delete(key: K): boolean {
        const items = this.map.get(this.hashKey(key));
        if (!items) { return false; }
        for (let i = 0; i < items.length; i++) {
            if (this.equalKeys(items[i].key, key)) {
                items.splice(i, 1);
                this._size--;
                return true;
            }
        }
        return false;
    }

    clear(): void {
        this.map.clear();
        this._size = 0;
    }

    forEach(callback: (value: V, key: K, map: ReadonlyHashMap<K, V>) => void) {
        this.map.forEach(items => {
            for (const {key, value} of items) {
                callback(value, key, this);
            }
        });
    }

    clone(): HashMap<K, V> {
        const clone = new HashMap<K, V>(this.hashKey, this.equalKeys);
        clone._size = this.size;
        this.map.forEach((value, key) => clone.map.set(key, [...value]));
        return clone;
    }
}

export interface ReadonlyHashSet<K> {
    readonly size: number;
    has(key: K): boolean;
    forEach(callback: (value: K, key: K, map: ReadonlyHashSet<K>) => void): void;
    clone(): HashSet<K>;
}

export class HashSet<K> implements ReadonlyHashSet<K> {
    private map: HashMap<K, K>;

    constructor(
        private hashItem: (key: K) => number,
        private equalItems: (k1: K, k2: K) => boolean,
    ) {
        this.map = new HashMap(hashItem, equalItems);
    }

    get size() {
        return this.map.size;
    }

    has(key: K): boolean {
        return this.map.has(key);
    }

    add(key: K): this {
        this.map.set(key, key);
        return this;
    }

    delete(key: K): boolean {
        return this.map.delete(key);
    }

    clear(): void {
        this.map.clear();
    }

    clone(): HashSet<K> {
        const clone = new HashSet<K>(this.hashItem, this.equalItems);
        this.forEach(key => clone.add(key));
        return clone;
    }

    forEach(callback: (value: K, key: K, set: ReadonlyHashSet<K>) => void) {
        this.map.forEach((value, key) => callback(value, key, this));
    }

    static toArray<K>(set: ReadonlyHashSet<K>): K[] {
        if (set.size === 0) { return []; }
        const array: K[] = [];
        set.forEach(item => array.push(item));
        return array;
    }
}
