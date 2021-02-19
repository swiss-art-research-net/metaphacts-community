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

import { ElementModel, LinkModel, sameLink } from '../data/model';

import { Cancellation, CancellationToken } from '../viewUtils/async';

import { ProgressBar, ProgressState } from '../widgets/progressBar';

import { WorkspaceContextWrapper, WorkspaceContextTypes } from '../workspace/workspaceContext';

import { LinkTypeSelector, LinkValue, validateLinkType } from './linkTypeSelector';

const CLASS_NAME = 'ontodia-edit-form';

export interface EditLinkFormProps {
    link: LinkModel;
    source: ElementModel;
    target: ElementModel;
    onChange: (entity: LinkModel) => void;
    onApply: (entity: LinkModel) => void;
    onCancel: () => void;
}

interface State {
    linkValue: LinkValue;
    isValidating?: boolean;
}

export class EditLinkForm extends React.Component<EditLinkFormProps, State> {
    static contextTypes = WorkspaceContextTypes;
    declare readonly context: WorkspaceContextWrapper;

    private validationCancellation = new Cancellation();

    constructor(props: EditLinkFormProps) {
        super(props);
        this.state = {
            linkValue: {
                link: props.link,
                generated: true,
                validated: true,
                allowChange: true,
            },
        };
    }

    componentDidMount() {
        this.validate();
    }

    componentDidUpdate(prevProps: EditLinkFormProps, prevState: State) {
        const {linkValue} = this.state;
        if (!sameLink(linkValue.link, prevState.linkValue.link)) {
            this.validate();
        }
        if (linkValue !== prevState.linkValue && linkValue.validated && linkValue.allowChange) {
            this.props.onChange(linkValue.link);
        }
    }

    componentWillUnmount() {
        this.validationCancellation.abort();
    }

    private async validate() {
        const {model, editor} = this.context.ontodiaWorkspace;
        const {metadataApi} = editor;
        const {source, target, link: originalLink} = this.props;
        const {linkValue: {link, generated}} = this.state;
        this.setState({isValidating: true});

        this.validationCancellation.abort();
        this.validationCancellation = new Cancellation();
        const signal = this.validationCancellation.signal;

        let regeneratedLink = link;
        if (metadataApi && !generated) {
            let generateSource = source;
            let generateTarget = target;
            if (link.sourceId !== source.id) {
                [generateSource, generateTarget] = [generateTarget, generateSource];
            }
            const generatedLink = await CancellationToken.mapCancelledToNull(
                signal,
                metadataApi.generateNewLink(generateSource, generateTarget, link.linkTypeId, signal)
            );
            if (generatedLink === null) { return; }
            regeneratedLink = generatedLink;
        }

        const error = await validateLinkType(regeneratedLink, model, editor.temporaryState, originalLink);
        if (signal.aborted) { return; }

        this.setState(({linkValue}) => ({
            linkValue: {
                ...linkValue,
                ...error,
                link: regeneratedLink,
                generated: true,
                validated: true,
            },
            isValidating: false,
        }));
    }

    render() {
        const {source, target} = this.props;
        const {linkValue, isValidating} = this.state;
        const linkIsReadyToApply = linkValue.generated && !linkValue.error;
        return (
            <div className={CLASS_NAME}>
                <div className={`${CLASS_NAME}__body`}>
                    <LinkTypeSelector linkValue={linkValue}
                        source={source}
                        target={target}
                        onChange={value => this.setState({
                            linkValue: {...value, error: undefined, validated: false, allowChange: false},
                        })}
                    />
                    {isValidating ? (
                        <div className={`${CLASS_NAME}__progress`}>
                            <ProgressBar state={ProgressState.loading} height={10} />
                        </div>
                    ) : null}
                </div>
                <div className={`${CLASS_NAME}__controls`}>
                    <button className={`ontodia-btn ontodia-btn-success ${CLASS_NAME}__apply-button`}
                        onClick={() => this.props.onApply(linkValue.link)}
                        disabled={!linkIsReadyToApply || isValidating}>
                        Apply
                    </button>
                    <button className='ontodia-btn ontodia-btn-danger'
                        onClick={this.props.onCancel}>
                        Cancel
                    </button>
                </div>
            </div>
        );
    }
}
