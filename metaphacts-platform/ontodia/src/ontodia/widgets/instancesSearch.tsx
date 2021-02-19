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

import {
    ElementModel, LinkedElement, ElementIri, LinkTypeIri, ElementTypeIri,
} from '../data/model';
import { Rdf } from '../data/rdf';
import { FilterParams } from '../data/provider';

import { Debouncer } from '../viewUtils/async';
import { Events, EventObserver } from '../viewUtils/events';
import { cloneSet } from '../viewUtils/collections';
import { ProgressBar, ProgressState } from '../widgets/progressBar';
import { SearchResults } from './searchResults';

import { WorkspaceContextTypes, WorkspaceContextWrapper, WorkspaceEventKey } from '../workspace/workspaceContext';

const DirectionInImage: string = require('../../../images/direction-in.png');
const DirectionOutImage: string = require('../../../images/direction-out.png');

export interface InstancesSearchProps {
    commands: Events<InstancesSearchCommands>;
}

export interface SearchCriteria {
    readonly text?: string;
    readonly elementType?: {
        readonly iri: ElementTypeIri;
        readonly labels: ReadonlyArray<Rdf.Literal>;
    };
    readonly refElement?: {
        readonly iri: ElementIri;
        readonly labels: ReadonlyArray<Rdf.Literal>;
    };
    readonly refElementLink?: {
        readonly iri: LinkTypeIri;
        readonly labels: ReadonlyArray<Rdf.Literal>;
    };
    readonly linkDirection?: 'in' | 'out';
}
export interface State {
    readonly inputText?: string;
    readonly quering?: boolean;
    readonly resultId: number;
    readonly error?: any;
    readonly items?: ReadonlyArray<ElementModel>;
    readonly selection: ReadonlySet<ElementIri>;
    readonly moreItemsAvailable?: boolean;
    readonly criteria?: SearchCriteria;
}

export interface InstancesSearchCommands {
    setCriteria: { criteria: SearchCriteria | undefined };
}

const CLASS_NAME = 'ontodia-instances-search';

interface CreatedRequestParams extends FilterParams {
    limit: number;
    offset: number;
    languageCode: string;
}

export class InstancesSearch extends React.Component<InstancesSearchProps, State> {
    static contextTypes = WorkspaceContextTypes;
    declare readonly context: WorkspaceContextWrapper;

    private readonly listener = new EventObserver();
    private readonly commandListener = new EventObserver();
    private readonly delayedChangeCells = new Debouncer();

    private currentRequest: CreatedRequestParams | undefined;

    constructor(props: InstancesSearchProps, context: any) {
        super(props, context);
        this.state = {
            resultId: 0,
            selection: new Set<ElementIri>(),
        };
    }

    render() {
        const {view} = this.context.ontodiaWorkspace;
        const {criteria = {}, moreItemsAvailable, items: unsortedItems, error} = this.state;
        const ENTER_KEY_CODE = 13;

        const progressState = (
            this.state.quering ? ProgressState.loading :
            this.state.error ? ProgressState.error :
            this.state.items ? ProgressState.completed :
            ProgressState.none
        );

        const searchTerm = this.state.inputText === undefined
            ? criteria.text : this.state.inputText;

        let items: Array<ElementModel> | undefined;
        if (unsortedItems) {
            items = moreItemsAvailable ? [...unsortedItems] : [...unsortedItems].sort((a, b) => {
                const labelA = view.formatLabel(a.label.values, a.id);
                const labelB = view.formatLabel(b.label.values, b.id);
                return labelA.localeCompare(labelB);
            });
        }

        return <div className={CLASS_NAME}>
            <ProgressBar state={progressState} />
            <div className={`${CLASS_NAME}__criteria`}>
                {this.renderCriteria()}
                <div className={`${CLASS_NAME}__text-criteria ontodia-input-group`}>
                    <input type='text' className='ontodia-form-control' placeholder='Search for...'
                        value={searchTerm || ''}
                        onChange={e => this.setState({inputText: e.currentTarget.value})}
                        onKeyUp={e => {
                            if (e.keyCode === ENTER_KEY_CODE) {
                               this.submitCriteriaUpdate();
                            }
                        }} />
                    <span className='ontodia-input-group-btn'>
                        <button className='ontodia-btn ontodia-btn-secondary' type='button' title='Search'
                            onClick={() => this.submitCriteriaUpdate()}>
                            <span className='fa fa-search' aria-hidden='true'/>
                        </button>
                    </span>
                </div>
            </div>
            {moreItemsAvailable ? (
                <div className={`${CLASS_NAME}__warning`}>
                    The list exceeds {this.currentRequest!.limit} items, sorting cannot be applied.
                </div>
            ) : null}
            {/* specify resultId as key to reset scroll position when loaded new search results */}
            <div className={`${CLASS_NAME}__rest ontodia-scrollable`} key={this.state.resultId}>
                {error ? <div className={`${CLASS_NAME}__error`}>Data fetching failed.</div> : null}
                <SearchResults
                    view={view}
                    items={items ? items.map(model => ({model})) : []}
                    highlightText={criteria.text}
                    selection={this.state.selection}
                    onSelectionChanged={this.onSelectionChanged}
                />
                <div className={`${CLASS_NAME}__rest-end`}>
                    <button type='button'
                        className={`${CLASS_NAME}__load-more ontodia-btn ontodia-btn-primary`}
                        disabled={this.state.quering}
                        style={{display: moreItemsAvailable ? undefined : 'none'}}
                        onClick={() => this.queryItems(true)}>
                        <span className='fa fa-chevron-down' aria-hidden='true' />
                        &nbsp;Show more
                    </button>
                </div>
            </div>
        </div>;
    }

    private onSelectionChanged = (newSelection: ReadonlySet<ElementIri>) => {
        this.setState({selection: newSelection});
    }

    private renderCriteria(): React.ReactElement<any> {
        const {view} = this.context.ontodiaWorkspace;
        const criterions: React.ReactElement<any>[] = [];

        const criteria = this.state.criteria || {};

        if (criteria.elementType) {
            const classInfo = criteria.elementType;
            const classLabel = view.formatLabel(classInfo.labels, classInfo.iri);
            criterions.push(<div key='hasType' className={`${CLASS_NAME}__criterion`}>
                {this.renderRemoveCriterionButtons(() => this.onCriteriaChanged(
                    {...criteria, elementType: undefined}))}
                Has type <span className={`${CLASS_NAME}__criterion-class`}
                    title={classInfo.iri}>{classLabel}</span>
            </div>);
        } else if (criteria.refElement) {
            const element = criteria.refElement;
            const elementLabel = view.formatLabel(element.labels, element.iri);

            const linkType = criteria.refElementLink;
            const linkTypeLabel = linkType ? view.formatLabel(linkType.labels, linkType.iri) : undefined;

            criterions.push(<div key='hasLinkedElement' className={`${CLASS_NAME}__criterion`}>
                {this.renderRemoveCriterionButtons(() => this.onCriteriaChanged(
                    {...criteria, refElement: undefined, refElementLink: undefined}))}
                Connected to <span className={`${CLASS_NAME}__criterion-element`}
                    title={element ? element.iri : undefined}>{elementLabel}</span>
                {linkType && <span>
                    {' through '}
                    <span className={`${CLASS_NAME}__criterion-link-type`}
                        title={linkType ? linkType.iri : undefined}>{linkTypeLabel}</span>
                    {criteria.linkDirection === 'in' && <span>
                        {' as '}<img className={`${CLASS_NAME}__link-direction`} src={DirectionInImage} />&nbsp;source
                    </span>}
                    {criteria.linkDirection === 'out' && <span>
                        {' as '}<img className={`${CLASS_NAME}__link-direction`} src={DirectionOutImage} />&nbsp;target
                    </span>}
                </span>}
            </div>);
        }

        return <div className={`${CLASS_NAME}__criterions`}>{criterions}</div>;
    }

    private renderRemoveCriterionButtons(onClick: () => void) {
        return <div className={`${CLASS_NAME}__criterion-remove ontoidia-btn-group ontodia-btn-group-xs`}>
            <button type='button' className='ontodia-btn ontodia-btn-secondary' title='Remove criteria'
                onClick={onClick}>
                <span className='fa fa-times' aria-hidden='true'></span>
            </button>
        </div>;
    }

    private submitCriteriaUpdate() {
        const {criteria = {}} = this.state;
        let text = this.state.inputText === undefined ? criteria.text : this.state.inputText;
        text = text === '' ? undefined : text;
        this.onCriteriaChanged({...criteria, text});
    }

    componentDidMount() {
        const {view, triggerWorkspaceEvent} = this.context.ontodiaWorkspace;
        this.listener.listen(view.events, 'changeLanguage', () => this.forceUpdate());
        this.listener.listen(view.model.events, 'changeCells', () => {
            this.delayedChangeCells.call(this.onChangeCells);
        });
        this.listener.listen(view.model.events, 'elementEvent', ({data}) => {
            if (!data.requestedAddToFilter) { return; }
            const {source, linkType, direction} = data.requestedAddToFilter;
            this.setState({
                criteria: {
                    refElement: {
                        iri: source.iri,
                        labels: source.data.label.values,
                    },
                    refElementLink: linkType ? {
                        iri: linkType.id,
                        labels: linkType.label,
                    } : undefined,
                    linkDirection: direction,
                }
            });
            triggerWorkspaceEvent(WorkspaceEventKey.searchUpdateCriteria);
        });
        this.observeCommands(this.props.commands);
        this.queryItems(false);
    }

    componentWillReceiveProps(nextProps: InstancesSearchProps, nextContext: WorkspaceContextWrapper) {
        const languageChanged = this.currentRequest
            ? this.currentRequest.languageCode !== nextContext.ontodiaWorkspace.view.getLanguage() : false;
        if (languageChanged) {
            this.setState({inputText: undefined}, () => this.queryItems(false));
        }
        if (this.props.commands !== nextProps.commands) {
            this.commandListener.stopListening();
            this.observeCommands(nextProps.commands);
        }
    }

    componentDidUpdate(prevProps: Readonly<{}>, prevState: Readonly<State>, prevContext: any): void {
        if (this.state.criteria !== prevState.criteria) {
            this.setState({inputText: undefined}, () => this.queryItems(false));
        }
    }

    componentWillUnmount() {
        this.listener.stopListening();
        this.commandListener.stopListening();
        this.delayedChangeCells.dispose();
        this.currentRequest = undefined;
    }

    private observeCommands(commands: Events<InstancesSearchCommands>) {
        this.commandListener.listen(commands, 'setCriteria', e => {
            this.setState({criteria: e.criteria});
        });
    }

    private onChangeCells = () => {
        const {view} = this.context.ontodiaWorkspace;
        const {items, selection} = this.state;
        if (selection.size === 0) {
            if (items && items.length > 0) {
                // redraw "already on diagram" state
                this.forceUpdate();
            }
        } else {
            const newSelection = cloneSet(selection);
            for (const element of view.model.elements) {
                if (element.group === undefined && selection.has(element.iri)) {
                    newSelection.delete(element.iri);
                }
            }
            this.setState({selection: newSelection});
        }
    }

    private queryItems(loadMoreItems: boolean) {
        const {criteria = {}} = this.state;
        let request: CreatedRequestParams;
        if (loadMoreItems) {
            if (!this.currentRequest) {
                throw new Error('Cannot request more items without initial request.');
            }
            const {offset, limit} = this.currentRequest;
            request = {...this.currentRequest, offset: offset + limit};
        } else {
            request = createRequest(criteria, this.context.ontodiaWorkspace.view.getLanguage());
        }

        if (!(request.text || request.elementTypeId || request.refElementId || request.refElementLinkId)) {
            this.setState({
                quering: false,
                error: undefined,
                items: undefined,
                selection: new Set<ElementIri>(),
                moreItemsAvailable: false,
            });
            return;
        }

        this.currentRequest = request;
        this.setState({
            quering: true,
            error: undefined,
            moreItemsAvailable: false,
        });

        const {model} = this.context.ontodiaWorkspace;
        model.dataProvider.filter(request).then(elements => {
            if (this.currentRequest !== request) { return; }
            this.processFilterData(elements);
            this.context.ontodiaWorkspace.triggerWorkspaceEvent(WorkspaceEventKey.searchQueryItem);
        }).catch(error => {
            if (this.currentRequest !== request) { return; }
            // tslint:disable-next-line:no-console
            console.error(error);
            this.setState({quering: false, error});
        });
    }

    private processFilterData(elements: ReadonlyArray<LinkedElement>) {
        const requestedAdditionalItems = this.currentRequest!.offset > 0;

        const existingIris: { [iri: string]: true } = {};

        if (requestedAdditionalItems) {
            this.state.items!.forEach(item => existingIris[item.id] = true);
        }

        const items = requestedAdditionalItems ? [...this.state.items!] : [];
        for (const {element} of elements) {
            if (existingIris[element.id]) { continue; }
            items.push(element);
        }

        const moreItemsAvailable = Object.keys(elements).length >= this.currentRequest!.limit;

        if (requestedAdditionalItems) {
            this.setState({quering: false, items, error: undefined, moreItemsAvailable});
        } else {
            this.setState({
                quering: false,
                resultId: this.state.resultId + 1,
                items,
                selection: new Set<ElementIri>(),
                error: undefined,
                moreItemsAvailable,
            });
        }
    }

    private onCriteriaChanged(criteria: SearchCriteria) {
        this.setState({criteria});
    }

    internal_setCriteria(criteria: SearchCriteria | undefined) {
        this.setState({criteria});
    }
}

export function createRequest(criteria: SearchCriteria, language: string): CreatedRequestParams {
    const {text, elementType, refElement, refElementLink, linkDirection} = criteria;
    return {
        text,
        elementTypeId: elementType ? elementType.iri : undefined,
        refElementId: refElement ? refElement.iri : undefined,
        refElementLinkId: refElementLink ? refElementLink.iri : undefined,
        linkDirection,
        offset: 0,
        limit: 100,
        languageCode: language || 'en',
    };
}
