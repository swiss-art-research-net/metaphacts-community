import * as React from 'react';

import {
    DefaultWorkspaceLayout, DefaultWorkspaceLayoutProps, WorkspaceContextTypes, WorkspaceContextWrapper,
} from '../../src/ontodia/index';

import { saveLayoutToLocalStorage } from './common';

export type ExampleWorkspaceLayoutProps = DefaultWorkspaceLayoutProps;

export class ExampleWorkspaceLayout extends React.Component<ExampleWorkspaceLayoutProps> {
    static contextTypes = WorkspaceContextTypes;
    declare readonly context: WorkspaceContextWrapper;

    render() {
        return (
            <DefaultWorkspaceLayout {...this.props}
                toolbarProps={{
                    onSaveDiagram: () => {
                        const {editor} = this.context.ontodiaWorkspace;
                        const diagram = editor.model.exportLayout();
                        window.location.hash = saveLayoutToLocalStorage(diagram);
                        window.location.reload();
                    },
                    ...this.props.toolbarProps,
                }}
            />
        );
    }
}
