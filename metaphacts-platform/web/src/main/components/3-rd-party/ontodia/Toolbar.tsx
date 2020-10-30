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
import { cloneElement } from 'react';
import { Button, ButtonGroup } from 'react-bootstrap';
import * as classnames from 'classnames';
import {
  CommandHistory, NonRememberingHistory, EventObserver, WidgetDock, WorkspaceContextWrapper,
  WorkspaceContextTypes, CanvasContextWrapper, CanvasContextTypes, getCanvasWidgetPosition,
  InternalApi, EventSource, CanvasCommands,
} from 'ontodia';

import { Component, ContextTypes, ComponentContext } from 'platform/api/components';
import { VocabPlatform } from 'platform/api/rdf/vocabularies';
import { Permissions } from 'platform/api/services/security';
import { ConfigHolder } from 'platform/api/services/config-holder';
import { getPreferredUserLanguage } from 'platform/api/services/language';

import { HasPermission } from 'platform/components/security/HasPermission';
import { isValidChild } from 'platform/components/utils';

import { OntodiaContextWrapper, OntodiaContextTypes } from './OntodiaContext';
import { SaveButton } from './SaveButton';
import { subscribeOnCanvasCommands } from './Canvas';

import * as styles from './Toolbar.scss';
export const ToolbarStyles = styles;

/**
 * Controls to produce actions with canvas and data.
 */
export interface ToolbarConfig {
  /**
   * Unique ID, should be used to have multiple toolbars on the same canvas.
   */
  id?: string;
  /**
   * Canvas ID, should be used to send commands to a specific canvas.
   */
  canvasId?: string;
  /**
   * Position on the canvas.
   * @default 'nw'
   */
  dock?: WidgetDock;
  /**
   * Margin.
   * @default 10
   */
  margin?: number;
  /**
   * Custom controls.
   */
  children?: JSX.Element | ReadonlyArray<JSX.Element>;
}

export interface ToolbarProps extends ToolbarConfig {
 paperArea?: InternalApi.PaperArea;
}

export interface ToolbarCommand {
  readonly enabled: boolean;
  readonly title: string;
  readonly invoke: () => void;
}

export class Toolbar<P extends ToolbarProps = ToolbarProps, S = {}> extends Component<P, S> {
  static contextTypes = {
    ...ContextTypes,
    ...WorkspaceContextTypes,
    ...OntodiaContextTypes,
    ...CanvasContextTypes,
  };
  readonly context: ComponentContext & WorkspaceContextWrapper & OntodiaContextWrapper &
    CanvasContextWrapper;

  protected readonly listener = new EventObserver();

  protected readonly canvasCommands: EventSource<CanvasCommands>;

  constructor(props: P, context: any) {
    super(props, context);
    if (this.context.ontodiaCanvas) {
      this.canvasCommands = this.context.ontodiaCanvas.canvas.getCommands();
    } else {
      this.canvasCommands = new EventSource();
      subscribeOnCanvasCommands(this.canvasCommands, this.props);
    }
  }

  componentDidMount() {
    const {view} = this.context.ontodiaWorkspace;
    const history = view.model.history;
    if (history) {
        this.listener.listen(history.events, 'historyChanged', () => {
            this.forceUpdate();
        });
    }
  }

  render() {
    const {view} = this.context.ontodiaWorkspace;
    const {children} = this.props;
    const style = this.getPosition();
    if (children) {
      return (
        <div className={styles.component} style={style}>
          {this.mapChildren(children)}
        </div>
      );
    }
    const history = view.model.history;
    const {redo, undo} = this.getUndoRedoCommands(history);
    return (
        <div className={styles.component} style={style}>
          <HasPermission permission={
              Permissions.toLdp('container', VocabPlatform.OntodiaDiagramContainer, 'create', 'any')
            }>
            <ButtonGroup bsSize='small' className={styles.group}>
              <SaveButton />
            </ButtonGroup>
          </HasPermission>
          {undo && redo ? (
            <ButtonGroup bsSize='small' className={styles.group}>
                <Button className='ontodia-btn ontodia-btn-default' title={undo.title}
                        disabled={!undo.enabled} onClick={undo.invoke}>
                    <span className='fa fa-undo' aria-hidden='true'/>
                </Button>
                <Button className='ontodia-btn ontodia-btn-default' title={redo.title}
                        disabled={!redo.enabled} onClick={redo.invoke}>
                    <span className='fa fa-repeat' aria-hidden='true'/>
                </Button>
            </ButtonGroup>
          ) : null}
          <ButtonGroup bsSize='small' className={styles.group}>
            <Button type='button' className='ontodia-btn ontodia-btn-default'
                    onClick={this.onForceLayout}>
                <span title='Force layout' className='fa fa-snowflake-o' aria-hidden='true' />
            </Button>
            {this.context.ontodiaWorkspace.onClearAll ? (
              <Button onClick={this.context.ontodiaWorkspace.onClearAll}>
                <span className='fa fa-trash' aria-hidden='true' />&nbsp;Clear All
              </Button>
            ) : null}
            <Button title='Zoom In' onClick={this.onZoomIn}>
                <span className='fa fa-search-plus' aria-hidden='true'/>
            </Button>
            <Button title='Zoom Out' onClick={this.onZoomOut}>
                <span className='fa fa-search-minus' aria-hidden='true'/>
            </Button>
            <Button title='Fit to Screen' onClick={this.onZoomToFit}>
                <span className='fa fa-arrows-alt' aria-hidden='true'/>
            </Button>
            <Button title='Export diagram as PNG' onClick={this.onExportPng}>
                <span className='fa fa-picture-o' aria-hidden='true'/>&nbsp;PNG
            </Button>
            <Button title='Export diagram as SVG' onClick={this.onExportSvg}>
                <span className='fa fa-picture-o' aria-hidden='true'/>&nbsp;SVG
            </Button>
            <Button title='Print diagram' onClick={this.onPrint}>
                <span className='fa fa-print' aria-hidden='true'/>
            </Button>
          </ButtonGroup>
          {this.renderLanguages()}
      </div>
    );
  }

  protected mapChildren(children: React.ReactNode): React.ReactNode {
    return React.Children.map(children, child => {
      if (isValidChild(child)) {
        const button = this.renderButton(child);
        if (button) {
          return button;
        }
        return cloneElement(child, {children: this.mapChildren(child.props.children)})
      }
      return child;
    });
  }

  protected renderButton(
    element: JSX.Element
  ): JSX.Element | ReadonlyArray<JSX.Element> | undefined {
    const {onSaveDiagram} = this.context.ontodiaContext;
    const {view, onClearAll} = this.context.ontodiaWorkspace;
    const history = view.model.history;
    const {redo, undo} = this.getUndoRedoCommands(history);
    switch (element.props.name) {
      case 'save': {
        return cloneElement(element, {onClick: onSaveDiagram});
      }
      case 'undo': {
        if (!undo) { return element; }
        return cloneElement(element, {disabled: !undo.enabled, onClick: undo.invoke});
      }
      case 'redo': {
        if (!redo) { return element; }
        return cloneElement(element, {disabled: !redo.enabled, onClick: redo.invoke});
      }
      case 'forceLayout': return cloneElement(element, {onClick: this.onForceLayout});
      case 'clearAll': return cloneElement(element, {onClick: onClearAll});
      case 'zoomIn': return cloneElement(element, {onClick: this.onZoomIn});
      case 'zoomOut': return cloneElement(element, {onClick: this.onZoomOut});
      case 'zoomToFit': return cloneElement(element, {onClick: this.onZoomToFit});
      case 'exportPng': return cloneElement(element, {onClick: this.onExportPng});
      case 'exportSvg': return cloneElement(element, {onClick: this.onExportSvg});
      case 'print': return cloneElement(element, {onClick: this.onPrint});
      default: return undefined;
    }
  }

  protected renderLanguages() {
    const {view} = this.context.ontodiaWorkspace;
    const languages = getLanguages();
    if (languages.length <= 1) { return null; }
    const selectedLanguage = view.getLanguage();
    return (
      <ButtonGroup bsSize='small' className={classnames(styles.group, styles.languageSelector)}>
        <label>
          <span>Data Language&nbsp;-&nbsp;</span>
          <select value={selectedLanguage} onChange={this.onChangeLanguage}>
            {languages.map(({code, label}) => <option key={code} value={code}>{label}</option>)}
          </select>
        </label>
      </ButtonGroup>
    );
  }

  protected getUndoRedoCommands(history: CommandHistory) {
    let undo: ToolbarCommand;
    let redo: ToolbarCommand;
    if (history && !(history instanceof NonRememberingHistory)) {
        const undoCommand = last(history.undoStack);
        undo = {
            title: (undoCommand && undoCommand.title) ? `Undo (${undoCommand.title})` : 'Undo',
            enabled: Boolean(undoCommand),
            invoke: () => history.undo(),
        };
        const redoCommand = last(history.redoStack);
        redo = {
            title: (redoCommand && redoCommand.title) ? `Redo (${redoCommand.title})` : 'Redo',
            enabled: Boolean(redoCommand),
            invoke: () => history.redo(),
        };
    }

    return {undo, redo};
  }

  protected onExportPng = () => {
    this.canvasCommands.trigger('exportPng', {
      fileName: undefined,
      backgroundColor: 'whitesmoke'
    });
  }
  protected onExportSvg = () => {
    this.canvasCommands.trigger('exportSvg', {fileName: undefined});
  }

  protected onChangeLanguage = (event: React.SyntheticEvent<HTMLSelectElement>) => {
    const value = event.currentTarget.value;
    this.context.ontodiaWorkspace.onChangeLanguage(value);
  }

  protected onForceLayout = () => {
    this.canvasCommands.trigger('forceLayout', {});
  }

  protected onZoomIn = () => {
    this.canvasCommands.trigger('zoomIn', {});
  }

  protected onZoomOut = () => {
    this.canvasCommands.trigger('zoomOut', {});
  }

  protected onZoomToFit = () => {
    this.canvasCommands.trigger('zoomToFit', {});
  }

  protected onPrint = () => {
    this.canvasCommands.trigger('print', {});
  }

  protected getPosition(): React.CSSProperties | undefined {
    const {paperArea, dock, margin} = this.props;
    const isWidget = paperArea !== undefined;
    if (isWidget) {
      return getCanvasWidgetPosition({dock, margin});
    }
    return undefined;
  }
}

function last<T>(array: ReadonlyArray<T>): T | undefined {
  return array.length > 0 ? array[array.length - 1] : undefined;
}

function getLanguages(): ReadonlyArray<{ code: string; label: string }> {
  const preferredLanguage = getPreferredUserLanguage();
  const globalLanguages = ConfigHolder.getUIConfig().preferredLanguages.map(lang => {
    return {code: lang, label: lang};
  });
  return globalLanguages.length > 0
    ? globalLanguages
    : [{code: preferredLanguage, label: preferredLanguage}];
}
