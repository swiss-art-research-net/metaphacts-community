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

import { Accordion } from '../accordion';
import { AccordionItem, AccordionItemProps, DockSide } from '../accordionItem';

import {
    WorkspaceLayoutNodeProps, WorkspaceContainerProps, WorkspaceItemProps, WorkspaceRow, WorkspaceColumn,
    WorkspaceItem,
} from './layoutNode';

const DEFAULT_HORIZONTAL_COLLAPSED_SIZE = 28;

export interface WorkspaceLayoutProps {
    horizontalCollapsedSize?: number;
    verticalCollapsedSize?: number;
    children: React.ReactElement<WorkspaceLayoutNodeProps>;
    _onResize?: (direction: 'vertical' | 'horizontal') => void;
}

export class WorkspaceLayout extends React.Component<WorkspaceLayoutProps, {}> {
    static defaultProps: Pick<WorkspaceLayoutProps, 'horizontalCollapsedSize'> = {
        horizontalCollapsedSize: DEFAULT_HORIZONTAL_COLLAPSED_SIZE,
    };

    private resizingClassName: string | undefined;

    componentDidMount() {
        document.addEventListener('mouseup', this.onMouseUp);
    }

    componentWillUnmount(): void {
        document.removeEventListener('mouseup', this.onMouseUp);
    }

    private onMouseUp = () => {
        if (this.resizingClassName) {
            document.body.classList.remove(this.resizingClassName);
        }
    }

    private renderAccordion({children, direction, animationDuration}: {
        children: React.ReactElement<WorkspaceLayoutNodeProps> |
            ReadonlyArray<React.ReactElement<WorkspaceLayoutNodeProps>>;
        direction: 'horizontal' | 'vertical';
        animationDuration?: number;
    }) {
        const {horizontalCollapsedSize, verticalCollapsedSize, _onResize} = this.props;
        const items = React.Children.map(children, (child, index) => {
            if (typeof child !== 'object') { return undefined; }
            let dockSide: DockSide | undefined;
            if (direction === 'horizontal' && !child.props.undocked) {
                if (index === 0) {
                    dockSide = DockSide.Left;
                } else if (index === React.Children.count(children) - 1) {
                    dockSide = DockSide.Right;
                }
            }
            let collapsedSize = child.props.collapsedSize;
            if (collapsedSize === undefined) {
                collapsedSize = direction === 'horizontal'
                    ? horizontalCollapsedSize
                    : verticalCollapsedSize;
            }
            return (
                <AccordionItem key={child.type === WorkspaceItem ? child.props.id : index}
                    heading={child.type === WorkspaceItem ? child.props.heading : undefined}
                    dockSide={dockSide}
                    defaultSize={child.props.defaultSize}
                    defaultCollapsed={child.props.defaultCollapsed}
                    collapsedSize={collapsedSize}
                    minSize={child.props.minSize}>
                    {this.renderLayout(child)}
                </AccordionItem>
            );
        }).filter((item): item is React.ReactElement<AccordionItemProps> => Boolean(item));
        return (
            <Accordion direction={direction}
                onStartResize={resizeDirection => {
                    this.resizingClassName = `ontodia-${resizeDirection}-resizing`;
                    document.body.classList.add(this.resizingClassName);
                }}
                onResize={_onResize}
                animationDuration={animationDuration}>
                {items}
            </Accordion>
        );
    }

    private renderLayout(layout: React.ReactElement<WorkspaceLayoutNodeProps>) {
        if (layout.type === WorkspaceRow) {
            return this.renderAccordion({
                children: layout.props.children,
                direction: 'horizontal',
                animationDuration: (layout.props as WorkspaceContainerProps).animationDuration,
            });
        }
        if (layout.type === WorkspaceColumn) {
            return this.renderAccordion({
                children: layout.props.children,
                direction: 'vertical',
                animationDuration: (layout.props as WorkspaceContainerProps).animationDuration,
            });
        }
        if (layout.type === WorkspaceItem) {
            return (layout.props as WorkspaceItemProps).children;
        }
        return null;
    }

    render() {
        const {children} = this.props;
        return this.renderLayout(children);
    }
}
