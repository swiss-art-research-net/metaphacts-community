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
import { Element, Link } from './elements';

export interface Vector {
    readonly x: number;
    readonly y: number;
}
export namespace Vector {
    export function areEqual(a: Vector, b: Vector) {
        return a.x === b.x && a.y === b.y;
    }
    export function length({x, y}: Vector) {
        return Math.sqrt(x * x + y * y);
    }
    export function normalize({x, y}: Vector) {
        if (x === 0 && y === 0) { return {x, y}; }
        const inverseLength = 1 / Math.sqrt(x * x + y * y);
        return {x: x * inverseLength, y: y * inverseLength};
    }
    export function dot({x: x1, y: y1}: Vector, {x: x2, y: y2}: Vector): number {
        return x1 * x2 + y1 * y2;
    }
    export function cross2D({x: x1, y: y1}: Vector, {x: x2, y: y2}: Vector) {
        return x1 * y2 - y1 * x2;
    }
}

export interface Size {
    readonly width: number;
    readonly height: number;
}

export interface Rect {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}
export namespace Rect {
    export function center({x, y, width, height}: Rect) {
        return {x: x + width / 2, y: y + height / 2};
    }
}

export interface SizeProvider {
    getElementSize(element: Element): Size;
}

export function boundsOf(element: Element, sizeProvider: SizeProvider): Rect {
    const {x, y} = element.position;
    const {width, height} = sizeProvider.getElementSize(element);
    return {x, y, width, height};
}

function intersectRayFromRectangleCenter(sourceRect: Rect, rayTarget: Vector) {
    const isTargetInsideRect =
        sourceRect.width === 0 || sourceRect.height === 0 ||
        rayTarget.x > sourceRect.x && rayTarget.x < (sourceRect.x + sourceRect.width) &&
        rayTarget.y > sourceRect.y && rayTarget.y < (sourceRect.y + sourceRect.height);

    const halfWidth = sourceRect.width / 2;
    const halfHeight = sourceRect.height / 2;
    const center = {
        x: sourceRect.x + halfWidth,
        y: sourceRect.y + halfHeight,
    };
    if (isTargetInsideRect) {
        return center;
    }

    const direction = Vector.normalize({
        x: rayTarget.x - center.x,
        y: rayTarget.y - center.y,
    });

    const rightDirection = {x: Math.abs(direction.x), y: direction.y};
    const isHorizontal =
        Vector.cross2D({x: halfWidth, y: -halfHeight}, rightDirection) > 0 &&
        Vector.cross2D({x: halfWidth, y: halfHeight}, rightDirection) < 0;

    if (isHorizontal) {
        return {
            x: center.x + halfWidth * Math.sign(direction.x),
            y: center.y + halfWidth * direction.y / Math.abs(direction.x),
        };
    } else {
        return {
            x: center.x + halfHeight * direction.x / Math.abs(direction.y),
            y: center.y + halfHeight * Math.sign(direction.y),
        };
    }
}

export function isPolylineEqual(left: ReadonlyArray<Vector>, right: ReadonlyArray<Vector>) {
    if (left === right) { return true; }
    if (left.length !== right.length) { return false; }
    for (let i = 0; i < left.length; i++) {
        const a = left[i];
        const b = right[i];
        if (!(a.x === b.x && a.y === b.y)) {
            return false;
        }
    }
    return true;
}

export function computePolyline(
    source: Element,
    target: Element,
    vertices: ReadonlyArray<Vector>,
    sizeProvider: SizeProvider
): Vector[] {
    const sourceRect = boundsOf(source, sizeProvider);
    const targetRect = boundsOf(target, sizeProvider);
    const startPoint = intersectRayFromRectangleCenter(
        sourceRect, vertices.length > 0 ? vertices[0] : Rect.center(targetRect));
    const endPoint = intersectRayFromRectangleCenter(
        targetRect, vertices.length > 0 ? vertices[vertices.length - 1] : Rect.center(sourceRect));
    return [startPoint, ...vertices, endPoint];
}

export function computePolylineLength(polyline: ReadonlyArray<Vector>): number {
    let previous: Vector;
    return polyline.reduce((acc, point) => {
        const segmentLength = previous ? Vector.length({x: point.x - previous.x, y: point.y - previous.y}) : 0;
        previous = point;
        return acc + segmentLength;
    }, 0);
}

export function getPointAlongPolyline(polyline: ReadonlyArray<Vector>, offset: number): Vector {
    if (polyline.length === 0) {
        throw new Error('Cannot compute a point for empty polyline');
    }
    if (offset < 0) {
        return polyline[0];
    }
    let currentOffset = 0;
    for (let i = 1; i < polyline.length; i++) {
        const previous = polyline[i - 1];
        const point = polyline[i];
        const segment = {x: point.x - previous.x, y: point.y - previous.y};
        const segmentLength = Vector.length(segment);
        const newOffset = currentOffset + segmentLength;
        if (offset < newOffset) {
            const leftover = (offset - currentOffset) / segmentLength;
            return {
                x: previous.x + leftover * segment.x,
                y: previous.y + leftover * segment.y,
            };
        } else {
            currentOffset = newOffset;
        }
    }
    return polyline[polyline.length - 1];
}

export function findNearestSegmentIndex(polyline: ReadonlyArray<Vector>, location: Vector): number {
    let minDistance = Infinity;
    let foundIndex = 0;

    for (let i = 0; i < polyline.length - 1; i++) {
        const pivot = polyline[i];
        const next = polyline[i + 1];

        const target = {x: location.x - pivot.x, y: location.y - pivot.y};
        const segment = {x: next.x - pivot.x, y: next.y - pivot.y};
        const segmentLength = Vector.length(segment);

        const projectionToSegment = Vector.dot(target, segment) / segmentLength;
        if (projectionToSegment < 0 || projectionToSegment > segmentLength) {
            continue;
        }

        const distanceToSegment = Math.abs(Vector.cross2D(target, segment)) / segmentLength;
        if (distanceToSegment < minDistance) {
            minDistance = distanceToSegment;
            foundIndex = i;
        }
    }
    return foundIndex;
}

export function getContentFittingBox(
    elements: ReadonlyArray<Element>,
    links: ReadonlyArray<Link>,
    sizeProvider: SizeProvider
): { x: number; y: number; width: number; height: number } {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const element of elements) {
        const {x, y} = element.position;
        const size = sizeProvider.getElementSize(element);
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + size.width);
        maxY = Math.max(maxY, y + size.height);
    }

    for (const link of links) {
        const vertices = link.vertices || [];
        for (const {x, y} of vertices) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        }
    }

    return {
        x: Number.isFinite(minX) ? minX : 0,
        y: Number.isFinite(minY) ? minY : 0,
        width: Number.isFinite(minX) && Number.isFinite(maxX) ? (maxX - minX) : 0,
        height: Number.isFinite(minY) && Number.isFinite(maxY) ? (maxY - minY) : 0,
    };
}

export function findElementAtPoint(
    elements: ReadonlyArray<Element>,
    point: Vector,
    sizeProvider: SizeProvider
): Element | undefined {
    for (let i = elements.length - 1; i >= 0; i--) {
        const element = elements[i];
        const {x, y, width, height} = boundsOf(element, sizeProvider);

        if (element.temporary) { continue; }

        if (point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height) {
            return element;
        }
    }
    return undefined;
}

export function computeGrouping(elements: ReadonlyArray<Element>): Map<string, Element[]> {
    const grouping = new Map<string, Element[]>();
    for (const element of elements) {
        const group = element.group;
        if (typeof group === 'string') {
            let children = grouping.get(group);
            if (!children) {
                children = [];
                grouping.set(group, children);
            }
            children.push(element);
        }
    }
    return grouping;
}
