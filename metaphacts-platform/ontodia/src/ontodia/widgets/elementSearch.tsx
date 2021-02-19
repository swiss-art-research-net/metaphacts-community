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

import { ElementIri } from '../data/model';
import { Element, Link } from '../diagram/elements';
import { Highlighter } from '../diagram/view';
import { Debouncer } from '../viewUtils/async';
import { EventTrigger, EventObserver } from '../viewUtils/events';
import { CanvasCommands } from '../workspace/canvas';
import { WorkspaceContextWrapper, WorkspaceContextTypes } from '../workspace/workspaceContext';
import { SearchResults } from './searchResults';

import * as styles from './elementSearch.scss';

export interface ElementSearchProps {
    canvasCommands: EventTrigger<CanvasCommands>;
}

interface State {
    items: ReadonlyArray<Item>;
    searchString: string;
}

interface Item {
    element: Element;
    label: string;
}

export class ElementSearch extends React.Component<ElementSearchProps, State> {
    static contextTypes = WorkspaceContextTypes;
    declare readonly context: WorkspaceContextWrapper;

    private readonly listener = new EventObserver();
    private readonly delayedUpdate = new Debouncer();
    private readonly delayedSync = new Debouncer();

    constructor(props: ElementSearchProps) {
        super(props);
        this.state = {searchString: '', items: []};
    }

    componentDidMount() {
        const {view, editor} = this.context.ontodiaWorkspace;
        this.listener.listen(view.events, 'changeLanguage', this.syncItems);
        this.listener.listen(view.model.events, 'elementEvent', ({data}) => {
            if (data.changeData) {
                this.delayedSync.call(this.syncItems);
            }
        });
        this.listener.listen(view.model.events, 'changeCells', this.syncItems);
        this.listener.listen(editor.events, 'changeSelection', this.scheduleUpdate);
        this.syncItems();
    }

    private scheduleUpdate = () => {
        this.delayedUpdate.call(this.performUpdate);
    }

    private performUpdate = () => {
        this.forceUpdate();
    }

    componentDidUpdate(prevProps: {}, prevState: State) {
        const {searchString, items} = this.state;
        if (searchString !== prevState.searchString || items !== prevState.items) {
            let filteredItems: Array<Element> | undefined;
            if (searchString.length > 0) {
                filteredItems = filterBySearchTerm(this.state.items, searchString).map(({element}) => element);
            }
            this.onSearch(filteredItems);
        }
    }

    componentWillUnmount() {
        this.listener.stopListening();
        this.delayedUpdate.dispose();
        this.delayedSync.dispose();
    }

    private onSearch(elements: ReadonlyArray<Element> | undefined) {
        const {view} = this.context.ontodiaWorkspace;
        let highlighter: Highlighter;
        if (elements) {
            const highlightedElements = new Set<string>();
            elements.forEach(({iri}) => highlightedElements.add(iri));
            highlighter = item => {
                if (item instanceof Element) {
                    return highlightedElements.has(item.iri);
                }
                if (item instanceof Link) {
                    const {sourceId, targetId} = item.data;
                    return highlightedElements.has(sourceId) || highlightedElements.has(targetId);
                }
                throw Error('Unknown item type');
            };
        }
        view.setHighlighter(highlighter);
    }

    private syncItems = () => {
        const {view} = this.context.ontodiaWorkspace;
        const items: Array<Item> = [];
        view.model.elements.forEach(element => {
            if (!element.temporary) {
                const model = element.data;
                const label = view.formatLabel(model.label.values, model.id);
                items.push({element, label});
            }
        });
        items.sort(compareByLabel);
        this.setState({items});
    }

    private onChangeSearchString = (e: React.FormEvent<HTMLInputElement>) => {
        const searchString = (e.target as HTMLInputElement).value;
        this.setState({searchString});
    }

    private onChangeSelection = (newSelection: ReadonlySet<ElementIri>) => {
        const {editor} = this.context.ontodiaWorkspace;
        const {items} = this.state;
        const selectedItems = items
            .filter(item => newSelection.has(item.element.iri))
            .map(item => item.element);
        editor.setSelection(selectedItems);
        // cast event data to any for supporting canvas animation and not introducing the sub-class.
        this.props.canvasCommands.trigger('zoomToContent', {
            elements: selectedItems,
            links: [],
            options: {animate: true},
        } as any);
    }

    render() {
        const {view, editor} = this.context.ontodiaWorkspace;
        const {items, searchString} = this.state;

        const selectedElements = new Set<ElementIri>();
        for (const selected of editor.selection) {
            if (selected instanceof Element) {
                selectedElements.add(selected.iri);
            }
        }

        const filteredItems = filterBySearchTerm(items, searchString);
        return (
            <div className={styles.component}>
                <div className={styles.header}>
                    <input className='ontodia-form-control'
                        placeholder='Type to highlight...'
                        value={searchString}
                        onChange={this.onChangeSearchString} />
                    {
                        searchString.length > 0 ? (
                            <button type='button' className={styles.clearButton}
                                    onClick={() => this.setState({searchString: ''})}>
                                <i className='fa fa-times' />
                            </button>
                        ) : null
                    }
                </div>
                <ul className={`${styles.body} ontodia-scrollable`}>
                    <SearchResults
                        view={view}
                        items={filteredItems.map(item => ({model: item.element.data}))}
                        highlightText={searchString}
                        selection={selectedElements}
                        onSelectionChanged={this.onChangeSelection}
                        useDragAndDrop={false}
                    />
                </ul>
            </div>
        );
    }
}

function compareByLabel(left: Item, right: Item): number {
    return left.label.localeCompare(right.label);
}

function filterBySearchTerm(items: ReadonlyArray<Item>, term: string) {
    if (!term) { return items; }
    const lowerCaseTerm = term.toLowerCase();
    return items.filter(item => item.label.toLowerCase().indexOf(lowerCaseTerm) >= 0);
}
