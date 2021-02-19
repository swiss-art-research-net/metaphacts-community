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

import { LinkTypeIri, ElementModel, sameLink, LinkModel } from '../data/model';
import { MetadataApi } from '../data/metadataApi';
import { PLACEHOLDER_ELEMENT_TYPE, PLACEHOLDER_LINK_TYPE } from '../data/schema';

import { CreateLinkProps } from '../diagram/model';
import { WidgetAttachment, assertWidgetComponent } from '../diagram/view';
import { LinkLayer, LinkMarkers } from '../diagram/linkLayer';
import { Element, Link } from '../diagram/elements';
import { boundsOf, Vector, findElementAtPoint } from '../diagram/geometry';
import { TransformedSvgCanvas } from '../diagram/paper';
import { PaperWidgetProps } from '../diagram/paperArea';
import { RenderingState } from '../diagram/renderingState';

import { Cancellation, CancellationToken } from '../viewUtils/async';
import { EventObserver } from '../viewUtils/events';
import { Spinner } from '../viewUtils/spinner';

import { WorkspaceContextWrapper, WorkspaceContextTypes } from '../workspace/workspaceContext';

import { TemporaryState } from './authoringState';
import { validateLinkType } from '../forms/linkTypeSelector';

export enum EditLayerMode {
    establishLink,
    moveLinkSource,
    moveLinkTarget,
}

export interface EditLayerProps extends PaperWidgetProps {
    mode: EditLayerMode;
    target: Element | Link;
    point: { x: number; y: number };
    linkTypeIri?: LinkTypeIri;
    canDropOnCanvas?: boolean;
    onFinishEditing: () => void;
}

interface State {
    targetElement?: Element;
    canDropOnCanvas?: boolean;
    canDropOnElement?: boolean;
    waitingForMetadata?: boolean;
}

type RequiredProps = EditLayerProps & Required<PaperWidgetProps>;

export class EditLayer extends React.Component<EditLayerProps, State> {
    static readonly attachment = WidgetAttachment.OverElements;
    static readonly key = 'editLayer';

    static contextTypes = WorkspaceContextTypes;
    declare readonly context: WorkspaceContextWrapper;

    private readonly listener = new EventObserver();
    private readonly cancellation = new Cancellation();

    private canDropOnElementCancellation = new Cancellation();

    private temporaryLink!: Link;
    private temporaryElement!: Element;
    private oldLink: Link | undefined;

    constructor(props: EditLayerProps) {
        super(props);
        this.state = {};
    }

    componentDidMount() {
        const {mode, target, point} = this.props;
        if (mode === EditLayerMode.establishLink) {
            this.beginCreatingLink({source: target as Element, point});
        } else if (mode === EditLayerMode.moveLinkSource || mode === EditLayerMode.moveLinkTarget) {
            this.beginMovingLink(target as Link, point);
        } else {
            throw new Error('Unknown edit mode');
        }
        this.forceUpdate();
        this.queryCanDropOnCanvas();
        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('mouseup', this.onMouseUp);
    }

    componentWillUnmount() {
        this.listener.stopListening();
        this.cancellation.abort();
        this.canDropOnElementCancellation.abort();
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('mouseup', this.onMouseUp);
    }

    private beginCreatingLink = (params: { source: Element; point: Vector }) => {
        const {model, editor} = this.context.ontodiaWorkspace;
        const {source, point} = params;

        const temporaryElement = this.createTemporaryElement(point);
        const linkTemplate: CreateLinkProps = {
            sourceId: source.id,
            targetId: temporaryElement.id,
            data: {
                linkTypeId: PLACEHOLDER_LINK_TYPE,
                sourceId: source.iri,
                targetId: temporaryElement.iri,
                properties: {},
            }
        };
        const temporaryLink = editor.createNewLink({link: linkTemplate, temporary: true});
        const fatLinkType = model.createLinkType(temporaryLink.typeId);
        fatLinkType.setVisibility({visible: true, showLabel: false});

        this.temporaryElement = temporaryElement;
        this.temporaryLink = temporaryLink;
    }

    private beginMovingLink(target: Link, startingPoint: Vector) {
        const {mode} = this.props;
        const {model, editor} = this.context.ontodiaWorkspace;

        if (!(mode === EditLayerMode.moveLinkSource || mode === EditLayerMode.moveLinkTarget)) {
            throw new Error('Unexpected edit mode for moving link');
        }

        this.oldLink = target;
        model.removeLink(target.id);
        const {sourceId, targetId, data, vertices, linkState} = target;

        const temporaryElement = this.createTemporaryElement(startingPoint);
        const linkTemplate: CreateLinkProps = {
            sourceId: mode === EditLayerMode.moveLinkSource ? temporaryElement.id : sourceId,
            targetId: mode === EditLayerMode.moveLinkTarget ? temporaryElement.id : targetId,
            data,
            vertices,
            linkState,
        };
        const temporaryLink = editor.createNewLink({link: linkTemplate, temporary: true});

        this.temporaryElement = temporaryElement;
        this.temporaryLink = temporaryLink;
    }

    private createTemporaryElement(point: Vector) {
        const {view} = this.context.ontodiaWorkspace;
        const temporaryElement = view.model.createTemporaryElement();
        temporaryElement.setPosition(point);

        return temporaryElement;
    }

    private onMouseMove = (e: MouseEvent) => {
        const {view, renderingState, paperArea} = this.props as RequiredProps;
        const {targetElement, waitingForMetadata} = this.state;

        e.preventDefault();
        e.stopPropagation();

        if (waitingForMetadata) { return; }

        const point = paperArea.pageToPaperCoords(e.pageX, e.pageY);
        this.temporaryElement.setPosition(point);

        const newTargetElement = findElementAtPoint(view.model.elements, point, renderingState);

        if (newTargetElement !== targetElement) {
            this.queryCanDropOnElement(newTargetElement);
        }
        this.setState({targetElement: newTargetElement});
    }

    private queryCanDropOnCanvas() {
        const {mode, canDropOnCanvas} = this.props;
        const {model, editor} = this.context.ontodiaWorkspace;
        const {metadataApi} = editor;

        if (!metadataApi || mode !== EditLayerMode.establishLink || canDropOnCanvas === false) {
            this.setState({canDropOnCanvas: false});
            return;
        }

        this.setState({canDropOnCanvas: undefined});

        const source = model.getElement(this.temporaryLink.sourceId)!;
        CancellationToken.mapCancelledToNull(
            this.cancellation.signal,
            metadataApi.canConnect(source.data, null, null, this.cancellation.signal)
        ).then(
            canDropOnCanvasResult => {
                if (canDropOnCanvasResult === null) { return; }
                this.setState({canDropOnCanvas: canDropOnCanvasResult});
            },
            error => {
                // tslint:disable-next-line: no-console
                console.error('Error calling canDropOnCanvas:', error);
                this.setState({canDropOnCanvas: false});
            }
        );
    }

    private async queryCanDropOnElement(targetElement: Element | undefined) {
        const {mode, linkTypeIri} = this.props;
        const {model, editor} = this.context.ontodiaWorkspace;
        const {metadataApi} = editor;

        this.canDropOnElementCancellation.abort();
        this.canDropOnElementCancellation = new Cancellation();

        if (!(metadataApi && targetElement)) {
            this.setState({canDropOnElement: false});
            return;
        }

        this.setState({canDropOnElement: undefined});

        const linkType = this.temporaryLink.typeId === PLACEHOLDER_LINK_TYPE
            ? (linkTypeIri ?? null) : this.temporaryLink.typeId;
        let source: ElementModel;
        let target: ElementModel;
        switch (mode) {
            case EditLayerMode.establishLink:
            case EditLayerMode.moveLinkTarget: {
                source = model.getElement(this.temporaryLink.sourceId)!.data;
                target = targetElement.data;
                break;
            }
            case EditLayerMode.moveLinkSource: {
                source = targetElement.data;
                target = model.getElement(this.temporaryLink.targetId)!.data;
                break;
            }
        }

        const newLinkModel: LinkModel = {
            ...this.temporaryLink.data,
            sourceId: source.id,
            targetId: target.id,
            linkTypeId: linkType ?? PLACEHOLDER_LINK_TYPE,
        };
        const signal = this.canDropOnElementCancellation.signal;
        const result = await CancellationToken.mapCancelledToNull(
            signal,
            Promise.all([
                validateLinkType(newLinkModel, model, editor.temporaryState),
                metadataApi.canConnect(source, target, linkType, signal)
            ])
        );
        if (result === null) { return; }
        const [validationResult, canDrop] = result;

        this.setState({canDropOnElement: canDrop && validationResult.allowChange});
    }

    private onMouseUp = (e: MouseEvent) => {
        if (this.state.waitingForMetadata) { return; }
        // show spinner while waiting for additional MetadataApi queries
        this.setState({waitingForMetadata: true});
        const {paperArea} = this.props as RequiredProps;
        const selectedPosition = paperArea.pageToPaperCoords(e.pageX, e.pageY);
        this.executeEditOperation(selectedPosition);
    }

    private async executeEditOperation(selectedPosition: Vector): Promise<void> {
        const {renderingState, mode, linkTypeIri} = this.props as RequiredProps;
        const {model, editor, overlayController} = this.context.ontodiaWorkspace;

        try {
            const {targetElement: existingTargetElement, canDropOnCanvas, canDropOnElement} = this.state;

            if (this.oldLink) {
                model.addLink(this.oldLink);
            }

            const canDrop = existingTargetElement ? canDropOnElement : canDropOnCanvas;
            if (canDrop) {
                let modifiedLink: Link | undefined;
                let targetElement: Element | undefined = existingTargetElement;

                switch (mode) {
                    case EditLayerMode.establishLink: {
                        if (!targetElement) {
                            const source = model.getElement(this.temporaryLink.sourceId)!;
                            targetElement = await this.createNewElement(source.data);
                            if (!targetElement) {
                                // new element creation was cancelled
                                return;
                            }
                            centerElementAtPoint(targetElement, selectedPosition, renderingState);
                        }
                        const sourceElement = model.getElement(this.temporaryLink.sourceId)!;
                        modifiedLink = await this.createNewLink(sourceElement, targetElement, linkTypeIri);
                        break;
                    }
                    case EditLayerMode.moveLinkSource: {
                        modifiedLink = editor.moveLinkSource({link: this.oldLink!, newSource: existingTargetElement!});
                        break;
                    }
                    case EditLayerMode.moveLinkTarget: {
                        modifiedLink = editor.moveLinkTarget({link: this.oldLink!, newTarget: existingTargetElement!});
                        break;
                    }
                    default: {
                        throw new Error('Unknown edit mode');
                    }
                }

                if (existingTargetElement && linkTypeIri) {
                    if (modifiedLink) {
                        editor.setSelection([modifiedLink]);
                        overlayController.showEditLinkPropertiesForm(modifiedLink, {afterCreate: true});
                    }
                } else if (existingTargetElement) {
                    const focusedLink = modifiedLink || this.oldLink;
                    if (focusedLink) {
                        editor.setSelection([focusedLink]);
                        overlayController.showEditLinkTypeForm(focusedLink);
                    }
                } else if (targetElement && modifiedLink) {
                    editor.setSelection([targetElement]);
                    const source = model.getElement(modifiedLink.sourceId)!;
                    overlayController.showEditElementTypeForm({
                        link: modifiedLink,
                        source,
                        target: targetElement,
                        targetIsNew: true,
                    });
                }
            }
        } finally {
            this.cleanupAndFinish();
        }
    }

    private makeTemporaryLinkAlive(link: Link) {
        const {editor, model} = this.context.ontodiaWorkspace;
        model.removeLink(link.id);
        editor.setTemporaryState(
            TemporaryState.deleteLink(editor.temporaryState, link.data)
        );
        return editor.createNewLink({link, temporary: false});
    }

    private createNewElement = async (source: ElementModel): Promise<Element | undefined> => {
        const {editor} = this.context.ontodiaWorkspace;
        const {metadataApi} = editor;
        const elementTypes = await CancellationToken.mapCancelledToNull(
            this.cancellation.signal,
            metadataApi!.typesOfElementsDraggedFrom(source, this.cancellation.signal)
        );
        if (elementTypes === null) { return undefined; }
        const classId = elementTypes.length === 1 ? elementTypes[0] : PLACEHOLDER_ELEMENT_TYPE;
        const elementModel = await CancellationToken.mapCancelledToNull(
            this.cancellation.signal,
            metadataApi!.generateNewElement([classId], this.cancellation.signal)
        );
        if (elementModel === null) { return; }
        return editor.createNewEntity({elementModel, temporary: true});
    }

    private async createNewLink(
        source: Element, target: Element, selectedLinkType?: LinkTypeIri
    ): Promise<Link | undefined> {
        const {model, editor} = this.context.ontodiaWorkspace;
        const {metadataApi} = editor;
        if (!metadataApi) {
            return undefined;
        }

        let suggestedLinkType = selectedLinkType;
        if (!suggestedLinkType) {
            const suggestion = await CancellationToken.mapCancelledToNull(
                this.cancellation.signal,
                suggestLinkType(source, target, metadataApi, this.cancellation.signal)
            );
            if (suggestion === null) { return undefined; }
            if (suggestion.backwards) {
                // switches source and target if the direction equals 'in'
                [source, target] = [target, source];
            }

            suggestedLinkType = suggestion.linkType;
            if (model.findLink(suggestion.linkType, source.id, target.id)) {
                suggestedLinkType = PLACEHOLDER_LINK_TYPE;
            }
        }

        const linkModel = await CancellationToken.mapCancelledToNull(
            this.cancellation.signal,
            metadataApi.generateNewLink(
                source.data,
                target.data,
                suggestedLinkType,
                this.cancellation.signal
            )
        );
        if (linkModel === null) { return undefined; }
        const existingLink = model.findLink(
            linkModel.linkTypeId, source.id, target.id, linkModel.linkIri
        );
        return existingLink || editor.createNewLink({
            link: {sourceId: source.id, targetId: target.id, data: linkModel},
            temporary: true,
        });
    }

    private cleanupAndFinish() {
        const {onFinishEditing} = this.props;
        const {model, editor} = this.context.ontodiaWorkspace;

        const batch = model.history.startBatch();
        model.removeElement(this.temporaryElement.id);
        model.removeLink(this.temporaryLink.id);
        editor.setTemporaryState(
            TemporaryState.deleteLink(editor.temporaryState, this.temporaryLink.data)
        );
        batch.discard();

        onFinishEditing();
    }

    render() {
        const {view, renderingState, paperTransform} = this.props as RequiredProps;
        const {waitingForMetadata} = this.state;

        if (!this.temporaryLink) { return null; }

        return (
            <TransformedSvgCanvas paperTransform={paperTransform} style={{overflow: 'visible'}}>
                <LinkMarkers model={view.model} renderingState={renderingState} />
                {this.renderHighlight()}
                {this.renderCanDropIndicator()}
                {waitingForMetadata ? null : (
                    <LinkLayer
                        view={view}
                        renderingState={renderingState}
                        links={[this.temporaryLink]}
                    />
                )}
            </TransformedSvgCanvas>
        );
    }

    private renderHighlight() {
        const {renderingState} = this.props as RequiredProps;
        const {targetElement, canDropOnElement, waitingForMetadata} = this.state;

        if (!targetElement) { return null; }

        const {x, y, width, height} = boundsOf(targetElement, renderingState);

        if (canDropOnElement === undefined || waitingForMetadata) {
            return (
                <g transform={`translate(${x},${y})`}>
                    <rect width={width} height={height} fill={'white'} fillOpacity={0.5} />
                    <Spinner size={30} position={{x: width / 2, y: height / 2}}/>
                </g>
            );
        }

        const stroke = canDropOnElement ? '#5cb85c' : '#c9302c';
        return (
            <rect x={x} y={y} width={width} height={height} fill={'transparent'} stroke={stroke} strokeWidth={3} />
        );
    }

    private renderCanDropIndicator() {
        const {targetElement, canDropOnCanvas, waitingForMetadata} = this.state;

        if (targetElement) { return null; }

        const {x, y} = this.temporaryElement.position;

        let indicator: React.ReactElement<any>;
        if (canDropOnCanvas === undefined) {
            indicator = <Spinner size={1.2} position={{x: 0.5, y: -0.5}} />;
        } else if (canDropOnCanvas) {
            indicator = <path d='M0.5,0 L0.5,-1 M0,-0.5 L1,-0.5' strokeWidth={0.2} stroke='#5cb85c' />;
        } else {
            indicator = (
                <g>
                    <circle cx='0.5' cy='-0.5' r='0.5' fill='none' strokeWidth={0.2} stroke='#c9302c' />
                    <path d='M0.5,0 L0.5,-1' strokeWidth={0.2} stroke='#c9302c' transform='rotate(-45 0.5 -0.5)' />
                </g>
            );
        }

        return (
            <g transform={`translate(${x} ${y})scale(40)`}>
                <rect x={-0.5} y={-0.5} width={1} height={1} fill='rgba(0, 0, 0, 0.1)' rx={0.25} ry={0.25} />
                {waitingForMetadata
                    ? <Spinner size={0.8} />
                    : <g transform={`translate(${0.5}, -${0.5})scale(${0.25})`}>{indicator}</g>}
            </g>
        );
    }
}

assertWidgetComponent(EditLayer);

function centerElementAtPoint(element: Element, point: Vector, renderingState: RenderingState) {
    element.setPosition(point);
    renderingState.performSyncUpdate();
    const {width, height} = renderingState.getElementSize(element);
    element.setPosition({
        x: point.x - width / 2,
        y: point.y - height / 2,
    });
}

async function suggestLinkType(
    source: Element,
    target: Element,
    metadataApi: MetadataApi,
    ct: CancellationToken
): Promise<{ linkType: LinkTypeIri; backwards: boolean } | null> {
    const [forwardTypes, backwardTypes] = await Promise.all([
        metadataApi.possibleLinkTypes(source.data, target.data, ct),
        metadataApi.possibleLinkTypes(target.data, source.data, ct)
    ]);

    let linkType = PLACEHOLDER_LINK_TYPE;
    let backwards = false;

    if (forwardTypes.length > 0) {
        linkType = forwardTypes[0];
    } else if (backwardTypes.length > 0) {
        linkType = backwardTypes[0];
        backwards = true;
    }
    return {linkType, backwards};
}
