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
import { pick } from 'lodash';

import { ElementIri, LinkIri, LinkTypeIri } from '../data/model';
import { DIAGRAM_CONTEXT_URL_V1 } from '../data/schema';

import { Element, ElementTemplateState, Link, LinkTemplateState } from '../diagram/elements';
import { Vector, Size } from '../diagram/geometry';

export interface SerializedDiagram {
    '@context': any;
    '@type': 'Diagram';
    layoutData: LayoutData;
    linkTypeOptions?: ReadonlyArray<LinkTypeOptions>;
}

export interface LinkTypeOptions {
    '@type': 'LinkTypeOptions';
    property: LinkTypeIri;
    visible: boolean;
    showLabel?: boolean;
}

export interface LayoutData {
    '@type': 'Layout';
    elements: ReadonlyArray<LayoutElement>;
    links: ReadonlyArray<LayoutLink>;
}

export interface LayoutElement {
    '@type': 'Element';
    '@id': string;
    iri: ElementIri;
    position: Vector;
    size?: Size;
    angle?: number;
    isExpanded?: boolean;
    group?: string;
    elementState?: ElementTemplateState;
}

export interface LayoutLink {
    '@type': 'Link';
    '@id': string;
    iri?: LinkIri;
    property: LinkTypeIri;
    source: { '@id': string };
    target: { '@id': string };
    vertices?: ReadonlyArray<Vector>;
    linkState?: LinkTemplateState;
}

const serializedCellProperties = [
    // common properties
    'id', 'type',
    // element properties
    'size', 'angle', 'isExpanded', 'position', 'iri', 'group',
    // link properties
    'typeId', 'source', 'target', 'vertices',
];

export function emptyDiagram(): SerializedDiagram {
    return {
        '@context': DIAGRAM_CONTEXT_URL_V1,
        '@type': 'Diagram',
        layoutData: emptyLayoutData(),
        linkTypeOptions: [],
    };
}

export function emptyLayoutData(): LayoutData {
    return {'@type': 'Layout', elements: [], links: []};
}

export function convertToSerializedDiagram(params: {
    layoutData: any;
    linkTypeOptions: any;
}): SerializedDiagram {
    const elements: LayoutElement[] = [];
    const links: LayoutLink[] = [];

    for (const cell of params.layoutData.cells) {
        // get rid of unused properties
        const newCell: any = pick(cell, serializedCellProperties);

        // normalize type
        if (newCell.type === 'Ontodia.Element' || newCell.type === 'element') {
            newCell.type = 'Element';
        }

        // normalize type
        if (newCell.type === 'link') {
            newCell.type = 'Link';
        }

        if (!newCell.iri) {
            newCell.iri = newCell.id;
        }

        // rename to @id and @type to match JSON-LD
        newCell['@id'] = newCell.id;
        delete newCell.id;

        newCell['@type'] = newCell.type;
        delete newCell.type;

        // make two separate lists
        switch (newCell['@type']) {
            case 'Element':
                elements.push(newCell);
                break;
            case 'Link':
                // rename internal IDs
                newCell.source['@id'] = newCell.source.id;
                delete newCell.source.id;
                newCell.target['@id'] = newCell.target.id;
                delete newCell.target.id;
                // rename typeID to property
                newCell.property = newCell.typeId;
                delete newCell.typeId;
                links.push(newCell);
                break;
        }
    }

    return {
        ...emptyDiagram(),
        layoutData: {'@type': 'Layout', elements, links},
        linkTypeOptions: params.linkTypeOptions,
    };
}

export function makeSerializedDiagram(params: {
    layoutData?: LayoutData;
    linkTypeOptions?: ReadonlyArray<LinkTypeOptions>;
}): SerializedDiagram {
    const diagram: SerializedDiagram = {
        ...emptyDiagram(),
        linkTypeOptions: params.linkTypeOptions
    };
    // layout data is a complex structure we want to persist
    if (params.layoutData) {
        diagram.layoutData = params.layoutData;
    }
    return diagram;
}

export function makeLayoutData(
    modelElements: ReadonlyArray<Element>,
    modelLinks: ReadonlyArray<Link>,
): LayoutData {
    const elements = modelElements.map((element): LayoutElement => ({
        '@type': 'Element',
        '@id': element.id,
        iri: element.iri,
        position: element.position,
        isExpanded: element.isExpanded,
        group: element.group,
        elementState: element.elementState,
    }));
    const links = modelLinks.map((link): LayoutLink => ({
        '@type': 'Link',
        '@id': link.id,
        iri: link.data.linkIri,
        property: link.typeId,
        source: {'@id': link.sourceId},
        target: {'@id': link.targetId},
        vertices: [...link.vertices],
        linkState: link.linkState,
    }));
    return {'@type': 'Layout', elements, links};
}
