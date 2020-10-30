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
import { Workspace } from 'ontodia';

import { OntodiaFactory } from './extensions';

import { FormBasedPersistence } from './authoring/FormBasedPersistence';

import { Toolbar } from './Toolbar';
import { Canvas } from './Canvas';
import { ElementSearch } from './ElementSearch';
import { DefaultWorkspace } from './DefaultWorkspace';

export const DEFAULT_FACTORY: OntodiaFactory = {
  createWorkspace: (componentProps, workspaceProps, useDefaultLayout) => {
    return <Workspace {...workspaceProps}>
      {[
        ...workspaceProps.children as Array<React.ReactElement<any>>,
        useDefaultLayout ? (
          <DefaultWorkspace key='default-workspace' factory={DEFAULT_FACTORY} />
        ) : null,
      ]}
    </Workspace>;
  },
  createToolbar: props => <Toolbar {...props} />,
  onNewDigaramInitialized: (componentProps, workspace: Workspace) => {
    workspace.forAnyCanvas(canvas => {
      canvas.getCommands().trigger('forceLayout', {});
    });
    workspace.forEachCanvas(canvas => {
      canvas.getCommands().trigger('zoomToFit', {});
    });
  },
  getPersistence: mode => {
    switch (mode.type) {
      case 'form':
        return new FormBasedPersistence(mode);
      default:
        throw new Error(`Ontodia graph persistence mode is not supported: "${mode.type}"`);
    }
  },
  createCanvas: props => <Canvas {...props} />,
  createElementSearch: props => <ElementSearch {...props} />,
};
