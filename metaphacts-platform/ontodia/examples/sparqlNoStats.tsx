import * as React from 'react';

import { Workspace, SparqlDataProvider, SparqlDataProviderSettings, OWLRDFSSettings } from '../src/ontodia/index';

import { renderExample, tryLoadLayoutFromLocalStorage } from './resources/common';
import { ExampleWorkspaceLayout } from './resources/exampleWorkspaceLayout';

const SPARQL_PROVIDER_SETTINGS: SparqlDataProviderSettings = {
    ...OWLRDFSSettings,
    fullTextSearch: {
        prefix: 'PREFIX bds: <http://www.bigdata.com/rdf/search#>' + '\n',
        queryPattern: `
            ?inst rdfs:label ?searchLabel.
            SERVICE bds:search {
                    ?searchLabel bds:search "\${text}*" ;
                                bds:minRelevance '0.5' ;

                                bds:matchAllTerms 'true';
                                bds:relevance ?score.
            }
        `
    },
    elementInfoQuery: `
        CONSTRUCT {
            ?inst rdf:type ?class;
                rdfs:label ?label;
                ?propType ?propValue.
        }
        WHERE {
            OPTIONAL {?inst rdf:type ?class . }
            OPTIONAL {?inst \${dataLabelProperty} ?label}
            OPTIONAL {?inst ?propType ?propValue.
            FILTER (isLiteral(?propValue)) }
            VALUES ?labelProp { rdfs:label foaf:name }
        } VALUES (?inst) {\${ids}}
    `,
};

class SparqlNoStatsExample extends React.Component {
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
            validateLinks: true,
            dataProvider: new SparqlDataProvider(
                {
                    endpointUrl: '/sparql',
                    imagePropertyUris: [
                        'http://xmlns.com/foaf/0.1/img',
                    ],
                    // queryMethod: SparqlQueryMethod.POST
                },
                SPARQL_PROVIDER_SETTINGS
            ),
        });
    }
}

renderExample(<SparqlNoStatsExample />);
