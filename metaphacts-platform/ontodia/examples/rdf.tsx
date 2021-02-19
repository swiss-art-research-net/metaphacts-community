import * as React from 'react';

import {
    Workspace, DataProvider, RdfDataProvider, LodDataProvider, GroupTemplate,
} from '../src/ontodia/index';

import { N3Parser, renderExample, tryLoadLayoutFromLocalStorage } from './resources/common';
import { ExampleMetadataApi, ExampleValidationApi } from './resources/exampleMetadataApi';
import { ExampleWorkspaceLayout } from './resources/exampleWorkspaceLayout';

const RdfXmlParser: any = require('rdf-parser-rdfxml');
const JsonLdParser: any = require('rdf-parser-jsonld');

const data = require('./resources/orgOntology.ttl');

const ENABLE_LOD_FETCHING = false;

class RdfExample extends React.Component {
    private workspace!: Workspace;

    private metadataApi = new ExampleMetadataApi();
    private validationApi = new ExampleValidationApi();

    render() {
        return (
            <Workspace ref={this.onWorkspaceMount}
                metadataApi={this.metadataApi}
                validationApi={this.validationApi}
                groupBy={[
                    {linkType: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', linkDirection: 'in'},
                ]}
                language='ru'>
                <ExampleWorkspaceLayout
                    canvasProps={{
                        elementTemplateResolver: types => {
                            if (types.length === 0) {
                                // use group template only for classes
                                return GroupTemplate;
                            }
                            return undefined;
                        }
                    }}
                    toolbarProps={{
                        onPersistChanges: () => {
                            const {editor} = this.workspace.getContext();
                            // tslint:disable-next-line:no-console
                            console.log('Authoring state:', editor.authoringState);
                        }
                    }}
                />
            </Workspace>
        );
    }

    private onWorkspaceMount = (workspace: Workspace | null) => {
        if (!workspace) { return; }
        this.workspace = workspace;

        const rdfDataProvider = new RdfDataProvider({
            data: [
                {
                    content: data,
                    type: 'text/turtle',
                    fileName: 'testData.ttl',
                },
            ],
            acceptBlankNodes: false,
            parsers: {
                'application/rdf+xml': new RdfXmlParser(),
                'application/ld+json': new JsonLdParser(),
                'text/turtle': new N3Parser(),
            },
        });

        const dataProvider: DataProvider = ENABLE_LOD_FETCHING
            ? new LodDataProvider({baseProvider: rdfDataProvider, /* proxyUrl: '/lod-proxy/' */})
            : rdfDataProvider;

        const diagram = tryLoadLayoutFromLocalStorage();
        workspace.getModel().importLayout({
            diagram,
            validateLinks: true,
            dataProvider,
        });
    }
}

renderExample(<RdfExample />);
