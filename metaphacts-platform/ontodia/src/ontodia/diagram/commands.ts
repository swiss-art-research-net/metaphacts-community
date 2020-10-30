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
import { ElementModel, ElementIri, LinkModel, sameLink } from '../data/model';

import { Element, Link, LinkType } from './elements';
import { Vector, SizeProvider, isPolylineEqual } from './geometry';
import { Command } from './history';
import { DiagramModel } from './model';
import { LayoutFunction, LayoutFunctionParams, applyLayout } from '../viewUtils/layout';

export class RestoreGeometry implements Command {
    readonly title = 'Move elements and links';

    constructor(
        private elementState: ReadonlyArray<{ element: Element; position: Vector }>,
        private linkState: ReadonlyArray<{ link: Link; vertices: ReadonlyArray<Vector> }>,
    ) {}

    static capture(model: DiagramModel) {
        return RestoreGeometry.captureElementsAndLinks(model.elements, model.links);
    }

    private static captureElementsAndLinks(
        elements: ReadonlyArray<Element>,
        links: ReadonlyArray<Link>,
    ) {
        return new RestoreGeometry(
            elements.map(element => ({element, position: element.position})),
            links.map(link => ({link, vertices: link.vertices})),
        );
    }

    hasChanges() {
        return this.elementState.length > 0 || this.linkState.length > 0;
    }

    filterOutUnchanged(): RestoreGeometry {
        return new RestoreGeometry(
            this.elementState.filter(
                ({element, position}) => !Vector.areEqual(element.position, position)
            ),
            this.linkState.filter(
                ({link, vertices}) => !isPolylineEqual(link.vertices, vertices)
            ),
        );
    }

    invoke(): RestoreGeometry {
        const previous = RestoreGeometry.captureElementsAndLinks(
            this.elementState.map(state => state.element),
            this.linkState.map(state => state.link)
        );
        // restore in reverse order to workaround position changed event
        // handling in EmbeddedLayer inside nested elements
        // (child's position change causes group to resize or move itself)
        for (const {element, position} of [...this.elementState].reverse()) {
            element.setPosition(position);
        }
        for (const {link, vertices} of this.linkState) {
            link.setVertices(vertices);
        }
        return previous;
    }
}

export function restoreCapturedLinkGeometry(link: Link): Command {
    const vertices = link.vertices;
    return Command.create('Change link vertices', () => {
        const capturedInverse = restoreCapturedLinkGeometry(link);
        link.setVertices(vertices);
        return capturedInverse;
    });
}

export function setElementExpanded(element: Element, expanded: boolean): Command {
    const title = expanded ? 'Expand element' : 'Collapse element';
    return Command.create(title, () => {
        element.setExpanded(expanded);
        return setElementExpanded(element, !expanded);
    });
}

export function changeLinkTypeVisibility(params: {
    linkType: LinkType;
    visible: boolean;
    showLabel: boolean;
    preventLoading?: boolean;
}): Command {
    const {linkType, visible, showLabel, preventLoading} = params;
    return Command.create('Change link type visibility', () => {
        const previousVisible = linkType.visible;
        const previousShowLabel = linkType.showLabel;
        linkType.setVisibility({visible, showLabel, preventLoading});
        return changeLinkTypeVisibility({
            linkType,
            visible: previousVisible,
            showLabel: previousShowLabel,
            preventLoading,
        });
    });
}

export function setElementData(model: DiagramModel, target: ElementIri, data: ElementModel | undefined): Command {
    const elements = model.elements.filter(el => el.iri === target);
    const previous = elements.length > 0 ? elements[0].data : undefined;
    return Command.create('Set element data', () => {
        if (data) {
            for (const element of model.elements.filter(el => el.iri === target)) {
                element.setData(data);
            }
        }
        return setElementData(model, data ? data.id : target, previous);
    });
}

export function setLinkData(model: DiagramModel, oldData: LinkModel, newData: LinkModel): Command {
    if (!sameLink(oldData, newData)) {
        throw new Error('Cannot change typeId, sourceId or targetId when changing link data');
    }
    return Command.create('Set link data', () => {
        for (const link of model.links) {
            if (sameLink(link.data, oldData)) {
                link.setData(newData);
            }
        }
        return setLinkData(model, newData, oldData);
    });
}

export function performLayout(layoutFunction: LayoutFunction, params: LayoutFunctionParams) {
    return Command.create('Perform layout', () => {
        const capturedGeometry = RestoreGeometry.capture(params.model);
        applyLayout(params.model, layoutFunction(params));
        return capturedGeometry.filterOutUnchanged();
    });
}
