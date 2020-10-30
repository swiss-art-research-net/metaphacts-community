import * as React from 'react';

import {
    Workspace, SparqlDataProvider, WikidataSettings, SparqlQueryMethod, PropertySuggestionParams, PropertyScore
} from '../src/ontodia/index';

import { renderExample, tryLoadLayoutFromLocalStorage } from './resources/common';
import { ExampleWorkspaceLayout } from './resources/exampleWorkspaceLayout';

const WIKIDATA_PREFIX = 'http://www.wikidata.org/prop/direct/';

class WikidataExample extends React.Component {
    private workspace!: Workspace;

    render() {
        return (
            <Workspace ref={this.onWorkspaceMount}
                suggestProperties={this.wikidataSuggestProperties}>
                <ExampleWorkspaceLayout />
            </Workspace>
        );
    }

    private onWorkspaceMount = (workspace: Workspace | null) => {
        if (!workspace) { return; }
        this.workspace = workspace;

        const diagram = tryLoadLayoutFromLocalStorage();
        const dataProvider = new SparqlDataProvider({
            endpointUrl: '/wikidata',
            imagePropertyUris: [
                'http://www.wikidata.org/prop/direct/P18',
                'http://www.wikidata.org/prop/direct/P154',
            ],
            queryMethod: SparqlQueryMethod.POST,
        }, WikidataSettings);

        workspace.getModel().importLayout({diagram, dataProvider, validateLinks: true});
    }

    private getElementLabel(id: string): string {
        const model = this.workspace.getModel();
        const view = this.workspace.getDiagram();
        const element = model.getElement(id);
        return element ? view.formatLabel(element.data.label.values, element.iri) : '';
    }

    private wikidataSuggestProperties = (params: PropertySuggestionParams) => {
        const idMap: { [id: string]: string } = {};

        const properties = params.properties.map(id => {
            let resultID;
            if (id.startsWith(WIKIDATA_PREFIX)) {
                resultID = id.substr(WIKIDATA_PREFIX.length, id.length);
            } else {
                resultID = id;
            }
            idMap[resultID] = id;
            return resultID;
        });
        const term = params.token.toLowerCase() || this.getElementLabel(params.elementId);
        const requestBody = {
            threshold: 0.1,
            term,
            instance_properties: properties,
        };
        return fetch('/wikidata-prop-suggest', {
            method: 'POST',
            body: JSON.stringify(requestBody),
            credentials: 'same-origin',
            mode: 'cors',
            cache: 'default',
        }).then((response) => {
            if (response.ok) {
                return response.json();
            } else {
                const error = new Error(response.statusText);
                (error as any).response = response;
                throw error;
            }
        }).then(json => {
            const dictionary: { [id: string]: PropertyScore } = {};
            for (const scoredItem of json.data) {
                const propertyIri = idMap[scoredItem.id];
                const item = dictionary[propertyIri];

                if (item && item.score > scoredItem.value) { continue; }

                dictionary[propertyIri] = {propertyIri, score: scoredItem.value};
            }

            Object.keys(idMap).forEach(key => {
                const propertyIri = idMap[key];

                if (dictionary[propertyIri]) { return; }

                dictionary[propertyIri] = {propertyIri, score: 0};
            });

            return dictionary;
        });
    }
}

renderExample(<WikidataExample />);
