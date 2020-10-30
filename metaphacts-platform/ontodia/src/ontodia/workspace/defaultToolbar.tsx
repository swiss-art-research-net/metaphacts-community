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

import { WidgetDock, getCanvasWidgetPosition } from '../diagram/canvasWidget';
import { PaperWidgetProps } from '../diagram/paperArea';
import { WidgetAttachment, assertWidgetComponent } from '../diagram/view';

import { EventTrigger, EventObserver } from '../viewUtils/events';
import { AuthoringState } from '../editor/authoringState';

import { CanvasCommands } from './canvas';
import { WorkspaceLanguage } from './workspace';
import { WorkspaceContextWrapper, WorkspaceContextTypes } from './workspaceContext';

export interface DefaultToolbarProps extends PaperWidgetProps {
    id?: string;
    dock?: WidgetDock;
    margin?: number;
    canvasCommands: EventTrigger<CanvasCommands>;
    diagramName?: string;
    languages?: ReadonlyArray<WorkspaceLanguage>;
    /** Saves diagram layout (position and state of elements and links). */
    onSaveDiagram?: () => void;
    /** Persists authored changes in the editor. */
    onPersistChanges?: () => void;
}

const CLASS_NAME = 'ontodia-toolbar';

type RequiredProps = DefaultToolbarProps & Required<PaperWidgetProps> &
    Required<Pick<DefaultToolbarProps,
        'id' | 'dock' | 'margin' | 'diagramName' | 'languages'
    >>;

export class DefaultToolbar extends React.Component<DefaultToolbarProps, {}> {
    static defaultProps: Partial<DefaultToolbarProps> = {
        id: 'toolbar',
        dock: 'nw',
        margin: 10,
        diagramName: 'diagram',
        languages: [
            {code: 'en', label: 'English'},
            {code: 'de', label: 'German'},
            {code: 'ru', label: 'Russian'},
        ],
    };

    static contextTypes = WorkspaceContextTypes;
    declare readonly context: WorkspaceContextWrapper;

    static attachment = WidgetAttachment.Viewport;

    private readonly listener = new EventObserver();

    componentDidMount() {
        const {editor} = this.getContext();
        this.listener.listen(editor.events, 'changeAuthoringState', () => {
            this.forceUpdate();
        });
    }

    componentWillUnmount() {
        this.listener.stopListening();
    }

    private onChangeLanguage = (event: React.SyntheticEvent<HTMLSelectElement>) => {
        const value = event.currentTarget.value;
        this.getContext().onChangeLanguage(value);
    }

    private renderSaveDiagramButton() {
        if (!this.props.onSaveDiagram) { return null; }
        return (
            <button type='button' className='saveDiagramButton ontodia-btn ontodia-btn-primary'
                disabled={this.canPersistChanges()}
                onClick={this.props.onSaveDiagram}>
                <span className='fa fa-floppy-o' aria-hidden='true' /> Save diagram
            </button>
        );
    }

    private renderPersistAuthoredChangesButton() {
        const {onPersistChanges} = this.props;
        if (!onPersistChanges) { return null; }
        return (
            <button type='button' className='saveDiagramButton ontodia-btn ontodia-btn-success'
                disabled={this.canPersistChanges() === false}
                onClick={onPersistChanges}>
                <span className='fa fa-floppy-o' aria-hidden='true' /> Save data
            </button>
        );
    }

    private renderLanguages() {
        const {view} = this.getContext();
        const {languages} = this.props as RequiredProps;
        if (languages.length <= 1) { return null; }
        const selectedLanguage = view.getLanguage();
        return (
            <span className={`ontodia-btn-group ${CLASS_NAME}__language-selector`}>
                <label className='ontodia-label'><span>Data Language - </span></label>
                <select value={selectedLanguage} onChange={this.onChangeLanguage}>
                    {languages.map(({code, label}) => <option key={code} value={code}>{label}</option>)}
                </select>
            </span>
        );
    }

    render() {
        const {paperArea, dock, margin} = this.props as RequiredProps;
        const isWidget = paperArea !== undefined;
        const style = isWidget ? getCanvasWidgetPosition({dock, margin}) : undefined;
        return (
            <div className={CLASS_NAME} style={style}>
                <div className='ontodia-btn-group ontodia-btn-group-sm'>
                    {this.renderSaveDiagramButton()}
                    {this.renderPersistAuthoredChangesButton()}
                    {this.getContext().onClearAll ? (
                        <button type='button' className='ontodia-btn ontodia-btn-default'
                            title='Clear All' onClick={this.getContext().onClearAll}>
                            <span className='fa fa-trash' aria-hidden='true'/>&nbsp;Clear All
                        </button>
                    ) : null}
                    <button type='button' className='ontodia-btn ontodia-btn-default'
                            title='Force layout' onClick={this.onForceLayout}>
                        <span className='fa fa-sitemap' aria-hidden='true'/> Layout
                    </button>
                    <button type='button' className='ontodia-btn ontodia-btn-default'
                            title='Zoom In' onClick={this.onZoomIn}>
                        <span className='fa fa-search-plus' aria-hidden='true'/>
                    </button>
                    <button type='button' className='ontodia-btn ontodia-btn-default'
                            title='Zoom Out' onClick={this.onZoomOut}>
                        <span className='fa fa-search-minus' aria-hidden='true'/>
                    </button>
                    <button type='button' className='ontodia-btn ontodia-btn-default'
                            title='Fit to Screen' onClick={this.onZoomToFit}>
                        <span className='fa fa-arrows-alt' aria-hidden='true'/>
                    </button>
                    <button type='button' className='ontodia-btn ontodia-btn-default'
                            title='Export diagram as PNG' onClick={this.onExportPng}>
                        <span className='fa fa-picture-o' aria-hidden='true'/> PNG
                    </button>
                    <button type='button' className='ontodia-btn ontodia-btn-default'
                            title='Export diagram as SVG' onClick={this.onExportSvg}>
                        <span className='fa fa-picture-o' aria-hidden='true'/> SVG
                    </button>
                    <button type='button' className='ontodia-btn ontodia-btn-default'
                            title='Print diagram' onClick={this.onPrint}>
                        <span className='fa fa-print' aria-hidden='true'/>
                    </button>
                    {this.renderLanguages()}
                </div>
            </div>
        );
    }

    private canPersistChanges(): boolean {
        const {editor} = this.getContext();
        const {onPersistChanges} = this.props;
        return onPersistChanges ? !AuthoringState.isEmpty(editor.authoringState) : false;
    }

    private getContext() {
        return this.context.ontodiaWorkspace;
    }

    private onZoomIn = () => {
        this.props.canvasCommands.trigger('zoomIn', {});
    }

    private onZoomOut = () => {
        this.props.canvasCommands.trigger('zoomOut', {});
    }

    private onZoomToFit = () => {
        this.props.canvasCommands.trigger('zoomToFit', {});
    }

    private onExportSvg = () => {
        const fileName = `${this.props.diagramName}.svg`;
        this.props.canvasCommands.trigger('exportSvg', {fileName});
    }

    private onExportPng = () => {
        const fileName = `${this.props.diagramName}.png`;
        this.props.canvasCommands.trigger('exportPng', {fileName});
    }

    private onPrint = () => {
        this.props.canvasCommands.trigger('print', {});
    }

    private onForceLayout = () => {
        this.props.canvasCommands.trigger('forceLayout', {});
    }
}

assertWidgetComponent(DefaultToolbar);
