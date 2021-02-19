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

export interface Props extends React.HTMLAttributes<HTMLDivElement> {
    onBeginDragHandle: (e: React.MouseEvent<HTMLDivElement>) => void;
    onDragHandle: (e: MouseEvent, dx: number, dy: number) => void;
    onEndDragHandle?: (e: MouseEvent) => void;
}

export class DraggableHandle extends React.Component<Props, {}> {
    private isHoldingMouse = false;
    private originPageX!: number;
    private originPageY!: number;

    render() {
        // remove custom handlers from `div` props
        // tslint:disable-next-line:no-unused-variable
        const {onBeginDragHandle, onDragHandle, onEndDragHandle, ...props} = this.props;
        return <div {...props} onMouseDown={this.onHandleMouseDown}>
            {this.props.children}
        </div>;
    }

    componentWillUnmount() {
        this.removeListeners();
    }

    private onHandleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target !== e.currentTarget) { return; }
        if (this.isHoldingMouse) { return; }

        const LEFT_BUTTON = 0;
        if (e.button !== LEFT_BUTTON) { return; }

        this.isHoldingMouse = true;
        this.originPageX = e.pageX;
        this.originPageY = e.pageY;
        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('mouseup', this.onMouseUp);
        this.props.onBeginDragHandle(e);
    }

    private onMouseMove = (e: MouseEvent) => {
        if (!this.isHoldingMouse) { return; }
        e.preventDefault();
        this.props.onDragHandle(e, e.pageX - this.originPageX, e.pageY - this.originPageY);
    }

    private onMouseUp = (e: MouseEvent) => {
        this.removeListeners();
        if (this.props.onEndDragHandle) {
            this.props.onEndDragHandle(e);
        }
    }

    private removeListeners() {
        if (this.isHoldingMouse) {
            this.isHoldingMouse = false;
            document.removeEventListener('mousemove', this.onMouseMove);
            document.removeEventListener('mouseup', this.onMouseUp);
        }
    }
}
