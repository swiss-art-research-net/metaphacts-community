/*
 * "Commons Clause" License Condition v1.0
 *
 * The Software is provided to you by the Licensor under the
 * License, as defined below, subject to the following condition.
 *
 * Without limiting other conditions in the License, the grant
 * of rights under the License will not include, and the
 * License does not grant to you, the right to Sell the Software.
 *
 * For purposes of the foregoing, "Sell" means practicing any
 * or all of the rights granted to you under the License to
 * provide to third parties, for a fee or other consideration
 * (including without limitation fees for hosting or
 * consulting/ support services related to the Software), a
 * product or service whose value derives, entirely or substantially,
 * from the functionality of the Software. Any
 * license notice or attribution required by the License must
 * also include this Commons Clause License Condition notice.
 *
 * License: LGPL 2.1 or later
 * Licensor: metaphacts GmbH
 *
 * Copyright (C) 2015-2021, metaphacts GmbH
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, you can receive a copy
 * of the GNU Lesser General Public License from http://www.gnu.org/
 */
import { Dictionary } from '../model';

import { RdfCompositeParser } from './rdfCompositeParser';
import * as Rdf from './rdfModel';

export class RdfLoader {
    private readonly factory: Rdf.DataFactory;
    private readonly parser: RdfCompositeParser;
    private readonly proxyUrl: string | undefined;

    private readonly fetchingFileCatche: Dictionary<Promise<ReadonlyArray<Rdf.Quad>>> = {};

    constructor(params: {
        factory: Rdf.DataFactory;
        parser: RdfCompositeParser;
        proxyUrl?: string;
    }) {
        this.factory = params.factory;
        this.parser = params.parser;
        this.proxyUrl = params.proxyUrl;
    }

    resourceUrlFromIri(iri: string): Rdf.NamedNode {
        const hashIndex = iri.indexOf('#');
        const urlString = hashIndex >= 0 ? iri.substr(0, hashIndex) : iri;
        return this.factory.namedNode(urlString);
    }

    private parseData(data: string, contentType?: string, elementId?: string): Promise<ReadonlyArray<Rdf.Quad>> {
        return this.parser.parse(data, contentType);
    }

    downloadElement(resourceUrl: string): Promise<ReadonlyArray<Rdf.Quad>> {
        const fetch = async (): Promise<ReadonlyArray<Rdf.Quad>> => {
            for (const acceptType of this.parser.acceptedMimeTypes) {
                if (acceptType && (resourceUrl.startsWith('http:') || resourceUrl.startsWith('file:'))) {
                    let body: string;
                    try {
                        body = await this.fetchFile({
                            url: resourceUrl,
                            headers: {
                                'Accept': acceptType,
                            },
                        });
                    } catch (error) {
                        continue;
                    }

                    try {
                        const parsed = this.parseData(body, acceptType, resourceUrl);
                        return parsed;
                    } catch (error) {
                        // tslint:disable-next-line:no-console
                        console.warn(`Unable to parse response. Response: ${body}`, error);
                    }
                } else {
                    throw new Error(`Unable to fetch data for URL <${resourceUrl}>`);
                }
            }
            throw new Error(`Failed to fetch data for URL <${resourceUrl}>`);
        };

        let fetchingGraph = this.fetchingFileCatche[resourceUrl];
        if (!fetchingGraph) {
            fetchingGraph = fetch();
            this.fetchingFileCatche[resourceUrl] = fetchingGraph;
        }
        return fetchingGraph;
    }

    private fetchFile(params: {
        url: string;
        headers?: any;
    }) {
        return fetch(
            (this.proxyUrl ?? '') + params.url,
            {
                method: 'GET',
                credentials: 'same-origin',
                mode: 'cors',
                cache: 'default',
                headers: params.headers || {
                    'Accept': 'application/rdf+xml',
                },
            },
        ).then(response => {
            if (response.ok) {
                return response.text();
            } else {
                const error = new Error(response.statusText);
                (error as any).response = response;
                throw error;
            }
        });
    }
}
