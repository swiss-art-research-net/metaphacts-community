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
import { NamedNode, Literal, equalTerms } from './rdf/rdfModel';
import { hashFnv32a } from './utils';

export interface Dictionary<T> { [key: string]: T | undefined; }

export interface Property {
    readonly values: ReadonlyArray<NamedNode | Literal>;
}

/** @TJS-type string */
export type ElementIri = string & { readonly elementBrand: any };
/** @TJS-type string */
export type ElementTypeIri = string & { readonly classBrand: any };
/** @TJS-type string */
export type LinkIri = string & { readonly linkBrand: any };
/** @TJS-type string */
export type LinkTypeIri = string & { readonly linkTypeBrand: any };
/** @TJS-type string */
export type PropertyTypeIri = string & { readonly propertyTypeBrand: any };

export const BLANK_NODE_PREFIX = 'ontodia:blank:';
export const ONTODIA_LINK_IDENTITY = 'ontodia:linkIdentity' as LinkTypeIri;
export const ONTODIA_LIST = 'ontodia:list:List' as ElementTypeIri;
export const ONTODIA_LIST_ITEM = 'ontodia:list:listItem' as LinkTypeIri;
export const ONTODIA_LIST_INDEX = 'ontodia:list:listIndex' as LinkTypeIri;

export function isEncodedBlank(iri: string): boolean {
    return iri.startsWith(BLANK_NODE_PREFIX);
}

export interface ElementModel {
    id: ElementIri;
    /**
     * @items.type string
     */
    types: ElementTypeIri[];
    label: { values: Literal[] };
    image?: string;
    properties: { [propertyIri: string]: Property | undefined };
    sources?: string[];
}

export interface LinkModel {
    linkTypeId: LinkTypeIri;
    sourceId: ElementIri;
    targetId: ElementIri;
    linkIri?: LinkIri;
    properties: { [propertyIri: string]: Property | undefined };
}

export interface ClassModel {
    id: ElementTypeIri;
    label: { values: Literal[] };
    count?: number;
    children: ClassModel[];
}

export interface LinkCount {
    id: LinkTypeIri;
    inCount: number;
    outCount: number;
}

export interface LinkTypeModel {
    id: LinkTypeIri;
    label: { values: Literal[] };
    count?: number;
}

export interface PropertyModel {
    id: PropertyTypeIri;
    label: { values: Literal[] };
}

export interface LinkedElement {
    element: ElementModel;
    /**
     * @items.type string
     */
    inLinks: LinkTypeIri[];
    /**
     * @items.type string
     */
    outLinks: LinkTypeIri[];
}

export function sameLink(left: LinkModel, right: LinkModel) {
    return (
        left.linkTypeId === right.linkTypeId &&
        left.sourceId === right.sourceId &&
        left.targetId === right.targetId &&
        left.linkIri === right.linkIri
    );
}

export function hashLink(link: LinkModel): number {
    const {linkTypeId, sourceId, targetId, linkIri} = link;
    let hash = hashFnv32a(linkTypeId);
    hash = hash * 31 + hashFnv32a(sourceId);
    hash = hash * 31 + hashFnv32a(targetId);
    if (linkIri) {
        hash = hash * 31 + hashFnv32a(linkIri);
    }
    return hash;
}

export function sameElement(left: ElementModel, right: ElementModel): boolean {
    return (
        left.id === right.id &&
        sameStringArrays(left.types, right.types) &&
        sameTermArrays(left.label.values, right.label.values) &&
        left.image === right.image &&
        samePropertyDictionaries(left.properties, right.properties) &&
        (
            Boolean(!left.sources && !right.sources) ||
            Boolean(left.sources && right.sources && sameStringArrays(left.sources, right.sources))
        )
    );
}

function sameStringArrays(left: string[], right: string[]): boolean {
    if (left.length !== right.length) { return false; }
    for (let i = 0; i < left.length; i++) {
        if (left[i] !== right[i]) { return false; }
    }
    return true;
}

function sameTermArrays(
    left: ReadonlyArray<NamedNode | Literal>,
    right: ReadonlyArray<NamedNode | Literal>
): boolean {
    if (left.length !== right.length) { return false; }
    for (let i = 0; i < left.length; i++) {
        if (!equalTerms(left[i], right[i])) {
            return false;
        }
    }
    return true;
}

function samePropertyDictionaries(
    left: { [id: string]: Property | undefined },
    right: { [id: string]: Property | undefined }
): boolean {
    for (const propertyIri in left.properties) {
        if (!Object.prototype.hasOwnProperty.call(left.properties, propertyIri)) { continue; }
        if (!Object.prototype.hasOwnProperty.call(right.properties, propertyIri)) {
            return false;
        }
        const leftProperty = left[propertyIri];
        const rightProperty = right[propertyIri];
        if (!leftProperty && !rightProperty) {
            // both properties are undefined
            continue;
        } else if (leftProperty && rightProperty) {
            if (!sameTermArrays(leftProperty.values, rightProperty.values)) {
                return false;
            }
        } else  {
            // one property is undefined and the other is not
            return false;
        }
    }
    for (const propertyIri in right.properties) {
        if (!Object.prototype.hasOwnProperty.call(right.properties, propertyIri)) { continue; }
        if (!Object.prototype.hasOwnProperty.call(left.properties, propertyIri)) {
            return false;
        }
    }
    return true;
}
