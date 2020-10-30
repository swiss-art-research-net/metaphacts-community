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
import { HashMap } from '../../viewUtils/hashMap';
import { Quad, Term, OntodiaDataFactory, hashTerm, equalTerms, hashQuad, equalQuads } from './rdfModel';

export interface MemoryDataset {
    readonly size: number;
    add(quad: Quad): this;
    addAll(quads: ReadonlyArray<Quad>): this;
    delete(quad: Quad): this;
    has(quad: Quad): boolean;
    iterateMatches(
        subject: Term | undefined | null,
        predicate: Term | undefined | null,
        object: Term | undefined | null,
        graph?: Term | null
    ): ReadonlyArray<Quad>;
    forEach(callback: (t: Quad) => void): void;
}

export enum IndexQuadBy {
    /** Index by whole quad (default, required). */
    OnlyQuad = 0,
    /** Index by quad subject. */
    S = 1,
    /* Reserved: P = 2 */
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

const EMPTY_QUADS: ReadonlyArray<Quad> = [];

class IndexedDataset implements MemoryDataset {
    private _size = 0;

    private readonly byQuad: HashMap<Quad, Quad>;
    private readonly bySubject: HashMap<Term, Set<Quad>> | undefined;
    private readonly byObject: HashMap<Term, Set<Quad>> | undefined;
    private readonly bySubjectPredicate: HashMap<SourcePredicateKey, Quad[]> | undefined;
    private readonly byObjectPredicate: HashMap<SourcePredicateKey, Quad[]> | undefined;

    constructor(indexBy: IndexQuadBy) {
        this.byQuad = new HashMap<Quad, Quad>(hashQuad, equalQuads);
        /* tslint:disable: no-bitwise */
        if (indexBy & IndexQuadBy.S) {
            this.bySubject = new HashMap<Term, Set<Quad>>(hashTerm, equalTerms);
        }
        if (indexBy & IndexQuadBy.O) {
            this.byObject = new HashMap<Term, Set<Quad>>(hashTerm, equalTerms);
        }
        if (indexBy & IndexQuadBy.SP) {
            this.bySubjectPredicate = new HashMap<SourcePredicateKey, Quad[]>(
                SourcePredicateKey.hashCode, SourcePredicateKey.equals
            );
        }
        if (indexBy & IndexQuadBy.OP) {
            this.byObjectPredicate = new HashMap<SourcePredicateKey, Quad[]>(
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
                pushToByTermIndex(this.bySubject, quad.subject, quad);
            }
            if (this.byObject) {
                pushToByTermIndex(this.byObject, quad.object, quad);
            }
            if (this.bySubjectPredicate) {
                pushToSPIndex(
                    this.bySubjectPredicate,
                    {source: quad.subject, predicate: quad.predicate},
                    quad
                );
            }
            if (this.byObjectPredicate) {
                pushToSPIndex(
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
                deleteFromByTermIndex(this.bySubject, existing.subject, existing);
            }
            if (this.byObject) {
                deleteFromByTermIndex(this.byObject, existing.object, existing);
            }
            if (this.bySubjectPredicate) {
                deleteFromSPIndex(
                    this.bySubjectPredicate,
                    {source: quad.subject, predicate: quad.predicate},
                    existing
                );
            }
            if (this.byObjectPredicate) {
                deleteFromSPIndex(
                    this.byObjectPredicate,
                    {source: quad.object, predicate: quad.predicate},
                    existing
                );
            }
            this._size--;
        }
        return this;
    }

    has(quad: Quad): boolean {
        return this.byQuad.has(quad);
    }

    iterateMatches(
        subject: Quad['subject'] | undefined | null,
        predicate: Quad['predicate'] | undefined | null,
        object: Quad['object'] | undefined | null,
        graph?: Quad['graph'] | null
    ): ReadonlyArray<Quad> {
        let result: ReadonlyArray<Quad>;
        if (subject && predicate && object && graph) {
            const found = this.byQuad.get(OntodiaDataFactory.quad(subject, predicate, object, graph));
            result = found ? [found] : [];
        } else if (this.bySubjectPredicate && subject && predicate) {
            result = this.bySubjectPredicate.get({source: subject, predicate}) || EMPTY_QUADS;
        } else if (this.byObjectPredicate && predicate && object) {
            result = this.byObjectPredicate.get({source: object, predicate}) || EMPTY_QUADS;
        } else if (this.bySubject && subject) {
            return quadSetToArray(this.bySubject.get(subject));
        } else if (this.byObject && object) {
            return quadSetToArray(this.byObject.get(object));
        } else {
            result = filterBySPO(this.byQuad, subject, predicate, object);
        }
        return graph ? filterByGraph(result, graph) : result;
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

function pushToByTermIndex(index: HashMap<Term, Set<Quad>>, key: Term, quad: Quad) {
    let items = index.get(key);
    if (!items) {
        items = new Set<Quad>();
        index.set(key, items);
    }
    items.add(quad);
}

function deleteFromByTermIndex(index: HashMap<Term, Set<Quad>>, key: Term, quad: Quad) {
    const items = index.get(key);
    if (items) {
        items.delete(quad);
    }
}

function quadSetToArray(set: Set<Quad> | undefined): ReadonlyArray<Quad> {
    if (!set) { return EMPTY_QUADS; }
    const array: Quad[] = [];
    set.forEach(q => array.push(q));
    return array;
}

function pushToSPIndex(
    index: HashMap<SourcePredicateKey, Quad[]>,
    key: SourcePredicateKey,
    quad: Quad
) {
    let items = index.get(key);
    if (!items) {
        items = [];
        index.set(key, items);
    }
    items.push(quad);
}

function deleteFromSPIndex(
    index: HashMap<SourcePredicateKey, Quad[]>,
    key: SourcePredicateKey,
    quad: Quad
) {
    const items = index.get(key);
    if (items) {
        for (let i = 0; i < items.length; i++) {
            if (equalQuads(items[i], quad)) {
                items.splice(i, 1);
                break;
            }
        }
    }
}

function filterBySPO(
    quads: HashMap<Quad, Quad>,
    subject: Term | undefined | null,
    predicate: Term | undefined | null,
    object: Term | undefined | null,
): ReadonlyArray<Quad> {
    const result: Quad[] = [];
    quads.forEach(quad => {
        if (subject && !equalTerms(subject, quad.subject)) { return; }
        if (predicate && !equalTerms(predicate, quad.predicate)) { return; }
        if (object && !equalTerms(object, quad.object)) { return; }
        result.push(quad);
    });
    return result;
}

function filterByGraph(quads: ReadonlyArray<Quad>, graph: Term): ReadonlyArray<Quad> {
    const result: Quad[] = [];
    for (const quad of quads) {
        if (equalTerms(quad.graph, graph)) {
            result.push(quad);
        }
    }
    return result;
}
