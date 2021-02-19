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
import * as React from 'react';

import { LinkLabel, LinkTemplate, LinkTemplateResolver } from './props';
import { PropertyTypeIri, ONTODIA_LIST_ITEM, ONTODIA_LIST_INDEX } from '../data/model';
import { PLACEHOLDER_LINK_TYPE } from '../data/schema';
import { Link } from '../diagram/elements';
import { DiagramView } from '../diagram/view';

export const DEFAULT_LINK: LinkTemplate = {
    renderLink: (link, view) => {
        const properties = defaultRenderLinkProperties(link, view);
        return {properties};
    }
};

export const LINK_SHOW_IRI: LinkTemplate = {
    renderLink: (link, view) => {
        const properties = defaultRenderLinkProperties(link, view);
        properties.push({
            position: 0.5,
            content: link.typeId,
            textStyle: {
                fill: 'gray',
                fontSize: 12,
                fontWeight: 'lighter',
            }
        });
        return {properties};
    }
};

const LINK_SUB_CLASS_OF: LinkTemplate = {
    markerTarget: {
        fill: '#f8a485',
        stroke: '#cf8e76',
    },
    renderLink: (link, view) => ({
        connection: {
            stroke: '#f8a485',
            'stroke-width': 2,
        },
        properties: defaultRenderLinkProperties(link, view),
    }),
};

const LINK_DOMAIN: LinkTemplate = {
    markerTarget: {
        fill: '#34c7f3',
        stroke: '#38b5db',
    },
    renderLink: (link, view) => ({
        connection: {
            stroke: '#34c7f3',
            'stroke-width': 2,
        },
        properties: defaultRenderLinkProperties(link, view),
    }),
};

const LINK_RANGE: LinkTemplate = {
    markerTarget: {
        fill: '#34c7f3',
        stroke: '#38b5db',
    },
    renderLink: (link, view) => ({
        connection: {
            stroke: '#34c7f3',
            'stroke-width': 2,
        },
        properties: defaultRenderLinkProperties(link, view),
    }),
};

const LINK_TYPE_OF: LinkTemplate = {
    markerTarget: {
        fill: '#8cd965',
        stroke: '#5b9a3b',
    },
    renderLink: (link, view) => ({
        connection: {
            stroke: '#8cd965',
            'stroke-width': 2,
        },
        properties: defaultRenderLinkProperties(link, view),
    }),
};

const LINK_LIST_ITEM: LinkTemplate = {
    markerTarget: {
        fill: '#fe9bb2',
        stroke: '#fe9bb2',
    },
    renderLink: (link, view) => {
        const properties = defaultRenderLinkProperties(link, view);
        const indexLabel = renderListIndex(link);
        if (indexLabel) {
            properties.push(indexLabel);
        }
        return {
            connection: {
                stroke: '#fe9bb2',
                'stroke-width': 2,
            },
            label: {content: 'list item'},
            properties,
        };
    },
};

export function defaultRenderLinkProperties({data}: Link, view: DiagramView): LinkLabel[] {
    const labels: LinkLabel[] = [];
    for (const propertyIri in data.properties) {
        if (!Object.prototype.hasOwnProperty.call(data.properties, propertyIri)) { continue; }
        const property = view.model.createProperty(propertyIri as PropertyTypeIri);
        const propertyLabel = view.formatLabel(property.label, property.id);
        for (const value of data.properties[propertyIri]!.values) {
            const propertyValue = value.termType === 'Literal'
                ? value.value : view.formatIri(value.value);
            labels.push({
                content: <tspan>{propertyLabel}: {propertyValue}</tspan>,
                title: `${propertyLabel} ${view.formatIri(property.id)}`,
                textStyle: {fill: '#979797', fontSize: 'smaller'},
            });
        }
    }
    return labels;
}

function renderListIndex(link: Link): LinkLabel | undefined {
    const properties = link.data.properties;
    if (!properties) { return undefined; }
    const listIndexProperty = properties[ONTODIA_LIST_INDEX];
    if (!listIndexProperty || listIndexProperty.values.length === 0) { return undefined; }
    const listIndexValue = listIndexProperty.values[0];
    if (listIndexValue.termType === 'NamedNode') { return undefined; }
    return {
        content: `index: ${listIndexValue.value}`,
        textStyle: {fill: '#979797', fontSize: 'smaller'},
    };
}

export const DefaultLinkTemplateBundle: LinkTemplateResolver = type => {
    switch (type) {
        case 'http://www.w3.org/2000/01/rdf-schema#subClassOf':
            return LINK_SUB_CLASS_OF;
        case 'http://www.w3.org/2000/01/rdf-schema#domain':
            return LINK_DOMAIN;
        case 'http://www.w3.org/2000/01/rdf-schema#range':
            return LINK_RANGE;
        case 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type':
            return LINK_TYPE_OF;
        case PLACEHOLDER_LINK_TYPE:
            return {markerTarget: {fill: 'none'}};
        case ONTODIA_LIST_ITEM:
            return LINK_LIST_ITEM;
        default:
            return DEFAULT_LINK;
    }
};
