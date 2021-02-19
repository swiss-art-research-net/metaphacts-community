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
import { uniqueId } from 'lodash';

import { Component } from 'platform/api/components';

import { OntodiaFactory } from './extensions';
import { WorkspaceLayout, WorkspaceRow, WorkspaceColumn, WorkspaceItem } from './workspace';
import { Canvas } from './Canvas';
import { ClassTree } from './ClassTree';
import { InstancesSearch } from './InstancesSearch';
import { LinkTypesToolbox } from './LinkTypesToolbox';
import { NavigationMenu } from './NavigationMenu';
import { ElementSearch } from './ElementSearch';
import { Halo } from './Halo';
import { HaloLink } from './HaloLink';
import { Navigator } from './Navigator';

export class DefaultWorkspace extends Component<{ factory: OntodiaFactory }, {}> {
  private readonly id = uniqueId('ontodia-workspace_');

  render() {
    const canvasId = `${this.id}-canvas`;
    const instancesSearchId = `${this.id}-instances`;
    const toolbar = this.props.factory.createToolbar({});
    return <WorkspaceLayout>
      <WorkspaceRow>
        <WorkspaceColumn defaultSize={275}>
          <WorkspaceItem id='classes' heading='Classes'>
            <ClassTree id={`${this.id}-classes`}
              canvasId={canvasId}
              instancesSearchId={instancesSearchId} />
          </WorkspaceItem>
          <WorkspaceItem id='instances' heading='Instances'>
            <InstancesSearch id={instancesSearchId} />
          </WorkspaceItem>
        </WorkspaceColumn>
        <WorkspaceItem id='paper'>
          <Canvas id={canvasId}>
            {toolbar}
            <NavigationMenu />
            <Halo />
            <HaloLink />
            <Navigator />
          </Canvas>
        </WorkspaceItem>
        <WorkspaceColumn defaultSize={275} defaultCollapsed={true}>
          <WorkspaceItem id='connections' heading='Connections'>
            <LinkTypesToolbox />
          </WorkspaceItem>
          <WorkspaceItem id='search' heading='Search in diagram'>
            <ElementSearch id={`${this.id}-search`} canvasId={canvasId} />
          </WorkspaceItem>
        </WorkspaceColumn>
      </WorkspaceRow>
    </WorkspaceLayout>;
  }
}
