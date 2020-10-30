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
import { ReactElement } from 'react';
import * as ReactDOM from 'react-dom';

import { TypeStyleResolver } from '../customization/props';

import { MetadataApi } from '../data/metadataApi';
import { ValidationApi } from '../data/validationApi';

import { CommandHistory, NonRememberingHistory } from '../diagram/history';
import { DiagramView, IriClickHandler, LabelLanguageSelector, IriClickEvent } from '../diagram/view';

import { AsyncModel, GroupBy } from '../editor/asyncModel';
import { EditorController, PropertyEditor } from '../editor/editorController';

import { EventSource, EventObserver } from '../viewUtils/events';
import { forceLayout } from '../viewUtils/layout';

import { PropertySuggestionHandler } from '../widgets/connectionsMenu';

import { CanvasMethods } from './canvas';
import { DefaultWorkspaceLayout } from './defaultWorkspaceLayout';
import {
    WorkspaceContext, WorkspaceContextTypes, WorkspaceContextWrapper, WorkspaceEventHandler, WorkspaceEventKey,
    WorkspaceCommands,
} from './workspaceContext';
import { Rdf } from '../data/rdf';

export interface WorkspaceProps {
    /** @default true */
    hideTutorial?: boolean;

    /**
     * Currently selected language.
     */
    language?: string;
    /**
     * Called when user selected another language from the UI.
     *
     * If this function is set, language selection will work in controlled mode;
     * otherwise language selection will function in uncontrolled mode.
     */
    onLanguageChange?: (language: string) => void;

    history?: CommandHistory;
    groupBy?: GroupBy[];

    /**
     * RDF/JS data factory to create IRI, Literal and other terms.
     */
    factory?: Rdf.DataFactory;
    /**
     * If provided, switches editor into "authoring mode".
     */
    metadataApi?: MetadataApi;
    validationApi?: ValidationApi;
    propertyEditor?: PropertyEditor;

    typeStyleResolver?: TypeStyleResolver;
    /**
     * Overrides label selection based on target language.
     */
    selectLabelLanguage?: LabelLanguageSelector;
    suggestProperties?: PropertySuggestionHandler;
    /**
     * @default
     * (e) => window.open(e.iri, '_blank')
     */
    onIriClick?: IriClickHandler;
    onWorkspaceEvent?: WorkspaceEventHandler;

    children?: ReactElement<any> | ReadonlyArray<ReactElement<any>>;
}

export interface WorkspaceLanguage {
    code: string;
    label: string;
}

export interface WorkspaceMethods {
    getModel(): AsyncModel;
    getDiagram(): DiagramView;
    getEditor(): EditorController;
    showWaitIndicatorWhile(operation: Promise<any>): void;
    undo(): void;
    redo(): void;
    clearAll(): void;
    changeLanguage(language: string): void;
    forEachCanvas(callback: (canvas: CanvasMethods) => void): void;
    forAnyCanvas(callback: (canvas: CanvasMethods) => void): void;
}

type RequiredProps = WorkspaceProps & Required<Pick<WorkspaceProps, 'hideTutorial' | 'language'>>;

export class Workspace extends React.Component<WorkspaceProps, {}> implements WorkspaceMethods {
    static readonly defaultProps: Partial<WorkspaceProps> = {
        hideTutorial: true,
        language: 'en',
    };

    static childContextTypes = WorkspaceContextTypes;

    private readonly listener = new EventObserver();

    private readonly model: AsyncModel;
    private readonly view: DiagramView;
    private readonly editor: EditorController;

    private readonly commands = new EventSource<WorkspaceCommands>();

    constructor(props: WorkspaceProps) {
        super(props);

        const {
            history, factory, metadataApi, validationApi, propertyEditor, groupBy,
            typeStyleResolver, selectLabelLanguage, suggestProperties, onIriClick, language,
        } = this.props as RequiredProps;

        this.model = new AsyncModel(
            factory ?? Rdf.OntodiaDataFactory,
            history ?? new NonRememberingHistory(),
            groupBy ?? [],
        );
        this.view = new DiagramView(this.model, {
            typeStyleResolver,
            selectLabelLanguage,
            onIriClick: onIriClick ?? defaultIriClickHandler,
        });
        this.editor = new EditorController({
            model: this.model,
            view: this.view,
            suggestProperties,
            validationApi,
            propertyEditor,
        });
        this.editor.setMetadataApi(metadataApi);

        this.view.setLanguage(language);
        this.state = {};
    }

    getChildContext(): WorkspaceContextWrapper {
        const ontodiaWorkspace: WorkspaceContext = {
            view: this.view,
            editor: this.editor,
            onClearAll: this.onClearAll,
            onChangeLanguage: this.onChangeLanguage,
            triggerWorkspaceEvent: this.triggerWorkspaceEvent,
            workspaceCommands: this.commands,
        };
        return {ontodiaWorkspace};
    }

    render(): ReactElement<any> {
        const {children} = this.props;
        return (
            <div className='ontodia'>
                <div className='ontodia__workspace'>
                    {children || <DefaultWorkspaceLayout />}
                </div>
            </div>
        );
    }

    componentDidMount() {
        const {onWorkspaceEvent} = this.props;

        this.listener.listen(this.model.events, 'layoutGroupContent', ({group}) => {
            this.forAnyCanvas(canvas => {
                canvas.performLayout(forceLayout, {group});
            });
        });

        if (onWorkspaceEvent) {
            this.listener.listen(this.editor.events, 'changeSelection', () =>
                onWorkspaceEvent(WorkspaceEventKey.editorChangeSelection)
            );
            this.listener.listen(this.editor.events, 'toggleDialog', () =>
                onWorkspaceEvent(WorkspaceEventKey.editorToggleDialog)
            );
            this.listener.listen(this.editor.events, 'addElements', () =>
                onWorkspaceEvent(WorkspaceEventKey.editorAddElements)
            );
        }
    }

    componentWillReceiveProps(nextProps: WorkspaceProps) {
        const controlledLanguage = Boolean(nextProps.onLanguageChange);
        if (controlledLanguage && nextProps.language !== this.view.getLanguage()) {
            this.view.setLanguage((nextProps as RequiredProps).language);
        }

        if (nextProps.metadataApi !== this.editor.metadataApi) {
            this.editor.setMetadataApi(nextProps.metadataApi);
        }
    }

    componentWillUnmount() {
        this.listener.stopListening();
        this.view.dispose();
    }

    getModel() { return this.model; }
    getDiagram() { return this.view; }
    getEditor() { return this.editor; }

    showWaitIndicatorWhile(operation: Promise<any>) {
        this.editor.setSpinner({});
        if (operation) {
            operation.then(() => {
                this.editor.setSpinner(undefined);
            }).catch(error => {
                // tslint:disable-next-line:no-console
                console.error(error);
                this.editor.setSpinner({statusText: 'Unknown error occured', errorOccured: true});
            });
        }
    }

    undo() {
        this.model.history.undo();
    }

    redo() {
        this.model.history.redo();
    }

    clearAll() {
        this.editor.removeItems([...this.model.elements]);
    }

    changeLanguage(language: string) {
        const {onLanguageChange} = this.props;
        // if language is in controlled mode we'll just forward the change
        if (onLanguageChange) {
            onLanguageChange(language);
        } else {
            this.view.setLanguage(language);
            // since we have toolbar dependent on language, we're forcing update here
            this.forceUpdate();
        }
    }

    forEachCanvas(callback: (canvas: CanvasMethods) => void): void {
        this.commands.trigger('forEachCanvas', {callback});
    }

    forAnyCanvas(callback: (canvas: CanvasMethods) => void): void {
        this.commands.trigger('forAnyCanvas', {callback, handled: false});
    }

    private triggerWorkspaceEvent = (key: WorkspaceEventKey) => {
        const {onWorkspaceEvent} = this.props;
        if (onWorkspaceEvent) {
            onWorkspaceEvent(key);
        }
    }

    private onClearAll = () => {
        this.clearAll();
    }

    private onChangeLanguage = (language: string) => {
        this.changeLanguage(language);
    }
}

function defaultIriClickHandler(e: IriClickEvent) {
    window.open(e.iri, '_blank');
}

export function renderTo<WorkspaceComponentProps>(
    workspace: React.ComponentClass<WorkspaceComponentProps>,
    container: HTMLElement,
    props: WorkspaceComponentProps,
) {
    const WorkspaceClass = workspace;
    ReactDOM.render(<WorkspaceClass {...props} />, container);
}
