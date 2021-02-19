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
import { hcl } from 'd3-color';

import { WidgetDock } from '../diagram/canvasWidget';
import { Element } from '../diagram/elements';
import { PaperWidgetProps } from '../diagram/paperArea';
import { WidgetAttachment, assertWidgetComponent } from '../diagram/view';

import { Debouncer } from '../viewUtils/async';
import { EventObserver } from '../viewUtils/events';
import {
    PaperTransform, totalPaneSize, paneTopLeft, paneFromPaperCoords, paperFromPaneCoords
} from '../diagram/paper';
import { Vector, getContentFittingBox } from '../diagram/geometry';

export interface NavigatorConfig {
    id?: string;
    dock?: WidgetDock;
    margin?: number;
    width?: number;
    height?: number;
    scalePadding?: number;
    expanded?: boolean;
    backgroundColor?: string;
    viewportBackgroundColor?: string;
    viewportBorderColor?: string;
    viewportBorderWidth?: number;
    viewportOutsideBorderColor?: string;
    viewportOutsideBorderWidth?: number;
}

export type NavigatorProps = PaperWidgetProps & NavigatorConfig;

interface NavigatorTransform {
    scale: number;
    canvasOffset: Vector;
    paneOffset: Vector;
}

const CLASS_NAME = 'ontodia-navigator';
const MIN_SCALE = 0.25;

interface State {
    expanded?: boolean;
}

type RequiredProps = NavigatorProps & Required<PaperWidgetProps> & DefaultProps;
type DefaultProps = Required<Pick<NavigatorProps,
    'id' | 'dock' | 'margin' | 'width' | 'height' | 'scalePadding' | 'expanded'
>>;

export class Navigator extends React.Component<NavigatorProps, State> {
    static defaultProps: DefaultProps = {
        id: 'navigator',
        dock: 'se',
        margin: 25,
        width: 300,
        height: 160,
        scalePadding: 0.2,
        expanded: true,
    };

    static readonly attachment = WidgetAttachment.Viewport;

    private readonly delayedRedraw = new Debouncer();
    private readonly listener = new EventObserver();
    private canvas: HTMLCanvasElement | undefined | null;

    private transform!: NavigatorTransform;
    private isDraggingViewport: boolean | undefined;

    constructor(props: NavigatorProps, context: any) {
        super(props, context);
        this.state = {expanded: this.props.expanded};
    }

    componentDidMount() {
        const {view, paperArea} = this.props as RequiredProps;
        this.listener.listen(view.events, 'changeHighlight', this.scheduleRedraw);
        this.listener.listen(view.model.events, 'changeCells', this.scheduleRedraw);
        this.listener.listen(view.model.events, 'elementEvent', this.scheduleRedraw);
        this.listener.listen(paperArea.events, 'pointerMove', this.scheduleRedraw);
        this.listener.listen(paperArea.events, 'scroll', this.scheduleRedraw);
    }

    shouldComponentUpdate(nextProps: NavigatorProps, nextState: State) {
        return nextState !== this.state;
    }

    componentWillUnmount() {
        this.delayedRedraw.dispose();
        this.listener.stopListening();
        this.stopDraggingViewport();
    }

    private scheduleRedraw = () => {
        if (this.state.expanded) {
            this.delayedRedraw.call(this.draw);
        }
    }

    private draw = () => {
        const {paperTransform: pt, width, height, backgroundColor} = this.props as RequiredProps;

        this.calculateTransform();

        const ctx = this.canvas!.getContext('2d')!;
        ctx.fillStyle = '#EEEEEE';
        ctx.clearRect(0, 0, width, height);
        ctx.fillRect(0, 0, width, height);

        const paneStart = paneTopLeft(pt);
        const paneSize = totalPaneSize(pt);
        const paneEnd = {
            x: paneStart.x + paneSize.x,
            y: paneStart.y + paneSize.y,
        };

        const start = canvasFromPaneCoords(paneStart, pt, this.transform);
        const end = canvasFromPaneCoords(paneEnd, pt, this.transform);
        ctx.fillStyle = backgroundColor ?? 'white';
        ctx.fillRect(start.x, start.y, end.x - start.x, end.y - start.y);

        ctx.save();

        this.drawViewportBackground(ctx);
        this.drawElements(ctx);
        this.drawViewport(ctx);

        ctx.restore();
    }

    private drawElements(ctx: CanvasRenderingContext2D) {
        const {view, renderingState, paperTransform: pt} = this.props as RequiredProps;
        view.model.elements.forEach(element => {
            const {position} = element;
            const size = renderingState.getElementSize(element);
            ctx.fillStyle = this.chooseElementColor(element);

            const {x: x1, y: y1} = canvasFromPaperCoords(position, pt, this.transform);
            const {x: x2, y: y2} = canvasFromPaperCoords({
                x: position.x + size.width,
                y: position.y + size.height,
            }, pt, this.transform);

            ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
        });
    }

    private chooseElementColor(element: Element): string {
        const {view} = this.props as RequiredProps;
        const isBlurred = view.highlighter && !view.highlighter(element);
        if (isBlurred) {
            return 'lightgray';
        }
        const {color: {h, c, l}} = view.getElementStyle(element.data);
        return hcl(h, c, l).toString();
    }

    private drawViewportBackground(ctx: CanvasRenderingContext2D) {
        const {paperArea, paperTransform: pt, viewportBackgroundColor} = this.props as RequiredProps;
        if (!viewportBackgroundColor) { return; }

        const {clientWidth, clientHeight} = paperArea.getAreaMetrics();
        const viewportStart = paperArea.clientToScrollablePaneCoords(0, 0);
        const viewportEnd = paperArea.clientToScrollablePaneCoords(clientWidth, clientHeight);

        const {x: x1, y: y1} = canvasFromPaneCoords(viewportStart, pt, this.transform);
        const {x: x2, y: y2} = canvasFromPaneCoords(viewportEnd, pt, this.transform);

        ctx.fillStyle = viewportBackgroundColor;
        ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
    }

    private drawViewport(ctx: CanvasRenderingContext2D) {
        const {
            paperArea, paperTransform: pt, width, height,
            viewportBorderColor, viewportBorderWidth, viewportOutsideBorderColor, viewportOutsideBorderWidth
        } = this.props as RequiredProps;

        ctx.strokeStyle = viewportBorderColor ?? '#337ab7';
        ctx.lineWidth = viewportBorderWidth ?? 2;

        const {clientWidth, clientHeight} = paperArea.getAreaMetrics();
        const viewportStart = paperArea.clientToScrollablePaneCoords(0, 0);
        const viewportEnd = paperArea.clientToScrollablePaneCoords(clientWidth, clientHeight);

        const {x: x1, y: y1} = canvasFromPaneCoords(viewportStart, pt, this.transform);
        const {x: x2, y: y2} = canvasFromPaneCoords(viewportEnd, pt, this.transform);

        // draw visible viewport rectangle
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

        // draw "out of area" viewport borders
        ctx.beginPath();
        if (x1 < 0) {
            ctx.moveTo(0, y1);
            ctx.lineTo(0, y2);
        }
        if (y1 < 0) {
            ctx.moveTo(x1, 0);
            ctx.lineTo(x2, 0);
        }
        if (x2 > width) {
            ctx.moveTo(width, y1);
            ctx.lineTo(width, y2);
        }
        if (y2 > height) {
            ctx.moveTo(x1, height);
            ctx.lineTo(x2, height);
        }

        ctx.strokeStyle = viewportOutsideBorderColor ?? '#a0d2ff';
        ctx.lineWidth = viewportOutsideBorderWidth ?? 4;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
    }

    private calculateTransform() {
        const {view, renderingState, paperTransform: pt, width, height, scalePadding} = this.props as RequiredProps;

        const box = getContentFittingBox(view.model.elements, view.model.links, renderingState);
        const displayPadding: Vector = {
            x: Math.max(box.width, width / MIN_SCALE) * scalePadding,
            y: Math.max(box.height, height / MIN_SCALE) * scalePadding,
        };
        const displayStart = paneFromPaperCoords({
            x: box.x - displayPadding.x,
            y: box.y - displayPadding.y,
        }, pt);
        const displayEnd = paneFromPaperCoords({
            x: box.x + box.width + displayPadding.x,
            y: box.y + box.height + displayPadding.y,
        }, pt);
        const displaySize: Vector = {
            x: displayEnd.x - displayStart.x,
            y: displayEnd.y - displayStart.y,
        };

        const scale = Math.min(width / displaySize.x, height / displaySize.y);
        const canvasOffset: Vector = {
            x: (width - displaySize.x * scale) / 2,
            y: (height - displaySize.y * scale) / 2,
        };
        this.transform = {scale, canvasOffset, paneOffset: displayStart};
    }

    private canvasFromPageCoords(pageX: number, pageY: number): Vector {
        const {top, left} = this.canvas!.getBoundingClientRect();
        return {
            x: pageX - left - window.pageXOffset,
            y: pageY - top - window.pageYOffset,
        };
    }

    render() {
        const {width, height} = this.props;
        const {expanded} = this.state;
        const position = this.getPosition();
        return (
            <div className={`${CLASS_NAME} ${CLASS_NAME}--${expanded ? 'expanded' : 'collapsed'}`}
                style={expanded ? {width, height, ...position} : position}>
                <canvas ref={this.onCanvasMount}
                    width={width}
                    height={height}
                    onMouseDown={e => {
                        this.startDragginViewport();
                        this.onDragViewport(e);
                    }}
                    onWheel={this.onWheel}
                />
                <button className={`${CLASS_NAME}__toggle`}
                    title={expanded ? 'Collapse navigator' : 'Expand navigator'}
                    onClick={this.onToggleClick}>
                    <div className={`${CLASS_NAME}__toggle-icon`} />
                </button>
            </div>
        );
    }

    private onCanvasMount = (canvas: HTMLCanvasElement | null) => {
        this.canvas = canvas;
    }

    private startDragginViewport() {
        if (!this.isDraggingViewport) {
            this.isDraggingViewport = true;
            document.addEventListener('mousemove', this.onDragViewport);
            document.addEventListener('mouseup', this.onMouseUp);
        }
    }

    private stopDraggingViewport() {
        if (this.isDraggingViewport) {
            this.isDraggingViewport = false;
            document.removeEventListener('mousemove', this.onDragViewport);
            document.removeEventListener('mouseup', this.onMouseUp);
        }
    }

    private onDragViewport = (e: MouseEvent | React.MouseEvent<{}>) => {
        e.preventDefault();
        if (this.isDraggingViewport) {
            const canvas = this.canvasFromPageCoords(e.pageX, e.pageY);
            const {paperTransform, paperArea} = this.props as RequiredProps;
            const paper = paperFromCanvasCoords(canvas, paperTransform, this.transform);
            paperArea.centerTo(paper);
        }
    }

    private onMouseUp = () => {
        this.stopDraggingViewport();
    }

    private onWheel = (e: React.WheelEvent<{}>) => {
        e.preventDefault();
        const delta = Math.max(-1, Math.min(1, e.deltaY || e.deltaX));
        const {paperArea} = this.props as RequiredProps;
        paperArea.zoomBy(-delta * 0.1);
    }

    private onToggleClick = () => {
        this.setState(
            (state): State => ({expanded: !state.expanded}),
            this.scheduleRedraw
        );
    }

    private getPosition(): React.CSSProperties {
        const {dock, margin, width, height} = this.props as RequiredProps;
        switch (dock) {
            case 'n':
                return {top: margin, left: '50%', marginLeft: -width / 2};
            case 's':
                return {bottom: margin, left: '50%', marginLeft: -width / 2};
            case 'e':
                return {top: '50%', right: margin, marginTop: -height / 2};
            case 'w':
                return {top: '50%', left: margin, marginTop: -height / 2};
            case 'ne':
                return {top: margin, right: margin};
            case 'se':
                return {bottom: margin, right: margin};
            case 'sw':
                return {bottom: margin, left: margin};
            case 'nw':
            default:
                return {top: margin, left: margin};
        }
    }
}

assertWidgetComponent(Navigator);

function canvasFromPaneCoords(pane: Vector, pt: PaperTransform, nt: NavigatorTransform): Vector {
    return {
        x: nt.canvasOffset.x + (pane.x - nt.paneOffset.x) * nt.scale,
        y: nt.canvasOffset.y + (pane.y - nt.paneOffset.y) * nt.scale,
    };
}

function canvasFromPaperCoords(paper: Vector, pt: PaperTransform, nt: NavigatorTransform): Vector {
    const pane = paneFromPaperCoords(paper, pt);
    return canvasFromPaneCoords(pane, pt, nt);
}

function paperFromCanvasCoords(canvas: Vector, pt: PaperTransform, nt: NavigatorTransform): Vector {
    const pane = {
        x: nt.paneOffset.x + (canvas.x - nt.canvasOffset.x) / nt.scale,
        y: nt.paneOffset.y + (canvas.y - nt.canvasOffset.y) / nt.scale,
    };
    return paperFromPaneCoords(pane, pt);
}
