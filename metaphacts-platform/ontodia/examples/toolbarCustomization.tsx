import * as React from 'react';

import {
    Workspace, WorkspaceLayout, WorkspaceRow, WorkspaceColumn, WorkspaceItem, ClassTree,
    InstancesSearch, LinkTypesToolbox, Canvas, CanvasCommands, CanvasWidget, Navigator, EventSource, EventTrigger,
    InstancesSearchCommands, Halo, HaloLink, DefaultWorkspaceLayoutCommands, RdfDataProvider,
} from '../src/ontodia/index';

import {N3Parser, renderExample, tryLoadLayoutFromLocalStorage} from './resources/common';

const data = require('./resources/orgOntology.ttl');


interface CustomToolbarProps {
    commands: EventTrigger<CanvasCommands>;
    onExampleClick: () => void;
}

export class CustomToolbar extends React.Component<CustomToolbarProps> {
    render() {
        return (
            <div className='ontodia-toolbar'>
                <div className='ontodia-btn-group ontodia-btn-group-sm'>
                    <span className={`ontodia-toolbar__layout-group`}>
                        <label className='ontodia-label'><span>Layout - </span></label>
                        <span className='ontodia-btn-group ontodia-btn-group-sm'>
                            <button type='button' className='ontodia-btn ontodia-btn-default'
                                    onClick={this.onForceLayout}>
                                <span title='Force layout' className='fa fa-snowflake-o' aria-hidden='true' />
                            </button>
                            <button type='button' className='ontodia-btn ontodia-btn-default'
                                    onClick={this.props.onExampleClick}>
                                <span title='Example button'>Exapmle button</span>
                            </button>
                        </span>
                    </span>
                </div>
            </div>
        );
    }

    private onForceLayout = () => {
        this.props.commands.trigger('forceLayout', {});
    }
}

class ToolbarCustomizationExample extends React.Component {
    private canvasCommands = new EventSource<DefaultWorkspaceLayoutCommands>();
    private instancesSearchCommands = new EventSource<InstancesSearchCommands>();

    render() {
        return (
            <Workspace ref={this.onWorkspaceMount}>
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
                            <Canvas commands={this.canvasCommands}>
                                <CanvasWidget id='toolbar' dock='nw' margin={10}>
                                    <CustomToolbar commands={this.canvasCommands}
                                        onExampleClick={() => { alert('Example button have been pressed!'); }}
                                    />
                                </CanvasWidget>
                                <Halo commands={this.canvasCommands} />
                                <HaloLink />
                                <Navigator />
                            </Canvas>
                        </WorkspaceItem>
                        <WorkspaceColumn defaultSize={275} defaultCollapsed={true}>
                            <WorkspaceItem id='connections' heading='Connections'>
                                <LinkTypesToolbox />
                            </WorkspaceItem>
                        </WorkspaceColumn>
                    </WorkspaceRow>
                </WorkspaceLayout>
            </Workspace>
        );
    }

    private onWorkspaceMount = (workspace: Workspace | null) => {
        if (!workspace) { return; }

        const model = workspace.getModel();

        const diagram = tryLoadLayoutFromLocalStorage();
        model.importLayout({
            dataProvider: new RdfDataProvider({
                data: [
                    {
                        content: data,
                        type: 'text/turtle',
                        fileName: 'testData.ttl',
                    },
                ],
                acceptBlankNodes: false,
                parsers: {
                    'text/turtle': new N3Parser(),
                },
            }),
            diagram,
            validateLinks: true,
        });
    }
}

renderExample(<ToolbarCustomizationExample />);
