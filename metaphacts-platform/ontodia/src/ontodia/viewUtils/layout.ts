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

import { hashFnv32a } from '../data/utils';

import { DiagramModel } from '../diagram/model';
import {
    Vector, Rect, Size, SizeProvider, boundsOf, getContentFittingBox, computeGrouping,
} from '../diagram/geometry';
import { Element } from '../diagram/elements';

import { HashSet } from '../viewUtils/hashMap';

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

export interface LayoutFunctionParams {
    readonly nodes: LayoutNode[];
    readonly links: LayoutEdge[];
}

export interface LayoutForceParams extends LayoutFunctionParams {
    /** @default {"x": 50, "y": 50} */
    readonly padding?: Vector | null;
    /** @default 200 */
    readonly preferredLinkLength?: number;
    /** @default true */
    readonly removeOverlaps?: boolean;
    readonly transformLinks?: LayoutTransformLinksSettings;
}

export function layoutForce(params: LayoutForceParams): void {
    const {
        nodes,
        transformLinks,
        padding = {x: 50, y: 50},
        preferredLinkLength = 200,
        removeOverlaps = true,
    } = params;
    const links = layoutTransformLinks(params.links, transformLinks);
    const runLayout = (avoidOverlaps: boolean) => {
        const layout = new cola.Layout()
            .nodes(nodes)
            .links(links)
            .avoidOverlaps(avoidOverlaps)
            .convergenceThreshold(1e-9)
            .jaccardLinkLengths(preferredLinkLength)
            .handleDisconnected(true);
        layout.start(30, 0, 10, undefined, false);
    };
    layoutColaPadded({nodes, links, padding, removeOverlaps, layout: runLayout});
}

export function layoutRemoveOverlaps(params: LayoutFunctionParams): void {
    const {nodes} = params;
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

export function layoutPadded(
    nodes: LayoutNode[],
    padding: Vector | undefined | null,
    transform: () => void,
) {
    if (!(padding && padding.x !== 0 && padding.y !== 0)) {
        transform();
        return;
    }

    for (const node of nodes) {
        node.x -= padding.x;
        node.y -= padding.y;
        node.width += 2 * padding.x;
        node.height += 2 * padding.y;
    }

    transform();

    for (const node of nodes) {
        node.x += padding.x;
        node.y += padding.y;
        node.width -= 2 * padding.x;
        node.height -= 2 * padding.y;
    }
}

export function layoutBiasFreePadded(
    nodes: LayoutNode[],
    padding: Vector | undefined | null,
    transform: () => void,
) {
    if (!(padding && padding.x !== 0 && padding.y !== 0)) {
        transform();
        return;
    }

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

    layoutPadded(nodes, padding, () => transform());

    const fittingBox = getLayoutContentFittingBox(nodes);
    for (const node of nodes) {
        const size = nodeSizeMap.get(node.id)!;
        node.x = (node.x - fittingBox.x) / possibleCompression.x + fittingBox.x;
        node.y = (node.y - fittingBox.y) / possibleCompression.y + fittingBox.y;
        node.height = size.height;
        node.width = size.width;
    }
}

export interface ColaPaddedParams extends LayoutFunctionParams {
    readonly layout: (avoidOverlaps: boolean) => void;
    readonly padding: Vector | undefined | null;
    readonly removeOverlaps: boolean;
}

export function layoutColaPadded(params: ColaPaddedParams): void {
    const {nodes, links, layout, padding, removeOverlaps} = params;
    const hasFixedNode = nodes.some(node => node.fixed === 1);
    if (hasFixedNode || !removeOverlaps) {
        layoutBiasFreePadded(nodes, padding, () => layout(hasFixedNode && removeOverlaps));
    } else {
        layout(false);
        layoutBiasFreePadded(nodes, padding, () => layoutRemoveOverlaps({nodes, links}));
    }
}

export interface LayoutTransformLinksSettings {
    /** @default [] */
    readonly directLinks?: ReadonlyArray<string>;
    /** @default [] */
    readonly invertLinks?: ReadonlyArray<string>;
    /** @default [] */
    readonly removeLinks?: ReadonlyArray<string>;
    /** @default false */
    readonly removeOtherLinks?: boolean;
    /** @default false */
    readonly collapseMultiple?: boolean;
}

export function layoutTransformLinks(
    links: LayoutEdge[],
    settings: LayoutTransformLinksSettings | undefined
): LayoutEdge[] {
    if (!settings) {
        return links;
    }
    const {
        directLinks,
        invertLinks,
        removeLinks,
        removeOtherLinks = false,
        collapseMultiple = false,
    } = settings;
    const directLinkTypes = new Set<string>(directLinks);
    const inverseLinkTypes = new Set<string>(invertLinks);

    let transformedLinks: LayoutEdge[] = [];
    for (const edge of links) {
        if (directLinkTypes.has(edge.typeId)) {
            transformedLinks.push(edge);
        } else if (inverseLinkTypes.has(edge.typeId)) {
            transformedLinks.push({...edge, source: edge.target, target: edge.source});
        } else if (!removeOtherLinks) {
            transformedLinks.push(edge);
        }
    }

    if (removeLinks && removeLinks.length > 0) {
        const removeLinkTypes = new Set<string>(removeLinks);
        transformedLinks = transformedLinks.filter(link => !removeLinkTypes.has(link.typeId));
    }

    if (collapseMultiple) {
        const filteredLinks = new HashSet(hashEdgeByDirection, equalEdgeByDirection);
        for (const edge of transformedLinks) {
            filteredLinks.add(edge);
        }
        transformedLinks = Array.from(filteredLinks);
    }

    return transformedLinks;
}

function hashEdgeByDirection(edge: LayoutEdge): number {
    const {source, target} = edge;
    let hash = hashFnv32a(source.id);
    hash = hash * 31 + hashFnv32a(target.id);
    return hash;
}

function equalEdgeByDirection(left: LayoutEdge, right: LayoutEdge) {
    return (
        left.source.id === right.source.id &&
        left.target.id === right.target.id
    );
}

export interface CalculateLayoutParams {
    readonly model: DiagramModel;
    readonly sizeProvider: SizeProvider;
    readonly fixedElements?: ReadonlySet<Element>;
    readonly group?: string;
    readonly selectedElements?: ReadonlySet<Element>;
    readonly layoutFunction: (params: LayoutFunctionParams) => void;
}

export interface CalculatedLayout {
    readonly parts: ReadonlyArray<CalculatedLayoutPart>;
}

export interface CalculatedLayoutPart {
    readonly positions: Map<string, Vector>;
    readonly sizes: Map<string, Size>;
    readonly translateToPositive?: boolean;
    readonly keepAveragePosition?: boolean;
}

export function calculateLayout(params: CalculateLayoutParams): CalculatedLayout {
    const {model, sizeProvider, layoutFunction, fixedElements, selectedElements} = params;

    if (selectedElements && selectedElements.size <= 1) {
        return {parts: []};
    }

    const grouping = computeGrouping(model.elements);
    const orderedGroups = getOrderedLayoutGroups(grouping, params.group);
    const parts: CalculatedLayoutPart[] = [];

    for (const group of orderedGroups) {
        const elementsToProcess = grouping.get(group)!;
        const elements = selectedElements
            ? elementsToProcess.filter(el => selectedElements.has(el))
            : elementsToProcess;
        if (elements.length === 0) {
            continue;
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
            const linkType = model.getLinkType(link.typeId);
            const source = model.sourceOf(link);
            const target = model.targetOf(link);
            if (!(source && target && linkType && linkType.visible)) {
                continue;
            }
            const sourceNode = nodeById[source.id];
            const targetNode = nodeById[target.id];
            if (sourceNode && targetNode) {
                links.push({typeId: link.typeId, source: sourceNode, target: targetNode});
            }
        }

        layoutFunction({nodes, links});

        const positions: Map<string, Vector> = new Map();
        const sizes: Map<string, Size> = new Map();
        for (const node of nodes) {
            const {x, y, width, height} = node;
            positions.set(node.id, {x, y});
            sizes.set(node.id, {width, height});
        }

        parts.push({
            positions,
            sizes,
            translateToPositive: group !== undefined,
            keepAveragePosition: Boolean(selectedElements),
        });
    }

    return {parts};
}

function getOrderedLayoutGroups(
    grouping: Map<string | undefined, Element[]>,
    rootGroup: string | undefined
): Array<string | undefined> {
    const visitedGroups = new Set<string | undefined>();
    const orderedGroups: Array<string | undefined> = [];
    const visit = (group: string | undefined) => {
        visitedGroups.add(group);
        const elements = grouping.get(group);
        if (elements) {
            for (const element of elements) {
                if (!visitedGroups.has(element.id)) {
                    visit(element.id);
                }
            }
            orderedGroups.push(group);
        }
    };
    visit(rootGroup);
    return orderedGroups;
}

export function applyLayout(model: DiagramModel, layout: CalculatedLayout) {
    for (const part of layout.parts) {
        const {positions, sizes, translateToPositive, keepAveragePosition} = part;

        const elements = model.elements.filter(({id}) => positions.has(id));

        const sizeProvider = makeSizeProviderFromSizes(sizes);
        if (translateToPositive) {
            const offset: Vector = getContentFittingBox(elements, [], sizeProvider);
            translateToPositiveQuadrant(positions, offset);
        }

        const averagePosition = keepAveragePosition
            ? calculateAveragePosition(elements, sizeProvider)
            : undefined;
        for (const element of elements) {
            element.setPosition(positions.get(element.id)!);
        }

        if (averagePosition) {
            const newAveragePosition = calculateAveragePosition(elements, sizeProvider);
            const averageDiff = {
                x: averagePosition.x - newAveragePosition.x,
                y: averagePosition.y - newAveragePosition.y,
            };
            positions.forEach((position, elementId) => {
                const element = model.getElement(elementId)!;
                element.setPosition({
                    x: position.x + averageDiff.x,
                    y: position.y + averageDiff.y,
                });
            });
        }
    }

    for (const link of model.links) {
        link.setVertices([]);
    }
}

function makeSizeProviderFromSizes(sizes: ReadonlyMap<string, Size>): SizeProvider {
    const EMPTY_SIZE: Size = {width: 0, height: 0};
    return {
        getElementSize: element => {
            return sizes.get(element.id) || EMPTY_SIZE;
        }
    };
}

function calculateAveragePosition(position: ReadonlyArray<Element>, sizeProvider: SizeProvider): Vector {
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

function translateToPositiveQuadrant(positions: Map<string, Vector>, offset: Vector) {
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

export function getLayoutContentFittingBox(
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
