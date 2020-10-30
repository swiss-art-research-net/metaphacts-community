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
import * as React from 'react';
import { Component, CSSProperties } from 'react';

import { Cell, LinkVertex } from './elements';
import { ElementLayer } from './elementLayer';
import { Vector } from './geometry';
import { LinkLayer, LinkMarkers } from './linkLayer';
import { DiagramModel } from './model';
import { RenderingState } from './renderingState';
import { DiagramView } from './view';

export interface PaperProps {
    view: DiagramView;
    paperTransform: PaperTransform;
    renderingState: RenderingState;
    onPointerDown?: (e: React.MouseEvent<HTMLElement>, cell: Cell | undefined) => void;
    group?: string;
    linkLayerWidgets?: React.ReactElement<any>;
    elementLayerWidgets?: React.ReactElement<any>;
}

const CLASS_NAME = 'ontodia-paper';

export class Paper extends Component<PaperProps, {}> {
    render() {
        const {view, group, paperTransform, linkLayerWidgets, elementLayerWidgets, renderingState} = this.props;
        const {width, height, originX, originY, scale, paddingX, paddingY} = paperTransform;

        const scaledWidth = width * scale;
        const scaledHeight = height * scale;
        // using padding instead of margin in combination with setting width and height
        // on .paper element to avoid "over-constrained" margins, see an explanation here:
        // https://stackoverflow.com/questions/11695354
        const style: CSSProperties = {
            width: scaledWidth + paddingX,
            height: scaledHeight + paddingY,
            marginLeft: paddingX,
            marginTop: paddingY,
            paddingRight: paddingX,
            paddingBottom: paddingY,
        };
        const htmlTransformStyle: React.CSSProperties = {
            position: 'absolute', left: 0, top: 0,
            transform: `scale(${scale},${scale})translate(${originX}px,${originY}px)`,
        };

        return (
            <div className={CLASS_NAME} style={style} onMouseDown={this.onMouseDown}>
                <TransformedSvgCanvas className={`${CLASS_NAME}__canvas`}
                    style={{overflow: 'visible'}}
                    paperTransform={paperTransform}>
                    <LinkMarkers model={view.model} renderingState={renderingState} />
                    <LinkLayer
                        view={view}
                        renderingState={renderingState}
                        links={view.model.links}
                        group={group}
                    />
                </TransformedSvgCanvas>
                {linkLayerWidgets}
                <ElementLayer
                    view={view}
                    renderingState={renderingState}
                    group={group}
                    style={htmlTransformStyle}
                />
                {elementLayerWidgets}
            </div>
        );
    }

    private onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        const {view, onPointerDown} = this.props;
        const cell = e.target instanceof Element
            ? findCell(e.target, e.currentTarget, view.model) : undefined;
        if (onPointerDown) {
            onPointerDown(e, cell);
        }
    }
}

function findCell(bottom: Element, top: Element, model: DiagramModel): Cell | undefined {
    let target: Node | null = bottom;
    let vertexIndex: number | undefined;
    while (true) {
        if (target instanceof Element) {
            if (target.hasAttribute('data-element-id')) {
                return model.getElement(target.getAttribute('data-element-id')!);
            } else if (target.hasAttribute('data-link-id')) {
                const link = model.getLinkById(target.getAttribute('data-link-id')!);
                if (!link) { return undefined; }
                return typeof vertexIndex === 'number' ? new LinkVertex(link, vertexIndex) : link;
            } else if (target.hasAttribute('data-vertex')) {
                vertexIndex = Number(target.getAttribute('data-vertex'));
            }
        }
        if (!target || target === top) { break; }
        target = target.parentNode;
    }
    return undefined;
}

export interface PaperTransform {
    width: number;
    height: number;
    originX: number;
    originY: number;
    scale: number;
    paddingX: number;
    paddingY: number;
}

export interface TransformedSvgCanvasProps extends React.HTMLProps<SVGSVGElement> {
    paperTransform: PaperTransform;
}

export class TransformedSvgCanvas extends Component<TransformedSvgCanvasProps, {}> {
    private static readonly SVG_STYLE: CSSProperties = {
        position: 'absolute',
        top: 0,
        left: 0,
    };
    render() {
        const {paperTransform, style, children, ...otherProps} = this.props;
        const {width, height, originX, originY, scale, paddingX, paddingY} = paperTransform;
        const scaledWidth = width * scale;
        const scaledHeight = height * scale;
        let svgStyle = TransformedSvgCanvas.SVG_STYLE;
        if (style) {
            svgStyle = {...svgStyle, ...style};
        }
        return (
            <svg width={scaledWidth} height={scaledHeight} style={svgStyle} {...otherProps}>
                <g transform={`scale(${scale},${scale})translate(${originX},${originY})`}>
                    {children}
                </g>
            </svg>
        );
    }
}

/**
 * @returns scrollable pane size in non-scaled pane coords.
 */
export function totalPaneSize(pt: PaperTransform): Vector {
    return {
        x: pt.width * pt.scale + pt.paddingX * 2,
        y: pt.height * pt.scale + pt.paddingY * 2,
    };
}

/**
 * @returns scrollable pane top-left corner position in non-scaled pane coords.
 */
export function paneTopLeft(pt: PaperTransform): Vector {
    return {x: -pt.paddingX, y: -pt.paddingY};
}

export function paneFromPaperCoords(paper: Vector, pt: PaperTransform): Vector {
    return {
        x: (paper.x + pt.originX) * pt.scale,
        y: (paper.y + pt.originY) * pt.scale,
    };
}

export function paperFromPaneCoords(pane: Vector, pt: PaperTransform): Vector {
    return {
        x: pane.x / pt.scale - pt.originX,
        y: pane.y / pt.scale - pt.originY,
    };
}
