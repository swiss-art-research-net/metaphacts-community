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
    Dictionary, ElementIri, ElementModel, ElementTypeIri, LinkTypeIri, PropertyModel, PropertyTypeIri, ClassModel,
    LinkCount, LinkModel, LinkTypeModel, LinkedElement,
} from '../model';
import { DataProvider, FilterParams } from '../provider';

import { RdfDataProvider } from './rdfDataProvider';
import { RdfLoader } from './rdfLoader';
import * as Rdf from './rdfModel';

export interface LodDataProviderOptions {
    baseProvider: RdfDataProvider;
    proxyUrl?: string;
}

export class LodDataProvider implements DataProvider {
    private readonly baseProvider: RdfDataProvider;
    private readonly rdfLoader: RdfLoader;
    private readonly fetchingResources = new Map<string, Promise<unknown>>();
    private readonly resolvedResources = new Set<string>();

    constructor(options: LodDataProviderOptions) {
        this.baseProvider = options.baseProvider;
        this.rdfLoader = new RdfLoader({
            factory: this.baseProvider.factory,
            parser: this.baseProvider.parser,
            proxyUrl: options.proxyUrl,
        });
    }

    get factory(): Rdf.DataFactory {
        return this.baseProvider.factory;
    }

    classTree(): Promise<ClassModel[]> {
        return this.baseProvider.classTree();
    }

    linkTypes(): Promise<LinkTypeModel[]> {
        return this.baseProvider.linkTypes();
    }

    async classInfo(params: { classIds: ElementTypeIri[] }): Promise<ClassModel[]> {
        const initialResult = await this.baseProvider.classInfo(params);
        const missingResources = this.missingResourcesFromArray(initialResult);
        if (missingResources.size === 0) {
            return initialResult;
        }
        await this.loadMissingInfo(missingResources);
        return this.baseProvider.classInfo(params);
    }

    async propertyInfo(params: { propertyIds: PropertyTypeIri[] }): Promise<Dictionary<PropertyModel>> {
        const initialResult = await this.baseProvider.propertyInfo(params);
        const missingResources = this.missingResourcesFromObject(initialResult);
        if (missingResources.size === 0) {
            return initialResult;
        }
        await this.loadMissingInfo(missingResources);
        return this.baseProvider.propertyInfo(params);
    }

    async linkTypesInfo(params: { linkTypeIds: LinkTypeIri[] }): Promise<LinkTypeModel[]> {
        const initialResult = await this.baseProvider.linkTypesInfo(params);
        const missingResources = this.missingResourcesFromArray(initialResult);
        if (missingResources.size === 0) {
            return initialResult;
        }
        await this.loadMissingInfo(missingResources);
        return this.baseProvider.linkTypesInfo(params);
    }

    async elementInfo(params: { elementIds: ElementIri[] }): Promise<Dictionary<ElementModel>> {
        const initialResult = await this.baseProvider.elementInfo(params);
        const missingResources = this.missingResourcesFromObject(initialResult);
        if (missingResources.size === 0) {
            return initialResult;
        }
        await this.loadMissingInfo(missingResources);
        return this.baseProvider.elementInfo(params);
    }

    async linksInfo(params: {
        elementIds: ElementIri[];
        linkTypeIds?: LinkTypeIri[];
    }): Promise<LinkModel[]> {
        const missingResources = new Set<string>();
        for (const elementId of params.elementIds) {
            if (this.baseProvider.hasResourceInfo(elementId)) { continue; }
            const resourceUrl = this.rdfLoader.resourceUrlFromIri(elementId);
            if (!this.resolvedResources.has(resourceUrl.value)) {
                missingResources.add(resourceUrl.value);
            }
        }
        if (missingResources.size > 0) {
            await this.loadMissingInfo(missingResources);
        }
        return this.baseProvider.linksInfo(params);
    }

    linkTypesOf(params: { elementId: ElementIri }): Promise<LinkCount[]> {
        return this.baseProvider.linkTypesOf(params);
    }

    async filter(params: FilterParams): Promise<LinkedElement[]> {
        const initialResult = await this.baseProvider.filter(params);
        const missingResources = this.missingResourcesFromArray(
            initialResult.map(item => item.element)
        );
        if (missingResources.size === 0) {
            return initialResult;
        }
        await this.loadMissingInfo(missingResources);
        return this.baseProvider.filter(params);
    }

    private missingResourcesFromArray(result: ReadonlyArray<{ readonly id: string }>): Set<string> {
        const resources = new Set<string>();
        for (const model of result) {
            if (this.baseProvider.hasResourceInfo(model.id)) { continue; }
            const resourceUrl = this.rdfLoader.resourceUrlFromIri(model.id);
            if (!this.resolvedResources.has(resourceUrl.value)) {
                resources.add(resourceUrl.value);
            }
        }
        return resources;
    }

    private missingResourcesFromObject(result: Dictionary<{ readonly id: string }>): Set<string> {
        const resources = new  Set<string>();
        for (const key in result) {
            if (!Object.prototype.hasOwnProperty.call(result, key)) { continue; }
            const model = result[key]!;
            if (this.baseProvider.hasResourceInfo(model.id)) { continue; }
            const resourceUrl = this.rdfLoader.resourceUrlFromIri(model.id);
            if (!this.resolvedResources.has(resourceUrl.value)) {
                resources.add(resourceUrl.value);
            }
        }
        return resources;
    }

    private async loadMissingInfo(resources: Set<string>): Promise<void> {
        const tasks: Promise<unknown>[] = [];
        resources.forEach(resourceIri => {
            let task = this.fetchingResources.get(resourceIri);
            if (!task) {
                task = this.rdfLoader.downloadElement(resourceIri)
                    .then(graph => {
                        this.fetchingResources.delete(resourceIri);
                        this.resolvedResources.add(resourceIri);
                        const graphWithUniqueBlanks = renameBlankNodes(this.factory, graph);
                        this.baseProvider.addGraph(graphWithUniqueBlanks);
                    })
                    .catch(error => {
                        this.fetchingResources.delete(resourceIri);
                        this.resolvedResources.add(resourceIri);
                        // tslint:disable-next-line:no-console
                        console.warn(`Failed to fetch resource <${resourceIri}>`, error);
                    });
                this.fetchingResources.set(resourceIri, task);
            }
            tasks.push(task);
        });
        await Promise.all(tasks);
    }
}

export function renameBlankNodes(factory: Rdf.DataFactory, graph: ReadonlyArray<Rdf.Quad>): Rdf.Quad[] {
    const suffix = '-' + factory.blankNode().value;
    const mapTerm = (term: Rdf.Term): Rdf.Term => {
        return term.termType === 'BlankNode'
            ? factory.blankNode(term.value + suffix)
            : term;
    };
    return graph.map(q => factory.quad(
        mapTerm(q.subject) as Rdf.Quad['subject'],
        mapTerm(q.predicate) as Rdf.Quad['predicate'],
        mapTerm(q.object) as Rdf.Quad['object'],
        mapTerm(q.graph) as Rdf.Quad['graph']
    ));
}
