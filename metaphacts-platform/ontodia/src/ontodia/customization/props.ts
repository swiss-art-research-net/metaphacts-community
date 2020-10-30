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
import { ComponentClass } from 'react';
import { DiagramModel } from '../diagram/model';

import { ElementIri, ElementModel, Dictionary, Property } from '../data/model';
import { Rdf } from '../data/rdf';
import { Link } from '../diagram/elements';
import { SizeProvider } from '../diagram/geometry';

export type TypeStyleResolver = (types: string[]) => CustomTypeStyle | undefined;
export type LinkTemplateResolver = (linkType: string) => LinkTemplate | undefined;
export type TemplateResolver = (types: string[]) => ElementTemplate | undefined;

export interface CustomTypeStyle {
    color?: string;
    icon?: string;
}

export type ElementTemplate = ComponentClass<TemplateProps>;

export interface TemplateProps {
    elementId: string;
    data: ElementModel;
    iri: ElementIri;
    types?: string;
    label: string;
    color: any;
    iconUrl?: string;
    imgUrl?: string;
    isExpanded?: boolean;
    propsAsList: PropArray;
    props: Dictionary<Property>;
}

export type PropArray = Array<{
    id: string;
    name: string;
    property: Property;
}>;

export interface LinkTemplate {
    markerSource?: LinkMarkerStyle | null;
    markerTarget?: Partial<LinkMarkerStyle> | null;
    renderLink?(link: Link, model: DiagramModel): LinkStyle;
    setLinkLabel?: ((link: Link, label: string) => void) | null;
}

export interface LinkStyle {
    connection?: {
        fill?: string;
        stroke?: string;
        'stroke-width'?: number;
        'stroke-dasharray'?: string;
    };
    label?: LinkLabel;
    properties?: LinkLabel[];
    connector?: { name?: string; args?: {} };
}

export interface LinkRouter {
    route(model: DiagramModel, sizeProvider: SizeProvider): RoutedLinks;
}

export type RoutedLinks = Map<string, RoutedLink>;

export interface RoutedLink {
    linkId: string;
    vertices: ReadonlyArray<Vertex>;
    labelTextAnchor?: 'start' | 'middle' | 'end';
}

export interface Vertex {
    x: number;
    y: number;
}

export interface LinkMarkerStyle {
    fill: string;
    stroke?: string;
    strokeWidth?: string;
    d: string;
    width: number;
    height: number;
}

export interface LinkLabel {
    position?: number;
    title?: string;
    attrs?: {
        rect?: {
            fill?: string;
            stroke?: string;
            'stroke-width'?: number;
        };
        text?: {
            fill?: string;
            stroke?: string;
            'stroke-width'?: number;
            'font-family'?: string;
            'font-size'?: string | number;
            'font-weight'?: 'normal' | 'bold' | 'lighter' | 'bolder' | number;
            text?: ReadonlyArray<Rdf.Literal>;
        };
    };
}
