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
import { DataProvider, LinkElementsParams, FilterParams } from '../provider';
import {
    Dictionary, ClassModel, LinkTypeModel, ElementModel, LinkModel, LinkCount,
    ElementIri, ElementTypeIri, LinkTypeIri,
} from '../model';
import { Rdf } from '../rdf';
import { objectValues } from '../../viewUtils/collections';

export class DemoDataProvider implements DataProvider {
    readonly factory = Rdf.OntodiaDataFactory;

    constructor(
        private allClasses: ClassModel[],
        private allLinkTypes: LinkTypeModel[],
        private allElements: Dictionary<ElementModel>,
        private allLinks: LinkModel[],
    ) {}

    private simulateNetwork<T>(result: T) {
        const MEAN_DELAY = 200;
        // deeply clone the result
        const cloned = JSON.parse(JSON.stringify(result));
        // simulate exponential distribution
        const delay = -Math.log(Math.random()) * MEAN_DELAY;
        return new Promise<T>(resolve => {
            setTimeout(() => resolve(cloned), delay);
        });
    }

    classTree() {
        return this.simulateNetwork(this.allClasses);
    }

    classInfo(params: { classIds: ElementTypeIri[] }) {
        const classIds = params.classIds || [];
        return this.simulateNetwork(this.allClasses.filter(cl => classIds.indexOf(cl.id)));
    }

    linkTypes() {
        return this.simulateNetwork(this.allLinkTypes);
    }

    linkTypesInfo(params: { linkTypeIds: LinkTypeIri[] }): Promise<LinkTypeModel[]> {
        const linkTypeSet = new Set<LinkTypeIri>();
        for (const linkType of params.linkTypeIds) {
            linkTypeSet.add(linkType);
        }
        const linkTypes = this.allLinkTypes.filter(type => linkTypeSet.has(type.id));
        return this.simulateNetwork(linkTypes);
    }

    elementInfo(params: { elementIds: ElementIri[] }): Promise<Dictionary<ElementModel>> {
        const result: Dictionary<ElementModel> = {};
        for (const elementId of params.elementIds) {
            if (Object.prototype.hasOwnProperty.call(this.allElements, elementId)) {
                result[elementId] = this.allElements[elementId];
            }
        }
        return this.simulateNetwork(result);
    }

    linksInfo(params: {
        elementIds: ElementIri[];
        linkTypeIds?: LinkTypeIri[];
    }) {
        const elements = new Set<ElementIri>();
        params.elementIds.forEach(element => elements.add(element));
        let types: Set<LinkTypeIri> | undefined;
        if (params.linkTypeIds) {
            types = new Set<LinkTypeIri>();
            params.linkTypeIds.forEach(type => types!.add(type));
        }
        const links = this.allLinks.filter(link =>
            elements.has(link.sourceId) &&
            elements.has(link.targetId) &&
            (!types || types.has(link.linkTypeId))
        );
        return this.simulateNetwork(links);
    }

    linkTypesOf(params: { elementId: ElementIri }) {
        const counts: Dictionary<LinkCount> = {};
        for (const link of this.allLinks) {
            if (link.sourceId === params.elementId ||
                link.targetId === params.elementId
            ) {
                const linkCount = counts[link.linkTypeId];
                const isSource = link.sourceId === params.elementId;
                if (linkCount) {
                    isSource ? linkCount.outCount++ : linkCount.inCount++;
                } else {
                    counts[link.linkTypeId] = isSource
                        ? {id: link.linkTypeId, inCount: 0, outCount: 1}
                        : {id: link.linkTypeId, inCount: 1, outCount: 0};
                }
            }
        }
        return this.simulateNetwork(objectValues(counts));
    }

    linkElements(params: LinkElementsParams): Promise<Dictionary<ElementModel>> {
        // for sparql we have rich filtering features and we just reuse filter.
        return this.filter({
            refElementId: params.elementId,
            refElementLinkId: params.linkId,
            linkDirection: params.direction,
            limit: params.limit,
            offset: params.offset,
            languageCode: '',
        });
    }

    filter(params: FilterParams): Promise<Dictionary<ElementModel>> {
        if (params.limit === undefined) { params.limit = 100; }

        if (params.offset > 0) { return Promise.resolve({}); }

        let filtered: Dictionary<ElementModel> = {};
        if (params.elementTypeId) {
            for (const key in this.allElements) {
                if (!Object.prototype.hasOwnProperty.call(this.allElements, key)) { continue; }
                const element = this.allElements[key]!;
                if (element.types.indexOf(params.elementTypeId!) >= 0) {
                    filtered[element.id] = element;
                }
            }
        } else if (params.refElementId) {
            const filteredLinks = params.refElementLinkId
                ? this.allLinks.filter(link => link.linkTypeId === params.refElementLinkId)
                : this.allLinks;
            const nodeId = params.refElementId;
            for (const link of filteredLinks) {
                let linkedElementId: string | undefined;
                if (link.sourceId === nodeId && params.linkDirection !== 'in') {
                    linkedElementId = link.targetId;
                } else if (link.targetId === nodeId && params.linkDirection !== 'out') {
                    linkedElementId = link.sourceId;
                }
                if (linkedElementId !== undefined) {
                    const linkedElement = this.allElements[linkedElementId];
                    if (linkedElement) {
                        filtered[linkedElement.id] = linkedElement;
                    }
                }
            }
        } else if (params.text) {
            filtered = this.allElements; // filtering by text is done below
        } else {
            return Promise.reject(new Error('This type of filter is not implemented'));
        }

        if (params.text) {
            const filteredByText: Dictionary<ElementModel> = {};
            const text = params.text.toLowerCase();
            for (const key in filtered) {
                if (!Object.prototype.hasOwnProperty.call(filtered, key)) { continue; }
                const element = filtered[key]!;
                let found = false;
                if (element.id.toLowerCase().indexOf(text) >= 0) {
                    found = true;
                } else {
                    found = element.label.values.some(
                        label => label.value.toLowerCase().indexOf(text) >= 0);
                }
                if (found) {
                    filteredByText[element.id] = element;
                }
            }
            return this.simulateNetwork(filteredByText);
        } else {
            return this.simulateNetwork(filtered);
        }
    }
}
