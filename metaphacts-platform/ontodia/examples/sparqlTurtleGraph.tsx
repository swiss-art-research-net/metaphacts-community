import * as React from 'react';

import {
    Workspace, EventSource, CanvasCommands, RdfDataProvider, LodDataProvider, GraphBuilder,
} from '../src/ontodia/index';

import { N3Parser, renderExample } from './resources/common';
import { ExampleWorkspaceLayout } from './resources/exampleWorkspaceLayout';

const RdfXmlParser: any = require('rdf-parser-rdfxml');
const JsonLdParser: any = require('rdf-parser-jsonld');

const EXAMPLE = `@prefix fts: <https://w3id.org/datafabric.cc/ontologies/fts#> .
 @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
 @prefix ex: <http://example.com/> .

 ex:LED-1 a fts:C4_Legal_Entity_Details ;
    fts:p80_describes_company ex:LE-1 ;
    fts:p81_includes_le_reg_entity ex:LE-1-NameEntity-1157847449121,
                        ex:LE-1-Address-1157847449121,
                        ex:LE-1-RegInfo-1157847449121 .
 ex:LE-1-NameEntity-1157847449121 a fts:C38_Name_Entity ;
        fts:p82_refers_to_company ex:LE-1 ;
        fts:p76_entered_on_registry_with ex:RND-1157847449121 ;
        fts:p16_full_name "ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ \\"ДАТАФАБРИК\\""@ru ;
        fts:p17_short_name "ООО \\"ДАТАФАБРИК\\""@ru .
 ex:LE-1-Address-1157847449121 a fts:C39_Address_Entity ;
        fts:p82_refers_to_company ex:LE-1 ;
        fts:p76_entered_on_registry_with ex:RND-1157847449121 ;
        fts:p18_postcode "193231" ;
        fts:p21_block "КОРПУС 2" ;
        fts:p23_office_number "КВАРТИРА 83" ;
        fts:p20_address_code "780000000000684" ;
        fts:p22_building_number "ДОМ 11" ;
        fts:p98_located_at ex:Region-78 ;
        fts:p98_located_at ex:Street-1 .
 ex:LE-1-RegInfo-1157847449121 a fts:C41_LE_Registration_Entity ;
        fts:p82_refers_to_company ex:LE-1 ;
        fts:p76_entered_on_registry_with ex:RND-1157847449121 ;
        fts:p28_le_primary_state_registration_number "1157847449121" ;
        fts:p29_psrn_assignment_date "25-12-2015"^^xsd:date .
`;

const DIAGRAM = `@prefix fts: <https://w3id.org/datafabric.cc/ontologies/fts#> .
 @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
 @prefix ex: <http://example.com/> .

 ex:LED-1 a fts:C4_Legal_Entity_Details ;
    fts:p80_describes_company ex:LE-1 ;
    fts:p81_includes_le_reg_entity ex:LE-1-NameEntity-1157847449121,
                        ex:LE-1-Address-1157847449121,
                        ex:LE-1-RegInfo-1157847449121 .`;

class SparqlTurtleGraphExample extends React.Component {
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

        const rdfDataProvider = new RdfDataProvider({
            data: [
                {
                    content: EXAMPLE,
                    type: 'text/turtle',
                }
            ],
            parsers: {
                'text/turtle': new N3Parser(),
                'application/rdf+xml': new RdfXmlParser(),
                'application/ld+json': new JsonLdParser(),
            },
        });
        const lodDataProvider = new LodDataProvider({
            baseProvider: rdfDataProvider,
        });
        const graphBuilder = new GraphBuilder(lodDataProvider);
        const loadingGraph = graphBuilder.getGraphFromTurtleGraph(DIAGRAM);

        workspace.showWaitIndicatorWhile(loadingGraph);

        loadingGraph.then(({diagram, preloadedElements}) => {
            const model = workspace.getModel();
            return model.importLayout({
                diagram,
                preloadedElements,
                dataProvider: lodDataProvider,
            });
        }).then(() => {
            this.commands.trigger('forceLayout', {});
        });
    }
}

renderExample(<SparqlTurtleGraphExample />);
