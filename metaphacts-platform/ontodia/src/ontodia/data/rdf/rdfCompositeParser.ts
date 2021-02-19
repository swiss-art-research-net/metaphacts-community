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

function workaroundForRDFXmlParser(body: string) {
    // For some strange reason we've encountered xml parser errors
    // when parsing rdf/xml file with Collection tag.
    // As I remember, file came from x3c Ontology
    // and this workaround helps to get file through xml parsing.
    return body.replace(/parseType=["']Collection["']/ig, 'parseType="Collection1"');
}

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
    parse(body: string): Promise<Rdf.Quad[] | RdfExtLegacyGraph>;
}

/** An RDF graph type from `rdf-ext@0.3.0` library */
export interface RdfExtLegacyGraph {
    toArray(): RdfExtLegacyTriple[];
}

export interface RdfExtLegacyTriple {
    subject: RdfExtLegacyTerm;
    predicate: RdfExtLegacyTerm;
    object: RdfExtLegacyTerm;
}

export type RdfExtLegacyTerm =
    { interfaceName: 'NamedNode'; nominalValue: string } |
    { interfaceName: 'BlankNode'; nominalValue: string } |
    {
        interfaceName: 'Literal';
        nominalValue: string;
        language: string | null;
        datatype: { interfaceName: 'NamedNode'; nominalValue: string };
    };

export class RdfCompositeParser {
    constructor(
        private readonly factory: Rdf.DataFactory,
        private parsers: { readonly [mimeType: string]: RdfParser }
    ) {}

    get acceptedMimeTypes(): string[] {
        return Object.keys(this.parsers);
    }

    async parse(body: string, mimeType?: string, fileName?: string): Promise<Rdf.Quad[]> {
        let parsedGraph: Rdf.Quad[] | RdfExtLegacyGraph;
        if (mimeType) {
            if (mimeType === 'application/rdf+xml') {
                body = workaroundForRDFXmlParser(body);
            }
            if (!this.parsers[mimeType]) {
                throw Error('There is no parser for this MIME type');
            }
            parsedGraph = await this.parsers[mimeType].parse(body);
        } else {
            parsedGraph = await this.tryToGuessMimeType(body, fileName);
        }

        const quads = convertRdfExtLegacyGraph(this.factory, parsedGraph);
        return quads;
    }

    private tryToGuessMimeType(body: string, fileName?: string): Promise<Rdf.Quad[] | RdfExtLegacyGraph> {
        let mimeTypeIndex = 0;
        let mimeTypes = Object.keys(this.parsers);

        if (fileName) {
            const mime = getMimeTypeByFileName(fileName);
            if (mime) {
                mimeTypes = [mime].concat(mimeTypes.filter(type => type !== mime));
            }
        }

        const errors: Array<{ mimeType: string; error: Error }> = [];

        const recursion = (): Promise<Rdf.Quad[] | RdfExtLegacyGraph> => {
            if (mimeTypeIndex < mimeTypes.length) {
                const mimeType = mimeTypes[mimeTypeIndex++];
                try {
                    const bodyToParse = mimeType === 'application/rdf+xml' ?
                        workaroundForRDFXmlParser(body) : body;

                    return this.parsers[mimeType].parse(bodyToParse).catch((error: Error) => {
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

function convertRdfExtLegacyGraph(factory: Rdf.DataFactory, graph: Rdf.Quad[] | RdfExtLegacyGraph): Rdf.Quad[] {
    if (Array.isArray(graph)) {
        return graph;
    }
    return graph.toArray().map(t => convertRdfExtLegacyTriple(factory, t));
}

function convertRdfExtLegacyTriple(factory: Rdf.DataFactory, triple: RdfExtLegacyTriple): Rdf.Quad {
    const subject = convertRdfExtLegacyTerm(factory, triple.subject);
    if (!(subject.termType === 'NamedNode' || subject.termType === 'BlankNode')) {
        throw new Error('RDF quad subject must be either NamedNode or BlankNode');
    }
    const predicate = convertRdfExtLegacyTerm(factory, triple.predicate);
    if (!(predicate.termType === 'NamedNode')) {
        throw new Error('RDF quad predicate must be NamedNode');
    }
    const object = convertRdfExtLegacyTerm(factory, triple.object);
    return factory.quad(subject, predicate, object);
}

function convertRdfExtLegacyTerm(
    factory: Rdf.DataFactory,
    term: RdfExtLegacyTerm
): Rdf.NamedNode | Rdf.Literal | Rdf.BlankNode {
    switch (term.interfaceName) {
        case 'NamedNode':
            return factory.namedNode(term.nominalValue);
        case 'BlankNode':
            return factory.blankNode(term.nominalValue);
        case 'Literal':
            const languageOrDatatype = term.language
                ? term.language
                : factory.namedNode(term.datatype.nominalValue);
            return factory.literal(term.nominalValue, languageOrDatatype);
        default:
            throw new Error(`Unexpected rdf-ext term type: ${(term as RdfExtLegacyTerm).interfaceName}`);
    }
}
