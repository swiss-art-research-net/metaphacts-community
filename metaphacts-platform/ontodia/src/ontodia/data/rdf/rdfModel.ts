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
import * as RdfJs from 'rdf-js';

import { hashFnv32a } from '../utils';

export type Term = NamedNode | BlankNode | Literal | Variable | DefaultGraph | Quad;

interface TermExtension {
    /**
     * Only for compatibility with external hash-based collections (e.g. Immutable.js);
     * use Rdf.hashTerm() instead.
     */
    hashCode(): number;
}

export interface NamedNode<Iri extends string = string>
    extends RdfJs.NamedNode<Iri>, Partial<TermExtension> {}
export interface BlankNode extends RdfJs.BlankNode, Partial<TermExtension> {}
export interface Literal extends RdfJs.Literal, Partial<TermExtension> {}
export interface Variable extends RdfJs.Variable, Partial<TermExtension> {}
export interface DefaultGraph extends RdfJs.DefaultGraph, Partial<TermExtension> {}
export interface Quad extends RdfJs.BaseQuad, Partial<TermExtension> {
    readonly subject: NamedNode | BlankNode | Variable | Quad;
    readonly predicate: NamedNode | Variable;
    readonly object: NamedNode | BlankNode | Literal | Variable | Quad;
    readonly graph: DefaultGraph | NamedNode | BlankNode | Variable;
}

export type DataFactory = RdfJs.DataFactory<Quad, Quad>;

class RdfNamedNode<Iri extends string> implements NamedNode<Iri>, TermExtension {
    get termType() { return 'NamedNode' as const; }
    constructor(
        readonly value: Iri,
    ) {}
    equals(other: Term | undefined | null): boolean {
        return other && equalTerms(this, other) || false;
    }
    hashCode(): number {
        return hashTerm(this);
    }
    toString(): string {
        return toString(this);
    }
}

class RdfBlankNode implements BlankNode, TermExtension {
    get termType() { return 'BlankNode' as const; }
    constructor(
        readonly value: string,
    ) {}
    equals(other: Term | undefined | null): boolean {
        return other && equalTerms(this, other) || false;
    }
    hashCode(): number {
        return hashTerm(this);
    }
    toString(): string {
        return toString(this);
    }
}

const RDF_LANG_STRING: NamedNode = new RdfNamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#langString');
const XSD_STRING: NamedNode = new RdfNamedNode('http://www.w3.org/2001/XMLSchema#string');

class RdfLiteral implements Literal, TermExtension {
    get termType() { return 'Literal' as const; }
    readonly value: string;
    readonly language: string;
    readonly datatype: NamedNode;
    constructor(value: string, languageOrDatatype?: string | NamedNode) {
        this.value = value;
        if (typeof languageOrDatatype === 'string') {
            this.language = languageOrDatatype;
            this.datatype = RDF_LANG_STRING;
        } else {
            this.language = '';
            this.datatype = languageOrDatatype || XSD_STRING;
        }
    }
    equals(other: Term | undefined | null): boolean {
        return other && equalTerms(this, other) || false;
    }
    hashCode(): number {
        return hashTerm(this);
    }
    toString(): string {
        return toString(this);
    }
}

class RdfVariable implements Variable, TermExtension {
    get termType() { return 'Variable' as const; }
    constructor(
        readonly value: string
    ) {}
    equals(other: Term | undefined | null): boolean {
        return other && equalTerms(this, other) || false;
    }
    hashCode(): number {
        return hashTerm(this);
    }
    toString(): string {
        return toString(this);
    }
}

class RdfDefaultGraph implements DefaultGraph, TermExtension {
    static readonly instance = new RdfDefaultGraph();
    get termType() { return 'DefaultGraph' as const; }
    readonly value = '';
    equals(other: Term | undefined | null): boolean {
        return other && equalTerms(this, other) || false;
    }
    hashCode(): number {
        return hashTerm(this);
    }
    toString(): string {
        return toString(this);
    }
}

class RdfQuad implements Quad {
    constructor(
        readonly subject: NamedNode | BlankNode | Variable | Quad,
        readonly predicate: NamedNode | Variable,
        readonly object: NamedNode | BlankNode | Literal | Variable | Quad,
        readonly graph: DefaultGraph | NamedNode | BlankNode | Variable = RdfDefaultGraph.instance,
    ) {}
    get termType() { return 'Quad' as const; }
    get value() { return '' as const; }
    hashCode(): number {
        return hashQuad(this);
    }
    equals(other: Quad | undefined | null): boolean {
        return other && equalQuads(this, other) || false;
    }
    toString() {
        let text = `${toString(this.subject)} ${toString(this.predicate)} ${toString(this.object)}`;
        if (this.graph.termType !== 'DefaultGraph') {
            text += ` ${toString(this.graph)}`;
        }
        return text;
    }
}

export function randomBlankNode(factory: DataFactory, prefix: string, randomBitCount: number): BlankNode {
    if (randomBitCount > 48) {
        throw new Error(`Cannot generate random blank node with > 48 bits of randomness`);
    }
    const hexDigitCount = Math.ceil(randomBitCount / 4);
    const num = Math.floor(Math.random() * Math.pow(2, randomBitCount));
    let hexNum = num.toString(16);
    while (hexNum.length < hexDigitCount) {
        hexNum = '0' + hexNum;
    }
    const value = prefix + hexNum;
    return factory.blankNode(value);
}

class RdfDataFactory implements DataFactory {
    namedNode = <Iri extends string = string>(value: Iri): NamedNode<Iri> => {
        return new RdfNamedNode(value);
    }
    blankNode = (value?: string | undefined): BlankNode => {
        return typeof value === 'string'
            ? new RdfBlankNode(value) : randomBlankNode(this, 'b', 48);
    }
    literal = (value: string, languageOrDatatype?: string | NamedNode | undefined): Literal => {
        return new RdfLiteral(value, languageOrDatatype);
    }
    variable = (value: string): Variable => {
        return new RdfVariable(value);
    }
    defaultGraph = (): DefaultGraph => {
        return RdfDefaultGraph.instance;
    }
    quad = (
        subject: Quad['subject'],
        predicate: Quad['predicate'],
        object: Quad['object'],
        graph?: Quad['graph']
    ): Quad => {
        return new RdfQuad(subject, predicate, object, graph);
    }
}

export const OntodiaDataFactory: DataFactory = new RdfDataFactory();

export function toString(node: Term): string {
    switch (node.termType) {
        case 'NamedNode':
            return `<${node.value}>`;
        case 'BlankNode':
            return `_:${node.value}`;
        case 'Literal': {
            const {value, language, datatype} = node;
            const stringLiteral = `"${escapeLiteralValue(value)}"`;
            if (language) {
                return stringLiteral + `@${language}`;
            } else if (datatype) {
                return stringLiteral + '^^' + toString(datatype);
            } else {
                return stringLiteral;
            }
        }
        case 'DefaultGraph':
            return '(default graph)';
        case 'Variable':
            return `?${node.value}`;
        case 'Quad': {
            let result = `<< `;
            result += toString(node.subject) + ' ';
            result += toString(node.predicate) + ' ';
            result += toString(node.object) + ' ';
            if (node.graph.termType !== 'DefaultGraph') {
                result += toString(node.graph) + ' ';
            }
            result += '>>';
            return result;
        }
    }
    return '';
}

function escapeLiteralValue(value: string): string {
    return value
        .replace('"', '\\"')
        .replace('\t', '\\t')
        .replace('\r', '\\r')
        .replace('\n', '\\n');
}

export function hashTerm(node: Term): number {
    let hash = 0;
    switch (node.termType) {
        case 'NamedNode':
        case 'BlankNode':
            hash = hashFnv32a(node.value);
            break;
        case 'Literal':
            hash = hashFnv32a(node.value);
            if (node.datatype) {
                // tslint:disable-next-line: no-bitwise
                hash = (hash * 31 + hashFnv32a(node.datatype.value)) | 0;
            }
            if (node.language) {
                // tslint:disable-next-line: no-bitwise
                hash = (hash * 31 + hashFnv32a(node.language)) | 0;
            }
            break;
        case 'Variable':
            hash = hashFnv32a(node.value);
            break;
        case 'Quad':
            hash = hashQuad(node);
            break;
    }
    return hash;
}

export function equalTerms(a: Term, b: Term): boolean {
    if (a.termType !== b.termType) {
        return false;
    }
    switch (a.termType) {
        case 'NamedNode':
        case 'BlankNode':
        case 'Variable':
        case 'DefaultGraph': {
            const {value} = b as NamedNode | BlankNode | Variable | DefaultGraph;
            return a.value === value;
        }
        case 'Literal': {
            const {value, language, datatype} = b as Literal;
            return a.value === value
                && a.datatype.value === datatype.value
                && a.language === language;
        }
        case 'Quad': {
            return equalQuads(a, b as Quad);
        }
    }
    return false;
}

export function hashQuad(q: Quad): number {
    /* tslint:disable: no-bitwise */
    let h = 0;
    h = (h * 31 + hashTerm(q.subject)) | 0;
    h = (h * 31 + hashTerm(q.predicate)) | 0;
    h = (h * 31 + hashTerm(q.object)) | 0;
    h = (h * 31 + hashTerm(q.graph)) | 0;
    return h;
    /* tslint:enable: no-bitwise */
}

export function equalQuads(a: Quad, b: Quad): boolean {
    return (
        equalTerms(a.subject, b.subject) &&
        equalTerms(a.predicate, b.predicate) &&
        equalTerms(a.object, b.object) &&
        equalTerms(a.graph, b.graph)
    );
}

export function compareTerms(a: Term, b: Term): number {
    if (a.termType < b.termType) { return -1; }
    if (a.termType > b.termType) { return 1; }
    if (a.value < b.value) { return -1; }
    if (a.value > b.value) { return 1; }
    if (a.termType === 'Literal' && b.termType === 'Literal') {
        const result = compareTerms(a.datatype, b.datatype);
        if (result !== 0) { return result; }
        if (a.language < b.language) { return -1; }
        if (a.language > b.language) { return 1; }
    }
    return 0;
}

export function compareQuads(a: Quad, b: Quad): number {
    let r = compareTerms(a.graph, b.graph);
    if (r !== 0) { return r; }
    r = compareTerms(a.subject, b.subject);
    if (r !== 0) { return r; }
    r = compareTerms(a.predicate, b.predicate);
    if (r !== 0) { return r; }
    r = compareTerms(a.object, b.object);
    return r;
}
