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

import { Paper, PaperTransform } from './paper';
import { PaperAreaContextTypes, PaperAreaContextWrapper } from './paperArea';
import { Element, Cell } from './elements';
import { ElementContextWrapper, ElementContextTypes } from './elementLayer';
import { Rect, getContentFittingBox } from './geometry';
import { EventObserver } from '../viewUtils/events';

export interface State {
    paperWidth: number;
    paperHeight: number;
    offsetX: number;
    offsetY: number;
}

export class EmbeddedLayer extends React.Component<{}, State> {
    static contextTypes = {...ElementContextTypes, ...PaperAreaContextTypes};

    declare readonly context: ElementContextWrapper & PaperAreaContextWrapper;

    private readonly listener = new EventObserver();
    private nestedElementListener = new EventObserver();

    private layerOffsetLeft = 0;
    private layerOffsetTop = 0;

    private isApplyingParentMove = false;
    private isNestedElementMoving = false;

    constructor(props: {}) {
        super(props);
        this.state = {paperWidth: 0, paperHeight: 0, offsetX: 0, offsetY: 0};
    }

    componentDidMount() {
        const {element} = this.context.ontodiaElement;
        const {paperArea, view} = this.context.ontodiaPaperArea;

        this.listener.listen(view.model.events, 'changeGroupContent', ({group}) => {
            if (group === element.id) {
                this.listenNestedElements(this.getNestedElements());
                const {offsetX, offsetY} = this.getOffset();
                this.moveNestedElements(offsetX, offsetY);
            }
        });

        this.listener.listen(element.events, 'changePosition', () => {
            if (this.isNestedElementMoving) { return; }

            const {offsetX, offsetY} = this.getOffset();
            const {x, y} = this.getContentFittingBox();

            const diffX = offsetX - x;
            const diffY = offsetY - y;
            this.moveNestedElements(diffX, diffY);

            this.setState({offsetX, offsetY});
        });

        this.listener.listen(paperArea.events, 'pointerUp', e => {
            this.isNestedElementMoving = false;
        });

        const nestedElements = this.getNestedElements();
        this.listenNestedElements(nestedElements);

        if (nestedElements.length > 0) {
            const {
                x: offsetX,
                y: offsetY,
                width: paperWidth,
                height: paperHeight,
            } = this.getContentFittingBox();
            this.setState({offsetX, offsetY, paperWidth, paperHeight}, () => element.redraw());
        } else {
            element.requestGroupContent();
        }
    }

    private listenNestedElements(nestedElements: ReadonlyArray<Element>) {
        const {renderingState} = this.context.ontodiaPaperArea;
        const listener = new EventObserver();
        const nestedSet = new Set<Element>();
        for (const nestedElement of nestedElements) {
            listener.listen(nestedElement.events, 'changePosition', this.recomputeSelfBounds);
            nestedSet.add(nestedElement);
        }
        listener.listen(renderingState.events, 'changeElementSize', e => {
            if (nestedSet.has(e.source)) {
                this.recomputeSelfBounds();
            }
        });
        this.nestedElementListener.stopListening();
        this.nestedElementListener = listener;
    }

    componentWillUnmount() {
        this.listener.stopListening();
        this.nestedElementListener.stopListening();
        this.removeElements();
        this.setState({paperWidth: 0, paperHeight: 0, offsetX: 0, offsetY: 0});
    }

    private getNestedElements() {
        const {element} = this.context.ontodiaElement;
        const {view} = this.context.ontodiaPaperArea;
        return view.model.elements.filter(el => el.group === element.id);
    }

    private getContentFittingBox(): Rect {
        const {renderingState} = this.context.ontodiaPaperArea;
        const nestedElements = this.getNestedElements();
        return getContentFittingBox(nestedElements, [], renderingState);
    }

    private removeElements() {
        const {view} = this.context.ontodiaPaperArea;
        const batch = view.model.history.startBatch();
        for (const element of this.getNestedElements()) {
            view.model.removeElement(element.id);
        }
        batch.discard();
    }

    private getOffset(): { offsetX: number; offsetY: number } {
        const {element} = this.context.ontodiaElement;
        const {x: elementX, y: elementY} = element.position;

        const offsetX = elementX + this.layerOffsetLeft;
        const offsetY = elementY + this.layerOffsetTop;

        return {offsetX, offsetY};
    }

    private moveNestedElements = (offsetX: number, offsetY: number) => {
        this.isApplyingParentMove = true;
        try {
            for (const element of this.getNestedElements()) {
                const {x, y} = element.position;
                const newPosition = {x: x + offsetX, y: y + offsetY};
                element.setPosition(newPosition);
            }
        } finally {
            this.isApplyingParentMove = false;
            this.recomputeSelfBounds();
        }
    }

    private recomputeSelfBounds = () => {
        if (this.isApplyingParentMove) { return; }

        const {element} = this.context.ontodiaElement;
        const {x: offsetX, y: offsetY, width: paperWidth, height: paperHeight} = this.getContentFittingBox();

        if (this.isNestedElementMoving) {
            const position = {
                x: offsetX - this.layerOffsetLeft,
                y: offsetY - this.layerOffsetTop,
            };
            element.setPosition(position);
        }

        this.setState({offsetX, offsetY, paperWidth, paperHeight}, () => element.redraw());
    }

    private onPaperPointerDown = (e: React.MouseEvent<HTMLElement>, cell: Cell | undefined) => {
        if (e.button !== 0 /* left mouse button */) {
            return;
        }

        if (cell && cell instanceof Element) {
            e.preventDefault();
            this.isNestedElementMoving = true;
        }
    }

    private calculateOffset(layer: HTMLElement): { left: number; top: number } {
        const {paperArea} = this.context.ontodiaPaperArea;
        const scale = paperArea.getScale();
        const parent = findParentElement(layer);
        const {left, top} = layer.getBoundingClientRect();
        const {left: parentLeft, top: parentTop} = parent.getBoundingClientRect();

        return {left: (left - parentLeft) / scale, top: (top - parentTop) / scale};
    }

    private onLayerInit = (layer: HTMLElement | null) => {
        if (!layer) { return; }

        const {left, top} = this.calculateOffset(layer);

        this.layerOffsetLeft = left;
        this.layerOffsetTop = top;
    }

    render() {
        const {element} = this.context.ontodiaElement;
        const {view, renderingState} = this.context.ontodiaPaperArea;
        const {paperWidth, paperHeight, offsetX, offsetY} = this.state;

        const paperTransform: PaperTransform = {
            width: paperWidth,
            height: paperHeight,
            originX: -offsetX,
            originY: -offsetY,
            scale: 1,
            paddingX: 0,
            paddingY: 0,
        };

        return (
            <div className='ontodia-embedded-layer' ref={this.onLayerInit}>
                <Paper view={view}
                    renderingState={renderingState}
                    paperTransform={paperTransform}
                    onPointerDown={this.onPaperPointerDown}
                    group={element.id}>
                </Paper>
            </div>
        );
    }
}

function findParentElement(layer: HTMLElement): HTMLElement {
    const parent = layer.parentElement;
    if (!parent) {
        throw new Error('Cannot find parent diagram element for EmbeddedLayer');
    } else if (parent.hasAttribute('data-element-id')) {
        return parent;
    } else {
        return findParentElement(parent);
    }
}
