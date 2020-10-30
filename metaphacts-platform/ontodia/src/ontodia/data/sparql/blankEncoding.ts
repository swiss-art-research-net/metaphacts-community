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
import { HashMap, ReadonlyHashMap } from '../../viewUtils/hashMap';
import * as Rdf from '../rdf/rdfModel';
import { ElementIri, BLANK_NODE_PREFIX } from '../model';

const ENCODED_PREFIX = BLANK_NODE_PREFIX + 'sparql2:';

export interface PointedGraph {
    quads: ReadonlyArray<Rdf.Quad>;
    pointer: Rdf.BlankNode;
}

export interface EncodedGraphPair {
    encodedGraph: string;
    pointerIndex: number;
}

type CompactedBlank = [CompactedTerms, CompactedQuads];
type CompactedTerms = [PrefixTree.Packed, ReadonlyArray<string | number>];
type CompactedQuads = Array<number>;
interface CompactedGraph {
    quads: CompactedQuads;
    pointerIndex: number;
}

export function isEncodedSparqlBlank(id: string): boolean {
    return id.startsWith(ENCODED_PREFIX);
}

export function encodePointedGraph(pointedGraph: PointedGraph): ElementIri {
    return encodePairToIri(encodePointedGraphToPair(pointedGraph));
}

export function encodePointedGraphToPair(pointedGraph: PointedGraph): EncodedGraphPair {
    const terms = findTerms(pointedGraph.quads);
    const compactedTerms = compactTermDictionary(terms.terms);
    const compactedGraph = compactGraph(pointedGraph, terms.indices);
    const compacted: CompactedBlank = [compactedTerms, compactedGraph.quads];
    const unescapedJson = JSON.stringify(compacted);
    const escapedJson = unescapedJson
        .replace(/\[/g, '(')
        .replace(/\]/g, ')')
        .replace(/,/g, ':')
        .replace(/"/g, '\'');
    return {
        encodedGraph: escapedJson,
        pointerIndex: compactedGraph.pointerIndex,
    };
}

export function encodePairToIri(pair: EncodedGraphPair): ElementIri {
    const encoded = ENCODED_PREFIX + `${pair.pointerIndex}:` + pair.encodedGraph;
    return encoded as ElementIri;
}

export function decodePointedGraph(iri: ElementIri, factory: Rdf.DataFactory): PointedGraph | undefined {
    const pair = decodeIriToPair(iri);
    if (!pair) { return undefined; }
    return decodePairToPointedGraph(pair, factory);
}

export function decodeIriToPair(iri: ElementIri): EncodedGraphPair | undefined {
    if (!isEncodedSparqlBlank(iri)) { return undefined; }
    const withoutPrefix = iri.substring(ENCODED_PREFIX.length);
    const separatorIndex = withoutPrefix.indexOf(':');
    if (separatorIndex < 0) {
        throw new Error('Cannot find separator for blank pointer and graph');
    }
    const pointerIndex = Number(withoutPrefix.substring(0, separatorIndex));
    return {
        encodedGraph: withoutPrefix.substring(separatorIndex + 1),
        pointerIndex,
    };
}

export function decodePairToPointedGraph(pair: EncodedGraphPair, factory: Rdf.DataFactory): PointedGraph {
    const unescapedJson = pair.encodedGraph
        .replace(/\(/g, '[')
        .replace(/\)/g, ']')
        .replace(/:/g, ',')
        .replace(/'/g, '"');
    const [compactedTerms, compactedQuads] = JSON.parse(unescapedJson) as CompactedBlank;
    const terms = expandTermDictionary(compactedTerms, factory);
    const pointedGraph = expandGraph(
        {quads: compactedQuads, pointerIndex: pair.pointerIndex},
        terms,
        factory
    );
    return pointedGraph;
}

interface TermDictionary {
    terms: ReadonlyArray<Rdf.Term>;
    indices: ReadonlyHashMap<Rdf.Term, number>;
}

function findTerms(graph: ReadonlyArray<Rdf.Quad>): TermDictionary {
    const terms = new HashMap<Rdf.Term, number>(Rdf.hashTerm, Rdf.equalTerms);
    for (const q of graph) {
        if (q.subject.termType === 'NamedNode') {
            terms.set(q.subject, 0);
        }
        if (q.predicate.termType === 'NamedNode') {
            terms.set(q.predicate, 0);
        }
        if (q.object.termType === 'NamedNode' || q.object.termType === 'Literal') {
            terms.set(q.object, 0);
        }
    }
    const array: Rdf.Term[] = [];
    terms.forEach((index, term) => array.push(term));
    array.sort(Rdf.compareTerms);
    for (let i = 0; i < array.length; i++) {
        terms.set(array[i], i);
    }
    return {terms: array, indices: terms};
}

function compactTermDictionary(terms: ReadonlyArray<Rdf.Term>): CompactedTerms {
    function visitTerms(
        writeKey: (key: string) => void,
        writeValue: (str: string) => void
    ) {
        for (const term of terms) {
            switch (term.termType) {
                case 'NamedNode': {
                    writeKey('N');
                    writeValue(term.value);
                    break;
                }
                case 'BlankNode': {
                    writeKey('B');
                    writeValue(term.value);
                    break;
                }
                case 'Literal': {
                    if (term.language) {
                        writeKey('L');
                        writeValue(term.value);
                        writeValue(term.language);
                    } else {
                        writeKey('D');
                        writeValue(term.value);
                        writeValue(term.datatype.value);
                    }
                    break;
                }
                case 'Variable': {
                    writeKey('V');
                    writeValue(term.value);
                    break;
                }
                case 'DefaultGraph': {
                    writeKey('G');
                    break;
                }
            }
        }
    }

    const tree: PrefixTree = PrefixTree.create();
    visitTerms(() => {/* nothing */}, str => {
        PrefixTree.insert(tree, str);
    });
    const strings = PrefixTree.keys(tree);
    strings.sort();
    const stringIndices = new Map<string, number>();
    for (let i = 0; i < strings.length; i++) {
        stringIndices.set(strings[i], i);
    }

    const output: Array<string | number> = [];
    visitTerms(
        key => output.push(key),
        str => {
            const index = stringIndices.get(str);
            if (typeof index !== 'number') {
                throw new Error('Failed to find index for term string');
            }
            output.push(index);
        }
    );
    return [PrefixTree.pack(tree), output];
}

function expandTermDictionary(
    [packedTree, packedTerms]: CompactedTerms,
    factory: Rdf.DataFactory
): ReadonlyArray<Rdf.Term> {
    const tree = PrefixTree.unpack(packedTree);
    const strings = PrefixTree.keys(tree);
    strings.sort();

    const terms: Rdf.Term[] = [];
    let i = 0;
    function readPackedString() {
        if (i >= packedTerms.length) {
            throw new Error('Unexpected end of compacted term dictionary');
        }
        const stringIndex = packedTerms[i];
        i++;
        if (typeof stringIndex !== 'number' || stringIndex < 0 || stringIndex >= strings.length) {
            throw new Error('Invalid packed string reference');
        }
        return strings[stringIndex];
    }
    while (i < packedTerms.length) {
        const type = packedTerms[i];
        i++;
        let term: Rdf.Term;
        switch (type) {
            case 'N': {
                term = factory.namedNode(readPackedString());
                break;
            }
            case 'B': {
                term = factory.blankNode(readPackedString());
                break;
            }
            case 'L': {
                term = factory.literal(readPackedString(), readPackedString());
                break;
            }
            case 'D': {
                term = factory.literal(readPackedString(), factory.namedNode(readPackedString()));
                break;
            }
            case 'V': {
                term = factory.variable!(readPackedString());
                break;
            }
            case 'G': {
                term = factory.defaultGraph();
                break;
            }
            default:
                throw new Error('Unexpected compacted term type: ' + type);
        }
        terms.push(term);
    }
    return terms;
}

function compactGraph(
    {quads, pointer}: PointedGraph,
    indices: TermDictionary['indices'],
): CompactedGraph {
    const result: Array<number> = [];
    let pointerIndex = 0;
    const blanks = new Map<string, number>();
    function writeTerm(term: Rdf.Term) {
        if (term.termType === 'BlankNode') {
            if (blanks.has(term.value)) {
                result.push(blanks.get(term.value)!);
            } else {
                const index = blanks.size + 1;
                blanks.set(term.value, -index);
                result.push(-index);
                if (Rdf.equalTerms(term, pointer)) {
                    pointerIndex = index;
                }
            }
        } else {
            result.push(indices.get(term)!);
        }
    }
    for (const q of quads) {
        writeTerm(q.subject);
        writeTerm(q.predicate);
        writeTerm(q.object);
    }
    return {quads: result, pointerIndex};
}

function expandGraph(
    {quads, pointerIndex}: CompactedGraph,
    terms: TermDictionary['terms'],
    factory: Rdf.DataFactory
): PointedGraph {
    let i = 0;
    function readTerm(): Rdf.Term {
        if (i >= quads.length) {
            throw new Error('Unexpected end of compacted graph');
        }
        const termIndex = quads[i];
        i++;
        if (termIndex < 0) {
            return factory.blankNode('b' + String(-termIndex));
        } else if (termIndex > terms.length) {
            throw new Error('Invalid out of bounds term index');
        }
        return terms[termIndex];
    }
    const result: Rdf.Quad[] = [];
    while (i < quads.length) {
        const subject = readTerm() as Rdf.Quad['subject'];
        const predicate = readTerm() as Rdf.Quad['predicate'];
        const object = readTerm() as Rdf.Quad['object'];
        result.push(factory.quad(subject, predicate, object));
    }
    return {quads: result, pointer: pointerFromIndex(pointerIndex, factory)};
}

export function pointerFromIndex(pointerIndex: number, factory: Rdf.DataFactory): Rdf.BlankNode {
    return factory.blankNode('b' + pointerIndex);
}

export function indexFromPointer(pointer: Rdf.BlankNode): number {
    const index = pointer.value.startsWith('b')
        ? Number(pointer.value.substring(1)) : NaN;
    if (Number.isNaN(index)) {
        throw new Error('Invalid blank graph pointer');
    }
    return index;
}

interface PrefixTree {
    end?: boolean;
    children?: Map<string, PrefixTree>;
}
namespace PrefixTree {
    export type Packed = number | [number, ...unknown[]];

    export function create(): PrefixTree {
        return {};
    }

    export function insert(tree: PrefixTree, str: string): void {
        if (str.length === 0) {
            tree.end = true;
            return;
        }
        if (!tree.children) {
            tree.children = new Map<string, PrefixTree>();
        }
        let inserted = false;
        tree.children.forEach((child, prefix) => {
            if (inserted) { return; }
            const shared = commonPrefixLength(prefix, str);
            if (shared === prefix.length) {
                insert(child, str.substring(shared));
                inserted = true;
            } else if (shared > 0) {
                tree.children!.delete(prefix);
                const head: PrefixTree = {};
                head.children = new Map<string, PrefixTree>();
                head.children.set(prefix.substring(shared), child);
                head.children.set(str.substring(shared), {end: true});
                tree.children!.set(prefix.substring(0, shared), head);
                inserted = true;
            }
        });
        if (!inserted) {
            tree.children.set(str, {end: true});
        }
    }

    function commonPrefixLength(a: string, b: string): number {
        const minLength = Math.min(a.length, b.length);
        for (let i = 0; i < minLength; i++) {
            if (a[i] !== b[i]) {
                return i;
            }
        }
        return minLength;
    }

    export function keys(tree: PrefixTree): string[] {
        const result: string[] = [];
        function visit(base: string, node: PrefixTree) {
            if (node.end) {
                result.push(base);
            }
            if (node.children) {
                node.children.forEach((child, prefix) => visit(base + prefix, child));
            }
        }
        visit('', tree);
        return result;
    }

    export function pack(tree: PrefixTree): Packed {
        if (tree.children) {
            const prefixes: string[] = [];
            tree.children.forEach((child, prefix) => prefixes.push(prefix));
            prefixes.sort();
            const packed: Packed = [tree.end ? 1 : 0];
            for (const prefix of prefixes) {
                packed.push(encodeURIComponent(prefix));
                packed.push(pack(tree.children.get(prefix)!));
            }
            return packed;
        } else {
            return tree.end ? 1 : 0;
        }
    }

    export function unpack(packed: Packed): PrefixTree {
        if (typeof packed === 'number') {
            const end = packed;
            if (!(end === 0 || end === 1)) {
                throw new Error('Unexpected non-0 or 1 tree node value');
            }
            return end ? {end: true} : {};
        } else if (Array.isArray(packed)) {
            const [end, ...items] = packed;
            if (!(end === 0 || end === 1)) {
                throw new Error('Unexpected non-0 or 1 tree node value');
            }
            const tree: PrefixTree = end ? {end: true} : {};
            let i = 0;
            while (i < items.length) {
                const prefix = items[i];
                i++;
                if (typeof prefix !== 'string') {
                    throw new Error('Expected string prefix value but found: ' + typeof prefix);
                }
                if (i >= items.length) {
                    throw new Error('Missing child prefix tree node');
                }
                const packedChild = items[i];
                i++;
                const child = unpack(packedChild as Packed);
                if (!tree.children) {
                    tree.children = new Map<string, PrefixTree>();
                }
                tree.children.set(decodeURIComponent(prefix), child);
            }
            return tree;
        } else {
            throw new Error('Unexpected non-number, non-array tree node');
        }
    }
}

export function pointedGraphToHashString({quads, pointer}: PointedGraph): string {
    /* tslint:disable: no-bitwise */
    let hash = 0;
    for (const q of quads) {
        hash = (hash * 31 + Rdf.hashQuad(q)) | 0;
    }
    const hashString = (0x100000000 + hash).toString(16).substring(1);
    const pointerIndex = /^b[0-9]+$/.test(pointer.value)
        ? pointer.value.substring(1)
        : pointer.value;
    return `${hashString}:${quads.length}:${pointerIndex}`;
    /* tslint:enable: no-bitwise */
}
