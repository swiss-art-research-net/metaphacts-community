import * as React from 'react';

import { Workspace, SparqlDataProvider, SparqlQueryMethod, DBPediaSettings } from '../src/ontodia/index';

import { renderExample, tryLoadLayoutFromLocalStorage } from './resources/common';
import { ExampleWorkspaceLayout } from './resources/exampleWorkspaceLayout';

class DbpediaExample extends React.Component<{}, {}> {
    render() {
        return <Workspace ref={this.onWorkspaceMount}>
            <ExampleWorkspaceLayout />
        </Workspace>;
    }

    private onWorkspaceMount(workspace: Workspace) {
        if (!workspace) { return; }

        const diagram = tryLoadLayoutFromLocalStorage();
        workspace.getModel().importLayout({
            diagram,
            validateLinks: true,
            dataProvider: new SparqlDataProvider({
                endpointUrl: 'https://dbpedia.org/sparql',
                imagePropertyUris: [
                    'http://xmlns.com/foaf/0.1/depiction',
                    'http://xmlns.com/foaf/0.1/img',
                ],
                queryMethod: SparqlQueryMethod.GET,
            }, DBPediaSettings),
        });
    }
}

renderExample(<DbpediaExample />);
