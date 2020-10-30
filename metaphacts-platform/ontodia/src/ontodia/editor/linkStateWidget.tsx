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

import { LinkModel } from '../data/model';

import { Vector, computePolyline, getPointAlongPolyline, computePolylineLength } from '../diagram/geometry';
import { TransformedSvgCanvas } from '../diagram/paper';
import { PaperWidgetProps } from '../diagram/paperArea';
import { Link } from '../diagram/elements';
import { RenderingLayer } from '../diagram/renderingState';
import { WidgetAttachment, assertWidgetComponent } from '../diagram/view';

import { Debouncer } from '../viewUtils/async';
import { EventObserver } from '../viewUtils/events';
import { HtmlSpinner } from '../viewUtils/spinner';

import { EditorController } from './editorController';

import { AuthoringKind, AuthoringState } from './authoringState';
import { LinkValidation, ElementValidation } from './validation';

export interface LinkStateWidgetProps extends PaperWidgetProps {
    editor: EditorController;
}

const CLASS_NAME = `ontodia-authoring-state`;
const LINK_LABEL_MARGIN = 5;

type RequiredProps = LinkStateWidgetProps & Required<PaperWidgetProps>;

export class LinkStateWidget extends React.Component<LinkStateWidgetProps, {}> {
    static readonly attachment = WidgetAttachment.OverLinks;
    static readonly key = 'linkStateWidget';

    private readonly listener = new EventObserver();
    private readonly delayedUpdate = new Debouncer();

    componentDidMount() {
        this.listenEvents();
    }

    componentWillUnmount() {
        this.listener.stopListening();
    }

    private listenEvents() {
        const {editor, renderingState} = this.props as RequiredProps;
        this.listener.listen(editor.model.events, 'elementEvent',  ({data}) => {
            if (data.changePosition) {
                this.scheduleUpdate();
            }
        });
        this.listener.listen(editor.model.events, 'linkEvent', ({data}) => {
            if (data.changeVertices) {
                this.scheduleUpdate();
            }
        });
        this.listener.listen(editor.model.events, 'changeCells', this.scheduleUpdate);
        this.listener.listen(editor.events, 'changeAuthoringState', this.scheduleUpdate);
        this.listener.listen(editor.events, 'changeTemporaryState', this.scheduleUpdate);
        this.listener.listen(editor.events, 'changeValidationState', this.scheduleUpdate);
        this.listener.listen(renderingState.events, 'changeElementSize', () => {
            this.scheduleUpdate();
        });
        this.listener.listen(renderingState.events, 'syncUpdate', ({layer}) => {
            if (layer === RenderingLayer.Editor) {
                this.delayedUpdate.runSynchronously();
            }
        });
        this.listener.listen(renderingState.events, 'changeLinkLabelBounds', this.scheduleUpdate);
    }

    private scheduleUpdate = () => {
        this.delayedUpdate.call(this.performUpdate);
    }

    private performUpdate = () => {
        this.forceUpdate();
    }

    private calculateLinkPath(link: Link) {
        const polyline = this.calculatePolyline(link);
        return 'M' + polyline.map(({x, y}) => `${x},${y}`).join(' L');
    }

    private calculatePolyline(link: Link) {
        const {editor, renderingState} = this.props as RequiredProps;

        const source = editor.model.getElement(link.sourceId)!;
        const target = editor.model.getElement(link.targetId)!;

        const route = renderingState.getRouting(link.id);
        const verticesDefinedByUser = link.vertices || [];
        const vertices = route ? route.vertices : verticesDefinedByUser;

        return computePolyline(source, target, vertices, renderingState);
    }

    private renderLinkStateLabels() {
        const {editor} = this.props;

        return editor.model.links.map(link => {
            let renderedState: JSX.Element | null = null;
            const state = editor.authoringState.links.get(link.data);
            if (state) {
                const onCancel = () => editor.discardChange(state);

                let statusText: string;
                let title: string;

                if (state.deleted) {
                    statusText = 'Delete';
                    title = 'Revert deletion of the link';
                } else if (!state.before) {
                    statusText = 'New';
                    title = 'Revert creation of the link';
                } else {
                    statusText = 'Change';
                    title = 'Revert all changes in properties of the link';
                }

                if (statusText && title) {
                    renderedState = (
                        <span>
                            <span className={`${CLASS_NAME}__state-label`}>{statusText}</span>
                            [<span className={`${CLASS_NAME}__state-cancel`}
                                    onClick={onCancel} title={title}>cancel</span>]
                        </span>
                    );
                }
            }

            const renderedErrors = this.renderLinkErrors(link.data);
            if (renderedState || renderedErrors) {
                const labelPosition = this.getLinkStateLabelPosition(link);
                if (!labelPosition) {
                    return null;
                }
                const style = {left: labelPosition.x, top: labelPosition.y};
                return <div className={`${CLASS_NAME}__state-indicator`}
                    key={link.id}
                    style={style}>
                    <div className={`${CLASS_NAME}__state-indicator-container`}>
                        <div className={`${CLASS_NAME}__state-indicator-body`}>
                            {renderedState}
                            {renderedErrors}
                        </div>
                    </div>
                </div>;
            } else {
                return null;
            }
        });
    }

    private renderLinkStateHighlighting() {
        const {editor} = this.props;
        return editor.model.links.map(link => {
            if (editor.temporaryState.links.has(link.data)) {
                const path = this.calculateLinkPath(link);
                return (
                    <path key={link.id} d={path} fill={'none'} stroke={'grey'} strokeWidth={5} strokeOpacity={0.5}
                        strokeDasharray={'8 8'} />
                );
            }
            const event = editor.authoringState.links.get(link.data);
            const isDeletedLink = AuthoringState.isDeletedLink(editor.authoringState, link.data);
            const isUncertainLink = AuthoringState.isUncertainLink(editor.authoringState, link.data);
            if (event || isDeletedLink || isUncertainLink) {
                const path = this.calculateLinkPath(link);
                let color: string | undefined;
                if (isDeletedLink) {
                    color = 'red';
                } else if (isUncertainLink) {
                    color = 'blue';
                } else if (event && event.type === AuthoringKind.ChangeLink) {
                    color = event.before ? 'blue' : 'green';
                }
                return (
                    <path key={link.id} d={path} fill={'none'} stroke={color} strokeWidth={5} strokeOpacity={0.5} />
                );
            }
            return null;
        });
    }

    private getLinkStateLabelPosition(link: Link): Vector {
        const {renderingState} = this.props as RequiredProps;
        const labelBounds = renderingState.getLinkLabelBounds(link);
        if (labelBounds) {
            const {x, y} = labelBounds;
            return {x, y: y - LINK_LABEL_MARGIN / 2};
        } else {
            const polyline = this.calculatePolyline(link);
            const polylineLength = computePolylineLength(polyline);
            return getPointAlongPolyline(polyline, polylineLength / 2);
        }
    }

    private renderLinkErrors(linkModel: LinkModel) {
        const {editor} = this.props;
        const {validationState} = editor;

        const validation = validationState.links.get(linkModel);
        if (!validation) {
            return null;
        }
        const title = validation.errors.map(error => error.message).join('\n');

        return this.renderErrorIcon(title, validation);
    }

    private renderErrorIcon(title: string, validation: LinkValidation | ElementValidation): JSX.Element {
        return <div className={`${CLASS_NAME}__item-error`} title={title}>
            {validation.loading
                ? <HtmlSpinner width={15} height={17} />
                : <div className={`${CLASS_NAME}__item-error-icon`} />}
            {(!validation.loading && validation.errors.length > 0)
                ? validation.errors.length : undefined}
        </div>;
    }

    render() {
        const {editor, paperTransform} = this.props as RequiredProps;
        const {scale, originX, originY} = paperTransform;
        if (!editor.inAuthoringMode) {
            return null;
        }
        const htmlTransformStyle: React.CSSProperties = {
            position: 'absolute', left: 0, top: 0,
            transform: `scale(${scale},${scale})translate(${originX}px,${originY}px)`,
        };
        return <div className={`${CLASS_NAME}`}>
            <TransformedSvgCanvas paperTransform={paperTransform} style={{overflow: 'visible', pointerEvents: 'none'}}>
                {this.renderLinkStateHighlighting()}
            </TransformedSvgCanvas>
            <div className={`${CLASS_NAME}__validation-layer`} style={htmlTransformStyle}>
                {this.renderLinkStateLabels()}
            </div>
        </div>;
    }
}

assertWidgetComponent(LinkStateWidget);
