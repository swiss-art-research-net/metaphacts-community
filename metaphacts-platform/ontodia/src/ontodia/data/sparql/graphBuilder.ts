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
import { keyBy } from 'lodash';

import { GenerateID } from '../../data/schema';
import {
    LayoutElement, LayoutLink, SerializedDiagram, makeSerializedDiagram
} from '../../editor/serializedDiagram';
import { uniformGrid } from '../../viewUtils/layout';

import * as Rdf from '../rdf/rdfModel';
import { Dictionary, ElementModel, LinkModel, ElementIri, LinkTypeIri } from '../model';
import { DataProvider } from '../provider';
import { parseTurtleText } from './turtle';

const GREED_STEP = 150;

export class GraphBuilder {
    constructor(public dataProvider: DataProvider) {}

    createGraph(graph: { elementIds: ElementIri[]; links: LinkModel[] }): Promise<{
        preloadedElements: Dictionary<ElementModel>;
        diagram: SerializedDiagram;
    }> {
        return this.dataProvider.elementInfo({elementIds: graph.elementIds}).then(elementsInfo => ({
            preloadedElements: elementsInfo,
            diagram: makeLayout(graph.elementIds, graph.links),
        }));
    }

    getGraphFromRDFGraph(graph: Rdf.Quad[]): Promise<{
        preloadedElements: Dictionary<ElementModel>;
        diagram: SerializedDiagram;
    }> {
        const {elementIds, links} = makeGraphItems(graph);
        return this.createGraph({elementIds, links});
    }

    getGraphFromTurtleGraph(graph: string): Promise<{
        preloadedElements: Dictionary<ElementModel>;
        diagram: SerializedDiagram;
    }> {
        const triples = parseTurtleText(graph, this.dataProvider.factory);
        return this.getGraphFromRDFGraph(triples);
    }
}

export function makeGraphItems(response: ReadonlyArray<Rdf.Quad>): {
    elementIds: ElementIri[];
    links: LinkModel[];
} {
    const elements: Dictionary<boolean> = {};
    const links: LinkModel[] = [];

    for (const {subject, predicate, object} of response) {
        if (subject.termType === 'NamedNode' && !elements[subject.value]) {
            elements[subject.value] = true;
        }

        if (object.termType === 'NamedNode' && !elements[object.value]) {
            elements[object.value] = true;
        }

        if (subject.termType === 'NamedNode' && object.termType === 'NamedNode') {
            links.push({
                linkTypeId: predicate.value as LinkTypeIri,
                sourceId: subject.value as ElementIri,
                targetId: object.value as ElementIri,
                properties: {},
            });
        }
    }
    return {elementIds: Object.keys(elements) as ElementIri[], links};
}

export function makeLayout(
    elementsIds: ReadonlyArray<ElementIri>,
    linksInfo: ReadonlyArray<LinkModel>
): SerializedDiagram {
    const rows = Math.ceil(Math.sqrt(elementsIds.length));
    const grid = uniformGrid({rows, cellSize: {x: GREED_STEP, y: GREED_STEP}});

    const elements: LayoutElement[] = elementsIds.map<LayoutElement>((id, index) => {
        const {x, y} = grid(index);
        return {'@type': 'Element', '@id': GenerateID.forElement(), iri: id, position: {x, y}};
    });

    const layoutElementsMap: { [iri: string]: LayoutElement } = keyBy(elements, 'iri');
    const links: LayoutLink[] = [];

    linksInfo.forEach((link, index) => {
        const source = layoutElementsMap[link.sourceId];
        const target = layoutElementsMap[link.targetId];

        if (!source || !target) { return; }

        links.push({
            '@type': 'Link',
            '@id': GenerateID.forLink(),
            property: link.linkTypeId,
            source: {'@id': source['@id']},
            target: {'@id': target['@id']},
        });
    });
    return makeSerializedDiagram({layoutData: {'@type': 'Layout', elements, links}, linkTypeOptions: []});
}
