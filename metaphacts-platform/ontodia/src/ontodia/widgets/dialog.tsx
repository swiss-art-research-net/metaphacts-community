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

import { DiagramView, WidgetAttachment, assertWidgetComponent } from '../diagram/view';
import { Element, Link } from '../diagram/elements';
import { EventObserver, Unsubscribe } from '../viewUtils/events';
import { PaperWidgetProps } from '../diagram/paperArea';
import {
    Size,
    Vector,
    boundsOf,
    computePolyline,
    computePolylineLength,
    getPointAlongPolyline,
} from '../diagram/geometry';
import { RenderingState } from '../diagram/renderingState';
import { DraggableHandle } from '../workspace/draggableHandle';

const DEFAULT_WIDTH = 300;
const DEFAULT_HEIGHT = 300;
const MIN_WIDTH = 250;
const MIN_HEIGHT = 250;
const MAX_WIDTH = 800;
const MAX_HEIGHT = 800;

const ELEMENT_OFFSET = 40;
const LINK_OFFSET = 20;
const FOCUS_OFFSET = 20;

const CLASS_NAME = 'ontodia-dialog';

export interface DialogProps extends PaperWidgetProps {
    view: DiagramView;
    target: Element | Link;
    size?: Size;
    caption?: string;
    offset?: Vector;
    calculatePosition?: (renderingState: RenderingState) => Vector | undefined;
    onClose: () => void;
    children: JSX.Element;
}

export interface State {
    width?: number;
    height?: number;
}

type RequiredProps = DialogProps & Required<PaperWidgetProps> & {
    readonly size: Size;
};

export class Dialog extends React.Component<DialogProps, State> {
    static readonly attachment = WidgetAttachment.OverElements;
    static readonly key = 'dialog';
    static defaultProps: Partial<DialogProps> = {
        size: {width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT},
    };

    private unsubscribeFromTarget: Unsubscribe | undefined = undefined;
    private readonly handler = new EventObserver();

    private updateAll = () => this.forceUpdate();

    private startSize: Vector | undefined;

    constructor(props: DialogProps) {
        super(props);
        this.state = {};
    }

    componentDidMount() {
        this.listenToTarget(this.props.target);
        this.focusOn();
    }

    componentWillReceiveProps(nextProps: DialogProps) {
        if (nextProps.target !== this.props.target) {
            this.listenToTarget(nextProps.target);
        }
    }

    componentWillUnmount() {
        this.listenToTarget(undefined);
    }

    private listenToTarget(target?: Element | Link) {
        if (this.unsubscribeFromTarget) {
            this.unsubscribeFromTarget();
            this.unsubscribeFromTarget = undefined;
        }

        if (target) {
            const {renderingState, view} = this.props as RequiredProps;

            if (target instanceof Element) {
                this.listenToElement(target);
            } else if (target instanceof Link) {
                this.listenToLink(target);
            }

            this.handler.listen(renderingState.events, 'changeElementSize', ({source}) => {
                if (source === target) {
                    this.updateAll();
                }
            });
            this.handler.listen(view.events, 'changeLanguage', this.updateAll);

            this.unsubscribeFromTarget = () => { this.handler.stopListening(); };
        }
    }

    private listenToElement(element: Element) {
        this.handler.listen(element.events, 'changePosition', this.updateAll);
    }

    private listenToLink(link: Link) {
        const {view, renderingState} = this.props as RequiredProps;

        const source = view.model.getElement(link.sourceId)!;
        const target = view.model.getElement(link.targetId)!;

        this.listenToElement(source);
        this.listenToElement(target);

        this.handler.listen(link.events, 'changeVertices', this.updateAll);
        this.handler.listen(renderingState.events, 'changeLinkLabelBounds', e => {
            if (e.source === link) {
                this.updateAll();
            }
        });
    }

    private calculatePositionForElement(element: Element): Vector {
        const {paperArea, renderingState, size} = this.props as RequiredProps;

        const bbox = boundsOf(element, renderingState);
        const {y: y0} = paperArea.paperToScrollablePaneCoords(bbox.x, bbox.y);
        const {x: x1, y: y1} = paperArea.paperToScrollablePaneCoords(
            bbox.x + bbox.width,
            bbox.y + bbox.height,
        );

        return {
            x: x1 + ELEMENT_OFFSET,
            y: (y0 + y1) / 2 - (size.height / 2),
        };
    }

    private calculatePositionForLink(link: Link): Vector {
        const {view, renderingState, paperArea} = this.props as RequiredProps;

        const source = view.model.getElement(link.sourceId);
        const target = view.model.getElement(link.targetId);

        if (!source || !target) {
            throw new Error('Source and target are not specified');
        }

        const route = renderingState.getRouting(link.id);
        const verticesDefinedByUser = link.vertices || [];
        const vertices = route ? route.vertices : verticesDefinedByUser;

        const polyline = computePolyline(source, target, vertices, renderingState);
        const polylineLength = computePolylineLength(polyline);
        const targetPoint = getPointAlongPolyline(polyline, polylineLength / 2);

        const {x, y} = paperArea.paperToScrollablePaneCoords(targetPoint.x, targetPoint.y);

        return {y: y + LINK_OFFSET, x: x + LINK_OFFSET};
    }

    private calculatePosition(): Vector {
        const {
            target, paperArea, renderingState, offset = {x: 0, y: 0}, calculatePosition
        } = this.props as RequiredProps;

        if (calculatePosition) {
            const position = calculatePosition(renderingState);
            if (position) {
                const {x, y} = paperArea.paperToScrollablePaneCoords(position.x, position.y);
                return {x: x + offset.x, y: y + offset.y};
            }
        }

        if (target instanceof Element) {
            return this.calculatePositionForElement(target);
        } else if (target instanceof Link) {
            return this.calculatePositionForLink(target);
        }

        throw new Error('Unknown target type');
    }

    private getViewPortScrollablePoints(): {min: Vector; max: Vector} {
        const {paperArea} = this.props as RequiredProps;
        const {clientWidth, clientHeight} = paperArea.getAreaMetrics();
        const min = paperArea.clientToScrollablePaneCoords(0, 0);
        const max = paperArea.clientToScrollablePaneCoords(clientWidth, clientHeight);
        return {min, max};
    }

    private getDialogScrollablePoints(): {min: Vector; max: Vector} {
        const {size} = this.props as RequiredProps;
        const {x, y} = this.calculatePosition();
        const min = {
            x: x - FOCUS_OFFSET,
            y: y - FOCUS_OFFSET,
        };
        const max = {
            x: min.x + size.width + FOCUS_OFFSET * 2,
            y: min.y + size.height + FOCUS_OFFSET * 2,
        };
        return {min, max};
    }

    private focusOn() {
        const {paperArea} = this.props as RequiredProps;
        const {min: viewPortMin, max: viewPortMax} = this.getViewPortScrollablePoints();
        const {min, max} = this.getDialogScrollablePoints();

        let xOffset = 0;
        if (min.x < viewPortMin.x) {
            xOffset = min.x - viewPortMin.x;
        } else if (max.x > viewPortMax.x) {
            xOffset = max.x - viewPortMax.x;
        }

        let yOffset = 0;
        if (min.y < viewPortMin.y) {
            yOffset = min.y - viewPortMin.y;
        } else if (max.y > viewPortMax.y) {
            yOffset = max.y - viewPortMax.y;
        }

        const curScrollableCenter = {
            x: viewPortMin.x + (viewPortMax.x - viewPortMin.x) / 2,
            y: viewPortMin.y + (viewPortMax.y - viewPortMin.y) / 2,
        };
        const newScrollabalCenter = {
            x: curScrollableCenter.x + xOffset,
            y: curScrollableCenter.y + yOffset,
        };
        const paperCenter = paperArea.scrollablePaneToPaperCoords(
            newScrollabalCenter.x, newScrollabalCenter.y,
        );
        paperArea.centerTo(paperCenter);
    }

    private onStartDragging = (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        const {size} = this.props as RequiredProps;
        this.startSize = {x: this.state.width || size.width, y: this.state.height || size.height};
    }

    private calculateHeight(height: number) {
        const {size} = this.props as RequiredProps;
        const minHeight = Math.min(size.height, MIN_HEIGHT);
        const maxHeight = Math.max(size.height, MAX_HEIGHT);
        return Math.max(minHeight, Math.min(maxHeight, height));
    }

    private calculateWidth(width: number) {
        const {size} = this.props as RequiredProps;
        const minWidth = Math.min(size.width, MIN_WIDTH);
        const maxWidth = Math.max(size.width, MAX_WIDTH);
        return Math.max(minWidth, Math.min(maxWidth, width));
    }

    private onDragHandleBottom = (e: MouseEvent, dx: number, dy: number) => {
        const height = this.calculateHeight(this.startSize!.y + dy);
        this.setState({height});
    }

    private onDragHandleRight = (e: MouseEvent, dx: number) => {
        const width = this.calculateWidth(this.startSize!.x + dx);
        this.setState({width});
    }

    private onDragHandleBottomRight = (e: MouseEvent, dx: number, dy: number) => {
        const width = this.calculateWidth(this.startSize!.x + dx);
        const height = this.calculateHeight(this.startSize!.y + dy);
        this.setState({width, height});
    }

    render() {
        const {size, caption, paperArea, paperTransform, renderingState, children} = this.props as RequiredProps;
        const {x, y} = this.calculatePosition();
        const width = this.state.width || size.width;
        const height = this.state.height || size.height;
        const style = {
            top: y,
            left: x,
            width,
            height,
        };
        const paperWidgetProps: PaperWidgetProps = {
            paperArea,
            paperTransform,
            renderingState
        };
        return (
            <div className={CLASS_NAME} style={style}>
                <button className={`${CLASS_NAME}__close-button`} onClick={() => this.props.onClose()} />
                {caption ? <div className='ontodia-dialog__caption'>{caption}</div> : null}
                {React.cloneElement(children, paperWidgetProps)}
                <DraggableHandle
                    className={`${CLASS_NAME}__bottom-handle`}
                    onBeginDragHandle={this.onStartDragging}
                    onDragHandle={this.onDragHandleBottom}>
                </DraggableHandle>
                <DraggableHandle
                    className={`${CLASS_NAME}__right-handle`}
                    onBeginDragHandle={this.onStartDragging}
                    onDragHandle={this.onDragHandleRight}>
                </DraggableHandle>
                <DraggableHandle
                    className={`${CLASS_NAME}__bottom-right-handle`}
                    onBeginDragHandle={this.onStartDragging}
                    onDragHandle={this.onDragHandleBottomRight}>
                </DraggableHandle>
            </div>
        );
    }
}

assertWidgetComponent(Dialog);
