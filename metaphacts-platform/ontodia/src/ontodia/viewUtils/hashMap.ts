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
export interface ReadonlyHashMap<K, V> extends ReadonlyMap<K, V> {
    clone(): HashMap<K, V>;
}

type Bucket<K, V> = { readonly k: K; readonly v: V } | Array<{ readonly k: K; readonly v: V }>;

export class HashMap<K, V> implements ReadonlyHashMap<K, V> {
    private readonly map = new Map<number, Bucket<K, V>>();
    private _size = 0;

    constructor(
        private hashKey: (key: K) => number,
        private equalKeys: (k1: K, k2: K) => boolean,
    ) {}

    get size() {
        return this._size;
    }

    has(key: K): boolean {
        const bucket = this.map.get(this.hashKey(key));
        if (!bucket) { return false; }
        if (Array.isArray(bucket)) {
            for (const item of bucket) {
                if (this.equalKeys(item.k, key)) { return true; }
            }
        } else {
            return this.equalKeys(bucket.k, key);
        }
        return false;
    }

    get(key: K): V | undefined {
        const bucket = this.map.get(this.hashKey(key));
        if (!bucket) { return undefined; }
        if (Array.isArray(bucket)) {
            for (const item of bucket) {
                if (this.equalKeys(item.k, key)) { return item.v; }
            }
        } else if (this.equalKeys(bucket.k, key)) {
            return bucket.v;
        }
        return undefined;
    }

    set(key: K, value: V): this {
        const hash = this.hashKey(key);
        let bucket = this.map.get(hash);
        if (!bucket) {
            bucket = {k: key, v: value};
            this.map.set(hash, bucket);
            this._size++;
        } else if (Array.isArray(bucket)) {
            let index = -1;
            for (let i = 0; i < bucket.length; i++) {
                if (this.equalKeys(bucket[i].k, key)) {
                    index = i;
                    break;
                }
            }
            if (index >= 0) {
                bucket.splice(index, 1);
            } else {
                this._size++;
            }
            bucket.push({k: key, v: value});
        } else if (this.equalKeys(bucket.k, key)) {
            this.map.set(hash, {k: key, v: value});
        } else {
            const single = bucket;
            bucket = [single, {k: key, v: value}];
            this.map.set(hash, bucket);
            this._size++;
        }
        return this;
    }

    delete(key: K): boolean {
        const hash = this.hashKey(key);
        const bucket = this.map.get(hash);
        if (!bucket) { return false; }
        if (Array.isArray(bucket)) {
            for (let i = 0; i < bucket.length; i++) {
                if (this.equalKeys(bucket[i].k, key)) {
                    bucket.splice(i, 1);
                    this._size--;
                    return true;
                }
            }
        } else if (this.equalKeys(bucket.k, key)) {
            this.map.delete(hash);
            this._size--;
            return true;
        }
        return false;
    }

    clear(): void {
        this.map.clear();
        this._size = 0;
    }

    [Symbol.iterator](): IterableIterator<[K, V]> {
        return this.entries();
    }

    *entries(): IterableIterator<[K, V]> {
        for (const bucket of this.map.values()) {
            if (Array.isArray(bucket)) {
                for (const entry of bucket) {
                    yield [entry.k, entry.v];
                }
            } else {
                yield [bucket.k, bucket.v];
            }
        }
    }

    *keys(): IterableIterator<K> {
        for (const bucket of this.map.values()) {
            if (Array.isArray(bucket)) {
                for (const entry of bucket) {
                    yield entry.k;
                }
            } else {
                yield bucket.k;
            }
        }
    }

    *values(): IterableIterator<V> {
        for (const bucket of this.map.values()) {
            if (Array.isArray(bucket)) {
                for (const entry of bucket) {
                    yield entry.v;
                }
            } else {
                yield bucket.v;
            }
        }
    }

    forEach(callback: (value: V, key: K, map: ReadonlyHashMap<K, V>) => void) {
        this.map.forEach(bucket => {
            if (Array.isArray(bucket)) {
                for (const entry of bucket) {
                    callback(entry.v, entry.k, this);
                }
            } else {
                callback(bucket.v, bucket.k, this);
            }
        });
    }

    clone(): HashMap<K, V> {
        const clone = new HashMap<K, V>(this.hashKey, this.equalKeys);
        clone._size = this.size;
        for (const [hash, bucket] of this.map) {
            clone.map.set(hash, Array.isArray(bucket) ? [...bucket] : bucket);
        }
        return clone;
    }
}

export interface ReadonlyHashSet<K> extends ReadonlySet<K> {
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

    [Symbol.iterator](): IterableIterator<K> {
        return this.map.keys();
    }

    entries(): IterableIterator<[K, K]> {
        return this.map.entries();
    }

    keys(): IterableIterator<K> {
        return this.map.keys();
    }

    values(): IterableIterator<K> {
        return this.map.values();
    }

    forEach(callback: (value: K, key: K, set: ReadonlyHashSet<K>) => void) {
        this.map.forEach((value, key) => callback(value, key, this));
    }

    clone(): HashSet<K> {
        const clone = new HashSet<K>(this.hashItem, this.equalItems);
        this.forEach(key => clone.add(key));
        return clone;
    }
}
