import * as React from 'react';

import {
    DefaultWorkspaceLayout, DefaultWorkspaceLayoutProps, DefaultWorkspaceLayoutCommands,
    WorkspaceContextTypes, WorkspaceContextWrapper,
} from '../../src/ontodia/index';

import { saveLayoutToLocalStorage } from './common';

export type ExampleWorkspaceLayoutProps = DefaultWorkspaceLayoutProps;
export type ExampleWorkspaceLayoutCommands = DefaultWorkspaceLayoutCommands;

export class ExampleWorkspaceLayout extends React.Component<ExampleWorkspaceLayoutProps> {
    static contextTypes = WorkspaceContextTypes;
    declare readonly context: WorkspaceContextWrapper;

    render() {
        return (
            <DefaultWorkspaceLayout {...this.props}
                toolbarProps={{
                    onSaveDiagram: () => {
                        const {model} = this.context.ontodiaWorkspace;
                        const diagram = model.exportLayout();
                        window.location.hash = saveLayoutToLocalStorage(diagram);
                        window.location.reload();
                    },
                    ...this.props.toolbarProps,
                }}
            />
        );
    }
}
