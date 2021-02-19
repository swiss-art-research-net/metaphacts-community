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
import * as cola from 'webcola';

import { DiagramModel } from '../diagram/model';
import { Vector, Rect, Size, SizeProvider, boundsOf, getContentFittingBox, computeGrouping } from '../diagram/geometry';
import { Element } from '../diagram/elements';
import { EventObserver } from './events';

export interface LayoutNode {
    id: string;
    x: number;
    y: number;
    types: string[];
    width: number;
    height: number;
    bounds?: any;
    fixed?: number;
    innerBounds?: any;
}

export interface LayoutEdge {
    typeId: string;
    source: LayoutNode;
    target: LayoutNode;
}

export function groupForceLayout(params: {
    nodes: LayoutNode[];
    links: LayoutEdge[];
    preferredLinkLength: number;
    avoidOvelaps?: boolean;
}) {
    const layout = new cola.Layout()
        .nodes(params.nodes)
        .links(params.links)
        .avoidOverlaps(Boolean(params.avoidOvelaps))
        .convergenceThreshold(1e-9)
        .jaccardLinkLengths(params.preferredLinkLength)
        .handleDisconnected(true);
    layout.start(30, 0, 10, undefined, false);
}

export function groupRemoveOverlaps(nodes: LayoutNode[]) {
    const nodeRectangles: cola.Rectangle[] = [];
    for (const node of nodes) {
        nodeRectangles.push(new cola.Rectangle(
            node.x, node.x + node.width,
            node.y, node.y + node.height));
    }

    cola.removeOverlaps(nodeRectangles);

    for (let i = 0; i < nodeRectangles.length; i++) {
        const node = nodes[i];
        const rectangle = nodeRectangles[i];
        node.x = rectangle.x;
        node.y = rectangle.y;
    }
}

export function translateToPositiveQuadrant(positions: Map<string, Vector>, offset: Vector) {
    let minX = Infinity, minY = Infinity;
    positions.forEach(position => {
        minX = Math.min(minX, position.x);
        minY = Math.min(minY, position.y);
    });

    const {x, y} = offset;
    positions.forEach((position, key) => {
        positions.set(key, {
            x: position.x - minX + x,
            y: position.y - minY + y,
        });
    });
}

export function uniformGrid(params: {
    rows: number;
    cellSize: Vector;
}): (cellIndex: number) => Rect {
    return cellIndex => {
        const row = Math.floor(cellIndex / params.rows);
        const column = cellIndex - row * params.rows;
        return {
            x: column * params.cellSize.x,
            y: row * params.cellSize.y,
            width: params.cellSize.x,
            height: params.cellSize.y,
        };
    };
}

export function padded(
    nodes: LayoutNode[],
    padding: { x: number; y: number } | undefined,
    transform: () => void,
) {
    if (padding) {
        for (const node of nodes) {
            node.x -= padding.x;
            node.y -= padding.y;
            node.width += 2 * padding.x;
            node.height += 2 * padding.y;
        }
    }

    transform();

    if (padding) {
        for (const node of nodes) {
            node.x += padding.x;
            node.y += padding.y;
            node.width -= 2 * padding.x;
            node.height -= 2 * padding.y;
        }
    }
}

export function biasFreePadded(
    nodes: LayoutNode[],
    padding: { x: number; y: number } | undefined,
    transform: () => void,
) {
    const nodeSizeMap = new Map<string, Size>();
    const possibleCompression = {x: Infinity, y: Infinity};
    for (const node of nodes) {
        nodeSizeMap.set(node.id, {width: node.width, height: node.height});
        const maxSide = Math.max(node.width, node.height);

        const compressionX = node.width ? (maxSide / node.width) : 1;
        const compressionY = node.height ? (maxSide / node.height) : 1;
        possibleCompression.x = Math.min(1 + (compressionX - 1), possibleCompression.x);
        possibleCompression.y = Math.min(1 + (compressionY - 1), possibleCompression.y);

        node.height = maxSide;
        node.width = maxSide;
    }
    padded(nodes, padding, () => transform());

    const fittingBox = getContentFittingBoxForLayout(nodes);
    for (const node of nodes) {
        const size = nodeSizeMap.get(node.id)!;
        node.x = (node.x - fittingBox.x) / possibleCompression.x + fittingBox.x;
        node.y = (node.y - fittingBox.y) / possibleCompression.y + fittingBox.y;
        node.height = size.height;
        node.width = size.width;
    }
}

export type CalculatedLayout = object & { readonly layoutBrand: void };

export type LayoutFunction = (params: LayoutFunctionParams) => CalculatedLayout;

export interface LayoutFunctionParams {
    readonly model: DiagramModel;
    readonly sizeProvider: SizeProvider;
    readonly selectedElements?: ReadonlySet<Element>;
    readonly fixedElements?: ReadonlySet<Element>;
    readonly group?: string;
}

export interface UnzippedCalculatedLayout {
    readonly group?: string;
    readonly keepAveragePosition: boolean;
    readonly positions: Map<string, Vector>;
    readonly sizes: Map<string, Size>;
    readonly nestedLayouts: UnzippedCalculatedLayout[];
}

export function calculateLayout(params: {
    model: DiagramModel;
    sizeProvider: SizeProvider;
    layoutFunction: (nodes: LayoutNode[], links: LayoutEdge[], group: string | undefined) => void;
    fixedElements?: ReadonlySet<Element>;
    group?: string;
    selectedElements?: ReadonlySet<Element>;
}): CalculatedLayout {
    const grouping = computeGrouping(params.model.elements);
    const {model, sizeProvider, layoutFunction, fixedElements, selectedElements} = params;

    if (selectedElements && selectedElements.size <= 1) {
        const unzipped: UnzippedCalculatedLayout = {
            positions: new Map(),
            sizes: new Map(),
            nestedLayouts: [],
            keepAveragePosition: false,
        };
        return unzipped as CalculatedLayout;
    }
    return internalRecursion(params.group) as CalculatedLayout;

    function internalRecursion(group: string | undefined): UnzippedCalculatedLayout {
        const elementsToProcess = group
            ? grouping.get(group)!
            : model.elements.filter(el => el.group === undefined);
        const elements = selectedElements
            ? elementsToProcess.filter(el => selectedElements.has(el))
            : elementsToProcess;

        const nestedLayouts: UnzippedCalculatedLayout[] = [];
        for (const element of elements) {
            if (grouping.has(element.id)) {
                nestedLayouts.push(internalRecursion(element.id));
            }
        }

        const nodes: LayoutNode[] = [];
        const nodeById: { [id: string]: LayoutNode } = {};
        for (const element of elements) {
            const {x, y, width, height} = boundsOf(element, sizeProvider);
            const node: LayoutNode = {
                id: element.id,
                x, y, width, height,
                types: element.data.types,
                fixed: fixedElements && fixedElements.has(element) ? 1 : 0,
            };
            nodeById[element.id] = node;
            nodes.push(node);
        }

        const links: LayoutEdge[] = [];
        for (const link of model.links) {
            if (!model.isSourceAndTargetVisible(link)) {
                continue;
            }
            const source = model.sourceOf(link)!;
            const target = model.targetOf(link)!;
            const sourceNode = nodeById[source.id];
            const targetNode = nodeById[target.id];
            if (sourceNode && targetNode) {
                links.push({typeId: link.typeId, source: sourceNode, target: targetNode});
            }
        }
        layoutFunction(nodes, links, group);

        const positions: Map<string, Vector> = new Map();
        const sizes: Map<string, Size> = new Map();
        for (const node of nodes) {
            const {x, y, width, height} = node;
            positions.set(node.id, {x, y});
            sizes.set(node.id, {width, height});
        }

        return {
            positions,
            sizes,
            group,
            nestedLayouts,
            keepAveragePosition: Boolean(selectedElements),
        };
    }
}

export function applyLayout(
    model: DiagramModel,
    layout: CalculatedLayout,
) {
    const {positions, sizes, group, nestedLayouts, keepAveragePosition} = layout as UnzippedCalculatedLayout;
    const elements = model.elements.filter(({id}) => positions.has(id));
    for (const nestedLayout of nestedLayouts) {
        applyLayout(model, nestedLayout as CalculatedLayout);
    }

    const sizeProvider = makeSizeProviderForLayout(layout as UnzippedCalculatedLayout);
    if (group) {
        const offset: Vector = getContentFittingBox(elements, [], sizeProvider);
        translateToPositiveQuadrant(positions, offset);
    }

    const averagePosition = keepAveragePosition ? calculateAveragePosition(elements, sizeProvider) : undefined;
    for (const element of elements) {
        element.setPosition(positions.get(element.id)!);
    }

    if (keepAveragePosition) {
        const newAveragePosition = calculateAveragePosition(elements, sizeProvider);
        const averageDiff = {
            x: averagePosition!.x - newAveragePosition.x,
            y: averagePosition!.y - newAveragePosition.y,
        };
        positions.forEach((position, elementId) => {
            const element = model.getElement(elementId)!;
            element.setPosition({
                x: position.x + averageDiff.x,
                y: position.y + averageDiff.y,
            });
        });
    }

    for (const link of model.links) {
        link.setVertices([]);
    }
}

function makeSizeProviderForLayout(layout: UnzippedCalculatedLayout): SizeProvider {
    const {sizes} = layout;
    const EMPTY_SIZE: Size = {width: 0, height: 0};
    return {
        getElementSize: element => {
            return sizes.get(element.id) || EMPTY_SIZE;
        }
    };
}

export function calculateAveragePosition(position: ReadonlyArray<Element>, sizeProvider: SizeProvider): Vector {
    let xSum = 0;
    let ySum = 0;
    for (const element of position) {
        const {x, y} = element.position;
        const {width, height} = sizeProvider.getElementSize(element);
        xSum += x + width / 2;
        ySum += y + height / 2;
    }
    return {
        x: xSum / position.length,
        y: ySum / position.length,
    };
}

export function placeElementsAround(params: {
    model: DiagramModel;
    sizeProvider: SizeProvider;
    elements: ReadonlyArray<Element>;
    preferredLinksLength: number;
    targetElement: Element;
    startAngle?: number;
}): void {
    const {model, sizeProvider, elements, targetElement, preferredLinksLength} = params;
    const targetElementBounds = boundsOf(targetElement, sizeProvider);
    const targetPosition: Vector = {
        x: targetElementBounds.x + targetElementBounds.width / 2,
        y: targetElementBounds.y + targetElementBounds.height / 2,
    };
    let outgoingAngle = 0;
    if (targetElement.links.length > 0) {
        const averageSourcePosition = calculateAveragePosition(
            targetElement.links.map(link => {
                const linkSource = model.sourceOf(link)!;
                return linkSource !== targetElement ? linkSource : model.targetOf(link)!;
            }),
            sizeProvider
        );
        const vectorDiff: Vector = {
            x: targetPosition.x - averageSourcePosition.x, y: targetPosition.y - averageSourcePosition.y,
        };
        if (vectorDiff.x !== 0 || vectorDiff.y !== 0) {
            outgoingAngle = Math.atan2(vectorDiff.y, vectorDiff.x);
        }
    }

    const step = Math.min(Math.PI / elements.length, Math.PI / 6);
    const elementStack: Element[]  = [...elements];

    const placeElementFromStack = (curAngle: number) => {
        const element = elementStack.pop();
        if (element) {
            const size = sizeProvider.getElementSize(element);
            element.setPosition({
                x: targetPosition.x + preferredLinksLength * Math.cos(curAngle) - size.width / 2,
                y: targetPosition.y + preferredLinksLength * Math.sin(curAngle) - size.height / 2,
            });
        }
    };

    const isOddLength = elementStack.length % 2 === 0;
    if (isOddLength) {
        for (let angle = step / 2; elementStack.length > 0; angle += step) {
            placeElementFromStack(outgoingAngle - angle);
            placeElementFromStack(outgoingAngle + angle);
        }
    } else {
        placeElementFromStack(outgoingAngle);
        for (let angle = step; elementStack.length > 0; angle += step) {
            placeElementFromStack(outgoingAngle - angle);
            placeElementFromStack(outgoingAngle + angle);
        }
    }
}

export function removeOverlaps(params: {
    model: DiagramModel;
    sizeProvider: SizeProvider;
    fixedElements?: ReadonlySet<Element>;
    padding?: Vector;
    group?: string;
    selectedElements?: ReadonlySet<Element>;
}): CalculatedLayout {
    const {padding, model, sizeProvider, group, fixedElements, selectedElements} = params;
    return calculateLayout({
        model,
        sizeProvider,
        group,
        fixedElements,
        selectedElements,
        layoutFunction: (nodes) => {
            padded(nodes, padding, () => groupRemoveOverlaps(nodes));
        },
    });
}

export function forceLayout(params: {
    model: DiagramModel;
    sizeProvider: SizeProvider;
    fixedElements?: ReadonlySet<Element>;
    group?: string;
    selectedElements?: ReadonlySet<Element>;
}): CalculatedLayout {
    const {model, sizeProvider, group, fixedElements, selectedElements} = params;
    return calculateLayout({
        model,
        sizeProvider,
        group,
        fixedElements,
        selectedElements,
        layoutFunction: (nodes, links) => {
            if (fixedElements && fixedElements.size > 0) {
                biasFreePadded(nodes, {x: 50, y: 50}, () => groupForceLayout({
                    nodes, links, preferredLinkLength: 200,
                    avoidOvelaps: true,
                }));
            } else {
                groupForceLayout({nodes, links, preferredLinkLength: 200});
                biasFreePadded(nodes, {x: 50, y: 50}, () => groupRemoveOverlaps(nodes));
            }
        },
    });
}

export function getContentFittingBoxForLayout(
    nodes: ReadonlyArray<LayoutNode>
): { x: number; y: number; width: number; height: number } {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const node of nodes) {
        const {x, y, width, height} = node;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + width);
        maxY = Math.max(maxY, y + height);
    }

    return {
        x: Number.isFinite(minX) ? minX : 0,
        y: Number.isFinite(minY) ? minY : 0,
        width: Number.isFinite(minX) && Number.isFinite(maxX) ? (maxX - minX) : 0,
        height: Number.isFinite(minY) && Number.isFinite(maxY) ? (maxY - minY) : 0,
    };
}
