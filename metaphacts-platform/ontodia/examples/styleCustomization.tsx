import * as React from 'react';

import { Workspace, SparqlDataProvider, LinkTemplate } from '../src/ontodia/index';

import { renderExample, tryLoadLayoutFromLocalStorage } from './resources/common';
import { ExampleWorkspaceLayout } from './resources/exampleWorkspaceLayout';

const certificateIcon: string = require('../images/font-awesome/certificate-solid.svg');
const cogIcon: string = require('../images/font-awesome/cog-solid.svg');

const CUSTOM_LINK_TEMPLATE: LinkTemplate = {
    markerSource: {
        fill: '#4b4a67',
        stroke: '#4b4a67',
        d: 'M0,3a3,3 0 1,0 6,0a3,3 0 1,0 -6,0',
        width: 6,
        height: 6,
    },
    markerTarget: {
        fill: '#4b4a67',
        stroke: '#4b4a67',
        d: 'm 20,5.88 -10.3,-5.95 0,5.6 -9.7,-5.6 0,11.82 9.7,-5.53 0,5.6 z',
        width: 20,
        height: 12,
    },
    renderLink: () => ({
        connection: {
            stroke: '#3c4260',
            'stroke-width': 2,
        },
        connector: {name: 'rounded'},
        label: {
            attrs: {text: {fill: '#3c4260'}},
        },
    }),
};

class StyleCustomizationExample extends React.Component {
    render() {
        return (
            <Workspace ref={this.onWorkspaceMount}
                typeStyleResolver={types => {
                    if (types.indexOf('http://www.w3.org/2000/01/rdf-schema#Class') !== -1) {
                        return {icon: certificateIcon};
                    } else if (types.indexOf('http://www.w3.org/2002/07/owl#Class') !== -1) {
                        return {icon: certificateIcon};
                    } else if (types.indexOf('http://www.w3.org/2002/07/owl#ObjectProperty') !== -1) {
                        return {icon: cogIcon};
                    } else if (types.indexOf('http://www.w3.org/2002/07/owl#DatatypeProperty') !== -1) {
                        return {color: '#046380'};
                    } else {
                        return undefined;
                    }
                }}>
                <ExampleWorkspaceLayout
                    canvasProps={{
                        linkTemplateResolver: () => CUSTOM_LINK_TEMPLATE,
                    }}
                />
            </Workspace>
        );
    }

    private onWorkspaceMount = (workspace: Workspace | null) => {
        if (!workspace) { return; }

        const diagram = tryLoadLayoutFromLocalStorage();
        workspace.getModel().importLayout({
            diagram,
            dataProvider: new SparqlDataProvider({
                endpointUrl: '/sparql',
                imagePropertyUris: [
                    'http://collection.britishmuseum.org/id/ontology/PX_has_main_representation',
                    'http://xmlns.com/foaf/0.1/img',
                ],
            }),
        });
    }
}

renderExample(<StyleCustomizationExample />);
