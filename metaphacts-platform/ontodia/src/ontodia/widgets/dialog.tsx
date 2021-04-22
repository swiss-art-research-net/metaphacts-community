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

import { WidgetAttachment, assertWidgetComponent } from '../diagram/view';
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

const ELEMENT_OFFSET = 40;
const LINK_OFFSET = 20;
const FOCUS_OFFSET = 20;

const CLASS_NAME = 'ontodia-dialog';

export interface DialogProps extends SizeBounds, PaperWidgetProps {
    target: Element | Link;
    caption?: string;
    offset?: Vector;
    /**
     * @default undefined
     */
    defaultSize?: Size;
    calculatePosition?: (renderingState: RenderingState) => Vector | undefined;
    onClose: () => void;
    children: React.ReactElement<any>;
}

interface SizeBounds {
    /**
     * @default 250
     */
    minWidth?: number;
    /**
     * @default 200
     */
    minHeight?: number;
    /**
     * Maximum dialog width.
     *
     * Default is 0.6*(viewport width).
     */
    maxWidth?: number;
    /**
     * Maximum dialog height.
     *
     * Default is 0.8*(viewport height).
     */
    maxHeight?: number;
}

interface State {
    computedSize?: Size;
    resizedSize?: Size;
}

type RequiredProps = DialogProps & Required<PaperWidgetProps>;

export class Dialog extends React.Component<DialogProps, State> {
    static readonly attachment = WidgetAttachment.OverElements;
    static readonly key = 'dialog';

    private unsubscribeFromTarget: Unsubscribe | undefined = undefined;
    private readonly handler = new EventObserver();

    private container: HTMLElement | null = null;
    private bounds: Required<SizeBounds>;
    private startSize: Vector | undefined;

    constructor(props: DialogProps) {
        super(props);
        const {paperArea} = this.props as RequiredProps;
        const {clientWidth, clientHeight} = paperArea.getAreaMetrics();
        this.bounds = {
            minWidth: this.props.minWidth ?? 250,
            minHeight: this.props.minHeight ?? 200,
            maxWidth: this.props.maxWidth ?? 0.6 * clientWidth,
            maxHeight: this.props.maxHeight ?? 0.8 * clientHeight,
        };
        this.state = {};
    }

    private updateAll = () => this.forceUpdate();

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
        this.handler.listen(renderingState.events, 'updateRoutings', e => {
            if (e.source.getRouting(link.id) !== e.previous.get(link.id)) {
                this.updateAll();
            }
        });
    }

    private calculatePositionForElement(element: Element, effectiveSize: Size): Vector {
        const {paperArea, renderingState} = this.props as RequiredProps;

        const bbox = boundsOf(element, renderingState);
        const {y: y0} = paperArea.paperToScrollablePaneCoords(bbox.x, bbox.y);
        const {x: x1, y: y1} = paperArea.paperToScrollablePaneCoords(
            bbox.x + bbox.width,
            bbox.y + bbox.height,
        );

        return {
            x: x1 + ELEMENT_OFFSET,
            y: (y0 + y1) / 2 - effectiveSize.height / 2,
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

    private calculatePosition(effectiveSize: Size): Vector {
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
            return this.calculatePositionForElement(target, effectiveSize);
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

    private getDialogScrollablePoints(effectiveSize: Size): {min: Vector; max: Vector} {
        const {x, y} = this.calculatePosition(effectiveSize);
        const min = {
            x: x - FOCUS_OFFSET,
            y: y - FOCUS_OFFSET,
        };
        const max = {
            x: min.x + effectiveSize.width + FOCUS_OFFSET * 2,
            y: min.y + effectiveSize.height + FOCUS_OFFSET * 2,
        };
        return {min, max};
    }

    private focusOn() {
        const {paperArea} = this.props as RequiredProps;
        const {min: viewPortMin, max: viewPortMax} = this.getViewPortScrollablePoints();
        const bbox = this.container!.getBoundingClientRect();
        const {min, max} = this.getDialogScrollablePoints({width: bbox.width, height: bbox.height});

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
        const newScrollableCenter = {
            x: curScrollableCenter.x + xOffset,
            y: curScrollableCenter.y + yOffset,
        };
        const paperCenter = paperArea.scrollablePaneToPaperCoords(
            newScrollableCenter.x, newScrollableCenter.y,
        );
        paperArea.centerTo(paperCenter);
    }

    private onStartDragging = (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        const {resizedSize} = this.state;
        const measuredSize = this.container?.getBoundingClientRect();
        const size = measuredSize ?? resizedSize ?? {width: 0, height: 0};
        this.startSize = {x: size.width, y: size.height};
    }

    private onDragHandle = (e: MouseEvent, dx: number, dy: number) => {
        const {x: startWidth, y: startHeight} = this.startSize!;
        const resizedSize = getBoundedSize(
            {width: startWidth + dx, height: startHeight + dy},
            this.bounds
        );
        this.setState({resizedSize});
    }

    render() {
        const {
            defaultSize, caption, view, paperArea, paperTransform, renderingState, children,
        } = this.props as RequiredProps;
        const {computedSize, resizedSize} = this.state;
        const {x, y} = this.calculatePosition(computedSize ?? defaultSize ?? {width: 0, height: 0});
        const effectiveSize = resizedSize ?? defaultSize;
        const boundedSize = effectiveSize ? getBoundedSize(effectiveSize, this.bounds) : undefined;
        const style: React.CSSProperties = {
            top: y,
            left: x,
            width: boundedSize ? boundedSize.width : 'auto',
            height: boundedSize ? boundedSize.height : 'auto',
            minWidth: this.bounds.minWidth,
            minHeight: this.bounds.minHeight,
            maxWidth: this.bounds.maxWidth,
            maxHeight: this.bounds.maxHeight,
        };
        let className = CLASS_NAME;
        if (resizedSize) {
            className += ` ${CLASS_NAME}--resized`;
        }
        const paperWidgetProps: Required<PaperWidgetProps> = {
            view,
            paperArea,
            paperTransform,
            renderingState
        };
        return (
            <div ref={this.onContainerMount} className={className} style={style}>
                <button className={`${CLASS_NAME}__close-button`} onClick={() => this.props.onClose()} />
                {caption ? <div className='ontodia-dialog__caption'>{caption}</div> : null}
                {React.cloneElement(children, paperWidgetProps)}
                <DraggableHandle
                    className={`${CLASS_NAME}__bottom-handle`}
                    onBeginDragHandle={this.onStartDragging}
                    onDragHandle={this.onDragHandle}>
                </DraggableHandle>
                <DraggableHandle
                    className={`${CLASS_NAME}__right-handle`}
                    onBeginDragHandle={this.onStartDragging}
                    onDragHandle={this.onDragHandle}>
                </DraggableHandle>
                <DraggableHandle
                    className={`${CLASS_NAME}__bottom-right-handle`}
                    onBeginDragHandle={this.onStartDragging}
                    onDragHandle={this.onDragHandle}>
                </DraggableHandle>
            </div>
        );
    }

    private onContainerMount = (container: HTMLElement | null) => {
        this.container = container;
        this.recomputeBounds();
    }

    private recomputeBounds() {
        if (this.container && !this.state.resizedSize) {
            const {width, height} = this.container.getBoundingClientRect();
            this.setState({computedSize: {width, height}});
        }
    }
}

function getBoundedSize(size: Size, props: Required<SizeBounds>): Size {
    let width = size.width;
    width = Math.min(width, props.maxWidth);
    width = Math.max(width, props.minWidth);

    let height = size.height;
    height = Math.min(height, props.maxHeight);
    height = Math.max(height, props.minHeight);

    return {width, height};
}

assertWidgetComponent(Dialog);
