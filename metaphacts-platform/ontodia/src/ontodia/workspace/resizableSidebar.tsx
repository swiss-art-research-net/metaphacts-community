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

import { DraggableHandle } from './draggableHandle';

export interface ResizableSidebarProps {
    className?: string;
    dockSide?: DockSide;
    defaultLength?: number;
    minLength?: number;
    maxLength?: number;
    isOpen?: boolean;
    onOpenOrClose?: (open: boolean) => void;
    onStartResize: () => void;
    children?: React.ReactNode;
}

export enum DockSide {
    Left = 1,
    Right,
    Top,
    Bottom,
}

export interface State {
    readonly open: boolean;
    readonly length: number;
}

const CLASS_NAME = 'ontodia-drag-resizable-column';

type RequiredProps = ResizableSidebarProps & DefaultProps;
type DefaultProps = Required<Pick<ResizableSidebarProps,
    'dockSide' | 'minLength' | 'maxLength' | 'defaultLength' | 'isOpen'
>>;

export class ResizableSidebar extends React.Component<ResizableSidebarProps, State> {
    static readonly defaultProps: DefaultProps = {
        dockSide: DockSide.Left,
        minLength: 0,
        maxLength: 500,
        defaultLength: 275,
        isOpen: true,
    };

    private originWidth!: number;

    constructor(props: ResizableSidebarProps) {
        super(props);
        const {isOpen} = this.props as RequiredProps;
        this.state = {
            open: isOpen,
            length: this.defaultWidth(),
        };
    }

    componentWillReceiveProps(nextProps: ResizableSidebarProps) {
        if (this.state.open !== nextProps.isOpen) {
            this.toggle({open: (nextProps as RequiredProps).isOpen});
        }
    }

    private defaultWidth() {
        const {defaultLength, maxLength} = this.props as RequiredProps;
        return Math.min(defaultLength, maxLength);
    }

    private getSideClass() {
        switch (this.props.dockSide) {
            case DockSide.Left: return `${CLASS_NAME}--docked-left`;
            case DockSide.Right: return `${CLASS_NAME}--docked-right`;
            case DockSide.Top: return `${CLASS_NAME}--docked-top`;
            case DockSide.Bottom: return `${CLASS_NAME}--docked-bottom`;
            default: return 'docked-right';
        }
    }

    private get isHorizontal(): boolean {
        return this.props.dockSide === DockSide.Top ||
        this.props.dockSide === DockSide.Bottom;
    }

    render() {
        const {open, length} = this.state;

        const className = `${CLASS_NAME} ` +
            `${this.getSideClass()} ` +
            `${CLASS_NAME}--${open ? 'opened' : 'closed'} ` +
            `${this.props.className || ''}`;

        const style: any = {};
        style[this.isHorizontal ? 'height' : 'width'] = open ? length : 0;
        return <div className={className}
            style={style}>
            {open ? this.props.children : null}
            <DraggableHandle className={`${CLASS_NAME}__handle`}
                onBeginDragHandle={this.onBeginDragHandle}
                onDragHandle={this.onDragHandle}>
                <div className={`${CLASS_NAME}__handle-btn`}
                    onClick={() => this.toggle({open: !this.state.open})}>
                </div>
            </DraggableHandle>
        </div>;
    }

    private onBeginDragHandle = () => {
        this.originWidth = this.state.open ? this.state.length : 0;
        this.props.onStartResize();
    }

    private onDragHandle = (e: MouseEvent, dx: number, dy: number) => {
        const {dockSide, minLength, maxLength} = this.props as RequiredProps;
        let difference = this.isHorizontal ? dy : dx;
        if (dockSide === DockSide.Right) {
            difference = -difference;
        }
        const newWidth = this.originWidth + difference;
        const clampedWidth = Math.max(Math.min(newWidth, maxLength), minLength);
        const isOpen = minLength > 0 || clampedWidth > minLength;
        this.toggle({open: isOpen, newWidth: clampedWidth});
    }

    private toggle(params: {
        open: boolean;
        newWidth?: number;
    }) {
        const {open, newWidth} = params;
        const openChanged = open !== this.state.open;
        const onStateChanged = () => {
            if (openChanged && this.props.onOpenOrClose) {
                this.props.onOpenOrClose(open);
            }
        };

        const useDefaultWidth = open && this.state.length === 0 && newWidth === undefined;
        if (useDefaultWidth) {
            this.setState({open, length: this.defaultWidth()}, onStateChanged);
        } else if (newWidth === undefined) {
            this.setState({open}, onStateChanged);
        } else {
            this.setState({open, length: newWidth}, onStateChanged);
        }
    }
}
