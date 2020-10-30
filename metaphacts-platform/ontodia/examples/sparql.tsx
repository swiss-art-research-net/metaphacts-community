import * as React from 'react';

import {
    Workspace, SparqlDataProvider, OWLStatsSettings, SparqlQueryMethod, GroupTemplate, LinkTypeIri,
    DIAGRAM_CONTEXT_URL_V1,
} from '../src/ontodia/index';

import { renderExample, tryLoadLayoutFromLocalStorage } from './resources/common';
import { ExampleWorkspaceLayout } from './resources/exampleWorkspaceLayout';

class SparqlExample extends React.Component {
    render() {
        return (
            <Workspace ref={this.onWorkspaceMount}
                groupBy={[
                    {linkType: 'http://www.researchspace.org/ontology/group', linkDirection: 'in'},
                ]}
                language='ru'>
                <ExampleWorkspaceLayout
                    canvasProps={{
                        elementTemplateResolver: types => {
                            if (types.indexOf('http://www.ics.forth.gr/isl/CRMinf/I2_Belief') !== -1) {
                                return GroupTemplate;
                            }
                            return undefined;
                        }
                    }}
                />
            </Workspace>
        );
    }

    private onWorkspaceMount = (workspace: Workspace | null) => {
        if (!workspace) { return; }

        const diagram = tryLoadLayoutFromLocalStorage();
        workspace.getModel().importLayout({
            diagram: {
                ...diagram,
                linkTypeOptions: [
                    {
                        '@type': 'LinkTypeOptions',
                        property: 'http://www.researchspace.org/ontology/group' as LinkTypeIri,
                        visible: false,
                    },
                ],
            },
            validateLinks: true,
            dataProvider: new SparqlDataProvider({
                endpointUrl: '/sparql',
                imagePropertyUris: [
                    'http://collection.britishmuseum.org/id/ontology/PX_has_main_representation',
                    'http://xmlns.com/foaf/0.1/img',
                ],
                queryMethod: SparqlQueryMethod.GET,
                acceptBlankNodes: true,
            }, OWLStatsSettings),
        });
    }
}

renderExample(<SparqlExample />);
