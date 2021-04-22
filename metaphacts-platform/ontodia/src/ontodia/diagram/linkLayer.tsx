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
import * as React from 'react';
import { Component, ReactElement, SVGAttributes, CSSProperties } from 'react';

import { LinkStyle, LinkMarkerStyle, RoutedLink, RoutedLinks } from '../customization/props';
import { Debouncer } from '../viewUtils/async';
import { EventObserver } from '../viewUtils/events';

import { restoreCapturedLinkGeometry } from './commands';
import { Element as DiagramElement, Link as DiagramLink, LinkVertex, LinkType } from './elements';
import {
    Vector, computePolyline, computePolylineLength, getPointAlongPolyline, computeGrouping, Rect,
} from './geometry';
import { DiagramModel } from './model';
import { RenderingLayer, RenderingState, FilledLinkTemplate } from './renderingState';
import { DiagramView } from './view';

export interface LinkLayerProps {
    view: DiagramView;
    renderingState: RenderingState;
    links: ReadonlyArray<DiagramLink>;
    group?: string;
}

enum UpdateRequest {
    /** Some part of layer requested an update */
    Partial = 1,
    /** Full update requested */
    All,
}

const CLASS_NAME = 'ontodia-link-layer';

export class LinkLayer extends Component<LinkLayerProps, {}> {
    private readonly listener = new EventObserver();
    private readonly delayedUpdate = new Debouncer();

    private updateState = UpdateRequest.Partial;
    /** List of link IDs to update at the next flush event */
    private scheduledToUpdate = new Set<string>();

    constructor(props: LinkLayerProps, context: any) {
        super(props, context);
    }

    componentDidMount() {
        const {view, renderingState} = this.props;

        const scheduleUpdateElementLinks = (element: DiagramElement) => {
            for (const link of element.links) {
                this.scheduleUpdateLink(link.id);
            }
        };
        this.listener.listen(view.events, 'changeLanguage', this.scheduleUpdateAll);
        this.listener.listen(view.events, 'changeHighlight', this.scheduleUpdateAll);
        const updateChangedRoutes = (changed: RoutedLinks, previous: RoutedLinks) => {
            changed.forEach((routing, linkId) => {
                if (previous.get(linkId) !== routing) {
                    this.scheduleUpdateLink(linkId);
                }
            });
        };
        this.listener.listen(renderingState.events, 'changeElementSize', e => {
            scheduleUpdateElementLinks(e.source);
        });
        this.listener.listen(renderingState.events, 'updateRoutings', ({previous}) => {
            const newRoutes = renderingState.getRoutings();
            updateChangedRoutes(newRoutes, previous);
            updateChangedRoutes(previous, newRoutes);
        });
        this.listener.listen(view.model.events, 'changeCells', e => {
            if (e.updateAll) {
                this.scheduleUpdateAll();
            } else {
                if (e.changedElement) {
                    scheduleUpdateElementLinks(e.changedElement);
                }
                if (e.changedLinks) {
                    for (const link of e.changedLinks) {
                        this.scheduleUpdateLink(link.id);
                    }
                }
            }
        });
        this.listener.listen(view.model.events, 'elementEvent', ({data}) => {
            const elementEvent = data.changePosition;
            if (!elementEvent) { return; }
            scheduleUpdateElementLinks(elementEvent.source);
        });
        this.listener.listen(view.model.events, 'linkEvent', ({data}) => {
            const linkEvent = (
                data.changeData ||
                data.changeLayoutOnly ||
                data.changeVertices ||
                data.changeLinkState
            );
            if (linkEvent) {
                this.scheduleUpdateLink(linkEvent.source.id);
            }
        });
        this.listener.listen(view.model.events, 'linkTypeEvent', ({data}) => {
            const linkTypeEvent = data.changeLabel || data.changeVisibility;
            if (!linkTypeEvent) { return; }
            const linkTypeId = linkTypeEvent.source.id;
            for (const link of view.model.linksOfType(linkTypeId)) {
                this.scheduleUpdateLink(link.id);
            }
        });
        this.listener.listen(view.model.events, 'propertyEvent', ({data}) => {
            const propertyEvent = data.changeLabel;
            if (!propertyEvent) { return; }
            const propertyTypeId = propertyEvent.source.id;
            for (const link of view.model.links) {
                if (!link.data) { continue; }
                if (Object.prototype.hasOwnProperty.call(link.data, propertyTypeId)) {
                    this.scheduleUpdateLink(link.id);
                }
            }
        });
        this.listener.listen(renderingState.events, 'syncUpdate', ({layer}) => {
            if (layer !== RenderingLayer.Link) { return; }
            this.delayedUpdate.runSynchronously();
        });
    }

    shouldComponentUpdate() {
        return false;
    }

    componentWillUnmount() {
        this.listener.stopListening();
        this.delayedUpdate.dispose();
    }

    private scheduleUpdateAll = () => {
        if (this.updateState !== UpdateRequest.All) {
            this.updateState = UpdateRequest.All;
            this.scheduledToUpdate = new Set<string>();
        }
        this.delayedUpdate.call(this.performUpdate);
    }

    private scheduleUpdateLink(linkId: string) {
        if (this.updateState === UpdateRequest.Partial) {
            this.scheduledToUpdate.add(linkId);
        }
        this.delayedUpdate.call(this.performUpdate);
    }

    private popShouldUpdatePredicate(): (model: DiagramLink) => boolean {
        const {updateState, scheduledToUpdate} = this;
        this.scheduledToUpdate = new Set<string>();
        this.updateState = UpdateRequest.Partial;
        return updateState === UpdateRequest.All
            ? () => true
            : link => scheduledToUpdate.has(link.id);
    }

    private performUpdate = () => {
        this.forceUpdate();
    }

    private getLinks = () => {
        const {view, links, group} = this.props;

        if (!group) { return links; }

        const grouping = computeGrouping(view.model.elements);
        const nestedElements = computeDeepNestedElements(grouping, group);

        return links.filter(link => {
            const {sourceId, targetId} = link;

            const source = view.model.getElement(sourceId);
            const target = view.model.getElement(targetId);

            if (!source || !target) { return false; }

            const sourceGroup = source.group;
            const targetGroup = target.group;

            return sourceGroup && nestedElements[sourceGroup]
                || targetGroup && nestedElements[targetGroup];
        });
    }

    render() {
        const {view, renderingState} = this.props;
        const shouldUpdate = this.popShouldUpdatePredicate();

        return <g className={CLASS_NAME}>
            {this.getLinks().map(model => (
                <LinkView key={model.id}
                    renderingState={renderingState}
                    view={view}
                    model={model}
                    shouldUpdate={shouldUpdate(model)}
                    route={renderingState.getRouting(model.id)}
                />
            ))}
        </g>;
    }
}

function computeDeepNestedElements(
    grouping: Map<string | undefined, DiagramElement[]>,
    groupId: string
): { [id: string]: true } {
    const deepChildren: { [elementId: string]: true } = {};

    function collectNestedItems(parentId: string) {
        deepChildren[parentId] = true;
        const children = grouping.get(parentId);
        if (!children) { return; }
        for (const element of children) {
            if (element.group !== parentId) { continue; }
            collectNestedItems(element.id);
        }
    }

    collectNestedItems(groupId);
    return deepChildren;
}

interface LinkViewProps {
    view: DiagramView;
    renderingState: RenderingState;
    model: DiagramLink;
    shouldUpdate: boolean;
    route?: RoutedLink;
}

const LINK_CLASS = 'ontodia-link';
const LABEL_GROUPING_PRECISION = 100;
// temporary, cleared-before-render map to hold line numbers for labels
// grouped on the same link offset
const TEMPORARY_LABEL_LINES = new Map<number, number>();

class LinkView extends Component<LinkViewProps, {}> {
    private linkType!: LinkType;
    private template!: FilledLinkTemplate;

    constructor(props: LinkViewProps, context: any) {
        super(props, context);
        this.grabLinkTemplate(this.props);
    }

    componentWillReceiveProps(nextProps: LinkViewProps) {
        if (this.linkType.id !== nextProps.model.typeId) {
            this.grabLinkTemplate(nextProps);
        }
    }

    shouldComponentUpdate(nextProps: LinkViewProps, nextState: {}) {
        return nextProps.shouldUpdate;
    }

    private grabLinkTemplate(props: LinkViewProps) {
        this.linkType = props.view.model.getLinkType(props.model.typeId)!;
        this.template = props.renderingState.createLinkTemplate(this.linkType);
    }

    render() {
        const {view, renderingState, model, route} = this.props;
        const source = view.model.getElement(model.sourceId);
        const target = view.model.getElement(model.targetId);
        if (!(this.linkType.visible && source && target)) {
            return null;
        }

        const verticesDefinedByUser = model.vertices || [];
        const vertices = route ? route.vertices : verticesDefinedByUser;
        const polyline = computePolyline(source, target, vertices, renderingState);

        const path = 'M' + polyline.map(({x, y}) => `${x},${y}`).join(' L');

        const {showLabel} = this.linkType;
        const {markerSource, markerSourceId, markerTarget, markerTargetId} = this.template;
        const style = this.template.renderLink(model, view);
        const pathAttributes = getPathAttributes(model, style);

        const isBlurred = view.highlighter && !view.highlighter(model);
        const className = `${LINK_CLASS} ${isBlurred ? `${LINK_CLASS}--blurred` : ''}`;
        return (
            <g className={className} data-link-id={model.id} data-source-id={source.id} data-target-id={target.id}>
                <path className={`${LINK_CLASS}__connection`} d={path} {...pathAttributes}
                    markerStart={markerSource ? `url(#${markerSourceId})` : undefined}
                    markerEnd={markerTarget ? `url(#${markerTargetId})` : undefined} />
                <path className={`${LINK_CLASS}__wrap`} d={path} />
                {showLabel ? this.renderLabels(polyline, style) : undefined}
                {this.renderVertices(verticesDefinedByUser, pathAttributes.stroke)}
            </g>
        );
    }

    private renderVertices(vertices: ReadonlyArray<Vector>, fill: string | undefined) {
        const elements: ReactElement<any>[] = [];

        const vertexClass = `${LINK_CLASS}__vertex`;
        const vertexRadius = 10;

        let index = 0;
        for (const {x, y} of vertices) {
            elements.push(
                <circle key={index * 2}
                    data-vertex={index} className={vertexClass}
                    cx={x} cy={y} r={vertexRadius} fill={fill} />
            );
            elements.push(
                <VertexTools key={index * 2 + 1}
                    className={`${LINK_CLASS}__vertex-tools`}
                    model={this.props.model} vertexIndex={index}
                    vertexRadius={vertexRadius} x={x} y={y}
                    onRemove={this.onRemoveLinkVertex}
                />
            );
            index++;
        }

        return <g className={`${LINK_CLASS}__vertices`}>{elements}</g>;
    }

    private onRemoveLinkVertex = (vertex: LinkVertex) => {
        const model = this.props.view.model;
        model.history.registerToUndo(
            restoreCapturedLinkGeometry(vertex.link)
        );
        vertex.remove();
        // remove all vertices for loop link if only one left
        // (it's hard to remove it otherwise due to overlapping decorators)
        const {link} = vertex;
        if (link.sourceId === link.targetId && link.vertices.length === 1) {
            link.setVertices([]);
        }
    }

    private onBoundsUpdate = (newBounds: Rect | undefined) => {
        const {model, renderingState} = this.props;
        renderingState.setLabelBounds(model, newBounds);
    }

    private renderLabels(polyline: ReadonlyArray<Vector>, style: LinkStyle) {
        const {view, model, route} = this.props;

        const labels = computeLinkLabels(model, style, view);

        let textAnchor: 'start' | 'middle' | 'end' = 'middle';
        if (route && route.labelTextAnchor) {
            textAnchor = route.labelTextAnchor;
        }

        const polylineLength = computePolylineLength(polyline);
        TEMPORARY_LABEL_LINES.clear();

        let seenNonEmptyLabel = false;
        return (
            <g className={`${LINK_CLASS}__labels`}>
                {labels.map((label, index) => {
                    if (label.content === null) {
                        return null;
                    }
                    const {x, y} = getPointAlongPolyline(polyline, polylineLength * label.offset);
                    const groupKey = Math.round(label.offset * LABEL_GROUPING_PRECISION) / LABEL_GROUPING_PRECISION;
                    const line = TEMPORARY_LABEL_LINES.get(groupKey) || 0;
                    TEMPORARY_LABEL_LINES.set(groupKey, line + 1);
                    const onBoundsUpdate = seenNonEmptyLabel ? undefined : this.onBoundsUpdate;
                    seenNonEmptyLabel = true;
                    return (
                        <LinkLabel key={index}
                            x={x} y={y}
                            line={line}
                            label={label}
                            textAnchor={textAnchor}
                            onBoundsUpdate={onBoundsUpdate}
                        />
                    );
                })}
            </g>
        );
    }
}

function computeLinkLabels(model: DiagramLink, style: LinkStyle, view: DiagramView) {
    const labels: LabelAttributes[] = [];

    const labelStyle = style.label ?? {};

    let content: React.ReactNode | undefined;
    let title: string | undefined = labelStyle.title;
    if (labelStyle.content !== undefined) {
        // allow to hide label by setting it's content to null
        content = labelStyle.content;
    } else {
        const type = view.model.getLinkType(model.typeId)!;
        const text = view.selectLabel(type.label)?.value ?? view.formatLabel(type.label, type.id);
        content = text;
        if (title === undefined) {
            title = `${text} ${view.formatIri(model.typeId)}`;
        }
    }

    labels.push({
        offset: labelStyle.position ?? 0.5,
        content,
        title,
        rectStyle: applyLabelRectStyleDefaults(labelStyle.rectStyle),
        textStyle: applyLabelTextStyleDefaults(labelStyle.textStyle),
    });

    if (style.properties) {
        for (const property of style.properties) {
            if (!property.content) {
                continue;
            }
            labels.push({
                offset: property.position ?? 0.5,
                content: property.content,
                title: property.title,
                rectStyle: applyLabelRectStyleDefaults(property.rectStyle),
                textStyle: applyLabelTextStyleDefaults(property.textStyle),
            });
        }
    }

    return labels;
}

function getPathAttributes(model: DiagramLink, style: LinkStyle): SVGAttributes<SVGPathElement> {
    const connectionAttributes: LinkStyle['connection'] = style.connection || {};
    const defaultStrokeDasharray = model.layoutOnly ? '5,5' : undefined;
    const {
        fill = 'none',
        stroke = 'black',
        'stroke-width': strokeWidth,
        'stroke-dasharray': strokeDasharray = defaultStrokeDasharray,
    } = connectionAttributes;
    return {fill, stroke, strokeWidth, strokeDasharray};
}

function applyLabelTextStyleDefaults(style: CSSProperties | undefined): CSSProperties {
    const {
        fill = 'black',
        stroke = 'none',
        strokeWidth = 0,
        fontFamily = '"Helvetica Neue", "Helvetica", "Arial", sans-serif',
        fontSize = 'inherit',
        fontWeight = 'bold',
    } = style ?? {};
    return {...style, fill, stroke, strokeWidth, fontFamily, fontSize, fontWeight};
}

function applyLabelRectStyleDefaults(style: CSSProperties | undefined): CSSProperties {
    const {
        fill = 'white',
        stroke = 'none',
        strokeWidth = 0,
    } = style ?? {};
    return {...style, fill, stroke, strokeWidth};
}

interface LabelAttributes {
    offset: number;
    content?: React.ReactNode;
    title?: string;
    rectStyle?: CSSProperties;
    textStyle?: CSSProperties;
}

interface LinkLabelProps {
    x: number;
    y: number;
    line: number;
    label: LabelAttributes;
    textAnchor: 'start' | 'middle' | 'end';
    onBoundsUpdate?: (newBounds: Rect | undefined) => void;
}

interface LinkLabelState {
    readonly width: number;
    readonly height: number;
}

const GROUPED_LABEL_MARGIN = 2;

class LinkLabel extends Component<LinkLabelProps, LinkLabelState> {
    private text: SVGTextElement | null | undefined;
    private shouldUpdateBounds = true;

    constructor(props: LinkLabelProps) {
        super(props);
        this.state = {width: 0, height: 0};
    }

    render() {
        const {x, y, label, line, textAnchor} = this.props;
        const {width, height} = this.state;
        const {x: rectX, y: rectY} = this.getLabelRectangle(width, height);

        const transform = line === 0 ? undefined :
            `translate(0, ${line * (height + GROUPED_LABEL_MARGIN)}px)`;
        // HACK: 'alignment-baseline' and 'dominant-baseline' are not supported in Edge and IE
        const dy = '0.6ex';

        return (
          <g style={transform ? {transform} : undefined}>
              {label.title ? <title>{label.title}</title> : undefined}
              <rect x={rectX} y={rectY}
                  width={width} height={height}
                  style={label.rectStyle}
              />
              <text ref={this.onTextMount}
                    x={x} y={y} dy={dy}
                    textAnchor={textAnchor}
                    style={label.textStyle}>
                    {label.content}
              </text>
          </g>
        );
    }

    private getLabelRectangle(width: number, height: number): Rect {
        const {x, y, textAnchor} = this.props;

        let xOffset = 0;
        if (textAnchor === 'middle') {
            xOffset = -width / 2;
        } else if (textAnchor === 'end') {
            xOffset = -width;
        }

        return {
            x: x + xOffset,
            y: y - height / 2,
            width,
            height,
        };
    }

    private onTextMount = (text: SVGTextElement | null) => {
        this.text = text;
    }

    componentDidMount() {
        this.recomputeBounds(this.props);
    }

    componentWillUnmount() {
        const {onBoundsUpdate} = this.props;
        if (onBoundsUpdate) {
            onBoundsUpdate(undefined);
        }
    }

    componentWillReceiveProps(nextProps: LinkLabelProps) {
        this.shouldUpdateBounds = true;
    }

    componentDidUpdate(props: LinkLabelProps) {
        this.recomputeBounds(this.props);
    }

    private recomputeBounds(props: LinkLabelProps) {
        if (this.shouldUpdateBounds) {
            const {onBoundsUpdate} = this.props;
            this.shouldUpdateBounds = false;
            const bounds = this.text!.getBBox();

            if (onBoundsUpdate) {
                const labelBounds = this.getLabelRectangle(bounds.width, bounds.height);
                onBoundsUpdate(labelBounds);
            }

            this.setState({
                width: bounds.width,
                height: bounds.height,
            });
        }
    }
}

class VertexTools extends Component<{
    className: string;
    model: DiagramLink;
    vertexIndex: number;
    vertexRadius: number;
    x: number;
    y: number;
    onRemove: (vertex: LinkVertex) => void;
}, {}> {
    render() {
        const {className, vertexIndex, vertexRadius, x, y} = this.props;
        const transform = `translate(${x + 2 * vertexRadius},${y - 2 * vertexRadius})scale(${vertexRadius})`;
        return (
            <g className={className} transform={transform} onMouseDown={this.onRemoveVertex}>
                <title>Remove vertex</title>
                <circle r={1} />
                <path d='M-0.5,-0.5 L0.5,0.5 M0.5,-0.5 L-0.5,0.5' strokeWidth={2 / vertexRadius} />
            </g>
        );
    }

    private onRemoveVertex = (e: React.MouseEvent<SVGElement>) => {
        if (e.button !== 0 /* left button */) { return; }
        e.preventDefault();
        e.stopPropagation();
        const {onRemove, model, vertexIndex} = this.props;
        onRemove(new LinkVertex(model, vertexIndex));
    }
}

export interface LinkMarkersProps {
    readonly model: DiagramModel;
    readonly renderingState: RenderingState;
}

export class LinkMarkers extends Component<LinkMarkersProps, {}> {
    private readonly listener = new EventObserver();
    private readonly delayedUpdate = new Debouncer();

    render() {
        const {model, renderingState} = this.props;
        const markers: Array<ReactElement<LinkMarkerProps>> = [];

        renderingState.getLinkTemplates().forEach((template, linkTypeId) => {
            const type = model.getLinkType(linkTypeId);
            if (!type) { return; }

            if (template.markerSource) {
                markers.push(
                    <LinkMarker key={template.markerSourceId}
                        markerId={template.markerSourceId}
                        style={template.markerSource}
                        isStartMarker={true}
                    />
                );
            }
            if (template.markerTarget) {
                markers.push(
                    <LinkMarker key={template.markerTargetId}
                        markerId={template.markerTargetId}
                        style={template.markerTarget}
                        isStartMarker={false}
                    />
                );
            }
        });

        return <defs>{markers}</defs>;
    }

    componentDidMount() {
        const {renderingState} = this.props;
        this.listener.listen(renderingState.events, 'syncUpdate', ({layer}) => {
            if (layer !== RenderingLayer.Link) { return; }
            this.delayedUpdate.runSynchronously();
        });
        this.listener.listen(renderingState.events, 'changeLinkTemplates', () => {
            this.delayedUpdate.call(() => this.forceUpdate());
        });
    }

    shouldComponentUpdate() {
        return false;
    }

    componentWillUnmount() {
        this.listener.stopListening();
        this.delayedUpdate.dispose();
    }
}

const SVG_NAMESPACE: 'http://www.w3.org/2000/svg' = 'http://www.w3.org/2000/svg';

interface LinkMarkerProps {
    markerId: string;
    isStartMarker: boolean;
    style: LinkMarkerStyle;
}

class LinkMarker extends Component<LinkMarkerProps, {}> {
    render() {
        return <marker ref={this.onMarkerMount}></marker>;
    }

    shouldComponentUpdate() {
        return false;
    }

    private onMarkerMount = (marker: SVGMarkerElement) => {
        if (!marker) { return; }

        const {markerId, isStartMarker, style} = this.props;

        marker.setAttribute('id', markerId);
        marker.setAttribute('markerWidth', String(style.width));
        marker.setAttribute('markerHeight', String(style.height));
        marker.setAttribute('orient', 'auto');

        const xOffset = isStartMarker ? 0 : (style.width - 1);
        marker.setAttribute('refX', String(xOffset));
        marker.setAttribute('refY', String(style.height / 2));
        marker.setAttribute('markerUnits', 'userSpaceOnUse');

        const path = document.createElementNS(SVG_NAMESPACE, 'path');
        path.setAttribute('d', style.d);
        if (style.fill !== undefined) {
            path.setAttribute('fill', style.fill);
        }
        if (style.fillOpacity !== undefined) {
            path.setAttribute('fill-opacity', String(style.fillOpacity));
        }
        if (style.stroke !== undefined) {
            path.setAttribute('stroke', style.stroke);
        }
        if (style.strokeWidth !== undefined) {
            path.setAttribute('stroke-width', String(style.strokeWidth));
        }
        if (style.strokeOpacity !== undefined) {
            path.setAttribute('stroke-opacity', String(style.strokeOpacity));
        }

        marker.appendChild(path);
    }
}

export interface LinkExampleProps {
    readonly link: DiagramLink;
    readonly pathAttributes: SVGAttributes<SVGPathElement>;
    readonly view: DiagramView;
    readonly renderingState: RenderingState;
}

export class LinkExample extends Component<LinkExampleProps> {
    render() {
        const {link, pathAttributes, view, renderingState} = this.props;
        const linkType = view.model.createLinkType(link.typeId);
        const linkTemplate = renderingState.createLinkTemplate(linkType);
        const linkStyle = linkTemplate.renderLink(link, view);
        const {markerSource, markerSourceId, markerTarget, markerTargetId} = linkTemplate;
        return (
            <>
                <defs>
                    {markerSource ? (
                        <LinkMarker markerId={markerSourceId}
                            style={markerSource}
                            isStartMarker={true}
                        />
                    ) : null}
                    {markerTarget ? (
                        <LinkMarker markerId={markerTargetId}
                            style={markerTarget}
                            isStartMarker={false}
                        />
                    ) : null}
                </defs>
                <path {...getPathAttributes(link, linkStyle)}
                    {...pathAttributes}
                    markerStart={markerSource ? `url(#${markerSourceId})` : undefined}
                    markerEnd={markerTarget ? `url(#${markerTargetId})` : undefined}
                />
            </>
        );
    }
}
