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
import { HashMap } from '../../viewUtils/hashMap';
import { Quad, Term, OntodiaDataFactory, hashTerm, equalTerms, hashQuad, equalQuads } from './rdfModel';

export interface MemoryDataset extends Iterable<Quad> {
    readonly size: number;
    add(quad: Quad): this;
    addAll(quads: ReadonlyArray<Quad>): this;
    delete(quad: Quad): this;
    clear(): void;
    has(quad: Quad): boolean;
    hasMatches(
        subject: Term | undefined | null,
        predicate: Term | undefined | null,
        object: Term | undefined | null,
        graph?: Term | null
    ): boolean;
    iterateMatches(
        subject: Term | undefined | null,
        predicate: Term | undefined | null,
        object: Term | undefined | null,
        graph?: Term | null
    ): Iterable<Quad>;
    forEach(callback: (t: Quad) => void): void;
}

export enum IndexQuadBy {
    /** Index by whole quad (default, required). */
    OnlyQuad = 0,
    /** Index by quad subject. */
    S = 1,
    /** Index by quad predicate. */
    P = 2,
    /** Index by quad object. */
    O = 4,
    /** Index by quad subject and predicate. */
    SP = 8,
    /** Index by quad object and predicate. */
    OP = 16,
    /* Reserved: SO = 32 */
    /* Reserved: G = 64 */
}

export function makeIndexedDataset(indexBy: IndexQuadBy): MemoryDataset {
    return new IndexedDataset(indexBy);
}

class IndexedDataset implements MemoryDataset {
    private _size = 0;

    private readonly byQuad: HashMap<Quad, Quad>;
    private readonly bySubject: HashMap<Term, SmallQuadSet> | undefined;
    private readonly byPredicate: HashMap<Term, SmallQuadSet> | undefined;
    private readonly byObject: HashMap<Term, SmallQuadSet> | undefined;
    private readonly bySubjectPredicate: HashMap<SourcePredicateKey, SmallQuadSet> | undefined;
    private readonly byObjectPredicate: HashMap<SourcePredicateKey, SmallQuadSet> | undefined;

    constructor(indexBy: IndexQuadBy) {
        this.byQuad = new HashMap<Quad, Quad>(hashQuad, equalQuads);
        /* tslint:disable: no-bitwise */
        if (indexBy & IndexQuadBy.S) {
            this.bySubject = new HashMap<Term, SmallQuadSet>(hashTerm, equalTerms);
        }
        if (indexBy & IndexQuadBy.P) {
            this.byPredicate = new HashMap<Term, SmallQuadSet>(hashTerm, equalTerms);
        }
        if (indexBy & IndexQuadBy.O) {
            this.byObject = new HashMap<Term, SmallQuadSet>(hashTerm, equalTerms);
        }
        if (indexBy & IndexQuadBy.SP) {
            this.bySubjectPredicate = new HashMap<SourcePredicateKey, SmallQuadSet>(
                SourcePredicateKey.hashCode, SourcePredicateKey.equals
            );
        }
        if (indexBy & IndexQuadBy.OP) {
            this.byObjectPredicate = new HashMap<SourcePredicateKey, SmallQuadSet>(
                SourcePredicateKey.hashCode, SourcePredicateKey.equals
            );
        }
        /* tslint:enable: no-bitwise */
    }

    get size(): number {
        return this._size;
    }

    add(quad: Quad): this {
        if (!this.byQuad.has(quad)) {
            this.byQuad.set(quad, quad);
            if (this.bySubject) {
                pushToIndex(this.bySubject, quad.subject, quad);
            }
            if (this.byPredicate) {
                pushToIndex(this.byPredicate, quad.predicate, quad);
            }
            if (this.byObject) {
                pushToIndex(this.byObject, quad.object, quad);
            }
            if (this.bySubjectPredicate) {
                pushToIndex(
                    this.bySubjectPredicate,
                    {source: quad.subject, predicate: quad.predicate},
                    quad
                );
            }
            if (this.byObjectPredicate) {
                pushToIndex(
                    this.byObjectPredicate,
                    {source: quad.object, predicate: quad.predicate},
                    quad
                );
            }
            this._size++;
        }
        return this;
    }

    addAll(quads: ReadonlyArray<Quad>): this {
        for (const quad of quads) {
            this.add(quad);
        }
        return this;
    }

    delete(quad: Quad): this {
        const existing = this.byQuad.get(quad);
        if (existing) {
            this.byQuad.delete(existing);
            if (this.bySubject) {
                deleteFromIndex(this.bySubject, existing.subject, existing);
            }
            if (this.byPredicate) {
                deleteFromIndex(this.byPredicate, existing.predicate, existing);
            }
            if (this.byObject) {
                deleteFromIndex(this.byObject, existing.object, existing);
            }
            if (this.bySubjectPredicate) {
                deleteFromIndex(
                    this.bySubjectPredicate,
                    {source: quad.subject, predicate: quad.predicate},
                    existing
                );
            }
            if (this.byObjectPredicate) {
                deleteFromIndex(
                    this.byObjectPredicate,
                    {source: quad.object, predicate: quad.predicate},
                    existing
                );
            }
            this._size--;
        }
        return this;
    }

    clear(): void {
        this._size = 0;
        this.byQuad.clear();
        if (this.bySubject) {
            this.bySubject.clear();
        }
        if (this.byPredicate) {
            this.byPredicate.clear();
        }
        if (this.byObject) {
            this.byObject.clear();
        }
        if (this.bySubjectPredicate) {
            this.bySubjectPredicate.clear();
        }
        if (this.byObjectPredicate) {
            this.byObjectPredicate.clear();
        }
    }

    has(quad: Quad): boolean {
        return this.byQuad.has(quad);
    }

    hasMatches(
        subject: Quad['subject'] | undefined | null,
        predicate: Quad['predicate'] | undefined | null,
        object: Quad['object'] | undefined | null,
        graph?: Quad['graph'] | null
    ): boolean {
        for (const q of this.iterateMatches(subject, predicate, object, graph)) {
            return true;
        }
        return false;
    }

    iterateMatches(
        subject: Quad['subject'] | undefined | null,
        predicate: Quad['predicate'] | undefined | null,
        object: Quad['object'] | undefined | null,
        graph?: Quad['graph'] | null
    ): Iterable<Quad> {
        let result: Iterable<Quad>;
        if (subject && predicate && object && graph) {
            const found = this.byQuad.get(OntodiaDataFactory.quad(subject, predicate, object, graph));
            result = found ? [found] : [];
        } else if (this.bySubjectPredicate && subject && predicate) {
            const indexed = this.bySubjectPredicate.get({source: subject, predicate});
            result = filterBySPO(iterateSmallSet(indexed), null, null, object);
        } else if (this.byObjectPredicate && predicate && object) {
            const indexed = this.byObjectPredicate.get({source: object, predicate});
            result = filterBySPO(iterateSmallSet(indexed), subject, null, null);
        } else if (this.bySubject && subject) {
            const indexed = this.bySubject.get(subject);
            result = filterBySPO(iterateSmallSet(indexed), null, predicate, object);
        } else if (this.byPredicate && predicate) {
            const indexed = this.byPredicate.get(predicate);
            result = filterBySPO(iterateSmallSet(indexed), subject, null, object);
        } else if (this.byObject && object) {
            const indexed = this.byObject.get(object);
            result = filterBySPO(iterateSmallSet(indexed), subject, predicate, null);
        } else {
            result = filterBySPO(this.byQuad.values(), subject, predicate, object);
        }
        return graph ? filterByGraph(result, graph) : result;
    }

    [Symbol.iterator](): Iterator<Quad> {
        return this.byQuad.values();
    }

    forEach(callback: (t: Quad) => void): void {
        this.byQuad.forEach(callback);
    }
}

interface SourcePredicateKey {
    readonly source: Term;
    readonly predicate: Term;
}
namespace SourcePredicateKey {
    export function hashCode(key: SourcePredicateKey): number {
        // tslint:disable-next-line: no-bitwise
        return (hashTerm(key.source) * 31 + hashTerm(key.predicate)) | 0;
    }
    export function equals(a: SourcePredicateKey, b: SourcePredicateKey): boolean {
        return equalTerms(a.source, b.source) && equalTerms(a.predicate, b.predicate);
    }
}

type SmallQuadSet = Quad | Set<Quad> | undefined;

function iterateSmallSet(set: SmallQuadSet): Iterable<Quad> {
    return set instanceof Set ? set : (set ? [set] : []);
}

function pushToIndex<K>(index: HashMap<K, SmallQuadSet>, key: K, quad: Quad) {
    let bucket = index.get(key);
    if (!bucket) {
        bucket = quad;
        index.set(key, bucket);
    } else if (bucket instanceof Set) {
        bucket.add(quad);
    } else {
        const single = bucket;
        bucket = new Set<Quad>();
        bucket.add(single);
        bucket.add(quad);
        index.set(key, bucket);
    }
}

function deleteFromIndex<K>(index: HashMap<K, SmallQuadSet>, key: K, quad: Quad) {
    const items = index.get(key);
    if (items) {
        if (items instanceof Set) {
            items.delete(quad);
        } else {
            index.delete(key);
        }
    }
}

function *filterBySPO(
    quads: Iterable<Quad>,
    subject: Term | undefined | null,
    predicate: Term | undefined | null,
    object: Term | undefined | null,
): Iterable<Quad> {
    for (const quad of quads) {
        if (subject && !equalTerms(subject, quad.subject)) { continue; }
        if (predicate && !equalTerms(predicate, quad.predicate)) { continue; }
        if (object && !equalTerms(object, quad.object)) { continue; }
        yield quad;
    }
}

function *filterByGraph(quads: Iterable<Quad>, graph: Term): Iterable<Quad> {
    for (const quad of quads) {
        if (equalTerms(quad.graph, graph)) {
            yield quad;
        }
    }
}
