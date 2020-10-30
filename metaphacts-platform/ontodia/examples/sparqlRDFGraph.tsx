import * as React from 'react';

import {
    Workspace, EventSource, CanvasCommands, SparqlDataProvider, OWLStatsSettings, GraphBuilder, Rdf,
} from '../src/ontodia/index';

import { renderExample } from './resources/common';
import { ExampleWorkspaceLayout } from './resources/exampleWorkspaceLayout';

const FACTORY = Rdf.OntodiaDataFactory;
const GRAPH: Rdf.Quad[] = [
    FACTORY.quad(
        FACTORY.namedNode('http://collection.britishmuseum.org/id/object/JCF8939'),
        FACTORY.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        FACTORY.namedNode('http://www.cidoc-crm.org/cidoc-crm/E22_Man-Made_Object'),
    ),
    FACTORY.quad(
        FACTORY.namedNode('http://collection.britishmuseum.org/id/object/JCF8939'),
        FACTORY.namedNode('http://www.cidoc-crm.org/cidoc-crm/P43_has_dimension'),
        FACTORY.namedNode('http://collection.britishmuseum.org/id/object/JCF8939/height/1'),
    ),
    FACTORY.quad(
        FACTORY.namedNode('http://www.britishmuseum.org/collectionimages/AN00230/AN00230739_001_l.jpg/digiprocess'),
        FACTORY.namedNode('http://www.ics.forth.gr/isl/CRMdig/L1_digitized'),
        FACTORY.namedNode('http://collection.britishmuseum.org/id/object/JCF8939'),
    ),
    FACTORY.quad(
        FACTORY.namedNode('http://collection.britishmuseum.org/id/object/JCF8939'),
        FACTORY.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        FACTORY.namedNode('http://www.researchspace.org/ontology/Thing'),
    ),
];

class SparqlRdfGraphExample extends React.Component {
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
        const endpointUrl = '/sparql';
        const sparqlDataProvider = new SparqlDataProvider({
            endpointUrl: endpointUrl,
            imagePropertyUris: ['http://collection.britishmuseum.org/id/ontology/PX_has_main_representation'],
        }, OWLStatsSettings);
        const graphBuilder = new GraphBuilder(sparqlDataProvider);

        const loadingGraph = graphBuilder.getGraphFromRDFGraph(GRAPH);
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

renderExample(<SparqlRdfGraphExample />);
