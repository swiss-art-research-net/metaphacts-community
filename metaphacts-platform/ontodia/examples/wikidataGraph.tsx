import * as React from 'react';

import {
    Workspace, EventSource, CanvasCommands, SparqlDataProvider, SparqlGraphBuilder, WikidataSettings
} from '../src/ontodia/index';

import { renderExample } from './resources/common';
import { ExampleWorkspaceLayout } from './resources/exampleWorkspaceLayout';

class WikidataGraphExample extends React.Component {
    private commands = new EventSource<CanvasCommands>();

    render() {
        return (
            <Workspace ref={this.onWorkspaceMount}>
                <ExampleWorkspaceLayout canvasCommands={this.commands} />
            </Workspace>
        );
    }

    private onWorkspaceMount = (workspace: Workspace | null) => {
        if (!workspace) { return; }

        const dataProvider = new SparqlDataProvider({
            endpointUrl: '/wikidata',
            imagePropertyUris: [
                'http://www.wikidata.org/prop/direct/P18',
                'http://www.wikidata.org/prop/direct/P154',
            ],
        }, WikidataSettings);
        const graphBuilder = new SparqlGraphBuilder(dataProvider);

        const loadingGraph = graphBuilder.getGraphFromConstruct(`
            CONSTRUCT { ?current ?p ?o. }
            WHERE {
                {
                ?current ?p ?o.
                ?p <http://www.w3.org/2000/01/rdf-schema#label> ?label.
                FILTER(ISIRI(?o))
                FILTER exists{?o ?p1 ?o2}
                }
            }
            LIMIT 20
            VALUES (?current) {
                (<http://www.wikidata.org/entity/Q567>)
            }`,
        );
        workspace.showWaitIndicatorWhile(loadingGraph);

        loadingGraph.then(({diagram, preloadedElements}) =>
            workspace.getModel().importLayout({diagram, preloadedElements, dataProvider}),
        ).then(() => {
            this.commands.trigger('forceLayout', {});
        });
    }
}

renderExample(<WikidataGraphExample />);
