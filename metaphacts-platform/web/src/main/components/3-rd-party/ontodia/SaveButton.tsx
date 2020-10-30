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
import { Button, Dropdown, MenuItem } from 'react-bootstrap';
import { WorkspaceContextWrapper, WorkspaceContextTypes, AuthoringState } from 'ontodia';

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
}

export type OntodiaSaveButtonProps = OntodiaSaveButtonConfig;

export class SaveButton extends React.Component<OntodiaSaveButtonProps, {}> {
  static defaultProps: Partial<OntodiaSaveButtonProps> = {
    saveDiagramLabel: 'Save diagram',
    persistChangesLabel: 'Save data',
  };

  static contextTypes = {
    ...WorkspaceContextTypes,
    ...OntodiaContextTypes,
  };
  readonly context: WorkspaceContextWrapper & OntodiaContextWrapper;

  render() {
    const {editor} = this.context.ontodiaWorkspace;
    const {
      inAuthoringMode, onSaveDiagram, onSaveDiagramAs, onPersistChanges,
      onPersistChangesAndSaveDiagram,
    } = this.context.ontodiaContext;
    const {saveDiagramLabel, persistChangesLabel, dropup} = this.props;

    const canPersistChanges = inAuthoringMode && !AuthoringState.isEmpty(editor.authoringState);
    if (canPersistChanges) {
      return (
        <Dropdown id='persist-changes-button' className='btn-group-sm' dropup={dropup}>
          <Button bsStyle='success'
            onClick={onPersistChanges}
            className={styles.saveButton}>
            <span className='fa fa-floppy-o' aria-hidden='true' />&nbsp;
            {persistChangesLabel}
          </Button>
          <Dropdown.Toggle bsStyle='success' />
          <Dropdown.Menu>
            <MenuItem href='#' onClick={onPersistChangesAndSaveDiagram}>
              {persistChangesLabel} &amp; {saveDiagramLabel}
            </MenuItem>
          </Dropdown.Menu>
        </Dropdown>
      );
    }
    return (
      <Dropdown id='save-diagram-button' className='btn-group-sm' dropup={dropup}>
        <Button bsStyle='primary'
          onClick={onSaveDiagram}
          className={styles.saveButton}>
          <span className='fa fa-floppy-o' aria-hidden='true' />&nbsp;
          {saveDiagramLabel}
        </Button>
        <Dropdown.Toggle bsStyle='primary' />
        <Dropdown.Menu>
          <MenuItem href='#' onClick={onSaveDiagramAs}>
            {saveDiagramLabel} as...
          </MenuItem>
        </Dropdown.Menu>
      </Dropdown>
    );
  }
}

export default SaveButton;
