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
import {
    Dictionary, ClassModel, LinkTypeModel, ElementModel, LinkModel, LinkCount, PropertyModel, Property,
    LinkedElement, ElementIri, ElementTypeIri, LinkIri, LinkTypeIri, PropertyTypeIri,
    BLANK_NODE_PREFIX, ONTODIA_LINK_IDENTITY, ONTODIA_LIST, ONTODIA_LIST_ITEM, ONTODIA_LIST_INDEX,
} from '../model';
import { DataProvider, FilterParams } from '../provider';
import { objectValues } from '../../viewUtils/collections';
import { HashSet, ReadonlyHashSet } from '../../viewUtils/hashMap';

import { DatasetMetadataCache } from './datasetMetadataCache';
import { RdfCompositeParser, RdfParser } from './rdfCompositeParser';
import { IndexQuadBy, makeIndexedDataset, MemoryDataset } from './memoryDataset';
import * as Rdf from './rdfModel';

const RDF_NAMESPACE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const RDFS_NAMESPACE = 'http://www.w3.org/2000/01/rdf-schema#';
const OWL_NAMESPACE = 'http://www.w3.org/2002/07/owl#';
const XSD_NAMESPACE = 'http://www.w3.org/2001/XMLSchema#';

export interface RdfDataProviderOptions {
    /** RDF/JS data factory to create IRI, Literal and other terms. */
    factory?: Rdf.DataFactory;
    data?: ReadonlyArray<RdfFile>;
    parsers?: { readonly [mimeType: string]: RdfParser };
    /** @default false */
    acceptBlankNodes?: boolean;
    /** @default false */
    transformRdfList?: boolean;
    /** @default true */
    acceptLinkProperties?: boolean;
    /** @default rdf:type */
    typePredicate?: string;
    /** @default rdfs:subClassOf */
    subtypePredicate?: string;
    /** @default [rdf:Property, owl:ObjectProperty] */
    linkSupertypes?: ReadonlyArray<string>;
    /** @default [rdf:label, foaf:name, schema:name, skos:prefLabel, skos:label, skos:altLabel] */
    labelPredicates?: ReadonlyArray<string>;
    /** @default true */
    guessLabelPredicate?: boolean;
    /** @default [] */
    imagePredicates?: ReadonlyArray<string>;
    /** @default [] */
    datatypePredicates?: ReadonlyArray<string>;
}

export interface RdfFile {
    content: string;
    fileName?: string;
    type?: string;
    uri?: string;
}

const RDF_BLANK_PREFIX = BLANK_NODE_PREFIX + 'rdf:';

export class RdfDataProvider implements DataProvider {
    readonly factory: Rdf.DataFactory;

    private _parser: RdfCompositeParser;
    private acceptBlankNodes: boolean;
    private transformRdfList: boolean;
    private acceptLinkProperties: boolean;
    private initGraphLoading: Promise<unknown>;

    private dataset = createDataset();
    private readonly createMetadataCache: () => DatasetMetadataCache;
    private metadataCache: DatasetMetadataCache;

    private readonly typePredicate: Rdf.NamedNode;
    private readonly subtypePredicate: Rdf.NamedNode;
    private readonly linkSupertypes: ReadonlyArray<Rdf.NamedNode>;
    private readonly linkIdentity: Rdf.NamedNode;
    private readonly listOptions: RdfListOptions;

    constructor(options: RdfDataProviderOptions) {
        this.factory = options.factory ?? Rdf.OntodiaDataFactory;
        this._parser = new RdfCompositeParser(this.factory, options.parsers ?? {});
        this.acceptBlankNodes = Boolean(options.acceptBlankNodes);
        this.transformRdfList = Boolean(options.transformRdfList);
        this.acceptLinkProperties = Boolean(options.acceptLinkProperties ?? true);

        this.typePredicate = options.typePredicate
            ? this.factory.namedNode(options.typePredicate)
            : this.factory.namedNode(RDF_NAMESPACE + 'type');

        this.subtypePredicate = options.subtypePredicate
            ? this.factory.namedNode(options.subtypePredicate)
            : this.factory.namedNode(RDFS_NAMESPACE + 'subClassOf');

        this.linkSupertypes = options.linkSupertypes
            ? options.linkSupertypes.map(type => this.factory.namedNode(type))
            : [
                this.factory.namedNode(RDF_NAMESPACE + 'Property'),
                this.factory.namedNode(OWL_NAMESPACE + 'ObjectProperty'),
            ];

        this.linkIdentity = this.factory.namedNode(ONTODIA_LINK_IDENTITY);

        this.listOptions = {
            dataset: this.dataset,
            factory: this.factory,
            indexDatatype: this.factory.namedNode(XSD_NAMESPACE + 'integer'),
            RDF_FIRST: this.factory.namedNode(RDF_NAMESPACE + 'first'),
            RDF_REST: this.factory.namedNode(RDF_NAMESPACE + 'rest'),
            RDF_NIL: this.factory.namedNode(RDF_NAMESPACE + 'nil'),
        };

        this.createMetadataCache = () => new DatasetMetadataCache({
            factory: this.factory,
            labelPredicates: options.labelPredicates,
            guessLabelPredicate: options.guessLabelPredicate ?? true,
            imagePredicates: options.imagePredicates,
            datatypePredicates: options.datatypePredicates,
        });
        this.metadataCache = this.createMetadataCache();

        if (options.data) {
            const onGraphParsed = (graph: ReadonlyArray<Rdf.Quad>) => this.addGraph(graph);
            this.initGraphLoading = Promise.all(options.data.map(datum =>
                this._parser
                    .parse(datum.content, datum.type, datum.fileName)
                    .then(onGraphParsed)
                    .catch(error => {
                        error.message = 'Initialization failed! Cause: ' + error.message;
                        return Promise.reject(error);
                    })
            ));
        } else {
            this.initGraphLoading = Promise.resolve();
        }
    }

    get parser(): RdfCompositeParser {
        return this._parser;
    }

    clearData() {
        this.dataset = createDataset();
        this.metadataCache = this.createMetadataCache();
    }

    addGraph(graph: ReadonlyArray<Rdf.Quad>) {
        const filtered = this.acceptBlankNodes ? graph : graph.filter(nonBlankQuad);
        this.dataset.addAll(filtered);
        this.metadataCache.addFrom(filtered);
    }

    getGraph(): ReadonlyArray<Rdf.Quad> {
        return Array.from(this.dataset);
    }

    private waitInitCompleted(): Promise<unknown> {
        return this.initGraphLoading;
    }

    hasResourceInfo(subjectIri: string): boolean {
        return this.metadataCache.hasResourceInfo(subjectIri);
    }

    private getInstancesCount(type: Rdf.NamedNode | Rdf.BlankNode): number {
        let count = 0;
        for (const q of this.dataset.iterateMatches(null, this.typePredicate, type)) {
            count++;
        }
        return count;
    }

    async classTree(): Promise<ClassModel[]> {
        await this.waitInitCompleted();

        const classes: ElementTypeIri[] = [];
        for (const {object} of this.dataset.iterateMatches(null, this.typePredicate, null)) {
            if (isNamedNodeOrBlank(object)) {
                classes.push(encodeTerm(object));
            }
        }

        const parents: Dictionary<ElementTypeIri[]> = {};

        const subClasses = this.dataset.iterateMatches(null, this.subtypePredicate, null);
        for (const t of subClasses) {
            if (!(isNamedNodeOrBlank(t.subject) && isNamedNodeOrBlank(t.object))) {
                continue;
            }
            const subClassIri: ElementTypeIri = encodeTerm(t.subject);
            const classIri: ElementTypeIri = encodeTerm(t.object);
            let subClassParents = parents[subClassIri];
            if (!subClassParents) {
                subClassParents = [];
                parents[subClassIri] = subClassParents;
            }
            if (t.object.termType === 'NamedNode' && subClassParents.indexOf(classIri) < 0) {
                subClassParents.push(classIri);
            }
        }

        const dictionary: Dictionary<ClassModel> = {};
        const firstLevel: Dictionary<ClassModel> = {};

        for (const classIri of classes) {
            let classElement = dictionary[classIri];
            if (!classElement) {
                classElement = this.createEmptyClass(classIri);
                dictionary[classIri] = classElement;
                firstLevel[classIri] = classElement;
                classElement.label = {values: this.getLabels(this.decodeTerm(classIri))};
            }

            const classParents = parents[classIri];
            if (classParents) {
                for (const parentIri of classParents) {
                    let parentElement = dictionary[parentIri];
                    if (!parentElement) {
                        parentElement = this.createEmptyClass(parentIri);
                        dictionary[parentIri] = parentElement;
                        firstLevel[parentIri] = parentElement;
                        parentElement.label = {values: this.getLabels(this.decodeTerm(parentIri))};
                    }
                    if (parentElement.children.indexOf(classElement) === -1) {
                        parentElement.children.push(classElement);
                        parentElement.count = (parentElement.count || 0) + (classElement.count || 0);
                    }
                    delete firstLevel[classElement.id];
                }
            }
        }

        const result = objectValues(firstLevel);
        return result;
    }

    async propertyInfo(params: { propertyIds: PropertyTypeIri[] }): Promise<Dictionary<PropertyModel>> {
        await this.waitInitCompleted();
        const result: Dictionary<PropertyModel> = {};
        for (const propertyId of params.propertyIds) {
            const propertyIri = this.decodeTerm(propertyId);
            result[propertyId] = {
                id: propertyId,
                label: {values: this.getLabels(propertyIri)},
            };
        }
        return result;
    }

    async classInfo(params: { classIds: ElementTypeIri[] }): Promise<ClassModel[]> {
        await this.waitInitCompleted();
        const result = params.classIds.map((classId): ClassModel => {
            const classIri = this.decodeTerm(classId);
            return {
                id: classId,
                label: {values: this.getLabels(classIri)},
                count: this.getInstancesCount(classIri),
                children: [],
            };
        });
        return result;
    }

    async linkTypesInfo(params: { linkTypeIds: LinkTypeIri[] }): Promise<LinkTypeModel[]> {
        await this.waitInitCompleted();
        const result = params.linkTypeIds.map((typeId): LinkTypeModel => {
            const typeIri = this.decodeTerm(typeId);
            return {
                id: typeId,
                label: {values: this.getLabels(typeIri)},
            };
        });
        return result;
    }

    async linkTypes(): Promise<LinkTypeModel[]> {
        await this.waitInitCompleted();

        const linkTypeIds = new Set<LinkTypeIri>();
        const linkTypes: LinkTypeModel[] = [];

        for (const linkSupertype of this.linkSupertypes) {
            for (const t of this.dataset.iterateMatches(null, this.typePredicate, linkSupertype)) {
                if (!isNamedNodeOrBlank(t.subject)) { continue; }
                const id: LinkTypeIri = encodeTerm(t.subject);
                if (!linkTypeIds.has(id)) {
                    linkTypeIds.add(id);
                    linkTypes.push({
                        id,
                        label: {values: this.getLabels(t.subject)},
                    });
                }
            }
        }
        return linkTypes;
    }

    async elementInfo(params: { elementIds: ElementIri[] }): Promise<Dictionary<ElementModel>> {
        await this.waitInitCompleted();
        const result: Dictionary<ElementModel> = {};
        for (const elementId of params.elementIds) {
            const elementIri = this.decodeTerm(elementId);
            const images = this.metadataCache.findImages(this.dataset, elementIri);
            const model: ElementModel = {
                id: elementId,
                types: this.getElementTypes(elementIri),
                label: {values: this.getLabels(elementIri)},
                image: images.length > 0 ? images[0] : undefined,
                properties: this.getElementProperties(elementIri),
            };
            result[model.id] = model;
        }
        return result;
    }

    async linksInfo(params: {
        elementIds: ElementIri[];
        linkTypeIds?: LinkTypeIri[];
    }): Promise<LinkModel[]> {
        await this.waitInitCompleted();

        const elementIris = new HashSet<Rdf.Term>(Rdf.hashTerm, Rdf.equalTerms);
        for (const elementId of params.elementIds) {
            elementIris.add(this.decodeTerm(elementId));
        }

        let linkTypeIris: HashSet<Rdf.Term> | undefined;
        if (params.linkTypeIds) {
            linkTypeIris = new HashSet<Rdf.Term>(Rdf.hashTerm, Rdf.equalTerms);
            for (const linkTypeId of params.linkTypeIds) {
                linkTypeIris.add(this.decodeTerm(linkTypeId));
            }
        }

        const result: LinkModel[] = [];
        this.dataset.forEach(t => {
            if (elementIris.has(t.subject) &&
                elementIris.has(t.object) &&
                t.predicate.termType === 'NamedNode' &&
                !this.metadataCache.isDatatypeProperty(t.predicate, t.object) &&
                (!linkTypeIris || linkTypeIris.has(t.predicate))
            ) {
                const sourceId = encodeTerm(t.subject as Rdf.NamedNode | Rdf.BlankNode);
                const targetId = encodeTerm(t.object as Rdf.NamedNode | Rdf.BlankNode);
                const linkTypeId = encodeTerm(t.predicate);
                const linkIds = Array.from(this.dataset.iterateMatches(t, this.linkIdentity, null));
                if (linkIds.length > 0) {
                    for (const {object: linkId} of linkIds) {
                        if (linkId.termType === 'NamedNode' || linkId.termType === 'BlankNode') {
                            const linkIri = encodeTerm(linkId);
                            const properties = this.acceptLinkProperties
                                ? findLinkProperties(this.dataset, linkId) : {};
                            result.push({linkIri, sourceId, targetId, linkTypeId, properties});
                        }
                    }
                } else {
                    const properties = this.acceptLinkProperties
                        ? findLinkProperties(this.dataset, t) : {};
                    result.push({sourceId, targetId, linkTypeId, properties});
                }
            }
        });
        if (this.transformRdfList) {
            collectRdfListLinks(this.listOptions, params, elementIris, result);
        }
        return result;
    }

    async linkTypesOf(params: { elementId: ElementIri }): Promise<LinkCount[]> {
        await this.waitInitCompleted();

        const element = this.decodeTerm(params.elementId);
        const linkMap = new Map<LinkTypeIri, LinkCount>();
        const links: LinkCount[] = [];

        function getLinkCount(linkTypeId: LinkTypeIri): LinkCount {
            let linkCount = linkMap.get(linkTypeId);
            if (!linkCount) {
                linkCount = {
                    id: linkTypeId,
                    inCount: 0,
                    outCount: 0,
                };
                linkMap.set(linkTypeId, linkCount);
                links.push(linkCount);
            }
            return linkCount;
        }

        if (this.transformRdfList && isRdfList(this.listOptions, element)) {
            getLinkCount(ONTODIA_LIST_ITEM).outCount +=
                getRdfListResourceCount(this.listOptions, element);
        }

        this.dataset.forEach(t => {
            if (t.predicate.termType !== 'NamedNode') { return; }
            if (this.metadataCache.isDatatypeProperty(t.predicate, t.object)) { return; }
            const inLink = isNamedNodeOrBlank(t.subject) && Rdf.equalTerms(element, t.object);
            const outLink = isNamedNodeOrBlank(t.object) && Rdf.equalTerms(element, t.subject);
            if (inLink || outLink) {
                const linkTypeId: LinkTypeIri = encodeTerm(t.predicate);
                const linkCount = getLinkCount(linkTypeId);
                if (inLink) {
                    linkCount.inCount++;
                    if (this.transformRdfList && Rdf.equalTerms(t.predicate, this.listOptions.RDF_FIRST)) {
                        getLinkCount(ONTODIA_LIST_ITEM).inCount++;
                    }
                }
                if (outLink) {
                    linkCount.outCount++;
                }
            }
        });

        return links;
    }

    async filter(params: FilterParams): Promise<LinkedElement[]> {
        await this.waitInitCompleted();

        const filterSubject = (subject: Rdf.Term): subject is Rdf.NamedNode | Rdf.BlankNode => {
            return isNamedNodeOrBlank(subject);
        };

        const visitedSubjects = new HashSet<Rdf.Term>(Rdf.hashTerm, Rdf.equalTerms);
        const offsetIndex = params.offset ?? 0;
        const limitIndex = offsetIndex + (params.limit ?? 100);

        const statefulLimit = (subject: Rdf.Term): subject is Rdf.NamedNode | Rdf.BlankNode => {
            const index = visitedSubjects.size;
            if (visitedSubjects.has(subject)) { return false; }
            visitedSubjects.add(subject);
            return index >= offsetIndex && index < limitIndex;
        };

        let linkedIndex: LinkedItemIndex;
        if (params.elementTypeId) {
            linkedIndex = this.filterByTypeId(params.elementTypeId, filterSubject, statefulLimit);
        } else if (params.refElementId && params.refElementLinkId) {
            linkedIndex = this.filterByRefAndLink(
                params.refElementId,
                params.refElementLinkId,
                params.linkDirection,
                filterSubject,
                statefulLimit
            );
        } else if (params.refElementId) {
            linkedIndex = this.filterByRef(params.refElementId, filterSubject, statefulLimit);
        } else if (params.text) {
            linkedIndex = this.getAllElements(params.text, filterSubject, statefulLimit);
        } else {
            return [];
        }

        if (this.transformRdfList) {
            filterRdfList(linkedIndex, this.listOptions, params, filterSubject, statefulLimit);
        }

        const elements = linkedIndex.items.map((item): LinkedElement => {
            const element = this.getShortElementInfo(item.element);
            return {element, inLinks: item.inLinks, outLinks: item.outLinks};
        });
        return this.filterByKey(params.text, elements);
    }

    private filterByTypeId(
        elementTypeId: ElementTypeIri,
        filterSubject: (subject: Rdf.Term) => subject is Rdf.NamedNode | Rdf.BlankNode,
        statefulLimit: (subject: Rdf.Term) => boolean,
    ): LinkedItemIndex {
        const index = new LinkedItemIndex();
        for (const t of this.dataset.iterateMatches(null, this.typePredicate, this.decodeTerm(elementTypeId))) {
            if (filterSubject(t.subject) && statefulLimit(t.subject)) {
                index.getOrCreateItem(t.subject);
            }
        }
        return index;
    }

    private filterByRefAndLink(
        refEl: ElementIri,
        refLink: LinkTypeIri,
        linkDirection: 'in' | 'out' | undefined,
        filterSubject: (subject: Rdf.Term) => subject is Rdf.NamedNode | Rdf.BlankNode,
        statefulLimit: (subject: Rdf.Term) => boolean,
    ): LinkedItemIndex {
        const index = new LinkedItemIndex();
        const predicate = this.decodeTerm(refLink);
        if (predicate.termType === 'NamedNode' && this.metadataCache.isDatatypePredicate(predicate)) {
            return index;
        }
        if (linkDirection === 'in') {
            for (const t of this.dataset.iterateMatches(null, predicate, this.decodeTerm(refEl))) {
                if (filterSubject(t.subject) && statefulLimit(t.subject)) {
                    const item = index.getOrCreateItem(t.subject);
                    item.inLinks.push(refLink);
                }
            }
        } else {
            for (const t of this.dataset.iterateMatches(this.decodeTerm(refEl), predicate, null)) {
                if (filterSubject(t.object) && statefulLimit(t.subject)) {
                    const item = index.getOrCreateItem(t.object);
                    item.outLinks.push(refLink);
                }
            }
        }
        return index;
    }

    private filterByRef(
        refEl: ElementIri,
        filterSubject: (subject: Rdf.Term) => subject is Rdf.NamedNode | Rdf.BlankNode,
        statefulLimit: (subject: Rdf.Term) => boolean,
    ): LinkedItemIndex {
        const index = new LinkedItemIndex();

        for (const t of this.dataset.iterateMatches(null, null, this.decodeTerm(refEl))) {
            if (t.predicate.termType === 'NamedNode'
                && !this.metadataCache.isDatatypeProperty(t.predicate, t.object)
                && filterSubject(t.subject)
                && statefulLimit(t.subject)
            ) {
                const item = index.getOrCreateItem(t.subject);
                item.inLinks.push(encodeTerm(t.predicate));
            }
        }

        for (const t of this.dataset.iterateMatches(this.decodeTerm(refEl), null, null)) {
            if (t.predicate.termType === 'NamedNode'
                && !this.metadataCache.isDatatypeProperty(t.predicate, t.subject)
                && filterSubject(t.object)
                && statefulLimit(t.object)
            ) {
                const item = index.getOrCreateItem(t.object);
                item.outLinks.push(encodeTerm(t.predicate));
            }
        }

        return index;
    }

    private getAllElements(
        text: string | undefined,
        filterSubject: (subject: Rdf.Term) => subject is Rdf.NamedNode | Rdf.BlankNode,
        statefulLimit: (subject: Rdf.Term) => boolean,
    ): LinkedItemIndex {
        const key = text ? text.toLowerCase() : undefined;
        const index = new LinkedItemIndex();
        this.dataset.forEach(t => {
            if (t.predicate.termType === 'NamedNode' && filterSubject(t.subject)) {
                const objectIsLiteral = t.object.termType === 'Literal';
                const isLabel = this.metadataCache.isLabelPredicate(t.predicate);
                const containsKey = !key ||
                    isLabel && t.object.value.toLowerCase().indexOf(key) >= 0 ||
                    !objectIsLiteral && t.subject.value.toLowerCase().indexOf(key) >= 0;

                if (containsKey) {
                    if (statefulLimit(t.subject)) {
                        index.getOrCreateItem(t.subject);
                    }
                }
            }
        });
        return index;
    }

    private filterByKey(text: string | undefined, items: LinkedElement[]): LinkedElement[] {
        const key = (text ? text.toLowerCase() : null);
        if (key) {
            const result: LinkedElement[] = [];
            for (const item of items) {
                let acceptableKey = false;
                for (const label of item.element.label.values) {
                    acceptableKey = acceptableKey || label.value.toLowerCase().indexOf(key) !== -1;
                    if (acceptableKey) { break; }
                }
                acceptableKey = acceptableKey || item.element.id.toLowerCase().indexOf(key) !== -1;
                if (acceptableKey) {
                    result.push(item);
                }
            }
            return result;
        } else {
            return items;
        }
    }

    private getShortElementInfo(element: Rdf.Term): ElementModel {
        if (!isNamedNodeOrBlank(element)) {
            throw new Error(`Invalid argument for getShortElementInfo: ${Rdf.toString(element)}`);
        }
        const elementId: ElementIri = encodeTerm(element);
        const images = this.metadataCache.findImages(this.dataset, element);
        return {
            id: elementId,
            types: this.getElementTypes(element),
            label: {values: this.getLabels(element)},
            image: images.length > 0 ? images[0] : undefined,
            properties: {},
        };
    }

    private getLabels(id: Rdf.NamedNode | Rdf.BlankNode): Rdf.Literal[] {
        return this.metadataCache.findLabels(this.dataset, id);
    }

    private getElementProperties(element: Rdf.NamedNode | Rdf.BlankNode): Dictionary<Property> {
        const props: Dictionary<Property> = {};
        for (const t of this.dataset.iterateMatches(element, null, null)) {
            if (t.predicate.termType === 'NamedNode' &&
                this.metadataCache.isDatatypeProperty(t.predicate, t.object) &&
                !Rdf.equalTerms(t.predicate, this.typePredicate) &&
                !this.metadataCache.isLabelPredicate(t.predicate) &&
                !this.metadataCache.isImagePredicate(t.predicate)
            ) {
                const property = props[t.predicate.value];
                const value = t.object.termType === 'BlankNode'
                    ? this.factory.namedNode<string>(encodeTerm(t.object))
                    : (t.object as Rdf.NamedNode | Rdf.Literal);
                props[t.predicate.value] = {
                    values: property ? [...property.values, value] : [value],
                };
            }
        }
        return props;
    }

    private getElementTypes(element: Rdf.NamedNode | Rdf.BlankNode): ElementTypeIri[] {
        const typeSet = new Set<ElementTypeIri>();
        for (const t of this.dataset.iterateMatches(element, this.typePredicate, null)) {
            if (!isNamedNodeOrBlank(t.object)) { continue; }
            typeSet.add(encodeTerm(t.object));
        }
        if (this.transformRdfList && isRdfList(this.listOptions, element)) {
            typeSet.add(ONTODIA_LIST);
        }
        const types: ElementTypeIri[] = [];
        typeSet.forEach(type => types.push(type));
        return types;
    }

    private createEmptyClass(classIri: ElementTypeIri): ClassModel {
        return {
            id: classIri,
            label: {
                values: [],
            },
            count: this.getInstancesCount(this.decodeTerm(classIri)),
            children: [],
        };
    }

    private decodeTerm(
        iri: ElementIri | ElementTypeIri | LinkTypeIri | PropertyTypeIri
    ): Rdf.NamedNode | Rdf.BlankNode {
        return decodeTerm(iri, this.factory);
    }

    static decodeTerm(id: string, factory: Rdf.DataFactory): Rdf.NamedNode | Rdf.BlankNode {
        return decodeTerm(id as ElementIri, factory);
    }
}

function createDataset() {
    return makeIndexedDataset(
        // tslint:disable-next-line: no-bitwise
        IndexQuadBy.S | IndexQuadBy.SP | IndexQuadBy.OP
    );
}

function decodeTerm(
    iri: ElementIri | ElementTypeIri | LinkTypeIri | PropertyTypeIri,
    factory: Rdf.DataFactory
): Rdf.NamedNode | Rdf.BlankNode {
    return iri.startsWith(RDF_BLANK_PREFIX)
        ? factory.blankNode(iri.substring(RDF_BLANK_PREFIX.length))
        : factory.namedNode(iri);
}

function encodeTerm(
    term: Rdf.NamedNode | Rdf.BlankNode
): ElementIri & ElementTypeIri & LinkIri & LinkTypeIri & PropertyTypeIri {
    const encoded = term.termType === 'BlankNode'
        ? (RDF_BLANK_PREFIX + term.value)
        : term.value;
    return encoded as ElementIri & ElementTypeIri & LinkIri & LinkTypeIri & PropertyTypeIri;
}

function isNamedNodeOrBlank(term: Rdf.Term): term is Rdf.NamedNode | Rdf.BlankNode {
    return term.termType === 'NamedNode' || term.termType === 'BlankNode';
}

function nonBlankQuad(quad: Rdf.Quad): boolean {
    return quad.subject.termType !== 'BlankNode' && quad.object.termType !== 'BlankNode';
}

export interface LinkedItem {
    element: Rdf.NamedNode | Rdf.BlankNode;
    inLinks: LinkTypeIri[];
    outLinks: LinkTypeIri[];
}

export class LinkedItemIndex {
    readonly items: LinkedItem[] = [];
    readonly index = new Map<ElementIri, LinkedItem>();

    getOrCreateItem(term: Rdf.NamedNode | Rdf.BlankNode): LinkedItem {
        const elementIri: ElementIri = encodeTerm(term);
        let item = this.index.get(elementIri);
        if (!item) {
            item = {element: term, inLinks: [], outLinks: []};
            this.items.push(item);
        }
        return item;
    }
}

function findLinkProperties(
    dataset: MemoryDataset,
    linkId: Rdf.Quad | Rdf.NamedNode | Rdf.BlankNode
): { [propertyTypeIri: string]: Property } {
    function arrayHasTerm(
        array: Array<Rdf.NamedNode | Rdf.Literal>,
        value: Rdf.NamedNode | Rdf.Literal
    ) {
        for (const term of array) {
            if (Rdf.equalTerms(term, value)) {
                return true;
            }
        }
        return false;
    }
    let propertyMap: Map<string, Array<Rdf.NamedNode | Rdf.Literal>> | undefined;
    for (const q of dataset.iterateMatches(linkId, null, null)) {
        if (q.predicate.termType === 'NamedNode' && (
            q.object.termType === 'NamedNode' ||
            q.object.termType === 'Literal'
        )) {
            if (!propertyMap) {
                propertyMap = new Map<string, Array<Rdf.NamedNode | Rdf.Literal>>();
            }
            const propertyTypeIri = q.predicate.value;
            let values = propertyMap.get(propertyTypeIri);
            if (!values) {
                values = [];
                propertyMap.set(propertyTypeIri, values);
            }
            if (!arrayHasTerm(values, q.object)) {
                values.push(q.object);
            }
        }
    }
    const properties: { [propertyTypeIri: string]: Property } = {};
    if (propertyMap) {
        propertyMap.forEach((values, propertyTypeIri) => {
            properties[propertyTypeIri] = {values};
        });
    }
    return properties;
}

interface RdfListOptions {
    readonly dataset: MemoryDataset;
    readonly factory: Rdf.DataFactory;
    readonly indexDatatype: Rdf.NamedNode;
    readonly RDF_FIRST: Rdf.NamedNode;
    readonly RDF_REST: Rdf.NamedNode;
    readonly RDF_NIL: Rdf.NamedNode;
}

function collectRdfListLinks(
    options: RdfListOptions,
    params: {
        elementIds: ElementIri[];
        linkTypeIds?: LinkTypeIri[];
    },
    elementIriSet: ReadonlyHashSet<Rdf.Term>,
    outputLinks: LinkModel[]
): void {
    const {factory} = options;
    if (params.linkTypeIds && params.linkTypeIds.indexOf(ONTODIA_LIST_ITEM) < 0) {
        return;
    }
    for (const elementId of params.elementIds) {
        const iri = decodeTerm(elementId, factory);
        if (isRdfList(options, iri)) {
            const items = getRdfListItems(options, iri);
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (!(item && elementIriSet.has(item))) { continue; }
                outputLinks.push({
                    sourceId: elementId,
                    linkTypeId: ONTODIA_LIST_ITEM,
                    targetId: encodeTerm(item as Rdf.NamedNode | Rdf.BlankNode),
                    properties: {
                        [ONTODIA_LIST_INDEX]: {
                            values: [options.factory.literal(String(i), options.indexDatatype)]
                        }
                    }
                });
            }
        }
    }
}

function filterRdfList(
    index: LinkedItemIndex,
    options: RdfListOptions,
    params: FilterParams,
    filterSubject: (subject: Rdf.Term) => subject is Rdf.NamedNode | Rdf.BlankNode,
    statefulLimit: (subject: Rdf.Term) => boolean
): void {
    const {dataset, factory} = options;
    if (!params.refElementId) {
        return;
    }
    const refElementIri = decodeTerm(params.refElementId, factory);
    if (isRdfList(options, refElementIri)) {
        if (!params.refElementLinkId || params.refElementLinkId === ONTODIA_LIST_ITEM) {
            for (const item of getRdfListItems(options, refElementIri)) {
                if (item && filterSubject(item) && statefulLimit(item)) {
                    const connectedItem = index.getOrCreateItem(item);
                    connectedItem.outLinks.push(ONTODIA_LIST_ITEM);
                }
            }
        }
    }
    if (!params.refElementLinkId || params.refElementLinkId === ONTODIA_LIST_ITEM) {
        for (const t of dataset.iterateMatches(null, options.RDF_FIRST, refElementIri)) {
            if (filterSubject(t.subject)) {
                const list = findRdfListHead(options, t.subject);
                if (statefulLimit(list)) {
                    const connectedList = index.getOrCreateItem(list);
                    connectedList.inLinks.push(ONTODIA_LIST_ITEM);
                }
            }
        }
    }
}

function isRdfList(
    {dataset, RDF_REST}: RdfListOptions,
    element: Rdf.NamedNode | Rdf.BlankNode
): boolean {
    for (const t of dataset.iterateMatches(element, RDF_REST, null)) {
        return true;
    }
    return false;
}

function getRdfListItems(
    options: RdfListOptions,
    list: Rdf.NamedNode | Rdf.BlankNode
): Array<Rdf.Term | null> {
    const {dataset, RDF_FIRST, RDF_REST, RDF_NIL} = options;
    const items: Array<Rdf.Term | null> = [];
    let tail: Rdf.NamedNode | Rdf.BlankNode | undefined = list;
    while (tail && !Rdf.equalTerms(tail, RDF_NIL)) {
        let first: Rdf.Term | null = null;
        for (const q of dataset.iterateMatches(tail, RDF_FIRST, null)) {
            first = q.object;
            break;
        }
        items.push(first);
        let rest: Rdf.Term | undefined;
        for (const q of dataset.iterateMatches(tail, RDF_REST, null)) {
            rest = q.object;
            break;
        }
        tail = rest && (rest.termType === 'NamedNode' || rest.termType === 'BlankNode')
            ? rest : undefined;
    }
    return items;
}

function findRdfListHead(
    options: RdfListOptions,
    tail: Rdf.NamedNode | Rdf.BlankNode
): Rdf.NamedNode | Rdf.BlankNode {
    const {dataset, RDF_REST} = options;
    let current = tail;
    while (true) {
        let parent: Rdf.NamedNode | Rdf.BlankNode | undefined;
        for (const q of dataset.iterateMatches(null, RDF_REST, current)) {
            if (q.subject.termType === 'NamedNode' || q.subject.termType === 'BlankNode') {
                parent = q.subject;
                break;
            }
        }
        if (parent && !Rdf.equalTerms(parent, tail)) {
            current = parent;
        } else {
            break;
        }
    }
    return current;
}

function getRdfListResourceCount(options: RdfListOptions, list: Rdf.NamedNode | Rdf.BlankNode): number {
    let count = 0;
    for (const item of getRdfListItems(options, list)) {
        if (item && (item.termType === 'NamedNode' || item.termType === 'BlankNode')) {
            count++;
        }
    }
    return count;
}
