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

export enum DockSide {
    Left = 1,
    Right,
}

export interface AccordionItemProps extends ProvidedProps {
    heading?: React.ReactNode;
    bodyClassName?: string;
    bodyRef?: (body: HTMLDivElement) => void;
    children?: React.ReactNode;
    defaultSize?: number;
    defaultCollapsed?: boolean;
    collapsedSize?: number;
    minSize?: number;
}

/** Props provided by Accordion. */
interface ProvidedProps {
    collapsed?: boolean;
    size?: number | string;
    direction?: 'vertical' | 'horizontal';
    dockSide?: DockSide;
    onChangeCollapsed?: (collapsed: boolean) => void;
    onBeginDragHandle?: () => void;
    onDragHandle?: (dx: number, dy: number) => void;
    onEndDragHandle?: () => void;
}

const CLASS_NAME = 'ontodia-accordion-item';

interface State {
    resizing?: boolean;
}

type RequiredProps = AccordionItemProps & Required<ProvidedProps> & DefaultProps;
type DefaultProps = Required<Pick<AccordionItemProps, 'direction'>>;

export class AccordionItem extends React.Component<AccordionItemProps, State> {
    static defaultProps: DefaultProps = {
        direction: 'vertical',
    };

    private _element: HTMLDivElement | undefined | null;
    private _header: HTMLDivElement | undefined | null;

    constructor(props: AccordionItemProps) {
        super(props);
        this.state = {
            resizing: false,
        };
    }

    get element() { return this._element!; }
    get header() { return this._header!; }

    private get isVertical() {
        return this.props.direction === 'vertical';
    }

    private renderToggleButton() {
        const {collapsed, dockSide, onChangeCollapsed} = this.props as RequiredProps;
        if (!dockSide) {
            return null;
        }
        const side = dockSide === DockSide.Left ? 'left' : 'right';
        return <div className={`${CLASS_NAME}__handle-btn ${CLASS_NAME}__handle-btn-${side}`}
            onClick={() => onChangeCollapsed(!collapsed)} />;
    }

    render() {
        const {
            heading, bodyClassName, children, bodyRef,
            collapsed, size, direction, dockSide,
            onChangeCollapsed, onBeginDragHandle, onDragHandle, onEndDragHandle,
        } = this.props as RequiredProps;
        const {resizing} = this.state;
        const shouldRenderHandle = Boolean(onBeginDragHandle && onDragHandle && onEndDragHandle);
        const style: React.CSSProperties = this.isVertical ? {height: size} : {width: size};

        // unmount child component when the accordion item is collapsed and has dockSide
        const isMounted = !(collapsed && dockSide);

        return <div className={
                `${CLASS_NAME} ${CLASS_NAME}--${collapsed ? 'collapsed' : 'expanded'} ${CLASS_NAME}--${direction}
                ${resizing ? `${CLASS_NAME}--resizing` : ''}`
            }
            ref={element => this._element = element}
            style={style}>
            <div className={`${CLASS_NAME}__inner`}>
                {heading ? <div className={`${CLASS_NAME}__header`}
                    ref={header => this._header = header}
                    onClick={() => onChangeCollapsed(!collapsed)}>{heading}</div> : null}
                <div className={`${CLASS_NAME}__body`}>
                    {children && isMounted ? children :
                        <div ref={bodyRef} className={`${bodyClassName || ''}`} />}
                </div>
            </div>
            {shouldRenderHandle ? (
                <DraggableHandle className={`${CLASS_NAME}__handle ${CLASS_NAME}__handle-${direction}`}
                    onBeginDragHandle={e => {
                        e.preventDefault();
                        this.setState({resizing: true});
                        onBeginDragHandle();
                    }}
                    onDragHandle={(e, x, y) => onDragHandle(x, y)}
                    onEndDragHandle={e => {
                        this.setState({resizing: false});
                        onEndDragHandle();
                    }}/>
            ) : null}
            {this.renderToggleButton()}
        </div>;
    }
}
