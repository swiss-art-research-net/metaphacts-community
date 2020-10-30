import * as React from 'react';

import {
    Workspace, EventSource, CanvasCommands,
    SparqlDataProvider, SparqlGraphBuilder, OWLStatsSettings, SparqlQueryMethod
} from '../src/ontodia/index';

import { renderExample } from './resources/common';
import { ExampleWorkspaceLayout } from './resources/exampleWorkspaceLayout';

class SparqlConstructExample extends React.Component {
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

        const model = workspace.getModel();
        const sparqlDataProvider = new SparqlDataProvider({
            endpointUrl: '/sparql',
            queryMethod: SparqlQueryMethod.GET
        }, OWLStatsSettings);
        const graphBuilder = new SparqlGraphBuilder(sparqlDataProvider);

        const loadingGraph = graphBuilder.getGraphFromConstruct(
            `CONSTRUCT {
                ?inst rdf:type ?class.
                ?inst ?propType1 ?propValue1.
                ?inst rdfs:label ?label .
                ?propValue2 ?propType2 ?inst .
            } WHERE {
                BIND (<http://collection.britishmuseum.org/id/object/JCF8939> as ?inst)
                ?inst rdf:type ?class.
                OPTIONAL {?inst rdfs:label ?label}
                OPTIONAL {?inst ?propType1 ?propValue1.  FILTER(isURI(?propValue1)). }
                OPTIONAL {?propValue2 ?propType2 ?inst.  FILTER(isURI(?propValue2)). }
            } LIMIT 100`,
        );
        workspace.showWaitIndicatorWhile(loadingGraph);

        loadingGraph.then(({diagram, preloadedElements}) => model.importLayout({
            diagram,
            preloadedElements,
            dataProvider: sparqlDataProvider,
        })).then(() => {
            this.commands.trigger('forceLayout', {});
        });
    }
}

renderExample(<SparqlConstructExample />);
