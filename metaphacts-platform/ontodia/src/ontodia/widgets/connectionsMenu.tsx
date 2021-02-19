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

import { Dictionary, ElementModel, ElementIri, LinkTypeIri } from '../data/model';

import { changeLinkTypeVisibility } from '../diagram/commands';
import { LinkType, Element } from '../diagram/elements';
import { PaperWidgetProps } from '../diagram/paperArea';
import { RenderingState } from '../diagram/renderingState';
import { DiagramView, WidgetAttachment, assertWidgetComponent } from '../diagram/view';

import { requestElementData, restoreLinksBetweenElements, AsyncModel } from '../editor/asyncModel';
import { Events, EventObserver } from '../viewUtils/events';
import { placeElementsAround } from '../viewUtils/layout';
import { ProgressBar, ProgressState } from '../widgets/progressBar';
import { highlightSubstring } from './listElementView';
import { SearchResults, SearchResultsItem } from './searchResults';

import { WorkspaceContextTypes, WorkspaceContextWrapper, WorkspaceEventKey } from '../workspace/workspaceContext';

import * as styles from './connectionsMenu.scss';

export type PropertySuggestionHandler =
    (params: PropertySuggestionParams) => Promise<Dictionary<PropertyScore>>;

export interface PropertySuggestionParams {
    elementId: string;
    token: string;
    properties: string[];
    lang: string;
}

export interface PropertyScore {
    propertyIri: string;
    score: number;
}

export interface ConnectionsMenuProps extends PaperWidgetProps {
    /**
     * @default "ontodia-connections-menu"
     */
    id?: string;
    commands: Events<ConnectionsMenuCommands>;
    defaultOpenAll?: boolean;
    /**
     * @default false
     */
    showReferenceLinks?: boolean;
    suggestProperties?: PropertySuggestionHandler;
}

export interface ConnectionsMenuCommands {
    showConnectionsMenu: {
        target: Element;
        byLink?: DirectedLinkType;
    };
}

interface DirectedLinkType {
    link: 'all' | LinkTypeIri;
    /**
     * Link direction. Has not effect if `link` property is set to `"all"`.
     *
     * @default "out"
     */
    direction?: 'out' | 'in';
}

export class ConnectionsMenu extends React.Component<ConnectionsMenuProps, {}> {
    static defaultProps: Pick<ConnectionsMenuProps, 'id'> = {
        id: 'ontodia-connections-menu',
    };

    static contextTypes = WorkspaceContextTypes;
    declare readonly context: WorkspaceContextWrapper;

    static readonly attachment = WidgetAttachment.OverElements;

    private readonly listener = new EventObserver();

    componentDidMount() {
        const {commands} = this.props;
        this.listener.listen(commands, 'showConnectionsMenu', e => {
            this.showConnectionsMenu(e.target, e.byLink);
        });
    }

    componentWillUnmount() {
        this.listener.stopListening();
    }

    render(): null {
        return null;
    }

    private showConnectionsMenu(target: Element, byLinkType: DirectedLinkType | undefined) {
        const {editor, overlayController} = this.context.ontodiaWorkspace;
        const {defaultOpenAll = false, showReferenceLinks = false} = this.props;
        const onClose = () => overlayController.hideDialog();
        const content = (
            <ConnectionsMenuForm target={target}
                byLinkType={byLinkType ?? (defaultOpenAll ? {link: 'all'} : undefined)}
                showReferenceLinks={showReferenceLinks}
                onElementsAdded={elements => {
                    editor._triggerAddElements(elements);
                }}
                onClose={onClose}
                suggestProperties={this.props.suggestProperties}
            />
        );
        overlayController.showDialog({
            target,
            caption: 'Connections',
            content,
            size: {width: 300, height: 350},
            onClose,
        });
    }
}

assertWidgetComponent(ConnectionsMenu);

interface ConnectionsMenuFormProps extends PaperWidgetProps {
    target: Element;
    byLinkType: DirectedLinkType | undefined;
    showReferenceLinks: boolean;
    onClose: () => void;
    onElementsAdded: (elements: Element[]) => void;
    suggestProperties?: PropertySuggestionHandler;
}

type RequiredProps = ConnectionsMenuFormProps & Required<PaperWidgetProps>;

interface ConnectionsMenuState {
    readonly loadingState: ProgressState;

    readonly links?: ReadonlyArray<LinkType>;
    readonly countMap?: { [linkTypeId: string]: ConnectionCount | undefined };

    readonly expanded: boolean;
    readonly linkDataChunk?: LinkDataChunk;
    readonly objects?: ReadonlyArray<ElementOnCanvas>;
}

interface ObjectsData {
    linkDataChunk: LinkDataChunk;
    objects: ReadonlyArray<ElementOnCanvas>;
}

interface LinkDataChunk {
    link: LinkType;
    direction?: 'in' | 'out';
    expectedCount: number;
    offset?: number;
}

interface ElementOnCanvas {
    model: ElementModel;
    inLinks?: ReadonlyArray<LinkType>;
    outLinks?: ReadonlyArray<LinkType>;
    presentOnDiagram: boolean;
}

interface ConnectionCount {
    inCount: number;
    outCount: number;
}

type SortMode = 'alphabet' | 'smart';

const MAX_LINK_COUNT = 100;

class ConnectionsMenuForm extends React.Component<ConnectionsMenuFormProps, ConnectionsMenuState> {
    static contextTypes = WorkspaceContextTypes;
    declare readonly context: WorkspaceContextWrapper;

    private readonly handler = new EventObserver();
    private readonly linkTypesListener = new EventObserver();

    private readonly ALL_RELATED_ELEMENTS_LINK: LinkType;

    constructor(props: ConnectionsMenuFormProps, context: any) {
        super(props, context);
        const {view} = this.props as RequiredProps;
        const {factory} = view.model;
        this.ALL_RELATED_ELEMENTS_LINK = new LinkType({
            id: 'ontodia:allRelatedElements' as LinkTypeIri,
            label: [factory.literal('All')],
        });
        this.state = {
            loadingState: ProgressState.none,
            expanded: false,
        };
    }

    private updateAll = () => this.forceUpdate();

    componentDidMount() {
        const {view} = this.props as RequiredProps;
        this.handler.listen(view.events, 'changeLanguage', this.updateAll);

        this.loadLinks();
    }

    componentWillUnmount() {
        this.handler.stopListening();
        this.linkTypesListener.stopListening();
    }

    private resubscribeOnLinkTypeEvents(linkTypesOfElement: ReadonlyArray<LinkType>) {
        this.linkTypesListener.stopListening();
        for (const linkType of linkTypesOfElement) {
            this.linkTypesListener.listen(linkType.events, 'changeLabel', this.updateAll);
            this.linkTypesListener.listen(linkType.events, 'changeVisibility', this.updateAll);
        }
    }

    private loadLinks() {
        const {model} = this.context.ontodiaWorkspace;
        const {view, target, byLinkType} = this.props as RequiredProps;

        this.setState({loadingState: ProgressState.loading, links: [], countMap: {}});

        model.dataProvider.linkTypesOf({elementId: target.iri})
            .then(linkTypes => {
                const countMap: Dictionary<ConnectionCount> = {};
                const links: LinkType[] = [];
                for (const {id: linkTypeId, inCount, outCount} of linkTypes) {
                    countMap[linkTypeId] = {inCount, outCount};
                    links.push(view.model.createLinkType(linkTypeId));
                }

                countMap[this.ALL_RELATED_ELEMENTS_LINK.id] = Object.keys(countMap)
                    .map(key => countMap[key]!)
                    .reduce((a, b) => {
                        return {inCount: a.inCount + b.inCount, outCount: a.outCount + b.outCount};
                    }, {inCount: 0, outCount: 0});

                this.setState({countMap, links, loadingState: ProgressState.completed}, () => {
                    this.resubscribeOnLinkTypeEvents(links);
                    this.context.ontodiaWorkspace.triggerWorkspaceEvent(WorkspaceEventKey.connectionsLoadLinks);

                    if (byLinkType) {
                        let linkType: LinkType | undefined;
                        let direction: 'in' | 'out' | undefined;
                        if (byLinkType.link === 'all') {
                            linkType = this.ALL_RELATED_ELEMENTS_LINK;
                        } else {
                            linkType = links.find(link => link.id === byLinkType.link);
                            direction = byLinkType.direction ?? 'out';
                        }
                        if (linkType) {
                            const expectedCounts = countMap[linkType.id]!;
                            const expectedCount = Math.min(
                                expectedCounts.inCount + expectedCounts.outCount,
                                MAX_LINK_COUNT
                            );
                            this.onSelectLink({link: linkType, direction, expectedCount});
                        }
                    }
                });
            })
            .catch(err => {
                // tslint:disable-next-line:no-console
                console.error(err);
                this.setState({loadingState: ProgressState.error});
            });
    }

    private loadObjects(linkDataChunk: LinkDataChunk) {
        const {model} = this.context.ontodiaWorkspace;
        const {view, target, showReferenceLinks} = this.props as RequiredProps;
        const {link, direction } = linkDataChunk;
        const offset = linkDataChunk.offset ?? 0;

        this.setState({loadingState: ProgressState.loading, linkDataChunk, objects: []});

        model.dataProvider.filter({
            refElementId: target.iri,
            refElementLinkId: (link === this.ALL_RELATED_ELEMENTS_LINK ? undefined : link.id),
            linkDirection: direction,
            limit: offset + MAX_LINK_COUNT,
            offset: offset,
        }).then(linkedElements => {
            const objects = linkedElements.map((item): ElementOnCanvas => ({
                model: item.element,
                inLinks: showReferenceLinks
                    ? item.inLinks.map(linkTypeId => model.createLinkType(linkTypeId))
                    : undefined,
                outLinks: showReferenceLinks
                    ? item.outLinks.map(linkTypeId => model.createLinkType(linkTypeId))
                    : undefined,
                presentOnDiagram: view.model.elements.findIndex(
                    element => element.iri === item.element.id && element.group === undefined
                ) >= 0,
            }));
            this.setState({loadingState: ProgressState.completed, objects}, () => {
                this.context.ontodiaWorkspace.triggerWorkspaceEvent(WorkspaceEventKey.connectionsLoadElements);
            });
        }).catch(err => {
            // tslint:disable-next-line:no-console
            console.error(err);
            this.setState({loadingState: ProgressState.error});
        });
    }

    private addSelectedElements = (selectedObjects: ElementOnCanvas[]) => {
        const {model} = this.context.ontodiaWorkspace;
        const {renderingState, target, onClose, onElementsAdded} = this.props as RequiredProps;
        const {linkDataChunk} = this.state;

        const addedElementsIris = selectedObjects.map(item => item.model.id);
        const linkType = linkDataChunk ? linkDataChunk.link : undefined;
        const hasChosenLinkType = Boolean(linkDataChunk && linkType !== this.ALL_RELATED_ELEMENTS_LINK);

        const addedElements = onAddElementsFromConnectionMenu({
            model,
            renderingState,
            addedIris: addedElementsIris,
            targetElement: target,
            linkType: hasChosenLinkType ? linkType : undefined,
        });
        onClose();
        onElementsAdded(addedElements);
    }

    private onSelectLink = (selectedLink: LinkDataChunk | undefined) => {
        const {linkDataChunk, objects} = this.state;
        if (selectedLink) {
            const alreadyLoaded = Boolean(
                objects &&
                linkDataChunk &&
                linkDataChunk.link === selectedLink.link &&
                linkDataChunk.direction === selectedLink.direction
            );
            if (!alreadyLoaded) {
                this.loadObjects(selectedLink);
            }
            this.setState({expanded: true});
            this.context.ontodiaWorkspace.triggerWorkspaceEvent(WorkspaceEventKey.connectionsExpandLink);
        } else {
            this.setState({expanded: false});
        }
    }

    private onMoveToFilter = (linkDataChunk: LinkDataChunk) => {
        const {view, target} = this.props as RequiredProps;
        const {link, direction} = linkDataChunk;

        if (link === this.ALL_RELATED_ELEMENTS_LINK) {
            target.addToFilter();
        } else {
            const selectedElement = view.model.getElement(target.id)!;
            selectedElement.addToFilter(link, direction);
        }
    }

    render() {
        const {loadingState, links = [], countMap = {}, linkDataChunk, objects, expanded} = this.state;

        let objectsData: ObjectsData | null = null;
        if (linkDataChunk && objects) {
            objectsData = {linkDataChunk, objects};
        }

        const {view, target, suggestProperties} = this.props as RequiredProps;
        return (
            <ConnectionsMenuMarkup
                target={target}
                connectionsData={{links, countMap}}
                expandedObjects={expanded}
                objectsData={objectsData}
                state={loadingState}
                view={view}
                onSelectLink={this.onSelectLink}
                onPressAddSelected={this.addSelectedElements}
                onMoveToFilter={this.onMoveToFilter}
                propertySuggestionCall={suggestProperties}
                ALL_RELATED_ELEMENTS_LINK={this.ALL_RELATED_ELEMENTS_LINK}
            />
        );
    }
}

interface ConnectionsMenuMarkupProps {
    target: Element;

    connectionsData: {
        links: ReadonlyArray<LinkType>;
        countMap: { readonly [linkTypeId: string]: ConnectionCount | undefined };
    };

    expandedObjects: boolean;
    objectsData: ObjectsData | null;

    view: DiagramView;
    state: ProgressState;

    onSelectLink: (linkDataChunk: LinkDataChunk | undefined) => void;
    onPressAddSelected: (selectedObjects: ElementOnCanvas[]) => void;
    onMoveToFilter: (linkDataChunk: LinkDataChunk) => void;

    propertySuggestionCall?: PropertySuggestionHandler;

    ALL_RELATED_ELEMENTS_LINK: LinkType;
}

interface ConnectionsMenuMarkupState {
    filterKey: string;
    sortMode: SortMode;
}

class ConnectionsMenuMarkup extends React.Component<ConnectionsMenuMarkupProps, ConnectionsMenuMarkupState> {
    constructor(props: ConnectionsMenuMarkupProps) {
        super(props);
        this.state = {
            filterKey: '',
            sortMode: 'alphabet',
        };
    }

    private onChangeFilter = (e: React.FormEvent<HTMLInputElement>) => {
        const filterKey = e.currentTarget.value;
        this.setState({filterKey});
    }

    private onExpandLink = (linkDataChunk: LinkDataChunk) => {
        this.setState({filterKey: ''});
        this.props.onSelectLink(linkDataChunk);
    }

    private onCollapseLink = () => {
        this.setState({filterKey: ''});
        this.props.onSelectLink(undefined);
    }

    private getBreadCrumbs = () => {
        if (this.props.objectsData && this.props.expandedObjects) {
            const {link, direction} = this.props.objectsData.linkDataChunk;
            const localizedText = this.props.view.formatLabel(link.label, link.id);

            return <span className={styles.breadcrumbs}>
                <a className={styles.breadcrumbsLink} onClick={this.onCollapseLink}>Connections</a>
                {'\u00A0' + '/' + '\u00A0'}
                {localizedText} {direction ? `(${direction})` : null}
            </span>;
        } else {
            return null;
        }
    }

    private getBody = () => {
        if (this.props.state === 'error') {
            return <div className={styles.menuError}>Data fetching failed.</div>;
        } else if (this.props.objectsData && this.props.expandedObjects) {
            return <ObjectsPanel
                data={this.props.objectsData}
                onMoveToFilter={this.props.onMoveToFilter}
                view={this.props.view}
                filterKey={this.state.filterKey}
                loading={this.props.state === ProgressState.loading}
                onPressAddSelected={this.props.onPressAddSelected}
            />;
        } else if (this.props.connectionsData && !this.props.expandedObjects) {
            if (this.props.state === ProgressState.loading) {
                return <label className={`ontodia-label ${styles.menuLoading}`}>Loading...</label>;
            }

            return <ConnectionsList
                id={this.props.target.id}
                data={this.props.connectionsData}
                view={this.props.view}
                filterKey={this.state.filterKey}
                onExpandLink={this.onExpandLink}
                onMoveToFilter={this.props.onMoveToFilter}
                propertySuggestionCall={this.props.propertySuggestionCall}
                sortMode={this.state.sortMode}
                ALL_RELATED_ELEMENTS_LINK={this.props.ALL_RELATED_ELEMENTS_LINK}
            />;
        } else {
            return <div />;
        }
    }

    private onSortChange = (e: React.FormEvent<HTMLInputElement>) => {
        const value = (e.target as HTMLInputElement).value as SortMode;

        if (this.state.sortMode === value) { return; }

        this.setState({sortMode: value});
    }

    private renderSortSwitch = (id: string, icon: string, title: string) => {
        return (
            <div>
                <input
                    type='radio'
                    name='sort'
                    id={id}
                    value={id}
                    className={styles.searchSortSwitch}
                    onChange={this.onSortChange}
                    checked={this.state.sortMode === id}
                />
                <label htmlFor={id} className={styles.searchSortSwitchLabel} title={title}>
                    <i className={`fa ${icon}`}/>
                </label>
            </div>
        );
    }

    private renderSortSwitches = () => {
        if (this.props.expandedObjects || !this.props.propertySuggestionCall) { return null; }

        return (
            <div className={styles.searchSortSwitches}>
                {this.renderSortSwitch('alphabet', 'fa-sort-alpha-asc', 'Sort alphabetically')}
                {this.renderSortSwitch('smart', 'fa-lightbulb-o', 'Smart sort')}
            </div>
        );
    }

    render() {
        return (
            <div className={styles.component}>
                {this.getBreadCrumbs()}
                <div className={styles.searchLine}>
                    <input
                        type='text'
                        className={`search-input ontodia-form-control ${styles.searchLineInput}`}
                        value={this.state.filterKey}
                        onChange={this.onChangeFilter}
                        placeholder='Search for...'
                    />
                    {this.renderSortSwitches()}
                </div>
                <ProgressBar state={this.props.state} height={10} />
                {this.getBody()}
            </div>
        );
    }
}

interface ConnectionsListProps {
    id: string;
    data: {
        links: ReadonlyArray<LinkType>;
        countMap: { readonly [linkTypeId: string]: ConnectionCount | undefined };
    };
    view: DiagramView;
    filterKey: string;

    onExpandLink: (linkDataChunk: LinkDataChunk) => void;
    onMoveToFilter: (linkDataChunk: LinkDataChunk) => void;

    propertySuggestionCall?: PropertySuggestionHandler;
    sortMode: SortMode;

    ALL_RELATED_ELEMENTS_LINK: LinkType;
}

class ConnectionsList extends React.Component<ConnectionsListProps, { scores: Dictionary<PropertyScore> }> {
    constructor(props: ConnectionsListProps) {
        super(props);
        this.state = { scores: {} };
        this.updateScores(props);
    }

    componentWillReceiveProps(newProps: ConnectionsListProps) {
        this.updateScores(newProps);
    }

    private updateScores = (props: ConnectionsListProps) => {
        if (props.propertySuggestionCall && (props.filterKey || props.sortMode === 'smart')) {
            const {id, data, view, filterKey} = props;
            const lang = view.getLanguage();
            const token = filterKey.trim();
            const properties = data.links.map(l => l.id);
            props.propertySuggestionCall({elementId: id, token, properties, lang}).then(scores =>
                this.setState({scores})
            );
        }
    }

    private isSmartMode(): boolean {
        return this.props.sortMode === 'smart' && !this.props.filterKey;
    }

    private compareLinks = (a: LinkType, b: LinkType) => {
        const {view} = this.props;
        const aText = view.formatLabel(a.label, a.id);
        const bText = view.formatLabel(b.label, b.id);
        return aText.localeCompare(bText);
    }

    private compareLinksByWeight = (a: LinkType, b: LinkType) => {
        const {view} = this.props;
        const aText = view.formatLabel(a.label, a.id);
        const bText = view.formatLabel(b.label, b.id);

        const aWeight = this.state.scores[a.id] ? this.state.scores[a.id]!.score : 0;
        const bWeight = this.state.scores[b.id] ? this.state.scores[b.id]!.score : 0;

        return (
            aWeight > bWeight ? -1 :
            aWeight < bWeight ? 1 :
            aText.localeCompare(bText)
        );
    }

    private getLinks = () => {
        const {view, data, filterKey} = this.props;
        return (data.links || []).filter(link => {
            const text = view.formatLabel(link.label, link.id).toLowerCase();
            return !filterKey || text.indexOf(filterKey.toLowerCase()) >= 0;
        })
        .sort(this.compareLinks);
    }

    private getProbableLinks = () => {
        const isSmartMode = this.isSmartMode();
        return (this.props.data.links || []).filter(link => {
            return this.state.scores[link.id] && (this.state.scores[link.id]!.score > 0 || isSmartMode);
        }).sort(this.compareLinksByWeight);
    }

    private getViews = (links: LinkType[], notSure?: boolean) => {
        const {view} = this.props;
        const countMap = this.props.data.countMap || {};

        const views: JSX.Element[] = [];
        const addView = (link: LinkType, direction: 'in' | 'out') => {
            const count = direction === 'in'
                ? countMap[link.id]!.inCount
                : countMap[link.id]!.outCount;
            if (count === 0) {
                return;
            }
            const postfix = notSure ? '-probable' : '';
            views.push(
                <LinkInPopupMenu
                    key={`${direction}-${link.id}-${postfix}`}
                    link={link}
                    onExpandLink={this.props.onExpandLink}
                    view={view}
                    count={count}
                    direction={direction}
                    filterKey={notSure ? '' : this.props.filterKey}
                    onMoveToFilter={this.props.onMoveToFilter}
                    probability={
                        (this.state.scores[link.id] && notSure ? this.state.scores[link.id]!.score : 0)
                    }
                />,
            );
        };

        for (const link of links) {
            addView(link, 'in');
            addView(link, 'out');
        }

        return views;
    }

    render() {
        const {view, ALL_RELATED_ELEMENTS_LINK} = this.props;
        const isSmartMode = this.isSmartMode();

        const links = isSmartMode ? [] : this.getLinks();
        const probableLinks = this.getProbableLinks().filter(link => links.indexOf(link) === -1);
        const views = this.getViews(links);
        const probableViews = this.getViews(probableLinks, true);

        let viewList: React.ReactElement<any> | React.ReactElement<any>[];
        if (views.length === 0 && probableViews.length === 0) {
            viewList = <label className={`ontodia-label ${styles.linkTypesEmptyLabel}`}>List empty</label>;
        } else {
            viewList = views;
            if (views.length > 1 || (isSmartMode && probableViews.length > 1)) {
                const countMap = this.props.data.countMap || {};
                const allRelatedElements = countMap[ALL_RELATED_ELEMENTS_LINK.id]!;
                viewList = [
                    <LinkInPopupMenu
                        key={ALL_RELATED_ELEMENTS_LINK.id}
                        link={ALL_RELATED_ELEMENTS_LINK}
                        onExpandLink={this.props.onExpandLink}
                        view={view}
                        count={allRelatedElements.inCount + allRelatedElements.outCount}
                        onMoveToFilter={this.props.onMoveToFilter}
                    />,
                    <hr key='ontodia-hr-line' className={styles.linkTypesSeparatorLine} />,
                ].concat(viewList);
            }
        }
        let probablePart = null;
        if (probableViews.length !== 0) {
            probablePart = [
                isSmartMode ? null : (
                    <li key='probable-links'><span className='ontodia-label'>Probably, you're looking for..</span></li>
                ),
                probableViews,
            ];
        }
        const isEmptyList = views.length === 0 && probableViews.length === 0;
        return <ul className={`${styles.linkTypes} ${isEmptyList ? styles.linkTypesEmpty : ''}`}>
            {viewList}{probablePart}
        </ul>;
    }
}

interface LinkInPopupMenuProps {
    link: LinkType;
    count: number;
    direction?: 'in' | 'out';
    view: DiagramView;
    filterKey?: string;
    onExpandLink: (linkDataChunk: LinkDataChunk) => void;
    onMoveToFilter: (linkDataChunk: LinkDataChunk) => void;
    probability?: number;
}

class LinkInPopupMenu extends React.Component<LinkInPopupMenuProps, {}> {
    constructor(props: LinkInPopupMenuProps) {
        super(props);
    }

    private onExpandLink = (expectedCount: number, direction?: 'in' | 'out') => {
        this.props.onExpandLink({
            link: this.props.link,
            direction,
            expectedCount,
        });
    }

    private onMoveToFilter = (evt: React.MouseEvent<any>) => {
        evt.stopPropagation();
        this.props.onMoveToFilter({
            link: this.props.link,
            direction: this.props.direction,
            expectedCount: this.props.count,
        });
    }

    render() {
        const {view, link} = this.props;
        const fullText = view.formatLabel(link.label, link.id);
        const probability = Math.round((this.props.probability || 0) * 100);
        const textLine = highlightSubstring(
            fullText + (probability > 0 ? ' (' + probability + '%)' : ''),
            this.props.filterKey
        );
        const directionName =
            this.props.direction === 'in' ? 'source' :
            this.props.direction === 'out' ? 'target' :
            'all connected';

        return (
            <li data-linktypeid={this.props.link.id}
                className={styles.linkType}
                title={`${directionName} of "${fullText}" ${view.formatIri(link.id)}`}
                onClick={() => this.onExpandLink(this.props.count, this.props.direction)}>
                {this.props.direction === 'in' || this.props.direction === 'out' ?
                <div className={styles.linkTypeDirection}>
                    {this.props.direction === 'in' && <div className={styles.linkTypeDirectionIn} />}
                    {this.props.direction === 'out' && <div className={styles.linkTypeDirectionOut} />}
                </div>
                : null}
                <div className={styles.linkTypeTitle}>{textLine}</div>
                <span className={`ontodia-badge ${styles.linkTypeCount}`}>
                    {this.props.count <= MAX_LINK_COUNT ? this.props.count : '100+'}
                </span>
                <div className={styles.linkTypeAddToFilter}
                    onClick={this.onMoveToFilter}
                    title='Set as filter in the Instances panel' />
                <div className={styles.linkTypeNavigate}
                    title={`Navigate to ${directionName} "${fullText}" elements`} />
            </li>
        );
    }
}

interface ObjectsPanelProps {
    data: ObjectsData;
    loading?: boolean;
    view: DiagramView;
    filterKey?: string;
    onPressAddSelected: (selectedObjects: ElementOnCanvas[]) => void;
    onMoveToFilter: (linkDataChunk: LinkDataChunk) => void;
}

interface ObjectsPanelState {
    selection: ReadonlySet<ElementIri>;
}

interface ObjectsPanelItem extends SearchResultsItem {
    readonly inLinks?: ReadonlyArray<LinkType>;
    readonly outLinks?: ReadonlyArray<LinkType>;
}

class ObjectsPanel extends React.Component<ObjectsPanelProps, ObjectsPanelState> {
    constructor(props: ObjectsPanelProps) {
        super(props);
        this.state = {selection: new Set<ElementIri>()};
    }

    componentWillReceiveProps(nextProps: ObjectsPanelProps) {
        if (this.props.data.objects.length < nextProps.data.objects.length) {
            this.setState({selection: new Set<ElementIri>()});
        }
    }

    private onSelectAll = () => {
        const objects = this.props.data.objects;
        if (objects.length === 0) { return; }
        const allSelected = allNonPresentedAreSelected(objects, this.state.selection);
        const newSelection = allSelected ? new Set<ElementIri>() : selectNonPresented(this.props.data.objects);
        this.updateSelection(newSelection);
    }

    private getFilteredObjects(): ReadonlyArray<ElementOnCanvas> {
        if (!this.props.filterKey) {
            return this.props.data.objects;
        }
        const filterKey = this.props.filterKey.toLowerCase();
        return this.props.data.objects.filter(element => {
            const text = this.props.view.formatLabel(
                element.model.label.values, element.model.id
            ).toLowerCase();
            return text && text.indexOf(filterKey) >= 0;
        });
    }

    private getItems(list: ReadonlyArray<ElementOnCanvas>): ObjectsPanelItem[] {
        const added: { [id: string]: true } = {};
        const result: ObjectsPanelItem[] = [];
        for (const obj of list) {
            if (added[obj.model.id]) { continue; }
            added[obj.model.id] = true;
            result.push({
                model: obj.model,
                inLinks: obj.inLinks,
                outLinks: obj.outLinks,
            });
        }
        const {view, data} = this.props;
        if (data.linkDataChunk.expectedCount > MAX_LINK_COUNT) {
            return result;
        }
        return result.sort((a, b) => {
            const labelA = view.formatLabel(a.model.label.values, a.model.id);
            const labelB = view.formatLabel(b.model.label.values, b.model.id);
            return labelA.localeCompare(labelB);
        });
    }

    private updateSelection = (newSelection: ReadonlySet<ElementIri>) => {
        this.setState({selection: newSelection});
    }

    private renderCounter = (activeObjCount: number) => {
        const countString = `${activeObjCount}\u00A0of\u00A0${this.props.data.objects.length}`;

        const wrongNodes =
            Math.min(MAX_LINK_COUNT, this.props.data.linkDataChunk.expectedCount) - this.props.data.objects.length;
        const wrongNodesString = Math.abs(wrongNodes) > MAX_LINK_COUNT ?
            `${MAX_LINK_COUNT}+` : Math.abs(wrongNodes).toString();
        const wrongNodesCount = wrongNodes === 0 ? '' : (wrongNodes < 0 ?
            `\u00A0(${wrongNodesString})` : `\u00A0(${wrongNodesString})`);
        const wrongNodesTitle = wrongNodes === 0 ? '' : (wrongNodes > 0 ? 'Unavailable nodes' : 'Extra nodes');

        return <div className={`ontodia-label ${styles.objectListCounter}`}>
            <span>{countString}</span>
            <span className={styles.objectListExtraElements}
                title={wrongNodesTitle}>
                {wrongNodesCount}
            </span>
        </div>;
    }

    render() {
        const {onPressAddSelected, filterKey} = this.props;
        const {selection} = this.state;
        const objects = this.getFilteredObjects();
        const isAllSelected = allNonPresentedAreSelected(objects, selection);

        const nonPresented = objects.filter(el => !el.presentOnDiagram);
        const active = nonPresented.filter(el => selection.has(el.model.id));

        return <div className={styles.objectPanel}>
            <div className={styles.objectSelectAll}>
                <label>
                    <input type='checkbox'
                        checked={isAllSelected && nonPresented.length > 0}
                        onChange={this.onSelectAll}
                        disabled={nonPresented.length === 0} />
                    Select All
                </label>
            </div>
            {
                !this.props.loading && objects.length > 0 &&
                this.props.data.linkDataChunk.expectedCount > MAX_LINK_COUNT ? (
                    <div className={styles.objectPanelWarning}>
                        The list is truncated. Only {MAX_LINK_COUNT} items are shown.
                    </div>
                ) : null
            }
            {(
                this.props.loading ?
                <label className={`ontodia-label ${styles.objectLoadingLabel}`}>Loading...</label> :
                objects.length === 0 ?
                <label className={`ontodia-label ${styles.objectLoadingLabel}`}>No available nodes</label> :
                <div className={styles.objectList}>
                    <SearchResults
                        view={this.props.view}
                        items={this.getItems(objects)}
                        selection={this.state.selection}
                        onSelectionChanged={this.updateSelection}
                        highlightText={filterKey}
                        renderItemContent={this.renderItemLinks}
                    />
                </div>
            )}
            <div className={styles.objectListFooter}>
                {this.renderCounter(active.length)}
                <button className={`ontodia-btn ontodia-btn-primary pull-right ${styles.objectListAddButton}`}
                    disabled={this.props.loading || nonPresented.length === 0}
                    onClick={() => onPressAddSelected(active.length > 0 ? active : nonPresented)}>
                    {active.length > 0 ? 'Add selected' : 'Add all'}
                </button>
            </div>
        </div>;
    }

    private renderItemLinks = (item: ObjectsPanelItem): React.ReactNode => {
        const {view} = this.props;
        if (!(item.inLinks && item.outLinks)) {
            return null;
        }
        let link: { type: LinkType; incoming: boolean } | undefined;
        if (item.inLinks && item.inLinks.length > 0) {
            link = {type: item.inLinks[0], incoming: true};
        } else if (item.outLinks && item.outLinks.length > 0) {
            link = {type: item.outLinks[0], incoming: false};
        }
        if (!link) {
            return <div className={styles.itemLinks} />;
        }
        const linkLabel = view.formatLabel(link.type.label, link.type.id);
        const totalCount = (
            (item.inLinks ? item.inLinks.length : 0) +
            (item.outLinks ? item.outLinks.length : 0)
        );
        return (
            <div className={styles.itemLinks}>
                <span className={link.incoming ? styles.itemIncomingArrow : styles.itemOutgoingArrow} />
                {linkLabel}
                {totalCount > 1 ? <span className={styles.itemLinkCount}>+{totalCount - 1}</span> : null}
            </div>
        );
    }
}

function selectNonPresented(objects: ReadonlyArray<ElementOnCanvas>) {
    const selection = new Set<ElementIri>();
    for (const object of objects) {
        if (object.presentOnDiagram) { continue; }
        selection.add(object.model.id);
    }
    return selection;
}

function allNonPresentedAreSelected(
    objects: ReadonlyArray<ElementOnCanvas>,
    selection: ReadonlySet<ElementIri>
): boolean {
    let allSelected = true;
    for (const object of objects) {
        if (object.presentOnDiagram) { continue; }
        allSelected = allSelected && selection.has(object.model.id);
    }
    return allSelected;
}

function onAddElementsFromConnectionMenu(params: {
    model: AsyncModel;
    renderingState: RenderingState;
    targetElement: Element;
    addedIris: ReadonlyArray<ElementIri>;
    linkType: LinkType | undefined;
}): Element[] {
    const {model, renderingState, targetElement, addedIris, linkType} = params;
    const batch = model.history.startBatch();

    const elements = addedIris.map(iri => {
        const created = model.createElement(iri);
        created.setPosition(targetElement.position);
        return created;
    });

    renderingState.performSyncUpdate();
    placeElementsAround({
        model,
        sizeProvider: renderingState,
        elements,
        targetElement,
        preferredLinksLength: 300,
    });

    if (linkType && !linkType.visible) {
        batch.history.execute(changeLinkTypeVisibility({
            linkType,
            visible: true,
            showLabel: true,
            preventLoading: true,
        }));
    }

    batch.history.execute(requestElementData(model, addedIris));
    batch.history.execute(restoreLinksBetweenElements(model));
    batch.store();

    return elements;
}
