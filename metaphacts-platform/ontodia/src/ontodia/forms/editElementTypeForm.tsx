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

import { ElementModel, LinkModel } from '../data/model';

import { Cancellation, CancellationToken } from '../viewUtils/async';
import { HtmlSpinner } from '../viewUtils/spinner';

import { ProgressBar, ProgressState } from '../widgets/progressBar';

import { WorkspaceContextWrapper, WorkspaceContextTypes } from '../workspace/workspaceContext';

import { ElementTypeSelector, ElementValue, validateElementType } from './elementTypeSelector';
import { LinkTypeSelector, LinkValue, validateLinkType } from './linkTypeSelector';

const CLASS_NAME = 'ontodia-edit-form';

export interface EditElementTypeFormProps {
    link: LinkModel;
    source: ElementModel;
    target: {
        value: ElementModel;
        isNew: boolean;
    };
    onChangeElement: (value: ElementModel) => void;
    onChangeLink: (value: LinkModel) => void;
    onApply: (elementData: ElementModel, isNewElement: boolean, linkData: LinkModel) => void;
    onCancel: () => void;
}

interface State {
    elementValue: ElementValue;
    linkValue: LinkValue;
    isValidating?: boolean;
}

export class EditElementTypeForm extends React.Component<EditElementTypeFormProps, State> {
    static contextTypes = WorkspaceContextTypes;
    declare readonly context: WorkspaceContextWrapper;

    private validationCancellation = new Cancellation();

    constructor(props: EditElementTypeFormProps) {
        super(props);
        const {target, link} = this.props;
        this.state = {
            elementValue: {
                value: target.value,
                isNew: target.isNew,
                loading: false,
                validated: true,
                allowChange: true,
            },
            linkValue: {
                link,
                generated: !target.isNew,
                validated: true,
                allowChange: true,
            },
        };
    }

    componentDidMount() {
        this.validate();
    }

    componentWillUnmount() {
        this.validationCancellation.abort();
    }

    private setElementOrLink({elementValue, linkValue}: {
        elementValue?: ElementValue;
        linkValue?: LinkValue;
    }) {
        this.setState(state => ({
            elementValue: elementValue || state.elementValue,
            linkValue: linkValue || state.linkValue,
        }),
        () => {
            if ((elementValue && !elementValue.validated) || (linkValue && !linkValue.validated)) {
                this.validate();
            }
            if (elementValue && elementValue.validated && elementValue.allowChange) {
                this.props.onChangeElement(elementValue.value);
            }
            if (linkValue && linkValue.validated && linkValue.allowChange) {
                this.props.onChangeLink(linkValue.link);
            }
        });
    }

    private async validate() {
        const {model, editor} = this.context.ontodiaWorkspace;
        const {metadataApi} = editor;
        const {source, link: originalLink} = this.props;
        const {elementValue, linkValue} = this.state;
        this.setState({isValidating: true});

        this.validationCancellation.abort();
        this.validationCancellation = new Cancellation();
        const signal = this.validationCancellation.signal;

        let regeneratedLink = linkValue.link;
        if (metadataApi && !linkValue.generated) {
            let generateSource = source;
            let generateTarget = elementValue.value;
            if (linkValue.link.sourceId !== source.id) {
                [generateSource, generateTarget] = [generateTarget, generateSource];
            }
            const generatedLink = await CancellationToken.mapCancelledToNull(
                signal,
                metadataApi.generateNewLink(
                    generateSource,
                    generateTarget,
                    linkValue.link.linkTypeId,
                    signal
                )
            );
            if (generatedLink === null) { return; }
            regeneratedLink = generatedLink;
        }

        const [elementError, linkError] = await Promise.all([
            validateElementType(elementValue.value),
            validateLinkType(regeneratedLink, model, editor.temporaryState, originalLink)
        ]);
        if (signal.aborted) { return; }
        this.setState({isValidating: false});
        this.setElementOrLink({
            elementValue: {...elementValue, ...elementError, validated: true},
            linkValue: {
                ...linkValue,
                ...linkError,
                link: regeneratedLink,
                generated: true,
                validated: true,
            },
        });
    }

    render() {
        const {source, link: originalLink} = this.props;
        const {elementValue, linkValue, isValidating} = this.state;
        const isValid = !elementValue.error && !linkValue.error;
        return (
            <div className={CLASS_NAME}>
                <div className={`${CLASS_NAME}__body`}>
                    <ElementTypeSelector source={source}
                        elementValue={elementValue}
                        onChange={newState => {
                            this.setElementOrLink({
                                elementValue: {
                                    value: newState.value,
                                    isNew: newState.isNew,
                                    loading: newState.loading,
                                    error: undefined,
                                    validated: false,
                                    allowChange: false,
                                },
                                linkValue: {
                                    link: {...originalLink, targetId: newState.value.id},
                                    generated: false,
                                    validated: false,
                                    allowChange: false,
                                },
                            });
                        }} />
                    {elementValue.loading ? (
                        <div style={{display: 'flex'}}>
                            <HtmlSpinner width={20} height={20} />&nbsp;Loading entity...
                        </div>
                    ) : (
                        <LinkTypeSelector linkValue={linkValue}
                            source={source}
                            target={elementValue.value}
                            onChange={value => this.setElementOrLink({
                                linkValue: {...value, error: undefined, validated: false, allowChange: false},
                            })}
                            disabled={elementValue.error !== undefined}
                        />
                    )}
                    {isValidating ? (
                        <div className={`${CLASS_NAME}__progress`}>
                            <ProgressBar state={ProgressState.loading} height={10} />
                        </div>
                    ) : null}
                </div>
                <div className={`${CLASS_NAME}__controls`}>
                    <button className={`ontodia-btn ontodia-btn-success ${CLASS_NAME}__apply-button`}
                        onClick={() => this.props.onApply(
                            elementValue.value,
                            elementValue.isNew,
                            linkValue.link
                        )}
                        disabled={elementValue.loading || !isValid || isValidating}>
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
