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

import { ElementModel, LinkModel, LinkTypeIri } from '../data/model';

import { Element, Link } from '../diagram/elements';
import { Size, Vector } from '../diagram/geometry';
import { CreateLinkProps } from '../diagram/model';
import { PaperWidgetProps } from '../diagram/paperArea';
import { DiagramView, WidgetAttachment, assertWidgetComponent } from '../diagram/view';

import { EditEntityForm } from '../forms/editEntityForm';
import { EditElementTypeForm } from '../forms/editElementTypeForm';
import { EditLinkForm } from '../forms/editLinkForm';
import { EditLinkLabelForm } from '../forms/editLinkLabelForm';

import { CancellationToken } from '../viewUtils/async';
import { Events, EventSource, EventObserver } from '../viewUtils/events';
import { Spinner, SpinnerProps } from '../viewUtils/spinner';

import { Dialog, DialogProps } from '../widgets/dialog';

import { AuthoringState, TemporaryState } from './authoringState';
import { AsyncModel } from './asyncModel';
import { EditorController, SelectionItem } from './editorController';
import { EditLayer, EditLayerMode } from './editLayer';
import { ElementDecorator } from './elementDecorator';
import { LinkStateWidget } from './linkStateWidget';
import { getUriLocalName } from '../data/utils';

export interface OverlayControllerOptions {
    propertyEditor?: PropertyEditor;
    linkEditor?: LinkEditor;
}

export type PropertyEditor = (options: PropertyEditorOptions) => React.ReactElement<any> | null;
export interface PropertyEditorOptions {
    elementData: ElementModel;
    afterCreate: boolean;
    onFinish: () => void;
}

export type LinkEditor = (options: LinkEditorOptions) => React.ReactElement<any> | null;
export interface LinkEditorOptions {
    linkData: LinkModel;
    afterCreate: boolean;
    onFinish: () => void;
}

export interface OverlayControllerProps extends OverlayControllerOptions {
    readonly model: AsyncModel;
    readonly editor: EditorController;
    readonly view: DiagramView;
}

export interface OverlayControllerEvents {
    toggleDialog: { isOpened: boolean };
}

interface OpenedDialog {
    target: SelectionItem;
    allowClickOnPaper: boolean;
}

export class OverlayController {
    private readonly listener = new EventObserver();
    private readonly source = new EventSource<OverlayControllerEvents>();
    readonly events: Events<OverlayControllerEvents> = this.source;

    private readonly model: AsyncModel;
    private readonly editor: EditorController;
    private readonly view: DiagramView;
    private readonly options: OverlayControllerOptions;

    private openedDialog: OpenedDialog | undefined;

    constructor({model, editor, view, ...options}: OverlayControllerProps) {
        this.model = model;
        this.editor = editor;
        this.view = view;
        this.options = options;

        this.listener.listen(editor.events, 'itemClickCapture', event => {
            if (this.openedDialog && this.openedDialog.allowClickOnPaper) {
                event.cancel();
            }
        });
        this.listener.listen(editor.events, 'itemClick', event => {
            if (!event.target && event.triggerAsClick) {
                this.hideDialog();
                if (document.activeElement) {
                    (document.activeElement as HTMLElement).blur();
                }
            }
        });

        this.listener.listen(editor.events, 'changeSelection', event => {
            const selected = editor.selection.length === 1 ? editor.selection[0] : undefined;
            if (this.openedDialog && this.openedDialog.target !== selected) {
                this.hideDialog();
            }
        });

        this.listener.listen(this.model.events, 'loadingStart', () => this.setSpinner({}));
        this.listener.listen(this.model.events, 'loadingSuccess', () => {
            this.setSpinner(undefined);
            this.view.setWidget(LinkStateWidget.key, <LinkStateWidget />);
        });
        this.listener.listen(this.model.events, 'loadingError', ({error}) => {
            const statusText = error ? error.message : undefined;
            this.setSpinner({statusText, errorOccurred: true});
        });

        this.view._setElementDecorator((element, renderingState) =>
            <ElementDecorator model={element}
                view={this.view}
                renderingState={renderingState}
                editor={this.editor}
                position={element.position}
            />
        );
    }

    dispose() {
        this.listener.stopListening();
    }

    setSpinner(props: SpinnerProps | undefined) {
        const widget = props ? <LoadingWidget spinnerProps={props} /> : undefined;
        this.view.setWidget(LoadingWidget.key, widget);
    }

    showDialog(params: {
        target: SelectionItem;
        content: React.ReactElement<PaperWidgetProps>;
        allowClickOnPaper?: boolean;
        size?: Size;
        caption?: string;
        offset?: Vector;
        calculatePosition?: DialogProps['calculatePosition'];
        onClose: DialogProps['onClose'];
    }) {
        const {
            target,
            content,
            allowClickOnPaper = false,
            size,
            caption,
            offset,
            calculatePosition,
            onClose,
        } = params;

        this.openedDialog = {target, allowClickOnPaper};

        const dialog = (
            <Dialog view={this.view} target={target} caption={caption} onClose={onClose}
                defaultSize={size} offset={offset} calculatePosition={calculatePosition}>
                {content}
            </Dialog>
        );
        this.view.setWidget(Dialog.key, dialog);
        this.source.trigger('toggleDialog', {isOpened: true});
    }

    hideDialog() {
        if (this.openedDialog) {
            const {target} = this.openedDialog;
            const isTemporaryElement = target instanceof Element
                && this.editor.temporaryState.elements.has(target.iri);
            const isTemporaryLink = target instanceof Link
                && this.editor.temporaryState.links.has(target.data);
            if (isTemporaryElement || isTemporaryLink) {
                this.editor.discardTemporaryState();
            }
            this.openedDialog = undefined;
            this.view.setWidget(Dialog.key, undefined);
            this.source.trigger('toggleDialog', {isOpened: false});
        }
    }

    private removeTemporaryElement(element: Element) {
        const batch = this.model.history.startBatch();
        this.model.removeElement(element.id);
        batch.discard();
        this.editor.setTemporaryState(
            TemporaryState.deleteElement(this.editor.temporaryState, element.data)
        );
    }

    private removeTemporaryLink(link: Link) {
        this.model.removeLink(link.id);
        this.editor.setTemporaryState(
            TemporaryState.deleteLink(this.editor.temporaryState, link.data)
        );
    }

    startEditing(params: {
        target: Element | Link;
        mode: EditLayerMode;
        point: Vector;
        linkTypeIri?: LinkTypeIri;
        canDropOnCanvas?: boolean;
    }) {
        const {target, mode, point, linkTypeIri, canDropOnCanvas} = params;
        const onFinishEditing = () => {
            this.view.setWidget(EditLayer.key, undefined);
        };
        const editLayer = (
            <EditLayer mode={mode}
                linkTypeIri={linkTypeIri}
                target={target}
                point={point}
                canDropOnCanvas={canDropOnCanvas}
                onFinishEditing={onFinishEditing}
            />
        );
        this.view.setWidget(EditLayer.key, editLayer);
    }

    showEditEntityForm(target: Element, options: { afterCreate?: boolean } = {}) {
        const {propertyEditor} = this.options;
        const modifiedIri = AuthoringState.getElementModifiedIri(
            this.editor.authoringState, target.data.id
        );
        const modelToEdit: ElementModel = {
            ...target.data,
            id: typeof modifiedIri === 'string' ? modifiedIri : target.data.id,
        };
        const afterCreate = Boolean(options.afterCreate);
        const onFinish = () => this.hideDialog();
        const content = propertyEditor
            ? propertyEditor({elementData: target.data, afterCreate, onFinish})
            : <EditEntityForm entity={modelToEdit} onFinish={onFinish} />;
        if (content) {
            const type = target.data.types.length > 0
                ? this.model.getClass(target.data.types[0]) : undefined;
            const typeLabel = type ? this.view.formatLabel(type.label, type.id) : 'entity';
            this.showDialog({
                target,
                caption: afterCreate ? `Create ${typeLabel}` : `Edit ${typeLabel}`,
                content,
                allowClickOnPaper: true,
                onClose: onFinish,
            });
        }
    }

    async showEditLinkPropertiesForm(link: Link, options: { afterCreate?: boolean } = {}) {
        const {linkEditor} = this.options;
        const previousData = link.data;

        const source = this.model.getElement(link.sourceId)!.data;
        const target = this.model.getElement(link.targetId)!.data;
        const canEdit = await this.editor.metadataApi?.canEditLink(
            previousData, source, target, CancellationToken.NEVER_SIGNAL
        );

        if (linkEditor && canEdit) {
            const afterCreate = Boolean(options.afterCreate);
            const onFinish = () => {
                if (this.editor.temporaryState.links.has(link.data)) {
                    this.removeTemporaryLink(link);
                }
                this.hideDialog();
            };
            const content = linkEditor?.({linkData: link.data, afterCreate, onFinish});
            if (content) {
                const type = this.model.getLinkType(link.data.linkTypeId);
                const typeLabel = type ? this.view.formatLabel(type.label, type.id) : 'link';
                this.showDialog({
                    target: link,
                    caption: afterCreate ? `Create ${typeLabel}` : `Edit ${typeLabel}`,
                    content,
                    allowClickOnPaper: true,
                    onClose: onFinish,
                });
            }
        } else {
            this.editor.commitLink(previousData);
        }
    }

    showEditElementTypeForm({link, source, target, targetIsNew}: {
        link: Link;
        source: Element;
        target: Element;
        targetIsNew: boolean;
    }) {
        const onCancel = () => {
            this.removeTemporaryElement(target);
            this.removeTemporaryLink(link);
            this.hideDialog();
        };
        const content = (
            <EditElementTypeForm link={link.data}
                source={source.data}
                target={{value: target.data, isNew: targetIsNew}}
                onChangeElement={(data: ElementModel) => {
                    const previous = target.data;
                    this.editor.setTemporaryState(
                        TemporaryState.deleteElement(this.editor.temporaryState, previous)
                    );
                    target.setData(data);
                    this.editor.setTemporaryState(
                        TemporaryState.addElement(this.editor.temporaryState, data)
                    );
                }}
                onChangeLink={(data: LinkModel) => {
                    this.removeTemporaryLink(link);
                    const newLink = makeLinkWithDirection(getLinkProps(link), data);
                    link = this.editor.createNewLink({link: newLink, temporary: true});
                }}
                onApply={(elementData: ElementModel, isNewElement: boolean, linkData: LinkModel) => {
                    this.removeTemporaryElement(target);
                    this.removeTemporaryLink(link);

                    const batch = this.model.history.startBatch(
                        isNewElement ? 'Create new entity' : 'Link to entity'
                    );

                    this.model.addElement(target);
                    if (isNewElement) {
                        target.setExpanded(true);
                        this.editor.setAuthoringState(
                            AuthoringState.addElement(this.editor.authoringState, target.data)
                        );
                    } else {
                        this.model.requestLinksOfType();
                    }

                    const newLink = makeLinkWithDirection(getLinkProps(link), linkData);
                    this.editor.createNewLink({link: newLink});

                    batch.store();

                    this.hideDialog();
                    if (isNewElement) {
                        this.showEditEntityForm(target, {afterCreate: true});
                    }
                }}
                onCancel={onCancel}
            />
        );
        this.showDialog({target, content, caption: 'Establish New Connection', onClose: onCancel});
    }

    showEditLinkTypeForm(link: Link) {
        const source = this.model.getElement(link.sourceId);
        const target = this.model.getElement(link.targetId);
        if (!(source && target)) {
            return;
        }
        const onCancel = () => {
            if (this.editor.temporaryState.links.has(link.data)) {
                this.removeTemporaryLink(link);
            }
            this.hideDialog();
        };
        const content = (
            <EditLinkForm link={link.data}
                source={source.data}
                target={target.data}
                onChange={(data: LinkModel) => {
                    if (this.editor.temporaryState.links.has(link.data)) {
                        this.removeTemporaryLink(link);
                        const newLink = makeLinkWithDirection(getLinkProps(link), data);
                        this.showEditLinkTypeForm(
                            this.editor.createNewLink({link: newLink, temporary: true})
                        );
                    }
                }}
                onApply={(data: LinkModel) => {
                    if (this.editor.temporaryState.links.has(link.data)) {
                        this.showEditLinkPropertiesForm(link, {afterCreate: true});
                    } else {
                        this.editor.changeLink(link.data, data);
                    }
                    this.hideDialog();
                }}
                onCancel={onCancel}/>
        );
        const caption = this.editor.temporaryState.links.has(link.data)
            ? 'Establish New Connection' : 'Edit Connection';
        this.showDialog({
            target: link,
            content,
            size: {width: 300, height: 160},
            caption,
            onClose: onCancel,
        });
    }

    // Link editing implementation could be rethought in the future.
    showEditLinkLabelForm(link: Link) {
        const size = {width: 300, height: 145};
        const closeDialog = () => this.hideDialog();
        this.showDialog({
            target: link,
            content: (
                <EditLinkLabelForm link={link}
                    onDone={closeDialog}
                />
            ),
            size,
            caption: 'Edit Link Label',
            offset: {x: 25, y: - size.height / 2},
            calculatePosition: renderingState => {
                const bounds = renderingState.getLinkLabelBounds(link);
                if (!bounds) { return undefined; }
                const {x, y, width, height} = bounds;
                return {x: x + width, y: y + height / 2};
            },
            onClose: closeDialog,
        });
    }
}

interface LoadingWidgetProps extends PaperWidgetProps {
    spinnerProps: Partial<SpinnerProps>;
}

class LoadingWidget extends React.Component<LoadingWidgetProps, {}> {
    static readonly attachment = WidgetAttachment.Viewport;
    static readonly key = 'loadingWidget';

    render() {
        const {spinnerProps, paperArea} = this.props as LoadingWidgetProps & Required<PaperWidgetProps>;
        const areaMetrics = paperArea.getAreaMetrics();
        const paneWidth = areaMetrics.clientWidth;
        const paneHeight = areaMetrics.clientHeight;

        const x = spinnerProps.statusText ? paneWidth / 3 : paneWidth / 2;
        const position = {x, y: paneHeight / 2};
        return (
            <div className='ontodia-loading-widget'>
                <svg width={paneWidth} height={paneHeight}>
                    <Spinner position={position} {...spinnerProps} />
                </svg>
            </div>
        );
    }
}

assertWidgetComponent(LoadingWidget);

function getLinkProps(link: Link): CreateLinkProps {
    const {id, sourceId, targetId, data, vertices, linkState} = link;
    return {id, sourceId, targetId, data, vertices, linkState};
}

function makeLinkWithDirection(original: CreateLinkProps, data: LinkModel): CreateLinkProps {
    if (!(data.sourceId === original.data.sourceId || data.sourceId === original.data.targetId)) {
        throw new Error('New link source IRI is unrelated to original link');
    }
    if (!(data.targetId === original.data.sourceId || data.targetId === original.data.targetId)) {
        throw new Error('New link target IRI is unrelated to original link');
    }
    const sourceId = data.sourceId === original.data.sourceId
        ? original.sourceId : original.targetId;
    const targetId = data.targetId === original.data.targetId
        ? original.targetId : original.sourceId;
    return {...original, sourceId, targetId, data};
}
