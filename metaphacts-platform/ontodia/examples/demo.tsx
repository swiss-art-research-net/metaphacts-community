import * as React from 'react';

import { Workspace, DemoDataProvider } from '../src/ontodia/index';

import { renderExample, tryLoadLayoutFromLocalStorage } from './resources/common';
import { ExampleWorkspaceLayout } from './resources/exampleWorkspaceLayout';

const CLASSES = require('./resources/classes.json');
const LINK_TYPES = require('./resources/linkTypes.json');
const ELEMENTS = require('./resources/elements.json');
const LINKS  = require('./resources/links.json');

class DemoExample extends React.Component {
    render() {
        return (
            <Workspace ref={this.onWorkspaceMount}>
                <ExampleWorkspaceLayout />
            </Workspace>
        );
    }

    private onWorkspaceMount = (workspace: Workspace | null) => {
        if (!workspace) { return; }

        const diagram = tryLoadLayoutFromLocalStorage();
        workspace.getModel().importLayout({
            diagram,
            dataProvider: new DemoDataProvider(CLASSES, LINK_TYPES, ELEMENTS, LINKS),
            validateLinks: true,
        });
    }
}

renderExample(<DemoExample />);
