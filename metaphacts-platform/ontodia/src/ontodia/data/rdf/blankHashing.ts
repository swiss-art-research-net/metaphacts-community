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
import * as Rdf from '../rdf/rdfModel';
import { MemoryDataset, IndexQuadBy, makeIndexedDataset } from '../rdf/memoryDataset';

import { HashSet, HashMap } from '../../viewUtils/hashMap';

import { hashFnv32a } from '../utils';

export function canonicalizeBlanks(
    quads: ReadonlyArray<Rdf.Quad>,
    factory: Rdf.DataFactory
): HashMap<Rdf.BlankNode, Rdf.BlankNode> {
    // tslint:disable-next-line: no-bitwise
    const dataset = makeIndexedDataset(IndexQuadBy.S | IndexQuadBy.O);
    dataset.addAll(quads);

    const finder = new BlankSplitFinder(dataset);

    const visitBlank = (blank: Rdf.BlankNode) => {
        if (mappedBlanks.has(blank)) { return; }
        const blankSplit = finder.findBlankSplit(blank);
        canonicalizeBlankSplit(blankSplit, factory, mappedBlanks);
    };

    const mappedBlanks = new HashMap<Rdf.BlankNode, Rdf.BlankNode>(Rdf.hashTerm, Rdf.equalTerms);
    for (const {subject, object} of quads) {
        if (subject.termType === 'BlankNode') {
            visitBlank(subject);
        }
        if (object.termType === 'BlankNode') {
            visitBlank(object);
        }
    }
    return mappedBlanks;
}

export class BlankSplitFinder {
    private readonly visited = new HashSet<Rdf.BlankNode>(Rdf.hashTerm, Rdf.equalTerms);
    private readonly stack: Rdf.BlankNode[] = [];
    private readonly set = new HashSet<Rdf.BlankNode>(Rdf.hashTerm, Rdf.equalTerms);

    private readonly connectedSplitSet = makeIndexedDataset(IndexQuadBy.OnlyQuad);

    constructor(
        private readonly indexedBySO: MemoryDataset
    ) {}

    findBlankSplit(pivot: Rdf.BlankNode): ReadonlyArray<Rdf.Quad> {
        const {indexedBySO, connectedSplitSet, visited, stack, set} = this;
        visited.clear();
        connectedSplitSet.clear();

        stack.push(pivot);
        set.add(pivot);

        while (stack.length > 0) {
            const node = stack.pop()!;
            set.delete(node);

            visited.add(node);
            for (const q of indexedBySO.iterateMatches(node, null, null)) {
                connectedSplitSet.add(q);
                if (q.object.termType === 'BlankNode') {
                    if (!visited.has(q.object) && !set.has(q.object)) {
                        stack.push(q.object);
                        set.add(q.object);
                    }
                }
            }
            for (const q of indexedBySO.iterateMatches(null, null, node)) {
                connectedSplitSet.add(q);
                const next = q.subject;
                if (next.termType === 'BlankNode') {
                    if (!visited.has(next) && !set.has(next)) {
                        stack.push(next);
                        set.add(next);
                    }
                }
            }
        }

        return this.connectedSplitSet.iterateMatches(null, null, null);
    }
}

export function canonicalizeBlankSplit(
    blankSplit: ReadonlyArray<Rdf.Quad>,
    factory: Rdf.DataFactory,
    outMappedBlanks: HashMap<Rdf.BlankNode, Rdf.BlankNode>
): void {
    const {blanks, hash} = hashBlankNodes(blankSplit);
    for (const blank of blanks) {
        const computedHash = hash.get(blank)!;
        const mappedBlank = factory.blankNode(LongHash.toHexString(computedHash));
        outMappedBlanks.set(blank, mappedBlank);
    }
}

export interface HashBlankNodesResult {
    blanks: Rdf.BlankNode[];
    hash: HashMap<Rdf.Term, LongHash>;
    finePartition: boolean;
}

/**
 * Assigns consistent hashes for each blank node in a graph such that any tow isomorphic
 * RDF graphs will have the same hashes for corresponding nodes.
 *
 * Reference: "Canonical forms for isomorphic and equivalent RDF graphs:
 * algorithms for leaning and labelling blank nodes." by Hogan, Aidan.
 * ACM Transactions on the Web (TWEB) 11.4 (2017): 1-62.
 */
export function hashBlankNodes(graph: ReadonlyArray<Rdf.Quad>): HashBlankNodesResult {
    let hash = new HashMap<Rdf.Term, LongHash>(Rdf.hashTerm, Rdf.equalTerms);
    const blanks: Rdf.BlankNode[] = [];
    function addTermHash(term: Rdf.Term) {
        if (hash.has(term)) { return; }
        if (term.termType === 'NamedNode' || term.termType === 'Literal') {
            hash.set(term, LongHash.fromTerm(term));
        } else if (term.termType === 'BlankNode') {
            blanks.push(term);
            hash.set(term, LongHash.ZERO);
        }
    }
    for (const q of graph) {
        addTermHash(q.subject);
        addTermHash(q.predicate);
        addTermHash(q.object);
    }
    // equivalency classes for each blank
    let classLeaders: ReadonlyArray<Rdf.BlankNode | undefined> = blanks;
    const hashToLeader = new HashMap<LongHash, Rdf.BlankNode>(LongHash.toHash32, LongHash.equal);
    let iteration = 0;
    while (true) {
        const nextHash = hash.clone();
        for (const q of graph) {
            if (q.subject.termType === 'BlankNode') {
                const quadHash = LongHash.tuple(hash.get(q.object)!, hash.get(q.predicate)!, true);
                nextHash.set(q.subject, LongHash.bag(quadHash, nextHash.get(q.subject)!));
            }
        }
        for (const q of graph) {
            if (q.object.termType === 'BlankNode') {
                const quadHash = LongHash.tuple(hash.get(q.subject)!, hash.get(q.predicate)!, false);
                nextHash.set(q.object, LongHash.bag(quadHash, nextHash.get(q.object)!));
            }
        }
        const nextLeaders: Rdf.BlankNode[] = [];
        let i = 0;
        let classLeaderChanged = false;
        let finePartition = true;
        for (const blank of blanks) {
            const blankHash = nextHash.get(blank)!;
            let nextLeader = hashToLeader.get(blankHash);
            if (nextLeader) {
                finePartition = false;
                if (nextLeader !== classLeaders[i]) {
                    classLeaderChanged = true;
                }
            } else {
                nextLeader = blank;
                hashToLeader.set(blankHash, nextLeader);
            }
            nextLeaders.push(nextLeader);
            i++;
        }
        if (!classLeaderChanged) {
            return {
                blanks,
                hash: nextHash,
                finePartition,
            };
        }

        classLeaders = nextLeaders;
        hash = nextHash;
        hashToLeader.clear();

        iteration++;
        if (iteration > blanks.length) {
            throw new Error('Failed to converge blank node hashes');
        }
    }
}

export type LongHash = readonly [number, number, number, number];
export namespace LongHash {
    export const ZERO: LongHash = [0, 0, 0, 0];

    export function toHash32(value: LongHash) {
        /* tslint:disable: no-bitwise */
        let h = value[0];
        h = (h * 31 + value[1]) | 0;
        h = (h * 31 + value[2]) | 0;
        h = (h * 31 + value[3]) | 0;
        return h;
        /* tslint:enable: no-bitwise */
    }

    export function equal(a: LongHash, b: LongHash) {
        for (let i = 0; i < 4; i++) {
            if (a[i] !== b[i]) { return false; }
        }
        return true;
    }

    export function compare(a: LongHash, b: LongHash) {
        for (let i = 0; i < 4; i++) {
            const av = a[i];
            const bv = b[i];
            if (av < bv) { return -1; }
            if (av > bv) { return 1; }
        }
        return 0;
    }

    export function toHexString(h: LongHash) {
        return h.map(x => (x + 0x100000000).toString(16).substring(1)).join('');
    }

    export function fromString(str: string): LongHash {
        const r0 = hashFnv32a(str, 0x811c9dc5);
        const r1 = hashFnv32a(str, 0x41c6ce57);
        const r2 = hashFnv32a(str, 0xdeadbeef);
        const r3 = hashFnv32a(str, 0x55555555);
        return [r0, r1, r2, r3];
    }

    export function fromTerm(term: Rdf.Term): LongHash {
        let hash = fromString(term.value);
        if (term.termType === 'Literal') {
            const additionalHash = term.language
                ? fromString(term.language)
                : fromString(term.datatype.value);
            hash = tuple(hash, additionalHash, true);
        }
        return hash;
    }

    /**
     * Computes an order-dependant hash of its inputs.
     */
    export function tuple(u: LongHash, v: LongHash, out: boolean): LongHash {
        /* tslint:disable: no-bitwise */
        const p = out ? 17 : 19;
        const q = out ? 23 : 29;
        const r01 = shuffleBits((u[0] * p + v[1] * q) | 0);
        const r12 = shuffleBits((u[1] * p + v[2] * q) | 0);
        const r23 = shuffleBits((u[2] * p + v[3] * q) | 0);
        const r30 = shuffleBits((u[3] * p + v[0] * q) | 0);
        /* tslint:enable: no-bitwise */
        return [r12, r23, r30, r01];
    }

    function shuffleBits(h: number) {
        // tslint:disable-next-line: no-bitwise
        return (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) | 0;
    }

    /**
     * Computes hash in a commutative and associative way over its inputs.
     */
    export function bag(u: LongHash, v: LongHash): LongHash {
        /* tslint:disable: no-bitwise */
        return [
            (u[0] + v[0]) | 0,
            (u[1] + v[1]) | 0,
            (u[2] + v[2]) | 0,
            (u[3] + v[3]) | 0,
        ];
        /* tslint:enable: no-bitwise */
    }
}
