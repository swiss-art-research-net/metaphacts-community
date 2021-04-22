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
import * as Rdf from './rdfModel';

const POSTFIX_TO_MIME: { [key: string]: string } = {
    'xml': 'application/rdf+xml',
    'rdf': 'application/rdf+xml',
    'owl': 'application/rdf+xml',
    'nttl': 'application/x-turtle',
    'jsonld': 'application/ld+json',
    'rj': 'application/ld+json',
    'ttl': 'text/turtle',
    'nt': 'text/turtle',
    'nq': 'text/turtle',
};

function getMimeTypeByFileName(fileName: string): string | undefined {
    const postfix = (fileName.match(/\.([\S]*)$/i) || [])[1];
    return postfix ? POSTFIX_TO_MIME[postfix] : undefined;
}

export interface RdfParser {
    parse(body: string): Promise<Rdf.Quad[]>;
}

export class RdfCompositeParser {
    constructor(
        private readonly factory: Rdf.DataFactory,
        private parsers: { readonly [mimeType: string]: RdfParser }
    ) {}

    get acceptedMimeTypes(): string[] {
        return Object.keys(this.parsers);
    }

    async parse(body: string, mimeType?: string, fileName?: string): Promise<Rdf.Quad[]> {
        let parsedGraph: Rdf.Quad[];
        if (mimeType) {
            if (!this.parsers[mimeType]) {
                throw Error('There is no parser for this MIME type');
            }
            parsedGraph = await this.parsers[mimeType].parse(body);
        } else {
            parsedGraph = await this.tryToGuessMimeType(body, fileName);
        }
        return parsedGraph;
    }

    private tryToGuessMimeType(body: string, fileName?: string): Promise<Rdf.Quad[]> {
        let mimeTypeIndex = 0;
        let mimeTypes = Object.keys(this.parsers);

        if (fileName) {
            const mime = getMimeTypeByFileName(fileName);
            if (mime) {
                mimeTypes = [mime].concat(mimeTypes.filter(type => type !== mime));
            }
        }

        const errors: Array<{ mimeType: string; error: Error }> = [];

        const recursion = (): Promise<Rdf.Quad[]> => {
            if (mimeTypeIndex < mimeTypes.length) {
                const mimeType = mimeTypes[mimeTypeIndex++];
                try {
                    return this.parsers[mimeType].parse(body).catch((error: Error) => {
                        errors.push({ mimeType, error });
                        return recursion();
                    });
                } catch (error) {
                    return recursion();
                }
            } else {
                throw new Error('Unknown mime type. Parse errors:\n' +
                    errors.map(e => `${e.mimeType}: ${e.error.message} ${e.error.stack};\n`).join('\n'),
                );
            }
        };
        return recursion();
    }
}
