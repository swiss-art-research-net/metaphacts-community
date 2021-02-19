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
import { ElementModel, ElementTypeIri, LinkTypeIri, PropertyTypeIri, LinkModel } from './model';
import { CancellationToken } from '../viewUtils/async';

export interface MetadataApi {
    /**
     * Determines if it's possible to create link between two elements
     * (does not depend on link direction).
     */
    canConnect(
        element: ElementModel,
        another: ElementModel | null,
        linkType: LinkTypeIri | null,
        ct: CancellationToken
    ): Promise<boolean>;

    /**
     * Determines links of which types can we create between elements
     * (depends on link direction).
     */
    possibleLinkTypes(
        source: ElementModel,
        target: ElementModel,
        ct: CancellationToken
    ): Promise<LinkTypeIri[]>;

    /**
     * If new element is created by dragging link from existing element, this should return available element types.
     */
    typesOfElementsDraggedFrom(source: ElementModel, ct: CancellationToken): Promise<ElementTypeIri[]>;

    /**
     * List properties for type meant to be edited in-place.
     */
    propertiesForType(type: ElementTypeIri, ct: CancellationToken): Promise<PropertyTypeIri[]>;

    /**
     * Filters types that can be created from the list of given types.
     * Used in Class Tree to quickly find out what types can be instantiated.
     */
    filterConstructibleTypes(
        types: ReadonlySet<ElementTypeIri>, ct: CancellationToken
    ): Promise<ReadonlySet<ElementTypeIri>>;

    /**
     * Determines whether the element can be deleted
     */
    canDeleteElement(element: ElementModel, ct: CancellationToken): Promise<boolean>;

    /**
     * Determines whether the element can be modified (incl. modification of iri, label, properties)
     */
    canEditElement(element: ElementModel, ct: CancellationToken): Promise<boolean>;

    /**
     * Determines whether the link can be deleted.
     * This also controls changing of links, because the change is represented as delete+create
     */
    canDeleteLink(link: LinkModel, source: ElementModel, target: ElementModel, ct: CancellationToken): Promise<boolean>;

    /**
     * Determines whether link properties can be edited.
     */
    canEditLink(link: LinkModel, source: ElementModel, target: ElementModel, ct: CancellationToken): Promise<boolean>;

    /**
     * Generates new element. Specific MetadataApi implementation can pre-populate element of specified type.
     */
    generateNewElement(
        types: ReadonlyArray<ElementTypeIri>,
        ct: CancellationToken
    ): Promise<ElementModel>;

    /**
     * Generates new link. Specific MetadataApi implementation can pre-populate link of specified type.
     */
    generateNewLink(
        source: ElementModel,
        target: ElementModel,
        linkType: LinkTypeIri,
        ct: CancellationToken
    ): Promise<LinkModel>;
}
