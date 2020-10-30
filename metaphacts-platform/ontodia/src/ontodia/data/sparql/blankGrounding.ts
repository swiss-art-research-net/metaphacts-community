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
import {
    Dictionary, ElementIri, LinkCount, LinkTypeIri, ElementModel, ElementTypeIri, LinkModel, ONTODIA_LIST,
} from '../model';
import { FilterParams } from '../provider';
import { hashFnv32a } from '../utils';
import { getOrCreateSetInMap } from '../../viewUtils/collections';
import { HashSet, HashMap } from '../../viewUtils/hashMap';

import { RdfDataProvider, RdfDataProviderOptions } from '../rdf/rdfDataProvider';
import * as Rdf from '../rdf/rdfModel';
import { MemoryDataset, IndexQuadBy, makeIndexedDataset } from '../rdf/memoryDataset';

import { SparqlDataProvider, resolveTemplate } from './sparqlDataProvider';
import { ElementBinding, ElementTypeBinding, SparqlResponse } from './sparqlModels';
import {
    EncodedGraphPair, PointedGraph, encodePointedGraph, decodePointedGraph, encodePairToIri, decodeIriToPair,
    decodePairToPointedGraph, pointerFromIndex, indexFromPointer, pointedGraphToHashString,
} from './blankEncoding';

const DEFAULT_MAX_LEVEL_DEEP = 3;
const ONTODIA_LEVEL_IRI = 'ontodia:blankLevel';

const RDF_NAMESPACE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';

export interface BlankGroundingOptions {
    maxRequestedLevel?: number;
    rdfOptions?: RdfDataProviderOptions;
}

export class BlankGrounding {
    private readonly factory: Rdf.DataFactory;
    private readonly maxRequestedLevel: number;
    private readonly rdfOptions: RdfDataProviderOptions;
    private readonly typePredicate: Rdf.NamedNode;

    private readonly ONTODIA_LEVEL: Rdf.NamedNode;

    constructor(factory: Rdf.DataFactory, options: BlankGroundingOptions = {}) {
        this.factory = factory;
        this.maxRequestedLevel = options.maxRequestedLevel ?? DEFAULT_MAX_LEVEL_DEEP;
        this.rdfOptions = {
            ...options.rdfOptions,
            factory,
        };
        this.typePredicate = this.rdfOptions.typePredicate
            ? this.factory.namedNode(this.rdfOptions.typePredicate)
            : this.factory.namedNode(RDF_NAMESPACE + 'type');
        this.ONTODIA_LEVEL = factory.namedNode(ONTODIA_LEVEL_IRI);
    }

    hasBlankResults(response: SparqlResponse<ElementBinding>): boolean {
        return Boolean(response.results.bindings.find(b => b.inst.termType === 'BlankNode'));
    }

    async augmentBlankResults(
        dataProvider: SparqlDataProvider,
        filterSelectQuery: string
    ): Promise<Dictionary<ElementModel>> {
        const selectIndex = filterSelectQuery.indexOf('SELECT');
        if (selectIndex < 0) {
            throw new Error('Cannot find SELECT in filer query');
        }
        const prefixes = filterSelectQuery.substring(0, selectIndex);
        const baseQuery = filterSelectQuery.substring(selectIndex);
        for (let maxLevel = 1; maxLevel <= this.maxRequestedLevel; maxLevel++) {
            const augmentedQuery = makeQueryWithMaxLevel(maxLevel, baseQuery);
            const results = await dataProvider.executeSparqlConstruct(prefixes + augmentedQuery);
            const graph = makeIndexedDataset(
                // tslint:disable-next-line: no-bitwise
                IndexQuadBy.S | IndexQuadBy.O
            );
            const blankMinLevels = new HashMap<Rdf.BlankNode, number>(Rdf.hashTerm, Rdf.equalTerms);
            for (const q of results) {
                if (Rdf.equalTerms(q.predicate, this.ONTODIA_LEVEL)) {
                    if (q.subject.termType === 'BlankNode' && q.object.termType === 'Literal') {
                        const level = parseInt(q.object.value, 10);
                        const existing = blankMinLevels.get(q.subject);
                        if (existing === undefined || level < existing) {
                            blankMinLevels.set(q.subject, level);
                        }
                    }
                } else {
                    graph.add(q);
                }
            }
            let hasNodeAtMaxLevel = false;
            blankMinLevels.forEach((level) => {
                if (level === maxLevel) {
                    hasNodeAtMaxLevel = true;
                }
            });
            if (hasNodeAtMaxLevel && maxLevel < this.maxRequestedLevel) {
                continue;
            }
            const encodedBlanks: ElementIri[] = [];
            blankMinLevels.forEach((level, root) => {
                if (level !== 0) { return; }
                const blankDataset = findConnectedBlankSplit(graph, root);
                if (blankDataset.size === 0) { return; }
                const canonicalGraph = canonicalizeBlankSplit({
                    quads: blankDataset.iterateMatches(null, null, null),
                    pointer: root,
                }, this.factory);
                const encodedBlank = encodePointedGraph(canonicalGraph);
                encodedBlanks.push(encodedBlank);
            });
            return this.elementInfo(encodedBlanks, false);
        }
        return {};
    }

    async elementInfo(iris: ElementIri[], fetchProperties = true): Promise<Dictionary<ElementModel>> {
        const models: Dictionary<ElementModel> = {};
        const providers = new Map<string, RdfDataProvider>();
        for (const iri of iris) {
            const sourcePair = decodeIriToPair(iri);
            if (sourcePair) {
                let provider = providers.get(sourcePair.encodedGraph);
                if (!provider) {
                    const pointedGraph = decodePairToPointedGraph(sourcePair, this.factory);
                    provider = this.makeRdfProviderFromGraph(pointedGraph);
                    providers.set(sourcePair.encodedGraph, provider);
                }
                const pointer = pointerFromIndex(sourcePair.pointerIndex, this.factory);
                const rdfTarget = makeRdfBlank(pointer) as ElementIri;
                const rdfResult = await provider.elementInfo({elementIds: [rdfTarget]});
                const rdfModel = rdfResult[rdfTarget];
                if (rdfModel) {
                    if (!fetchProperties) {
                        rdfModel.properties = {};
                    }
                    models[iri] = mapElementModelFromRdf(rdfModel, sourcePair, this.factory);
                }
            }
        }
        return models;
    }

    linksInfo(params: {
        elementIds: ElementIri[];
        linkTypeIds?: LinkTypeIri[];
    }): Promise<LinkModel[]> {
        const pointerByGraph = new Map<string, Set<string>>();
        const nonBlankIris = new Set<ElementIri>();
        for (const iri of params.elementIds) {
            const pair = decodeIriToPair(iri);
            if (pair) {
                getOrCreateSetInMap(pointerByGraph, pair.encodedGraph).add(
                    pointerFromIndex(pair.pointerIndex, this.factory).value
                );
            } else {
                nonBlankIris.add(iri);
            }
        }
        const links: LinkModel[] = [];
        const tasks: Promise<unknown>[] = [];
        pointerByGraph.forEach((pointers, encodedGraph) => {
            const source: EncodedGraphPair = {encodedGraph, pointerIndex: 1};
            const pointedGraph = decodePairToPointedGraph(source, this.factory);
            const provider = this.makeRdfProviderFromGraph(pointedGraph);
            const elementIds: ElementIri[] = [];
            pointers.forEach(pointer => elementIds.push(
                makeRdfBlank(this.factory.blankNode(pointer)) as ElementIri
            ));
            nonBlankIris.forEach(iri => elementIds.push(iri));
            const task = provider.linksInfo({elementIds, linkTypeIds: params.linkTypeIds}).then(found => {
                for (const link of found) {
                    links.push({
                        sourceId: mapSparqlBlankFromRdfBlank(link.sourceId, source, this.factory) as ElementIri,
                        linkTypeId: link.linkTypeId,
                        targetId: mapSparqlBlankFromRdfBlank(link.targetId, source, this.factory) as ElementIri,
                        properties: link.properties,
                    });
                }
            });
            tasks.push(task);
        });
        return Promise.all(tasks).then(() => links);
    }

    linkTypesOf(params: { elementId: ElementIri }): Promise<LinkCount[]> {
        const pointedGraph = decodePointedGraph(params.elementId, this.factory);
        if (!pointedGraph) {
            return Promise.resolve([]);
        }
        const provider = this.makeRdfProviderFromGraph(pointedGraph);
        return provider.linkTypesOf({
            elementId: makeRdfBlank(pointedGraph.pointer) as ElementIri,
        });
    }

    async filter(
        dataProvider: SparqlDataProvider,
        params: FilterParams
    ): Promise<Dictionary<ElementModel> | undefined> {
        if (!params.refElementId) { return undefined; }
        const sourcePair = decodeIriToPair(params.refElementId);
        if (!sourcePair) { return undefined; }
        const pointedGraph = decodePairToPointedGraph(sourcePair, this.factory);
        const provider = this.makeRdfProviderFromGraph(pointedGraph);
        const rdfResults = await provider.filter({
            ...params,
            refElementId:  makeRdfBlank(pointedGraph.pointer) as ElementIri,
        });
        let results: Dictionary<ElementModel> = {};
        const nonBlankIris: ElementIri[] = [];
        for (const rdfIri in rdfResults) {
            if (!Object.prototype.hasOwnProperty.call(rdfResults, rdfIri)) { continue; }
            const mappedModel = mapElementModelFromRdf(rdfResults[rdfIri]!, sourcePair, this.factory);
            if (mappedModel) {
                results[mappedModel.id] = mappedModel;
            } else {
                nonBlankIris.push(rdfIri as ElementIri);
            }
        }
        if (nonBlankIris.length > 0) {
            const fetchedModels = await dataProvider.elementInfo({elementIds: nonBlankIris});
            results = {...results, ...fetchedModels};
        }
        return results;
    }

    getElementTypes(iris: ReadonlyArray<ElementIri>): SparqlResponse<ElementTypeBinding> {
        const bindings: ElementTypeBinding[] = [];
        const decodedGraphs = new Map<string, ReadonlyArray<Rdf.Quad>>();
        for (const iri of iris) {
            const sourcePair = decodeIriToPair(iri);
            if (sourcePair) {
                let quads = decodedGraphs.get(sourcePair.encodedGraph);
                if (!quads) {
                    const pointedGraph = decodePairToPointedGraph(sourcePair, this.factory);
                    quads = pointedGraph.quads;
                    decodedGraphs.set(sourcePair.encodedGraph, quads);
                }
                const pointer = pointerFromIndex(sourcePair.pointerIndex, this.factory);
                for (const q of quads) {
                    if (Rdf.equalTerms(q.subject, pointer) &&
                        Rdf.equalTerms(q.predicate, this.typePredicate) &&
                        q.object.termType === 'NamedNode'
                    ) {
                        bindings.push({inst: this.factory.namedNode(iri), class: q.object});
                    }
                }
            }
        }
        return {
            head: {vars: ['inst', 'class']},
            results: {bindings},
        };
    }

    private makeRdfProviderFromGraph(pointedGraph: PointedGraph) {
        const {
            transformRdfList = true,
            guessLabelPredicate = false,
        } = this.rdfOptions;
        const provider = new RdfDataProvider({
            ...this.rdfOptions,
            transformRdfList,
            guessLabelPredicate,
            acceptBlankNodes: true,
        });
        provider.addGraph(pointedGraph.quads);
        return provider;
    }
}

function mapElementModelFromRdf(
    model: ElementModel,
    source: EncodedGraphPair,
    factory: Rdf.DataFactory
): ElementModel | undefined {
    if (!model.id.startsWith('ontodia:blank:rdf:')) {
        return undefined;
    }
    const mappedProperties: ElementModel['properties'] = {};
    for (const propIri in model.properties) {
        if (!Object.prototype.hasOwnProperty.call(model.properties, propIri)) { continue; }
        mappedProperties[propIri] = {
            values: model.properties[propIri]!.values.map(
                v => v.termType === 'Literal'
                    ? v : factory.namedNode(mapSparqlBlankFromRdfBlank(v.value, source, factory))
            )
        };
    }
    const newIri = mapSparqlBlankFromRdfBlank(model.id, source, factory) as ElementIri;
    let label = model.label;
    if (label.values.length === 0) {
        const decodedGraph = decodePointedGraph(newIri, factory)!;
        const hashString = pointedGraphToHashString(decodedGraph);
        const name = model.types.indexOf(ONTODIA_LIST) >= 0 ? 'list' : 'blank';
        label = {values: [factory.literal(`${name} ${hashString}`)]};
    }
    return {
        ...model,
        id: newIri,
        types: model.types.map(type => mapSparqlBlankFromRdfBlank(type, source, factory) as ElementTypeIri),
        label,
        properties: mappedProperties,
    };
}

function mapSparqlBlankFromRdfBlank(iri: string, source: EncodedGraphPair, factory: Rdf.DataFactory): string {
    if (!iri.startsWith('ontodia:blank:rdf:')) { return iri; }
    const newPointer = factory.blankNode(iri.substring('ontodia:blank:rdf:'.length));
    return encodePairToIri({
        encodedGraph: source.encodedGraph,
        pointerIndex: indexFromPointer(newPointer),
    });
}

function makeRdfBlank(blank: Rdf.BlankNode): string {
    return 'ontodia:blank:rdf:' + blank.value;
}

function makeQueryWithMaxLevel(maxLevel: number, baseQuery: string) {
    const constructBlocks: string[] = [];
    let lastWhereBlock = ' ';
    for (let level = maxLevel; level >= 1; level--) {
        constructBlocks.unshift(resolveTemplate(LEVEL_CONSTRUCT_PATTERN, {
            prev: String(level - 1),
            level: String(level),
        }));
        lastWhereBlock = resolveTemplate(LEVEL_WHERE_PATTERN, {
            prev: String(level - 1),
            level: String(level),
            nestedPattern: lastWhereBlock,
        });
    }
    const augmentedQuery = resolveTemplate(AUGMENTED_QUERY_TEMPLATE, {
        baseQuery,
        constructPatterns: constructBlocks.join('\n'),
        wherePatterns: lastWhereBlock,
    });
    return augmentedQuery;
}

const AUGMENTED_QUERY_TEMPLATE =
`CONSTRUCT {
    ?inst <${ONTODIA_LEVEL_IRI}> 0 .
    \${constructPatterns}
} WHERE {
    { \${baseQuery} }
    FILTER(IsBlank(?inst))
    BIND(?inst as ?node0)
    \${wherePatterns}
}`;

const LEVEL_CONSTRUCT_PATTERN =
`?node\${level} <${ONTODIA_LEVEL_IRI}> \${level} .
?node\${prev} ?out\${level} ?node\${level} .
?node\${level} ?in\${level} ?node\${prev} .
?item\${level} rdf:first ?node\${level} .
?item\${level} rdf:rest ?tail\${level} .`;

const LEVEL_WHERE_PATTERN =
`OPTIONAL {
    # Find level \${level} of blank nodes
    FILTER(IsBlank(?node\${prev}))
    {
        MINUS { ?node\${prev} rdf:rest _:tailOut\${level} }
        ?node\${prev} ?out\${level} ?node\${level} .
    }
    UNION
    {
        MINUS { ?node\${level} rdf:rest _:tailIn\${level} }
        ?node\${level} ?in\${level} ?node\${prev} .
    }
    UNION
    {
        FILTER EXISTS { ?node\${prev} rdf:rest _:restOut\${level} }
        ?node\${prev} rdf:rest* ?item\${level} .
        ?item\${level} rdf:first ?node\${level} .
        ?item\${level} rdf:rest ?tail\${level} .
    }
    UNION
    {
        FILTER EXISTS { ?node\${level} rdf:rest _:restIn\${level} }
        ?itemRev\${level} rdf:first ?node\${prev} .
        ?node\${level} rdf:rest* ?itemRev\${level} .
    }
\${nestedPattern}
}`;

function findConnectedBlankSplit(indexedBySO: MemoryDataset, pivot: Rdf.BlankNode): MemoryDataset {
    const dataset = makeIndexedDataset(IndexQuadBy.OnlyQuad);
    const visited = new HashSet<Rdf.Term>(Rdf.hashTerm, Rdf.equalTerms);
    function visit(node: Rdf.BlankNode) {
        if (visited.has(node)) { return; }
        visited.add(node);
        for (const q of indexedBySO.iterateMatches(node, null, null)) {
            dataset.add(q);
            if (q.object.termType === 'BlankNode') {
                visit(q.object);
            }
        }
        for (const q of indexedBySO.iterateMatches(null, null, node)) {
            dataset.add(q);
            if (q.subject.termType === 'BlankNode') {
                visit(q.subject);
            }
        }
    }
    visit(pivot);
    return dataset;
}

function canonicalizeBlankSplit(pointedGraph: PointedGraph, factory: Rdf.DataFactory): PointedGraph {
    const {blanks, hash, finePartition} = hashBlankNodes(pointedGraph.quads);
    function mapQuad(q: Rdf.Quad): Rdf.Quad {
        const s = q.subject.termType === 'BlankNode'
            ? factory.blankNode(LongHash.toHexString(hash.get(q.subject)!))
            : q.subject;
        const o = q.object.termType === 'BlankNode'
            ? factory.blankNode(LongHash.toHexString(hash.get(q.object)!))
            : q.object;
        return factory.quad(s, q.predicate, o);
    }
    const mappedQuads = pointedGraph.quads.map(mapQuad);
    mappedQuads.sort(Rdf.compareQuads);
    const mappedPointer = factory.blankNode(LongHash.toHexString(
        hash.get(pointedGraph.pointer)!
    ));
    return {quads: mappedQuads, pointer: mappedPointer};
}

/**
 * Assigns consistent hashes for each blank node in a graph such that any tow isomorphic
 * RDF graphs will have the same hashes for corresponding nodes.
 *
 * Reference: "Canonical forms for isomorphic and equivalent RDF graphs:
 * algorithms for leaning and labelling blank nodes." by Hogan, Aidan.
 * ACM Transactions on the Web (TWEB) 11.4 (2017): 1-62.
 */
function hashBlankNodes(graph: ReadonlyArray<Rdf.Quad>) {
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

type LongHash = readonly [number, number, number, number];
namespace LongHash {
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
