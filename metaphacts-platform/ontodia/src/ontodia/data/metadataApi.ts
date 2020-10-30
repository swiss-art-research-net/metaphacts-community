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
import { ElementModel, ElementTypeIri, LinkTypeIri, PropertyTypeIri, LinkModel, ElementIri } from './model';
import { LinkDirection } from '../diagram/elements';
import { CancellationToken } from '../viewUtils/async';

export interface MetadataApi {
    /**
     * Can user create element and link from this element?
     */
    canDropOnCanvas(source: ElementModel, ct: CancellationToken): Promise<boolean>;

    /**
     * Can we create link between two elements? Maybe it's unnesesary.
     */
    canDropOnElement(source: ElementModel, target: ElementModel, ct: CancellationToken): Promise<boolean>;

    /**
     * Links of which types can we create between elements?
     */
    possibleLinkTypes(source: ElementModel, target: ElementModel, ct: CancellationToken): Promise<DirectedLinkType[]>;

    /**
     * If new element is created by dragging link from existing element, this should return available element types.
     */
    typesOfElementsDraggedFrom(source: ElementModel, ct: CancellationToken): Promise<ElementTypeIri[]>;

    /**
     * List properties for type meant to be edited in-place.
     */
    propertiesForType(type: ElementTypeIri, ct: CancellationToken): Promise<PropertyTypeIri[]>;

    filterConstructibleTypes(
        types: ReadonlySet<ElementTypeIri>, ct: CancellationToken
    ): Promise<ReadonlySet<ElementTypeIri>>;

    canDeleteElement(element: ElementModel, ct: CancellationToken): Promise<boolean>;

    canEditElement(element: ElementModel, ct: CancellationToken): Promise<boolean>;

    canLinkElement(element: ElementModel, ct: CancellationToken): Promise<boolean>;

    canDeleteLink(link: LinkModel, source: ElementModel, target: ElementModel, ct: CancellationToken): Promise<boolean>;

    canEditLink(link: LinkModel, source: ElementModel, target: ElementModel, ct: CancellationToken): Promise<boolean>;

    generateNewElement(types: ReadonlyArray<ElementTypeIri>, ct: CancellationToken): Promise<ElementModel>;
}

export interface DirectedLinkType {
    readonly linkTypeIri: LinkTypeIri;
    readonly direction: LinkDirection;
}
