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

import { ElementModel, ElementIri } from '../data/model';
import { DiagramView } from '../diagram/view';
import { cloneSet } from '../viewUtils/collections';
import { ListElementView, startDragElements } from './listElementView';

import * as styles from './searchResults.scss';

export interface SearchResultProps {
    view: DiagramView;
    items: ReadonlyArray<SearchResultsItem>;
    selection: ReadonlySet<ElementIri>;
    onSelectionChanged: (newSelection: ReadonlySet<ElementIri>) => void;
    highlightText?: string;
    /** @default true */
    useDragAndDrop?: boolean;
    renderItemContent?: (item: SearchResultsItem) => React.ReactNode;
}

export interface SearchResultsItem {
    readonly model: ElementModel;
}

const enum Direction { Up, Down }

export class SearchResults extends React.Component<SearchResultProps, {}> {
    static defaultProps: Pick<SearchResultProps, 'useDragAndDrop'> = {
        useDragAndDrop: true,
    };

    private root: HTMLElement | undefined | null;

    private startSelection = 0;
    private endSelection = 0;

    constructor(props: SearchResultProps) {
        super(props);
        this.state = {
            selection: props.selection || {},
        };
    }

    render(): React.ReactElement<any> {
        return <ul className={styles.component}
            ref={this.onRootMount}
            tabIndex={-1}
            onFocus={this.addKeyListener}
            onBlur={this.removeKeyListener}>
            {this.props.items.map(this.renderResultItem)}
        </ul>;
    }

    private onRootMount = (root: HTMLElement | null) => {
        this.root = root;
    }

    private renderResultItem = (item: SearchResultsItem) => {
        const {useDragAndDrop, renderItemContent} = this.props;
        const canBeSelected = this.canBeSelected(item);
        const {model} = item;
        return (
            <ListElementView
                key={model.id}
                model={model}
                view={this.props.view}
                highlightText={this.props.highlightText}
                disabled={!canBeSelected}
                selected={this.props.selection.has(model.id)}
                onClick={canBeSelected ? this.onItemClick : undefined}
                onDragStart={useDragAndDrop ? e => {
                    const {selection} = this.props;
                    const iris: ElementIri[] = [];
                    selection.forEach(iri => iris.push(iri));
                    if (!selection.has(model.id)) {
                        iris.push(model.id);
                    }
                    return startDragElements(e, iris);
                } : undefined}>
                {renderItemContent ? renderItemContent(item) : null}
            </ListElementView>
        );
    }

    componentWillReceiveProps(props: SearchResultProps) {
        this.setState({selection: props.selection || {}});
    }

    componentWillUnmount() {
        this.removeKeyListener();
    }

    private updateSelection(selection: ReadonlySet<ElementIri>) {
        const {onSelectionChanged} = this.props;
        onSelectionChanged(selection);
    }

    private addKeyListener = () => {
        document.addEventListener('keydown', this.onKeyUp);
    }

    private removeKeyListener = () => {
        document.removeEventListener('keydown', this.onKeyUp);
    }

    private onKeyUp = (event: KeyboardEvent) => {
        const {items} = this.props;
        const isPressedUp = event.keyCode === 38 || event.which === 38;
        const isPressDown = event.keyCode === 40 || event.which === 40;

        if (isPressedUp || isPressDown) {
            if (event.shiftKey) { // select range
                if (isPressedUp) {
                    this.endSelection = this.getNextIndex(this.endSelection, Direction.Up);
                } else if (isPressDown) {
                    this.endSelection = this.getNextIndex(this.endSelection, Direction.Down);
                }
                const startIndex = Math.min(this.startSelection, this.endSelection);
                const finishIndex = Math.max(this.startSelection, this.endSelection);
                const selection = this.selectRange(startIndex, finishIndex);

                this.updateSelection(selection);
                this.focusOn(this.endSelection);
            } else { // change focus
                const startIndex = Math.min(this.startSelection, this.endSelection);
                const finishIndex = Math.max(this.startSelection, this.endSelection);

                if (isPressedUp) {
                    this.startSelection = this.getNextIndex(startIndex, Direction.Up);
                } else if (isPressDown) {
                    this.startSelection = this.getNextIndex(finishIndex, Direction.Down);
                }
                this.endSelection = this.startSelection;

                const focusItem = items[this.startSelection];
                const newSelection = new Set<ElementIri>();
                newSelection.add(focusItem.model.id);

                this.updateSelection(newSelection);
                this.focusOn(this.startSelection);
            }
        }
        event.preventDefault();
    }

    private onItemClick = (event: React.MouseEvent<any>, model: ElementModel) => {
        event.preventDefault();

        const {items, selection, onSelectionChanged} = this.props;
        const modelIndex = items.findIndex(item => item.model === model);

        let newSelection: Set<ElementIri>;

        if (event.shiftKey && this.startSelection !== -1) { // select range
            const start = Math.min(this.startSelection, modelIndex);
            const end = Math.max(this.startSelection, modelIndex);
            newSelection = this.selectRange(start, end);
        } else {
            this.endSelection = this.startSelection = modelIndex;
            const ctrlKey = event.ctrlKey || event.metaKey;

            if (ctrlKey) { // select/deselect
                newSelection = cloneSet(selection);
                if (selection.has(model.id)) {
                    newSelection.delete(model.id);
                } else {
                    newSelection.add(model.id);
                }
            } else { // single click
                newSelection = new Set<ElementIri>();
                newSelection.add(model.id);
            }
        }

        onSelectionChanged(newSelection);
    }

    private selectRange(start: number, end: number): Set<ElementIri> {
        const {items} = this.props;
        const selection = new Set<ElementIri>();
        for (let i = start; i <= end; i++) {
            const selectedItem = items[i];
            if (this.canBeSelected(selectedItem)) {
                selection.add(selectedItem.model.id);
            }
        }
        return selection;
    }

    private getNextIndex(startIndex: number, direction: Direction) {
        const {items} = this.props;
        if (items.length === 0) {
            return startIndex;
        }
        const indexDelta = direction === Direction.Up ? -1 : 1;
        for (let step = 1; step < items.length; step++) {
            let nextIndex = startIndex + step * indexDelta;
            if (nextIndex < 0) { nextIndex += items.length; }
            if (nextIndex >= items.length) { nextIndex -= items.length; }
            if (this.canBeSelected(items[nextIndex])) {
                return nextIndex;
            }
        }
        return startIndex;
    }

    private canBeSelected(item: SearchResultsItem) {
        const alreadyOnDiagram = this.props.view.model.elements.findIndex(
            element => element.iri === item.model.id && element.group === undefined
        ) >= 0;
        return !this.props.useDragAndDrop || !alreadyOnDiagram;
    }

    private focusOn(index: number) {
        const scrollableContainer = this.root!.parentElement!;

        const containerBounds = scrollableContainer.getBoundingClientRect();

        const item = this.root!.children.item(index) as HTMLElement;
        const itemBounds = item.getBoundingClientRect();
        const itemTop = itemBounds.top - containerBounds.top;
        const itemBottom = itemBounds.bottom - containerBounds.top;

        if (itemTop < 0) {
            scrollableContainer.scrollTop += itemTop;
        } else if (itemBottom > containerBounds.height) {
            scrollableContainer.scrollTop += (itemBottom - containerBounds.height);
        }

        item.focus();
    }
}
