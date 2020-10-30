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

import { ClassTree } from '../widgets/classTree';
import { InstancesSearch, InstancesSearchCommands } from '../widgets/instancesSearch';
import { LinkTypesToolbox } from '../widgets/linksToolbox';
import { Navigator } from '../widgets/navigator';
import { Halo } from '../widgets/halo';
import { HaloLink } from '../widgets/haloLink';
import { ElementSearch } from '../widgets/elementSearch';

import { Events, EventSource, EventTrigger } from '../viewUtils/events';

import { WorkspaceColumn, WorkspaceItem, WorkspaceLayout, WorkspaceRow } from './layout';
import { Canvas, CanvasCommands, CanvasProps } from './canvas';
import { DefaultToolbar, DefaultToolbarProps } from './defaultToolbar';

export interface DefaultWorkspaceLayoutProps {
    canvasCommands?: Events<CanvasCommands> & EventTrigger<CanvasCommands>;
    instancesSearchCommands?: Events<InstancesSearchCommands> & EventTrigger<InstancesSearchCommands>;
    canvasProps?: Partial<CanvasProps>;
    toolbarProps?: Partial<DefaultToolbarProps>;
}

export class DefaultWorkspaceLayout extends React.Component<DefaultWorkspaceLayoutProps> {
    private readonly canvasCommands:
        Events<CanvasCommands> & EventTrigger<CanvasCommands>;
    private readonly instancesSearchCommands:
        Events<InstancesSearchCommands> & EventTrigger<InstancesSearchCommands>;

    constructor(props: DefaultWorkspaceLayoutProps) {
        super(props);
        this.canvasCommands = this.props.canvasCommands
            ?? new EventSource<CanvasCommands>();
        this.instancesSearchCommands = this.props.instancesSearchCommands
            ?? new EventSource<InstancesSearchCommands>();
    }

    render() {
        return (
            <WorkspaceLayout>
                <WorkspaceRow>
                    <WorkspaceColumn defaultSize={275}>
                        <WorkspaceItem id='classes' heading='Classes'>
                            <ClassTree canvasCommands={this.canvasCommands}
                                instancesSearchCommands={this.instancesSearchCommands} />
                        </WorkspaceItem>
                        <WorkspaceItem id='instances' heading='Instances'>
                            <InstancesSearch commands={this.instancesSearchCommands} />
                        </WorkspaceItem>
                    </WorkspaceColumn>
                    <WorkspaceItem id='paper'>
                        <Canvas commands={this.canvasCommands} {...this.props.canvasProps}>
                            <DefaultToolbar canvasCommands={this.canvasCommands}
                                {...this.props.toolbarProps}
                            />
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
                            <ElementSearch canvasCommands={this.canvasCommands} />
                        </WorkspaceItem>
                    </WorkspaceColumn>
                </WorkspaceRow>
            </WorkspaceLayout>
        );
    }
}
