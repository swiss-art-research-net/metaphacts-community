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
import { LinkRouter, RoutedLinks, Vertex } from '../customization/props';
import { DiagramModel } from './model';
import { Link, Element } from './elements';
import { Vector, SizeProvider } from './geometry';

export class DefaultLinkRouter implements LinkRouter {
    constructor(private gap = 20) {}

    route(model: DiagramModel, sizeProvider: SizeProvider): RoutedLinks {
        const routings: RoutedLinks = new Map();

        for (const link of model.links) {
            if (routings.has(link.id)) {
                continue;
            }
            // The cell is a link. Let's find its source and target models.
            const {sourceId, targetId} = link;
            if (!sourceId || !targetId) {
                continue;
            } else if (sourceId === targetId) {
                this.routeFeedbackSiblingLinks(model, sizeProvider, sourceId, routings);
            } else {
                this.routeNormalSiblingLinks(model, sizeProvider, sourceId, targetId, routings);
            }
        }

        return routings;
    }

    private routeFeedbackSiblingLinks(
        model: DiagramModel,
        sizeProvider: SizeProvider,
        elementId: string,
        routings: RoutedLinks
    ): void {
        const element = model.getElement(elementId)!;
        const {x, y} = element.position;
        const {width, height} = sizeProvider.getElementSize(element);

        let index = 0;
        for (const sibling of element.links) {
            if (routings.has(sibling.id) || hasUserPlacedVertices(sibling)) {
                continue;
            }
            const {sourceId, targetId} = sibling;
            if (sourceId === targetId) {
                const offset = this.gap * (index + 1);
                const vertices: Vertex[] = [
                    {x: x - offset, y: y + height / 2},
                    {x: x - offset, y: y - offset},
                    {x: x + width / 2, y: y - offset},
                ];
                routings.set(sibling.id, {linkId: sibling.id, vertices});
                index++;
            }
        }
    }

    private routeNormalSiblingLinks(
        model: DiagramModel,
        sizeProvider: SizeProvider,
        sourceId: string,
        targetId: string,
        routings: RoutedLinks,
    ) {
        const source = model.getElement(sourceId)!;
        const target = model.getElement(targetId)!;

        const sourceCenter = centerOfElement(source, sizeProvider);
        const targetCenter = centerOfElement(target, sizeProvider);
        const midPoint = {
            x: (sourceCenter.x + targetCenter.x) / 2,
            y: (sourceCenter.y + targetCenter.y) / 2,
        };
        const direction = Vector.normalize({
            x: targetCenter.x - sourceCenter.x,
            y: targetCenter.y - sourceCenter.y,
        });

        const siblings = source.links.filter(link =>
            (link.sourceId === targetId || link.targetId === targetId) &&
            !routings.has(link.id) &&
            !hasUserPlacedVertices(link)
        );
        if (siblings.length <= 1) {
            return;
        }
        const indexModifier = siblings.length % 2 ? 0 : 1;

        siblings.forEach((sibling, siblingIndex) => {
            // For mor beautifull positioning
            const index = siblingIndex + indexModifier;
            // We want the offset values to be calculated as follows 0, 50, 50, 100, 100, 150, 150 ..
            const offset = this.gap * Math.ceil(index / 2) - (indexModifier ? this.gap / 2 : 0);
            // Now we need the vertices to be placed at points which are 'offset' pixels distant
            // from the first link and forms a perpendicular angle to it. And as index goes up
            // alternate left and right.
            //
            //  ^  odd indexes
            //  |
            //  |---->  index 0 line (straight line between a source center and a target center.
            //  |
            //  v  even indexes
            const offsetDirection = index % 2
                ? {x: -direction.y, y: direction.x}  // rotate by 90 degrees counter-clockwise
                : {x: direction.y, y: -direction.x}; // rotate by 90 degrees clockwise
            // We found the vertex.
            const vertex = {
                x: midPoint.x + offsetDirection.x * offset,
                y: midPoint.y + offsetDirection.y * offset,
            };
            routings.set(sibling.id, {
                linkId: sibling.id,
                vertices: [vertex],
                labelTextAnchor: this.getLabelAlignment(direction, siblingIndex, siblings.length),
            });
        });
    }

    private getLabelAlignment(
        connectionDirection: Vector,
        siblingIndex: number,
        siblingCount: number,
    ): 'start' | 'middle' | 'end' {
        // offset direction angle in [0; 2 Pi] interval
        const angle = Math.atan2(connectionDirection.y, connectionDirection.x);
        const absoluteAngle = Math.abs(angle);
        const isHorizontal = absoluteAngle < Math.PI * 1 / 8 || absoluteAngle > Math.PI * 7 / 8;
        const isTop = angle < 0;
        const isBottom = angle > 0;

        const firstOuter = siblingCount - 2;
        const secondOuter = siblingCount - 1;

        if (!isHorizontal) {
            if (isTop && siblingIndex === secondOuter || isBottom && siblingIndex === firstOuter) {
                return 'end';
            } else if (isTop && siblingIndex === firstOuter || isBottom && siblingIndex === secondOuter) {
                return 'start';
            }
        }

        return 'middle';
    }
}

function hasUserPlacedVertices(link: Link) {
    const vertices = link.vertices;
    return vertices && vertices.length > 0;
}

function centerOfElement(element: Element, sizeProvider: SizeProvider): Vector {
    const {x, y} = element.position;
    const {width, height} = sizeProvider.getElementSize(element);
    return {x: x + width / 2, y: y + height / 2};
}
