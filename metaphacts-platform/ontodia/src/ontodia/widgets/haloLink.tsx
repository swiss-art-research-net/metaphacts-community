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

import { Element, Link } from '../diagram/elements';
import { computePolyline, computePolylineLength, getPointAlongPolyline, Vector } from '../diagram/geometry';
import { PaperWidgetProps } from '../diagram/paperArea';
import { WidgetAttachment, assertWidgetComponent } from '../diagram/view';

import { AuthoringState } from '../editor/authoringState';
import { EditLayerMode } from '../editor/editLayer';

import { EventObserver } from '../viewUtils/events';
import { Cancellation, CancellationToken, Debouncer } from '../viewUtils/async';
import { HtmlSpinner } from '../viewUtils/spinner';

import { WorkspaceContextWrapper, WorkspaceContextTypes } from '../workspace/workspaceContext';

const CLASS_NAME = 'ontodia-halo-link';
const BUTTON_SIZE = 20;
const BUTTON_MARGIN = 5;

export interface HaloLinkProps extends PaperWidgetProps {
    id?: string;
}

export interface State {
    target?: Link;
    canDelete?: boolean;
    canEdit?: boolean;
}

type RequiredProps = HaloLinkProps & Required<PaperWidgetProps>;

export class HaloLink extends React.Component<HaloLinkProps, State> {
    static defaultProps: Partial<HaloLinkProps> = {
        id: 'halo-link',
    };

    static contextTypes = WorkspaceContextTypes;
    declare readonly context: WorkspaceContextWrapper;

    static attachment = WidgetAttachment.OverElements;

    private readonly listener = new EventObserver();
    private targetListener = new EventObserver();
    private queryDebouncer = new Debouncer();
    private queryCancellation = new Cancellation();

    constructor(props: HaloLinkProps) {
        super(props);
        this.state = {};
    }

    private updateAll = () => this.forceUpdate();

    componentDidMount() {
        const {editor} = this.context.ontodiaWorkspace;
        this.listener.listen(editor.events, 'changeAuthoringState', () => {
            this.queryAllowedActions();
        });
        this.listener.listen(editor.events, 'changeSelection', () => {
            const selection = editor.selection.length === 1 ? editor.selection[0] : undefined;
            this.setState({
                target: selection instanceof Link ? selection : undefined,
            });
        });
    }

    componentDidUpdate(prevProps: HaloLinkProps, prevState: State) {
        const {target} = this.state;
        if (target !== prevState.target) {
            this.listenToTarget(target);
            this.queryAllowedActions();
        }
    }

    componentWillUnmount() {
        this.listener.stopListening();
        this.listenToTarget(undefined);
        this.queryDebouncer.dispose();
        this.queryCancellation.abort();
    }

    private queryAllowedActions() {
        this.queryDebouncer.call(() => {
            this.queryCancellation.abort();
            this.queryCancellation = new Cancellation();
            this.queryCanDelete(this.state.target);
            this.queryCanEdit(this.state.target);
        });
    }

    private queryCanDelete(link: Link | undefined) {
        if (!link) { return; }

        const {editor} = this.context.ontodiaWorkspace;
        const {view} = this.props as RequiredProps;
        const metadataApi = editor.metadataApi;
        if (!metadataApi) {
            this.setState({canDelete: false});
            return;
        }
        if (isSourceOrTargetDeleted(editor.authoringState, link)) {
            this.setState({canDelete: false});
        } else {
            this.setState({canDelete: undefined});
            const source = view.model.getElement(link.sourceId)!;
            const target = view.model.getElement(link.targetId)!;
            const signal = this.queryCancellation.signal;
            CancellationToken.mapCancelledToNull(
                signal,
                metadataApi.canDeleteLink(link.data, source.data, target.data, signal)
            ).then(canDelete => {
                if (canDelete === null) { return; }
                if (this.state.target!.id === link.id) {
                    this.setState({canDelete});
                }
            });
        }
    }

    private queryCanEdit(link: Link | undefined) {
        if (!link) { return; }

        const {editor} = this.context.ontodiaWorkspace;
        const {view} = this.props as RequiredProps;
        const metadataApi = editor.metadataApi;
        if (!metadataApi) {
            this.setState({canEdit: false});
            return;
        }
        if (isDeletedLink(editor.authoringState, link)) {
            this.setState({canEdit: false});
        } else {
            this.setState({canEdit: undefined});
            const source = view.model.getElement(link.sourceId)!;
            const target = view.model.getElement(link.targetId)!;
            const signal = this.queryCancellation.signal;
            CancellationToken.mapCancelledToNull(
                signal,
                metadataApi.canEditLink(link.data, source.data, target.data, signal)
            ).then(canEdit => {
                if (canEdit === null) { return; }
                if (this.state.target!.id === link.id) {
                    this.setState({canEdit});
                }
            });
        }
    }

    private listenToTarget(link: Link | undefined) {
        const {view, renderingState} = this.props as RequiredProps;

        this.targetListener.stopListening();
        if (link) {
            const source = view.model.getElement(link.sourceId)!;
            const target = view.model.getElement(link.targetId)!;

            this.targetListener.listen(source.events, 'changePosition', this.updateAll);
            this.targetListener.listen(target.events, 'changePosition', this.updateAll);
            this.targetListener.listen(renderingState.events, 'changeElementSize', e => {
                if (e.source === source || e.source === target) {
                    this.updateAll();
                }
            });
            this.targetListener.listen(renderingState.events, 'changeLinkLabelBounds', e => {
                if (e.source === link) {
                    this.updateAll();
                }
            });
            this.targetListener.listen(link.events, 'changeVertices', this.updateAll);
        }
    }

    private paperToScrollablePaneCoords(point: Vector): Vector {
        const {paperArea} = this.props as RequiredProps;
        return paperArea.paperToScrollablePaneCoords(point.x, point.y);
    }

    private computePolyline(target: Link): ReadonlyArray<Vector> | undefined {
        const {view, renderingState} = this.props as RequiredProps;

        const sourceElement = view.model.getElement(target.sourceId);
        const targetElement = view.model.getElement(target.targetId);

        if (!(sourceElement && targetElement)) {
            return undefined;
        }

        const route = renderingState.getRouting(target.id);
        const verticesDefinedByUser = target.vertices || [];
        const vertices = route ? route.vertices : verticesDefinedByUser;

        return computePolyline(sourceElement, targetElement, vertices, renderingState);
    }

    private calculateDegree(source: Vector, target: Vector): number {
        const x = target.x - source.x;
        const y = target.y - source.y;
        const r = Math.sqrt(x * x + y * y);
        const unit = {x: x / r, y: y / r};
        return Math.atan2(unit.y, unit.x) * (180 / Math.PI);
    }

    private onSourceMove = (e: React.MouseEvent<HTMLElement>) => {
        e.preventDefault();
        if (e.button !== 0 /* left button */) { return; }
        const {editor} = this.context.ontodiaWorkspace;
        const {paperArea} = this.props as RequiredProps;
        const target = this.state.target!;
        const point = paperArea.pageToPaperCoords(e.pageX, e.pageY);
        editor.startEditing({target, mode: EditLayerMode.moveLinkSource, point});
    }

    private renderSourceButton(polyline: ReadonlyArray<Vector>) {
        const {editor} = this.context.ontodiaWorkspace;
        const target = this.state.target!;
        const point = getPointAlongPolyline(polyline, 0);
        const {x, y} = this.paperToScrollablePaneCoords(point);

        const top = y - BUTTON_SIZE / 2;
        const left = x - BUTTON_SIZE / 2;

        return (
            <button className={`${CLASS_NAME}__button`}
                style={{top, left, cursor: editor.inAuthoringMode ? undefined : 'default'}}
                disabled={isDeletedLink(editor.authoringState, target)}
                onMouseDown={editor.inAuthoringMode ? this.onSourceMove : undefined}>
                <svg width={BUTTON_SIZE} height={BUTTON_SIZE}>
                    <g transform={`scale(${BUTTON_SIZE})`}>
                        <circle r={0.5} cx={0.5} cy={0.5} fill='#198AD3' />
                    </g>
                </svg>
            </button>
        );
    }

    private onTargetMove = (e: React.MouseEvent<HTMLElement>) => {
        e.preventDefault();
        if (e.button !== 0 /* left button */) { return; }
        const {editor} = this.context.ontodiaWorkspace;
        const {paperArea} = this.props as RequiredProps;
        const target = this.state.target!;
        const point = paperArea.pageToPaperCoords(e.pageX, e.pageY);
        editor.startEditing({target, mode: EditLayerMode.moveLinkTarget, point});
    }

    private getButtonPosition(polyline: ReadonlyArray<Vector>, index: number): { top: number; left: number } {
        const polylineLength = computePolylineLength(polyline);
        const point = getPointAlongPolyline(polyline, polylineLength - (BUTTON_SIZE + BUTTON_MARGIN) * index);
        const {x, y} = this.paperToScrollablePaneCoords(point);

        return {top: y - BUTTON_SIZE / 2, left: x - BUTTON_SIZE / 2};
    }

    private renderTargetButton(target: Link, polyline: ReadonlyArray<Vector>) {
        const {editor} = this.context.ontodiaWorkspace;
        const {top, left} = this.getButtonPosition(polyline, 0);

        const {length} = polyline;
        const degree = this.calculateDegree(polyline[length - 1], polyline[length - 2]);

        return (
            <button className={`${CLASS_NAME}__button`}
                style={{top, left, cursor: editor.inAuthoringMode ? undefined : 'default'}}
                disabled={isDeletedLink(editor.authoringState, target)}
                onMouseDown={editor.inAuthoringMode ? this.onTargetMove : undefined}>
                <svg width={BUTTON_SIZE} height={BUTTON_SIZE} style={{transform: `rotate(${degree}deg)`}}>
                    <g transform={`scale(${BUTTON_SIZE})`}>
                        <polygon points={'0,0.5 1,1 1,0'} fill='#198AD3' />
                    </g>
                </svg>
            </button>
        );
    }

    private renderEditButton(polyline: ReadonlyArray<Vector>) {
        const {canEdit} = this.state;
        const style = this.getButtonPosition(polyline, 1);
        if (canEdit === undefined) {
            return (
                <div className={`${CLASS_NAME}__spinner`} style={style}>
                    <HtmlSpinner width={20} height={20} />
                </div>
            );
        }
        const title = canEdit ? 'Edit link' : 'Editing is unavailable for the selected link';
        return (
            <button className={`${CLASS_NAME}__button ${CLASS_NAME}__edit`} style={style} title={title}
                onClick={this.onEdit} disabled={!canEdit} />
        );
    }

    private renderDeleteButton(polyline: ReadonlyArray<Vector>) {
        const {canDelete} = this.state;
        const style = this.getButtonPosition(polyline, 2);
        if (canDelete === undefined) {
            return (
                <div className={`${CLASS_NAME}__spinner`} style={style}>
                    <HtmlSpinner width={20} height={20} />
                </div>
            );
        }
        const title = canDelete ? 'Delete link' : 'Deletion is unavailable for the selected link';
        return (
            <button className={`${CLASS_NAME}__button ${CLASS_NAME}__delete`} style={style} title={title}
                onClick={this.onDelete} disabled={!canDelete} />
        );
    }

    // Link editing implementation could be rethought in the future.
    private renderEditLabelButton(target: Link) {
        const {view, renderingState, paperArea} = this.props as RequiredProps;

        const linkType = view.model.getLinkType(target.typeId)!;
        const template = renderingState.createLinkTemplate(linkType);
        const labelBounds = renderingState.getLinkLabelBounds(target);

        if (!template.setLinkLabel || !labelBounds) {
            return null;
        }

        const {x, y, width, height} = labelBounds;
        const {x: left, y: top} = paperArea.paperToScrollablePaneCoords(x + width, y + height / 2);
        const size = {width: 15, height: 17};
        const style = {width: size.width, height: size.height, top: top - size.height / 2, left};
        return <button className={`${CLASS_NAME}__edit-label-button`} style={style} onClick={this.onEditLabel}
            title={'Edit Link Label'} />;
    }

    private renderLabelHighlighter(target: Link) {
        const {renderingState, paperArea} = this.props as RequiredProps;

        const labelBounds = renderingState.getLinkLabelBounds(target);
        if (!labelBounds) { return null; }

        const {x, y, width, height} = labelBounds;
        const {x: x0} = paperArea.paperToScrollablePaneCoords(x, y);
        const {x: x1, y: y1} = paperArea.paperToScrollablePaneCoords(x + width, y + height);
        return <div
            className={`${CLASS_NAME}__label-highlighter`}
            style={{width: (x1 - x0), left: x0, top: y1}}
        />;
    }

    render() {
        const {editor} = this.context.ontodiaWorkspace;
        const {target} = this.state;

        if (!target) { return null; }

        const metadataApi = editor.metadataApi;
        const polyline = this.computePolyline(target);
        if (!polyline) { return null; }

        const isAuthoringMode = Boolean(metadataApi);
        const deleteButton = (
            isDeletedByItself(editor.authoringState, target) ||
            isSourceOrTargetDeleted(editor.authoringState, target) ? null : this.renderDeleteButton(polyline)
        );

        return (
            <div className={`${CLASS_NAME}`}>
                {this.renderTargetButton(target, polyline)}
                {this.renderSourceButton(polyline)}
                {!isAuthoringMode || isDeletedLink(editor.authoringState, target)
                    ? null : this.renderEditButton(polyline)}
                {isAuthoringMode ? deleteButton : null}
                {this.renderEditLabelButton(target)}
                {this.renderLabelHighlighter(target)}
            </div>
        );
    }

    private onDelete = () => {
        const {editor} = this.context.ontodiaWorkspace;
        const target = this.state.target!;
        editor.deleteLink(target.data);
    }

    private onEdit = () => {
        const {editor} = this.context.ontodiaWorkspace;
        const target = this.state.target!;
        editor.showEditLinkForm(target);
    }

    private onEditLabel = () => {
        const {editor} = this.context.ontodiaWorkspace;
        const target = this.state.target!;
        editor.showEditLinkLabelForm(target);
    }
}

assertWidgetComponent(HaloLink);

function isDeletedLink(state: AuthoringState, link: Link) {
    return isDeletedByItself(state, link) || isSourceOrTargetDeleted(state, link);
}

function isDeletedByItself(state: AuthoringState, link: Link) {
    const event = state.links.get(link.data);
    return event && event.deleted;
}

function isSourceOrTargetDeleted(state: AuthoringState, link: Link) {
    const sourceEvent = state.elements.get(link.data.sourceId);
    const targetEvent = state.elements.get(link.data.targetId);
    return (
        sourceEvent && sourceEvent.deleted ||
        targetEvent && targetEvent.deleted
    );
}
