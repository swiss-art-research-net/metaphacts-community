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

import { ElementTypeIri, ClassModel } from '../../data/model';
import { DataProvider } from '../../data/provider';
import { RichClass } from '../../diagram/elements';
import { Vector } from '../../diagram/geometry';
import { DiagramView, DropOnPaperEvent } from '../../diagram/view';
import { Cancellation, CancellationToken, Debouncer } from '../../viewUtils/async';
import { cloneMap } from '../../viewUtils/collections';
import { EventTrigger, EventObserver } from '../../viewUtils/events';
import { HtmlSpinner } from '../../viewUtils/spinner';
import { ProgressBar, ProgressState } from '../../widgets/progressBar';
import { InstancesSearchCommands } from '../../widgets/instancesSearch';

import { WorkspaceContextTypes, WorkspaceContextWrapper } from '../../workspace/workspaceContext';
import { CanvasCommands } from '../../workspace/canvas';

import { TreeNode } from './treeModel';
import { Forest } from './leaf';

export interface ClassTreeProps {
    canvasCommands: EventTrigger<CanvasCommands>;
    instancesSearchCommands: EventTrigger<InstancesSearchCommands>;
}

export interface State {
    refreshingState: ProgressState;
    roots: ReadonlyArray<TreeNode>;
    filteredRoots: ReadonlyArray<TreeNode>;
    requestedSearchText: string;
    appliedSearchText: string | undefined;
    selectedNode?: TreeNode;
    constructibleClasses: ReadonlyMap<ElementTypeIri, boolean>;
    showOnlyConstructible: boolean;
}

const CLASS_NAME = 'ontodia-class-tree';
const MIN_TERM_LENGTH = 3;

export class ClassTree extends React.Component<ClassTreeProps, State> {
    static contextTypes = WorkspaceContextTypes;
    declare readonly context: WorkspaceContextWrapper;

    private readonly listener = new EventObserver();
    private readonly delayedClassUpdate = new Debouncer();
    private readonly delayedSearch = new Debouncer(200 /* ms */);
    private classTree: ReadonlyArray<ClassModel> | undefined;
    private dataProvider: DataProvider | undefined;

    private cancellation = new Cancellation();
    private loadClassesOperation = new Cancellation();
    private refreshOperation = new Cancellation();

    private dropHandler: ((e: DropOnPaperEvent) => void) | undefined;

    constructor(props: ClassTreeProps) {
        super(props);
        this.state = {
            refreshingState: ProgressState.none,
            roots: [],
            filteredRoots: [],
            requestedSearchText: '',
            appliedSearchText: '',
            constructibleClasses: new Map(),
            showOnlyConstructible: false,
        };
    }

    render() {
        const {view, editor} = this.context.ontodiaWorkspace;
        const {
            refreshingState, requestedSearchText, appliedSearchText, filteredRoots, selectedNode, constructibleClasses,
            showOnlyConstructible
        } = this.state;
        const normalizedSearchText = normalizeSearchText(requestedSearchText);
        // highlight search term only if actual tree is already filtered by current or previous term:
        //  - this immediately highlights typed characters thus making it look more responsive,
        //  - prevents expanding non-filtered tree (which can be too large) just to highlight the term
        const searchText = appliedSearchText ? normalizedSearchText : undefined;

        return (
            <div className={CLASS_NAME}>
                <div className={`${CLASS_NAME}__filter`}>
                    <div className={`${CLASS_NAME}__filter-group`}>
                        <input type='text'
                            className='search-input ontodia-form-control'
                            placeholder='Search for...'
                            value={this.state.requestedSearchText}
                            onChange={this.onSearchTextChange}
                        />
                        {editor.inAuthoringMode ? (
                            <label className={`${CLASS_NAME}__only-creatable`}>
                                <input type='checkbox'
                                    checked={showOnlyConstructible}
                                    onChange={this.onShowOnlyCreatableChange}
                                /> Show only constructible
                            </label>
                        ) : null}
                    </div>
                </div>
                <ProgressBar state={refreshingState} />
                {this.classTree ? (
                    <Forest className={`${CLASS_NAME}__tree ontodia-scrollable`}
                        view={view}
                        nodes={filteredRoots}
                        searchText={searchText}
                        selectedNode={selectedNode}
                        onSelect={this.onSelectNode}
                        creatableClasses={constructibleClasses}
                        onClickCreate={this.onCreateInstance}
                        onDragCreate={this.onDragCreate}
                        onDragEnd={this.onDragEnd}
                    />
                ) : (
                    <div className={`${CLASS_NAME}__spinner`}>
                        <HtmlSpinner width={30} height={30} />
                    </div>
                )}
            </div>
        );
    }

    componentDidMount() {
        const {model, view} = this.context.ontodiaWorkspace;
        this.listener.listen(view.events, 'changeLanguage', () => this.refreshClassTree());
        this.listener.listen(model.events, 'loadingStart', () => {
            this.initClassTree();
        });
        this.listener.listen(model.events, 'classEvent', ({data}) => {
            if (data.changeLabel || data.changeCount) {
                this.delayedClassUpdate.call(this.refreshClassTree);
            }
        });
        this.initClassTree();
    }

    componentWillUnmount() {
        this.listener.stopListening();
        this.delayedClassUpdate.dispose();
        this.delayedSearch.dispose();
        this.loadClassesOperation.abort();
        this.refreshOperation.abort();
        this.cancellation.abort();
    }

    private async initClassTree() {
        const {model} = this.context.ontodiaWorkspace;
        if (this.dataProvider !== model.dataProvider) {
            this.dataProvider = model.dataProvider;
            this.classTree = undefined;

            const cancellation = new Cancellation();
            this.loadClassesOperation.abort();
            this.loadClassesOperation = cancellation;

            const classes = await this.dataProvider.classTree();
            if (cancellation.signal.aborted) { return; }
            this.setClassTree(classes);
        }
        this.refreshClassTree();
    }

    private onSearchTextChange = (e: React.FormEvent<HTMLInputElement>) => {
        const requestedSearchText = e.currentTarget.value;
        this.setState({requestedSearchText});
        this.delayedSearch.call(this.performSearch);
    }

    private performSearch = () => {
        const {requestedSearchText} = this.state;
        const requested = normalizeSearchText(requestedSearchText);
        if (requested === this.state.appliedSearchText) {
            return;
        }

        const appliedSearchText = requested.length < MIN_TERM_LENGTH ? undefined : requested;
        this.setState((state): State => applyFilters(
            {...state, appliedSearchText}
        ));
    }

    private onShowOnlyCreatableChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.setState((state): State => applyFilters(
            {...state, showOnlyConstructible: !state.showOnlyConstructible}
        ));
    }

    private onSelectNode = (node: TreeNode) => {
        this.setState({selectedNode: node});
        this.props.instancesSearchCommands.trigger('setCriteria', {
            criteria: {elementType: {
                iri: node.model.id,
                labels: node.model.label,
            }}
        });
    }

    private onCreateInstance = (node: TreeNode) => {
        this.handleCreateInstance(node.model.id);
    }

    private onDragCreate = (node: TreeNode) => {
        const {view} = this.context.ontodiaWorkspace;
        this.dropHandler = e => {
            this.handleCreateInstance(node.model.id, e.paperPosition);
        };
        view.pushDragDropHandler(this.dropHandler);
    }

    private handleCreateInstance = async (classId: ElementTypeIri, position?: Vector) => {
        const {model, editor, overlayController} = this.context.ontodiaWorkspace;
        const {canvasCommands} = this.props;
        await forceNonReactExecutionContext();
        const batch = model.history.startBatch();

        const types = [classId];
        const signal = this.cancellation.signal;

        const elementModel = await CancellationToken.mapCancelledToNull(
            signal,
            editor.metadataApi!.generateNewElement(types, signal)
        );
        if (elementModel === null) { return; }
        const element = editor.createNewEntity({elementModel});
        canvasCommands.trigger('moveElementToCenter', {element, position});

        batch.store();
        editor.setSelection([element]);
        overlayController.showEditEntityForm(element, {afterCreate: true});
    }

    private onDragEnd = () => {
        const {view} = this.context.ontodiaWorkspace;
        if (this.dropHandler) {
            view.popDragDropHandler(this.dropHandler);
            this.dropHandler = undefined;
        }
    }

    private refreshClassTree = () => {
        const cancellation = new Cancellation();
        const {editor} = this.context.ontodiaWorkspace;
        this.refreshOperation.abort();
        this.refreshOperation = cancellation;

        this.setState((state): State | Pick<State, 'refreshingState'> => {
            if (!this.classTree) {
                return {refreshingState: ProgressState.none};
            }

            let refreshingState = ProgressState.none;
            if (editor.inAuthoringMode) {
                const newIris = getNewClassIris(state.constructibleClasses, this.classTree);

                if (newIris.size > 0) {
                    refreshingState = ProgressState.loading;
                    this.queryCreatableTypes(newIris, cancellation.signal);
                }
            }

            const roots = createRoots(this.classTree, this.context.ontodiaWorkspace.view);
            return applyFilters({...state, roots: sortTree(roots), refreshingState});
        });
    }

    private setClassTree(roots: ClassModel[]) {
        const {model: diagramModel} = this.context.ontodiaWorkspace;
        const visiting = new Set<ElementTypeIri>();
        const reduceNonCycle = (acc: ClassModel[], model: ClassModel) => {
            if (!visiting.has(model.id)) {
                visiting.add(model.id);
                const children = model.children.reduce(reduceNonCycle, []);
                acc.push({...model, children});
                visiting.delete(model.id);
            }
            return acc;
        };
        this.classTree = roots.reduce(reduceNonCycle, []);

        const addClass = (model: ClassModel) => {
            const existing = diagramModel.getClass(model.id);
            if (!existing) {
                const {id, label, count, children} = model;
                const richClass = new RichClass({id, label: label.values, count});
                diagramModel.addClass(richClass);
                children.forEach(addClass);
            }
        };
        this.classTree.forEach(addClass);

        this.refreshClassTree();
    }

    private async queryCreatableTypes(typeIris: Set<ElementTypeIri>, ct: CancellationToken) {
        try {
            const {editor} =  this.context.ontodiaWorkspace;
            const result = await CancellationToken.mapCancelledToNull(
                ct, editor.metadataApi!.filterConstructibleTypes(typeIris, ct)
            );
            if (result === null) { return; }
            this.setState((state): State => {
                const constructibleClasses = cloneMap(state.constructibleClasses);
                typeIris.forEach(type => {
                    constructibleClasses.set(type, result.has(type));
                });
                return applyFilters({...state, constructibleClasses, refreshingState: ProgressState.completed});
            });
        } catch (err) {
            // tslint:disable-next-line:no-console
            console.error(err);
            if (ct.aborted) { return; }
            this.setState((state): State => applyFilters({...state, refreshingState: ProgressState.error}));
        }
    }
}

function createRoots(classTree: ReadonlyArray<ClassModel>, view: DiagramView) {
    const mapClass = (model: ClassModel): TreeNode => {
        const richClass = view.model.createClass(model.id);
        return {
            model: richClass,
            label: view.formatLabel(richClass.label, richClass.id),
            derived: model.children.map(mapClass),
        };
    };
    return classTree.map(mapClass);
}

function getNewClassIris(
    existingClasses: ReadonlyMap<ElementTypeIri, boolean>,
    classTree: ReadonlyArray<ClassModel>,
) {
    const classIris = new Set<ElementTypeIri>();
    const visitClass = (model: ClassModel) => {
        if (!existingClasses.has(model.id)) {
            classIris.add(model.id);
        }
        model.children.forEach(visitClass);
    };
    classTree.forEach(visitClass);
    return classIris;
}

function normalizeSearchText(text: string) {
    return text.trim().toLowerCase();
}

function sortTree(roots: ReadonlyArray<TreeNode>): ReadonlyArray<TreeNode> {
    function mapNodes(nodes: ReadonlyArray<TreeNode>): ReadonlyArray<TreeNode> {
        if (nodes.length === 0) { return nodes; }
        const mapped = nodes.map(mapNode);
        mapped.sort(compareByLabel);
        return mapped;
    }
    function mapNode(node: TreeNode): TreeNode {
        return TreeNode.setDerived(node, mapNodes(node.derived));
    }
    function compareByLabel(left: TreeNode, right: TreeNode) {
        return left.label.localeCompare(right.label);
    }
    return mapNodes(roots);
}

function applyFilters(state: State): State {
    let filteredRoots = state.roots;
    if (state.appliedSearchText) {
        filteredRoots = filterByKeyword(filteredRoots, state.appliedSearchText);
    }
    if (state.showOnlyConstructible) {
        filteredRoots = filterOnlyCreatable(filteredRoots, state.constructibleClasses);
    }
    return {...state, filteredRoots};
}

function filterByKeyword(roots: ReadonlyArray<TreeNode>, searchText: string): ReadonlyArray<TreeNode> {
    if (roots.length === 0) {
        return roots;
    }
    function collectByKeyword(acc: TreeNode[], node: TreeNode) {
        const derived = node.derived.reduce(collectByKeyword, []);
        // keep parent if children is included or label contains keyword
        if (derived.length > 0 || node.label.toLowerCase().indexOf(searchText) >= 0) {
            acc.push(TreeNode.setDerived(node, derived));
        }
        return acc;
    }
    return roots.reduce(collectByKeyword, []);
}

function filterOnlyCreatable(
    roots: ReadonlyArray<TreeNode>,
    creatableClasses: ReadonlyMap<ElementTypeIri, boolean>
): ReadonlyArray<TreeNode> {
    function collectOnlyCreatable(acc: TreeNode[], node: TreeNode) {
        const derived = node.derived.reduce(collectOnlyCreatable, []);
        if (derived.length > 0 || creatableClasses.get(node.model.id)) {
            acc.push(TreeNode.setDerived(node, derived));
        }
        return acc;
    }
    return roots.reduce(collectOnlyCreatable, []);
}

function forceNonReactExecutionContext(): Promise<void> {
    // force non-React executing context to resolve forceUpdate() synchronously
    return Promise.resolve();
}
