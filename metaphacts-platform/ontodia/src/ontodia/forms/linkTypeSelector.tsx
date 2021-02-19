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

import { LinkModel, ElementModel, sameLink } from '../data/model';
import { PLACEHOLDER_LINK_TYPE } from '../data/schema';

import { LinkType } from '../diagram/elements';
import { DiagramView } from '../diagram/view';
import { AsyncModel } from '../editor/asyncModel';
import { TemporaryState } from '../editor/authoringState';
import { EventObserver } from '../viewUtils/events';
import { Cancellation, CancellationToken } from '../viewUtils/async';
import { HtmlSpinner } from '../viewUtils/spinner';

import { WorkspaceContextWrapper, WorkspaceContextTypes } from '../workspace/workspaceContext';

const CLASS_NAME = 'ontodia-edit-form';

export interface LinkValue {
    link: LinkModel;
    error?: string;
    generated: boolean;
    validated: boolean;
    allowChange: boolean;
}

interface DirectedLinkType {
    linkType: LinkType;
    backwards: boolean;
}

export interface LinkTypeSelectorProps {
    linkValue: LinkValue;
    source: ElementModel;
    target: ElementModel;
    onChange: (value: Pick<LinkValue, 'link' | 'generated'>) => void;
    disabled?: boolean;
}

interface State {
    linkTypes?: Array<DirectedLinkType>;
}

export class LinkTypeSelector extends React.Component<LinkTypeSelectorProps, State> {
    static contextTypes = WorkspaceContextTypes;
    declare readonly context: WorkspaceContextWrapper;

    private readonly listener = new EventObserver();
    private readonly cancellation = new Cancellation();

    constructor(props: LinkTypeSelectorProps) {
        super(props);
        this.state = {
            linkTypes: [],
        };
    }

    private updateAll = () => this.forceUpdate();

    componentDidMount() {
        this.fetchPossibleLinkTypes();
    }

    componentDidUpdate(prevProps: LinkTypeSelectorProps) {
        const {source, target} = this.props;
        if (prevProps.source !== source || prevProps.target !== target) {
            this.setState({linkTypes: undefined});
            this.fetchPossibleLinkTypes();
        }
    }

    componentWillUnmount() {
        this.listener.stopListening();
        this.cancellation.abort();
    }

    private async fetchPossibleLinkTypes() {
        const {editor, view} = this.context.ontodiaWorkspace;
        const {metadataApi} = editor;
        const {source, target} = this.props;
        if (!metadataApi) { return; }
        const signal = this.cancellation.signal;
        const allTypes = await CancellationToken.mapCancelledToNull(
            signal, Promise.all([
                metadataApi.possibleLinkTypes(source, target, signal),
                metadataApi.possibleLinkTypes(target, source, signal)
            ])
        );
        if (allTypes === null) { return; }
        const [forwardTypes, backwardTypes] = allTypes;
        const linkTypes: DirectedLinkType[] = [];
        for (const typeIri of forwardTypes) {
            const linkType = view.model.createLinkType(typeIri);
            linkTypes.push({linkType, backwards: false});
        }
        for (const typeIri of backwardTypes) {
            const linkType = view.model.createLinkType(typeIri);
            linkTypes.push({linkType, backwards: true});
        }
        linkTypes.sort(makeLinkTypeComparatorByLabelAndDirection(view));
        this.setState({linkTypes});
        this.listenToLinkLabels(linkTypes);
    }

    private listenToLinkLabels(linkTypes: ReadonlyArray<DirectedLinkType>) {
        for (const {linkType} of linkTypes) {
            this.listener.listen(linkType.events, 'changeLabel', this.updateAll);
        }
    }

    private onChangeType = (e: React.FormEvent<HTMLSelectElement>) => {
        const {source, target, linkValue} = this.props;
        const {link: originalLink} = linkValue;
        const index = parseInt(e.currentTarget.value, 10);
        const {linkType, backwards} = this.state.linkTypes![index];
        const link: LinkModel = {...originalLink, linkTypeId: linkType.id};
        // switches source and target if the direction has changed
        if (backwards) {
            link.sourceId = target.id;
            link.targetId = source.id;
        }
        // do not re-generate link if it has the same link type
        const generated = linkValue.generated && originalLink.linkTypeId === linkType.id;
        this.props.onChange({link, generated});
    }

    private renderPossibleLinkType = ({linkType, backwards}: DirectedLinkType, index: number) => {
        const {view} = this.context.ontodiaWorkspace;
        const {source, target} = this.props;
        const label = view.formatLabel(linkType.label, linkType.id);
        let [sourceLabel, targetLabel] = [source, target].map(element =>
            view.formatLabel(element.label.values, element.id)
        );
        if (backwards) {
            [sourceLabel, targetLabel] = [targetLabel, sourceLabel];
        }
        return <option key={index} value={index}>{label} [{sourceLabel} &rarr; {targetLabel}]</option>;
    }

    render() {
        const {linkValue, source, disabled} = this.props;
        const {linkTypes} = this.state;
        const currentLinkIsBackwards = linkValue.link.sourceId !== source.id;
        const value = (linkTypes ?? []).findIndex(({linkType, backwards}) =>
            linkType.id === linkValue.link.linkTypeId &&
            backwards === currentLinkIsBackwards
        );
        return (
            <div className={`${CLASS_NAME}__control-row`}>
                <label>Link Type</label>
                {
                    linkTypes ? (
                        <select className='ontodia-form-control'
                             value={value}
                             onChange={this.onChangeType}
                             disabled={disabled}>
                            <option value={-1} disabled={true}>Select link type</option>
                            {linkTypes.map(this.renderPossibleLinkType)}
                        </select>
                    ) : <div><HtmlSpinner width={20} height={20} /></div>
                }
                {linkValue.error ? <span className={`${CLASS_NAME}__control-error`}>{linkValue.error}</span> : ''}
            </div>
        );
    }
}

function makeLinkTypeComparatorByLabelAndDirection(view: DiagramView) {
    return (a: DirectedLinkType, b: DirectedLinkType) => {
        const labelA = view.formatLabel(a.linkType.label, a.linkType.id);
        const labelB = view.formatLabel(b.linkType.label, b.linkType.id);
        const labelCompareResult = labelA.localeCompare(labelB);
        if (labelCompareResult !== 0) {
            return labelCompareResult;
        }
        return (a.backwards ? 1 : 0) - (b.backwards ? 1 : 0);
    };
}

export function validateLinkType(
    currentLink: LinkModel,
    model: AsyncModel,
    temporaryState: TemporaryState,
    originalLink?: LinkModel
): Promise<Pick<LinkValue, 'error' | 'allowChange'>> {
    if (currentLink.linkTypeId === PLACEHOLDER_LINK_TYPE) {
        return Promise.resolve({error: 'Required.', allowChange: true});
    }
    if (originalLink && sameLink(currentLink, originalLink)) {
        return Promise.resolve({error: undefined, allowChange: true});
    }
    const alreadyOnDiagram = model.links.find(({data}) =>
        sameLink(data, currentLink) && !temporaryState.links.has(data)
    );
    if (alreadyOnDiagram) {
        return Promise.resolve({error: 'The link already exists.', allowChange: false});
    }
    return model.dataProvider.linksInfo({
        elementIds: [currentLink.sourceId, currentLink.targetId],
        linkTypeIds: [currentLink.linkTypeId],
    }).then((links): Pick<LinkValue, 'error' | 'allowChange'> => {
        const alreadyExists = links.some(link => sameLink(link, currentLink));
        return alreadyExists
            ? {error: 'The link already exists.', allowChange: false}
            : {error: undefined, allowChange: true};
    });
}
