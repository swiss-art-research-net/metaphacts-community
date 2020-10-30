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
import { LinkLabel, LinkTemplate, LinkTemplateResolver } from './props';
import { Rdf } from '../data/rdf';
import { ONTODIA_LIST_ITEM, ONTODIA_LIST_INDEX } from '../data/model';
import { PLACEHOLDER_LINK_TYPE } from '../data/schema';
import { Link } from '../diagram/elements';

export const LINK_SHOW_IRI: LinkTemplate = {
    renderLink: (link, model) => ({
        properties: [{
            position: 0.5,
            attrs: {
                text: {
                    text: [model.factory.literal(link.typeId)],
                    fill: 'gray',
                    'font-size': 12,
                    'font-weight': 'lighter',
                },
            },
        }],
    }),
};

const LINK_SUB_CLASS_OF: LinkTemplate = {
    markerTarget: {
        fill: '#f8a485',
        stroke: '#cf8e76',
    },
    renderLink: () => ({
        connection: {
            stroke: '#f8a485',
            'stroke-width': 2,
        },
    }),
};

const LINK_DOMAIN: LinkTemplate = {
    markerTarget: {
        fill: '#34c7f3',
        stroke: '#38b5db',
    },
    renderLink: () => ({
        connection: {
            stroke: '#34c7f3',
            'stroke-width': 2,
        },
    }),
};

const LINK_RANGE: LinkTemplate = {
    markerTarget: {
        fill: '#34c7f3',
        stroke: '#38b5db',
    },
    renderLink: () => ({
        connection: {
            stroke: '#34c7f3',
            'stroke-width': 2,
        },
    }),
};

const LINK_TYPE_OF: LinkTemplate = {
    markerTarget: {
        fill: '#8cd965',
        stroke: '#5b9a3b',
    },
    renderLink: () => ({
        connection: {
            stroke: '#8cd965',
            'stroke-width': 2,
        },
    }),
};

const LINK_LIST_ITEM: LinkTemplate = {
    markerTarget: {
        fill: '#fe9bb2',
        stroke: '#fe9bb2',
    },
    renderLink: (link, model) => ({
        connection: {
            stroke: '#fe9bb2',
            'stroke-width': 2,
        },
        label: {
            attrs: {
                text: {
                    text: [model.factory.literal(`list item`)]
                }
            }
        },
        properties: renderListIndex(link, model.factory),
    }),
};

function renderListIndex(link: Link, factory: Rdf.DataFactory): LinkLabel[] | undefined {
    const properties = link.data.properties;
    if (!properties) { return undefined; }
    const listIndexProperty = properties[ONTODIA_LIST_INDEX];
    if (!listIndexProperty || listIndexProperty.values.length === 0) { return undefined; }
    const listIndexValue = listIndexProperty.values[0];
    if (listIndexValue.termType === 'NamedNode') { return undefined; }
    return [{
        attrs: {
            text: {
                text: [factory.literal(`index: ${listIndexValue.value}`)],
                fill: '#979797',
                'font-size': 'smaller',
            }
        }
    }];
}

export const DefaultLinkTemplateBundle: LinkTemplateResolver = type => {
    if (type === 'http://www.w3.org/2000/01/rdf-schema#subClassOf') {
        return LINK_SUB_CLASS_OF;
    } else if (type === 'http://www.w3.org/2000/01/rdf-schema#domain') {
        return LINK_DOMAIN;
    } else if (type === 'http://www.w3.org/2000/01/rdf-schema#range') {
        return LINK_RANGE;
    } else if (type === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type') {
        return LINK_TYPE_OF;
    } else if (type === PLACEHOLDER_LINK_TYPE) {
        return {markerTarget: {fill: 'none'}};
    } else if (type === ONTODIA_LIST_ITEM) {
        return LINK_LIST_ITEM;
    } else {
        return undefined;
    }
};
