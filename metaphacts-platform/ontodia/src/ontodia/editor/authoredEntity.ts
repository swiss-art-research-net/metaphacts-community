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

import { ElementModel } from '../data/model';
import { PaperAreaContextTypes, PaperAreaContextWrapper } from '../diagram/paperArea';
import { DiagramView } from '../diagram/view';

import { Cancellation, CancellationToken } from '../viewUtils/async';
import { Listener } from '../viewUtils/events';

import { WorkspaceContextTypes, WorkspaceContextWrapper } from '../workspace/workspaceContext';

import { AuthoringState, AuthoringKind } from './authoringState';
import { EditLayerMode } from './editLayer';
import { EditorEvents, EditorController } from './editorController';

export interface AuthoredEntityProps {
    elementId: string;
    updateOnlyExpanded?: boolean;
    children: (context: AuthoredEntityContext) => React.ReactElement<any>;
}

export interface AuthoredEntityContext {
    editor: EditorController;
    view: DiagramView;
    editedIri?: string;
    canEdit: boolean | undefined;
    canDelete: boolean | undefined;
    onEdit: () => void;
    onDelete: () => void;
    onEstablishNewLink: (e: React.MouseEvent<HTMLElement>) => void;
}

export interface State {
    canEdit?: boolean;
    canDelete?: boolean;
}

/**
 * Component to simplify tracking changes in validation messages (property and link type labels).
 */
export class AuthoredEntity extends React.Component<AuthoredEntityProps, State> {
    static contextTypes = {...WorkspaceContextTypes, ...PaperAreaContextTypes};
    declare readonly context: WorkspaceContextWrapper & PaperAreaContextWrapper;

    private queryCancellation = new Cancellation();
    private prevData: ElementModel | undefined;
    private wasExpanded?: boolean;

    constructor(props: AuthoredEntityProps, context: any) {
        super(props, context);
        this.state = {};
    }

    componentDidMount() {
        const {editor} = this.context.ontodiaWorkspace;
        editor.events.on('changeAuthoringState', this.onChangeAuthoringState);
        this.queryAllowedActions();
    }

    componentDidUpdate(prevProps: AuthoredEntityProps) {
        const target = this.getTarget();
        if (!target) { return; }

        const shouldUpdateAllowedActions = !(
            target.data === this.prevData &&
            target.isExpanded === this.wasExpanded
        );
        if (shouldUpdateAllowedActions) {
            this.prevData = target.data;
            this.wasExpanded = target.isExpanded;
            this.queryAllowedActions();
        }
    }

    componentWillUnmount() {
        const {editor} = this.context.ontodiaWorkspace;
        editor.events.off('changeAuthoringState', this.onChangeAuthoringState);
        this.queryCancellation.abort();
    }

    private getTarget() {
        const {editor} = this.context.ontodiaWorkspace;
        const {elementId} = this.props;
        return editor.model.getElement(elementId);
    }

    private onChangeAuthoringState: Listener<EditorEvents, 'changeAuthoringState'> = e => {
        const target = this.getTarget();
        if (!target) { return; }

        const {source: editor, previous} = e;
        const iri = target.iri;
        const current = editor.authoringState;
        if (current.elements.get(iri) !== previous.elements.get(iri)) {
            this.queryAllowedActions();
        }
    }

    private queryAllowedActions() {
        const {updateOnlyExpanded} = this.props;
        const target = this.getTarget();
        // only fetch whether it's allowed to edit when expanded
        if (!target || updateOnlyExpanded && !target.isExpanded) { return; }

        this.queryCancellation.abort();
        this.queryCancellation = new Cancellation();

        const {editor} = this.context.ontodiaWorkspace;

        if (
            !editor.metadataApi ||
            AuthoringState.isDeletedElement(editor.authoringState, target.data.id)
        ) {
            this.setState({canEdit: false, canDelete: false});
        } else {
            this.queryCanEdit(target.data);
            this.queryCanDelete(target.data);
        }
    }

    private queryCanEdit(data: ElementModel) {
        const {editor} = this.context.ontodiaWorkspace;
        const signal = this.queryCancellation.signal;
        this.setState({canEdit: undefined});
        CancellationToken.mapCancelledToNull(
            signal,
            editor.metadataApi!.canEditElement(data, signal),
        ).then(canEdit => {
            if (canEdit === null) { return; }
            this.setState({canEdit});
        });
    }

    private queryCanDelete(data: ElementModel) {
        const {editor} = this.context.ontodiaWorkspace;
        const signal = this.queryCancellation.signal;
        this.setState({canDelete: undefined});
        CancellationToken.mapCancelledToNull(
            signal,
            editor.metadataApi!.canDeleteElement(data, signal)
        ).then(canDelete => {
            if (canDelete === null) { return; }
            this.setState({canDelete});
        });
    }

    render() {
        const target = this.getTarget();
        if (!target) { return null; }

        const {children: renderTemplate} = this.props;
        const {editor, view} = this.context.ontodiaWorkspace;
        const {canEdit, canDelete} = this.state;

        const iri = target.iri;
        const elementEvent = editor.authoringState.elements.get(iri);
        const editedIri = elementEvent && elementEvent.type === AuthoringKind.ChangeElement ?
            elementEvent.newIri : undefined;

        return renderTemplate({
            editor,
            view,
            canEdit,
            canDelete,
            editedIri,
            onEdit: this.onEdit,
            onDelete: this.onDelete,
            onEstablishNewLink: this.onEstablishNewLink,
        });
    }

    private onEdit = () => {
        const {editor} = this.context.ontodiaWorkspace;
        const {elementId} = this.props;
        const element = editor.model.getElement(elementId);
        if (element) {
            editor.showEditEntityForm(element);
        }
    }

    private onDelete = () => {
        const target = this.getTarget();
        if (!target) { return; }

        const {editor} = this.context.ontodiaWorkspace;
        editor.deleteEntity(target.iri);
    }

    private onEstablishNewLink = (e: React.MouseEvent<HTMLElement>) => {
        const target = this.getTarget();
        if (!target) { return; }

        const {editor} = this.context.ontodiaWorkspace;
        const {paperArea} = this.context.ontodiaPaperArea;
        const point = paperArea.pageToPaperCoords(e.pageX, e.pageY);
        editor.startEditing({
            target, mode: EditLayerMode.establishLink, point,
        });
      }
}
