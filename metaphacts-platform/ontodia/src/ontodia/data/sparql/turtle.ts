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
 * Copyright (C) 2015-2020, metaphacts GmbH
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
import * as N3 from 'n3';
import * as RdfJs from 'rdf-js';

import * as Rdf from '../rdf/rdfModel';
import { SparqlResponse } from './sparqlModels';

export function parseTurtleText(turtleText: string, factory: Rdf.DataFactory): Rdf.Quad[] {
    // type-cast here due to incorrect N3 typings
    // (too concrete N3.Quad type -- should be RDF/JS one)
    return new N3.Parser({factory: factory as RdfJs.DataFactory<any, any>})
        .parse(turtleText) as Rdf.Quad[];
}

type SparqlJsonTerm = SparqlJsonIri | SparqlJsonBlank | SparqlJsonLiteral | SparqlJsonTriple;

interface SparqlJsonIri {
    type: 'uri';
    value: string;
}

interface SparqlJsonBlank {
    type: 'bnode';
    value: string;
}

interface SparqlJsonLiteral {
    type: 'literal';
    value: string;
    datatype?: string;
    'xml:lang': string;
}

/** SPARQL* triple in rdf4j-specific format. */
interface SparqlJsonTriple {
    type: 'triple';
    value: {
        s: SparqlJsonTerm;
        p: SparqlJsonTerm;
        o: SparqlJsonTerm;
        g?: SparqlJsonTerm;
    };
}

export function parseSparqlJsonResponse(
    response: SparqlResponse<{ [varName: string]: SparqlJsonTerm }>,
    factory: Rdf.DataFactory
): SparqlResponse<{ [varName: string]: Rdf.Term }> {
    const bindings = response.results.bindings.map(b => convertSparqlJsonBinding(b, factory));
    return {
        head: response.head,
        results: {bindings},
    };
}

function convertSparqlJsonBinding(
    binding: { [varName: string]: SparqlJsonTerm },
    factory: Rdf.DataFactory
): { [varName: string]: Rdf.Term } {
    const result: { [varName: string]: Rdf.Term } = {};
    for (const varName in binding) {
        if (Object.prototype.hasOwnProperty.call(binding, varName)) {
            result[varName] = convertSparqlJsonTerm(binding[varName], factory);
        }
    }
    return result;
}

function convertSparqlJsonTerm(node: SparqlJsonTerm, factory: Rdf.DataFactory): Rdf.Term {
    switch (node.type) {
        case 'uri': return factory.namedNode(node.value);
        case 'bnode': return factory.blankNode(node.value);
        case 'literal': return factory.literal(node.value,
            node['xml:lang'] ? node['xml:lang'] :
            node.datatype ? factory.namedNode(node.datatype) :
            undefined
        );
        case 'triple': return factory.quad(
            convertSparqlJsonTerm(node.value.s, factory) as Rdf.Quad['subject'],
            convertSparqlJsonTerm(node.value.p, factory) as Rdf.Quad['predicate'],
            convertSparqlJsonTerm(node.value.o, factory) as Rdf.Quad['object'],
            node.value.g
                ? convertSparqlJsonTerm(node.value.g, factory) as Rdf.Quad['graph']
                : factory.defaultGraph()
        );
        default: throw new Error(`Unexpected node type: "${(node as SparqlJsonTerm).type}`);
    }
}
