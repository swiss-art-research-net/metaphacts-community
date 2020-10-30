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

import { LinkCount } from '../data/model';
import { changeLinkTypeVisibility } from '../diagram/commands';
import { Element, LinkType } from '../diagram/elements';
import { CommandHistory } from '../diagram/history';
import { DiagramView } from '../diagram/view';

import { Debouncer } from '../viewUtils/async';
import { EventObserver } from '../viewUtils/events';
import { highlightSubstring } from '../widgets/listElementView';
import { ProgressBar, ProgressState } from '../widgets/progressBar';

import { WorkspaceContextTypes, WorkspaceContextWrapper } from '../workspace/workspaceContext';

interface LinkInToolBoxProps {
    view: DiagramView;
    link: LinkType;
    count: number;
    onPressFilter?: (type: LinkType) => void;
    filterKey?: string;
}

type LinkTypeVisibility = 'invisible' | 'withoutLabels' | 'allVisible';

class LinkInToolBox extends React.Component<LinkInToolBoxProps, {}> {
    private onPressFilter = () => {
        if (this.props.onPressFilter) {
            this.props.onPressFilter(this.props.link);
        }
    }

    private changeState = (state: LinkTypeVisibility) => {
        const history = this.props.view.model.history;
        changeLinkTypeState(history, state, [this.props.link]);
    }

    private isChecked = (stateName: LinkTypeVisibility): boolean => {
        let curState: LinkTypeVisibility;
        if (!this.props.link.visible) {
            curState = 'invisible';
        } else if (!this.props.link.showLabel) {
            curState = 'withoutLabels';
        } else {
            curState = 'allVisible';
        }
        return stateName === curState;
    }

    private getText = () => {
        const {link: linkType, view, filterKey} = this.props;
        const fullText = view.formatLabel(linkType.label, linkType.id);
        return highlightSubstring(fullText, filterKey);
    }

    render() {
        const newIcon = (this.props.link.isNew ? <span className='linkInToolBox__new-tag'>new</span> : '');
        const countIcon = (this.props.count > 0 ? <span className='ontodia-badge'>{this.props.count}</span> : '');
        const badgeContainer = (newIcon || countIcon ? <div>{newIcon}{countIcon}</div> : '');

        return (
            <li data-linktypeid={this.props.link.id} className='ontodia-list-group-item linkInToolBox'>
                <span className='ontodia-btn-group ontodia-btn-group-xs' data-toggle='buttons'>
                    <label className={
                            'ontodia-btn ontodia-btn-default' + (this.isChecked('invisible') ? ' active' : '')}
                        id='invisible' title='Hide links and labels'
                        onClick={() => this.changeState('invisible')}>
                        <span className='fa fa-times' aria-hidden='true' />
                    </label>
                    <label className={
                            'ontodia-btn ontodia-btn-default' + (this.isChecked('withoutLabels') ? ' active' : '')}
                        id='withoutLabels' title='Show links without labels'
                        onClick={() => this.changeState('withoutLabels')}>
                        <span className='fa fa-arrows-h' aria-hidden='true' />
                    </label>
                    <label className={
                            'ontodia-btn ontodia-btn-default' + (this.isChecked('allVisible') ? ' active' : '')}
                        id='allVisible' title='Show links with labels'
                        onClick={() => this.changeState('allVisible')}>
                        <span className='fa fa-text-width' aria-hidden='true' />
                    </label>
                </span>
                <div className='link-title'>{this.getText()}</div>
                {badgeContainer}
                <div className='linkInToolBox__filter-button' onClick={this.onPressFilter} />
            </li>
        );
    }
}

interface LinkTypesToolboxViewProps {
    view: DiagramView;
    links: ReadonlyArray<LinkType> | undefined;
    countMap: { readonly [linkTypeId: string]: number } | undefined;
    selectedElement: Element | undefined;
    dataState: ProgressState;
    filterCallback: (type: LinkType) => void;
}

class LinkTypesToolboxView extends React.Component<LinkTypesToolboxViewProps, { filterKey: string }> {
    constructor(props: LinkTypesToolboxViewProps) {
        super(props);
        this.state = {filterKey: ''};
    }

    private compareLinks = (a: LinkType, b: LinkType) => {
        const {view} = this.props;
        const aText = view.formatLabel(a.label, a.id);
        const bText = view.formatLabel(b.label, b.id);
        return aText.localeCompare(bText);
    }

    private onChangeInput = (e: React.SyntheticEvent<HTMLInputElement>) => {
        this.setState({filterKey: e.currentTarget.value});
    }

    private onDropFilter = () => {
        this.setState({filterKey: ''});
    }

    private getLinks = () => {
        const {view, links = []} = this.props;
        return links.filter(linkType => {
            const text = view.formatLabel(linkType.label, linkType.id).toLowerCase();
            return !this.state.filterKey || text.indexOf(this.state.filterKey.toLowerCase()) >= 0;
        })
        .sort(this.compareLinks);
    }

    private getViews = (links: LinkType[]) => {
        const countMap = this.props.countMap || {};
        const views: React.ReactElement<any>[] = [];
        for (const link of links) {
            views.push(
                <LinkInToolBox key={link.id}
                    view={this.props.view}
                    link={link}
                    onPressFilter={this.props.filterCallback}
                    count={countMap[link.id] || 0}
                    filterKey={this.state.filterKey}
                />
            );
        }
        return views;
    }

    render() {
        const className = 'link-types-toolbox';
        const {view, dataState, selectedElement} = this.props;
        const history = view.model.history;

        const links = this.getLinks();
        const views = this.getViews(links);

        let connectedTo: JSX.Element | null = null;
        if (selectedElement) {
            const selectedElementLabel = view.formatLabel(
                selectedElement.data.label.values,
                selectedElement.iri
            );
            connectedTo = (
                <span className='links-heading' style={{display: 'block'}}>
                    Connected to{'\u00A0'}
                    <span>{selectedElementLabel}</span>
                </span>
            );
        }

        let dropButton: JSX.Element | null = null;
        if (this.state.filterKey) {
            dropButton = <button type='button' className={`${className}__clearSearch`}
                onClick={this.onDropFilter}>
                <span className='fa fa-times' aria-hidden='true'></span>
            </button>;
        }

        return (
            <div className={className}>
                <div className={`${className}__heading`}>
                    <div className={`${className}__searching-box`}>
                        <input className='search-input ontodia-form-control'
                            type='text'
                            value={this.state.filterKey}
                            onChange={this.onChangeInput}
                            placeholder='Search for...' />
                        {dropButton}
                    </div>
                    <div className={`${className}__switch-all`}>
                        <div className='ontodia-btn-group ontodia-btn-group-xs'>
                            <label className='ontodia-btn ontodia-btn-default'
                                title='Hide links and labels'
                                onClick={() => changeLinkTypeState(history, 'invisible', links)}>
                                <span className='fa fa-times' aria-hidden='true' />
                            </label>
                            <label className='ontodia-btn ontodia-btn-default'
                                title='Show links without labels'
                                onClick={() => changeLinkTypeState(history, 'withoutLabels', links)}>
                                <span className='fa fa-arrows-h' aria-hidden='true' />
                            </label>
                            <label className='ontodia-btn ontodia-btn-default'
                                title='Show links with labels'
                                onClick={() => changeLinkTypeState(history, 'allVisible', links)}>
                                <span className='fa fa-text-width' aria-hidden='true' />
                            </label>
                        </div>
                        <span>&nbsp;Switch all</span>
                    </div>
                </div>
                <ProgressBar state={dataState} />
                <div className={`${className}__rest`}>
                    {connectedTo}
                    <div className='ontodia-scrollable'>
                        <ul className='ontodia-list-group connected-links'>{views}</ul>
                    </div>
                </div>
            </div>
        );
    }
}

export interface LinkTypesToolboxState {
    readonly dataState: ProgressState;
    readonly selectedElement?: Element;
    readonly linksOfElement?: ReadonlyArray<LinkType>;
    readonly countMap?: { readonly [linkTypeId: string]: number };
}

export class LinkTypesToolbox extends React.Component<{}, LinkTypesToolboxState> {
    static contextTypes = WorkspaceContextTypes;
    declare readonly context: WorkspaceContextWrapper;

    private readonly listener = new EventObserver();
    private readonly linkListener = new EventObserver();
    private readonly debounceSelection = new Debouncer(50 /* ms */);

    private currentRequest: { elementId: string } | undefined | null;

    constructor(props: {}, context: any) {
        super(props, context);

        const {view, editor} = this.context.ontodiaWorkspace;

        this.listener.listen(view.events, 'changeLanguage', () => this.updateOnCurrentSelection());
        this.listener.listen(editor.model.events, 'loadingSuccess', () => this.updateOnCurrentSelection());
        this.listener.listen(editor.events, 'changeSelection', () => {
            this.debounceSelection.call(this.updateOnCurrentSelection);
        });

        this.state = {dataState: ProgressState.none};
    }

    componentDidMount() {
        this.updateOnCurrentSelection();
    }

    componentWillUnmount() {
        this.listener.stopListening();
        this.linkListener.stopListening();
        this.debounceSelection.dispose();
    }

    private updateOnCurrentSelection = () => {
        const {editor} = this.context.ontodiaWorkspace;
        const single = editor.selection.length === 1 ? editor.selection[0] : null;
        if (single !== this.state.selectedElement && single instanceof Element) {
            this.requestLinksOf(single);
        }
    }

    private requestLinksOf(selectedElement: Element) {
        if (selectedElement) {
            const request = {elementId: selectedElement.iri};
            this.currentRequest = request;
            this.setState({dataState: ProgressState.loading, selectedElement});
            this.context.ontodiaWorkspace.editor.model.dataProvider.linkTypesOf(request).then(linkTypes => {
                if (this.currentRequest !== request) { return; }
                const {linksOfElement, countMap} = this.computeStateFromRequestResult(linkTypes);
                this.subscribeOnLinksEvents(linksOfElement);
                this.setState({dataState: ProgressState.completed, linksOfElement, countMap});
            }).catch(error => {
                if (this.currentRequest !== request) { return; }
                // tslint:disable-next-line:no-console
                console.error(error);
                this.setState({dataState: ProgressState.error, linksOfElement: undefined, countMap: {}});
            });
        } else {
            this.currentRequest = null;
            this.setState({
                dataState: ProgressState.completed,
                selectedElement,
                linksOfElement: undefined,
                countMap: {},
            });
        }
    }

    private computeStateFromRequestResult(linkTypes: ReadonlyArray<LinkCount>) {
        const linksOfElement: LinkType[] = [];
        const countMap: { [linkTypeId: string]: number } = {};

        const model = this.context.ontodiaWorkspace.editor.model;
        for (const linkType of linkTypes) {
            const type = model.createLinkType(linkType.id);
            linksOfElement.push(type);
            countMap[linkType.id] = linkType.inCount + linkType.outCount;
        }

        return {linksOfElement, countMap};
    }

    private subscribeOnLinksEvents(linksOfElement: LinkType[]) {
        this.linkListener.stopListening();

        const listener = this.linkListener;
        for (const link of linksOfElement) {
            listener.listen(link.events, 'changeLabel', this.onLinkChanged);
            listener.listen(link.events, 'changeVisibility', this.onLinkChanged);
        }
    }

    private onLinkChanged = () => {
        this.forceUpdate();
    }

    render() {
        const {view} = this.context.ontodiaWorkspace;
        const {selectedElement, dataState, linksOfElement, countMap} = this.state;
        return <LinkTypesToolboxView view={view}
            dataState={dataState}
            links={linksOfElement}
            countMap={countMap}
            filterCallback={this.onAddToFilter}
            selectedElement={selectedElement}
        />;
    }

    private onAddToFilter = (linkType: LinkType) => {
        const {selectedElement} = this.state;
        if (selectedElement) {
            selectedElement.addToFilter(linkType);
        }
    }
}

function changeLinkTypeState(history: CommandHistory, state: LinkTypeVisibility, links: ReadonlyArray<LinkType>) {
    const batch = history.startBatch();
    const {visible, showLabel} = (
        state === 'invisible' ? {visible: false, showLabel: false} :
        state === 'withoutLabels' ? {visible: true, showLabel: false} :
        state === 'allVisible' ? {visible: true, showLabel: true} :
        undefined as unknown as { visible: boolean; showLabel: boolean }
    );
    for (const linkType of links) {
        history.execute(changeLinkTypeVisibility({linkType, visible, showLabel}));
    }
    batch.store();
}
