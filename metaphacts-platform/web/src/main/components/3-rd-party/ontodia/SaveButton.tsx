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
import { Button, Dropdown } from 'react-bootstrap';
import { WorkspaceContextWrapper, WorkspaceContextTypes, AuthoringState } from 'ontodia';

import { Component, ComponentContext } from 'platform/api/components';
import { TemplateItem } from 'platform/components/ui/template';
import { OntodiaContextWrapper, OntodiaContextTypes } from './OntodiaContext';
import * as styles from './Toolbar.scss';

/**
 * Special control that combine multiple actions such as `save`, `saveAs`, `persist` and `persistAndSave`.
 * Depending on Ontodia state, it displays different UI.
 */
export interface OntodiaSaveButtonConfig {
  /**
   * Custom label for "Save diagram" button.
   */
  saveDiagramLabel?: string;
  /**
   * Custom label for "Save data" button.
   */
  persistChangesLabel?: string;
  /**
   * Toggles dropdown menu above the button.
   */
  dropup?: boolean;
  /**
   * Provide a custom template. Requires the ID to be set.
   *
   * **Example**:
   * ```
   * <mp-event-trigger id='event-trigger'
   *   type='Ontodia.Save'
   *   data='{"persistChanges": true, "saveDiagram": true}'
   *   targets='["{{eventTarget}}"]'>
   *   <button>Save changes and diagram</button>
   * </mp-event-trigger>
   * ```
   */
  template?: string;
}

// exported for documentation
interface SaveButtonTemplateData {
  readonly inAuthoringMode: boolean;
  readonly canPersistChanges: boolean;
  readonly eventTarget: string | undefined;
}

export type OntodiaSaveButtonProps = OntodiaSaveButtonConfig;

export class SaveButton extends Component<OntodiaSaveButtonProps, {}> {
  static defaultProps: Pick<OntodiaSaveButtonProps, 'saveDiagramLabel' | 'persistChangesLabel'> = {
    saveDiagramLabel: 'Save diagram',
    persistChangesLabel: 'Save data',
  };

  static contextTypes = {
    ...WorkspaceContextTypes,
    ...OntodiaContextTypes,
  };
  readonly context: WorkspaceContextWrapper & OntodiaContextWrapper & ComponentContext;

  render() {
    const {editor} = this.context.ontodiaWorkspace;
    const {
      inAuthoringMode, onSaveDiagram, onSaveDiagramAs, onPersistChanges,
      onPersistChangesAndSaveDiagram, ontodiaId,
    } = this.context.ontodiaContext;
    const {saveDiagramLabel, persistChangesLabel, dropup, template} = this.props;
    const drop = dropup ? 'up' : 'down';

    const canPersistChanges = inAuthoringMode && !AuthoringState.isEmpty(editor.authoringState);
    if (template) {
      const templateData: SaveButtonTemplateData = {
        inAuthoringMode: inAuthoringMode(),
        canPersistChanges,
        eventTarget: ontodiaId,
      };
      return <TemplateItem template={{ source: template, options: templateData }}></TemplateItem>;
    }

    if (canPersistChanges) {
      return (
        <Dropdown id='persist-changes-button' className='btn-group-sm' drop={drop}>
          <Button variant='success'
            onClick={onPersistChanges}
            className={styles.saveButton}>
            <span className='fa fa-floppy-o' aria-hidden='true' />&nbsp;
            {persistChangesLabel}
          </Button>
          <Dropdown.Toggle variant='success' />
          <Dropdown.Menu>
            <Dropdown.Item href='#' onClick={onPersistChangesAndSaveDiagram}>
              {persistChangesLabel} &amp; {saveDiagramLabel}
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      );
    }
    return (
      <Dropdown id='save-diagram-button' className='btn-group-sm' drop={drop}>
        <Button variant='primary'
          onClick={onSaveDiagram}
          className={styles.saveButton}>
          <span className='fa fa-floppy-o' aria-hidden='true' />&nbsp;
          {saveDiagramLabel}
        </Button>
        <Dropdown.Toggle variant='primary' />
        <Dropdown.Menu>
          <Dropdown.Item href='#' onClick={onSaveDiagramAs}>
            {saveDiagramLabel} as...
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
    );
  }
}

export default SaveButton;
