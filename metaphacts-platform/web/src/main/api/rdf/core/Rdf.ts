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
import * as _ from 'lodash';
import * as Maybe from 'data.maybe';
import * as Immutable from 'immutable';
import type * as RdfJs from 'rdf-js';

import { serializerFor, deserializerFor } from 'platform/api/json';

export interface Iri<V extends string = string>
  extends RdfJs.NamedNode<V>, Partial<TermExtension> {}
export interface Literal extends RdfJs.Literal, Partial<TermExtension> {}
export interface BNode extends RdfJs.BlankNode, Partial<TermExtension> {}
export interface Variable extends RdfJs.Variable, Partial<TermExtension> {}
export interface DefaultGraph extends RdfJs.DefaultGraph, Partial<TermExtension> {}
export interface Quad extends RdfJs.BaseQuad, Partial<TermExtension> {
  readonly subject: Iri | BNode | Variable | Quad;
  readonly predicate: Iri | Variable;
  readonly object: Iri | BNode | Literal | Variable | Quad;
  readonly graph: Iri | BNode | DefaultGraph | Variable;
  /** Alias for `Quad.subject` */
  readonly s: Iri | BNode | Variable | Quad;
  /** Alias for `Quad.predicate` */
  readonly p: Iri | Variable;
  /** Alias for `Quad.object` */
  readonly o: Iri | BNode | Literal | Variable | Quad;
}

/**
 * Quad interface alias for backwards compatibility.
 * @deprecated Use `Rdf.Quad` instead.
 */
export type Triple = Quad;

/**
 * Subset of term types which was commonly used throughout the platform
 * before RDF/JS support was added.
 */
export type Node = Iri | Literal | BNode;
/**
 * Minimal base interface for all RDF/JS term types and extensions,
 * e.g. IRI, Literal, Quad from RDF/JS itself; Wildcard from SPARQL.js; etc
 */
export interface TermLike {
  readonly termType: string;
  readonly value: string;
  equals(other: TermLike): boolean;
}
/**
 * Known (supported) term types from RDF/JS model.
 */
export type Term = Iri | Literal | BNode | Variable | DefaultGraph | Quad;

interface TermExtension {
    /** @ignore */
    hashCode(): number;
    /** @ignore */
    toString(): string;
    /** @ignore */
    toJSON(): unknown;
}

class PlatformIri<V extends string = string> implements Iri<V>, TermExtension {
  private readonly _value: V;

  constructor(value: V) {
    this._value = value;
  }

  get termType(): 'NamedNode' {
    return 'NamedNode';
  }

  get value(): V {
    return this._value;
  }

  equals(other: Term | undefined | null): boolean {
    if (!(other && typeof other === 'object')) { return false; }
    return equalTerms(this, other);
  }

  hashCode(): number {
    return hashTerm(this);
  }

  toString(): string {
    return termToString(this);
  }

  toJSON() {
    return {
      'termType': 'NamedNode',
      'value': this.value,
    };
  }

  static fromJSON(obj: Pick<PlatformIri, 'value'>): PlatformIri {
    return new PlatformIri(obj.value);
  }
}

serializerFor<PlatformIri>({
  name: 'Iri',
  predicate: obj => obj instanceof PlatformIri,
  serializer: obj => obj.toJSON(),
});
deserializerFor<PlatformIri>({
  name: 'Iri',
  deserializer: PlatformIri.fromJSON,
});

export function iri(value: string): Iri {
  return new PlatformIri(value);
}

export function isIri(term: TermLike): term is Iri {
  return (term.termType as Term['termType']) === 'NamedNode';
}

/**
 * Convert <> enclosed Iri into [Rdf.Iri];
 * @param value full iri enclosed in <>
 */
export function fullIri(value: string): Iri {
  if (_.startsWith(value, '<') && _.endsWith(value, '>')) {
    // remove '<' and '>' form iri string
    return iri(value.slice(1, -1));
  } else {
    throw new Error('Expected IRI to be enclosed in <>, for ' + value);
  }
}

export const BASE_IRI = iri('');

const RDF_LANG_STRING = iri('http://www.w3.org/1999/02/22-rdf-syntax-ns#langString');
const XSD_STRING = iri('http://www.w3.org/2001/XMLSchema#string');
const XSD_BOOLEAN = iri('http://www.w3.org/2001/XMLSchema#boolean');

class PlatformLiteral implements Literal, TermExtension {
  private readonly _value: string;
  private readonly _datatype: Iri;
  private readonly _lang: string;

  constructor(value: string, datatypeOrLanguage?: Iri | string) {
    this._value = value;
    if (typeof datatypeOrLanguage === 'string') {
      this._datatype = RDF_LANG_STRING;
      this._lang = datatypeOrLanguage;
    } else {
      this._datatype = datatypeOrLanguage || XSD_STRING;
      this._lang = '';
    }
  }

  get termType(): 'Literal' {
    return 'Literal';
  }

  get value(): string {
    return this._value;
  }

  get datatype(): Iri {
    return this._datatype;
  }

  get language(): string {
    return this._lang;
  }

  equals(other: Term | undefined | null): boolean {
    if (!(other && typeof other === 'object')) { return false; }
    return equalTerms(this, other);
  }

  hashCode(): number {
    return hashTerm(this);
  }

  toString(): string {
    return termToString(this);
  }

  toJSON() {
    return {
      'termType': 'Literal',
      'value': this.value,
      'datatype': this.datatype,
      'language': this.language,
    };
  }

  static fromJSON(
    obj: Pick<Literal, 'value' | 'datatype' | 'language'> &
      { readonly dataType?: Iri; readonly lang?: string }
  ): PlatformLiteral {
    // preserve backwards-compatibility with previous serialization
    const datatype = obj.datatype ? PlatformIri.fromJSON(obj.datatype) : obj.dataType;
    const language = typeof obj.language === 'string' ? obj.language : obj.lang;
    return new PlatformLiteral(obj.value, language ? language : datatype);
  }
}

serializerFor<PlatformLiteral>({
  name: 'Literal',
  predicate: obj => obj instanceof PlatformLiteral,
  serializer: obj => obj.toJSON(),
});
deserializerFor<PlatformLiteral>({
  name: 'Literal',
  deserializer: PlatformLiteral.fromJSON,
});

export function literal(value: string | boolean, dataType?: Iri): Literal {
  if (typeof value === 'boolean') {
    return new PlatformLiteral(value.toString(), XSD_BOOLEAN);
  } else {
    return new PlatformLiteral(value, dataType);
  }
}

export function langLiteral(value: string, lang: string): Literal {
  return new PlatformLiteral(value, lang);
}

export function isLiteral(term: TermLike): term is Literal {
  return (term.termType as Term['termType']) === 'Literal';
}

class PlatformBlankNode implements BNode, TermExtension {
  private readonly _value: string;

  constructor(value: string) {
    this._value = value;
  }

  get termType(): 'BlankNode' {
    return 'BlankNode';
  }

  get value(): string {
    return this._value;
  }

  equals(other: Term | undefined | null): boolean {
    if (!(other && typeof other === 'object')) { return false; }
    return equalTerms(this, other);
  }

  hashCode(): number {
    return hashTerm(this);
  }

  toString(): string {
    return termToString(this);
  }

  toJSON() {
    return {
      'termType': 'BlankNode',
      'value': this.value,
    };
  }

  static fromJSON(obj: Pick<PlatformBlankNode, 'value'>): PlatformBlankNode {
    return new PlatformBlankNode(obj.value);
  }
}

serializerFor<PlatformBlankNode>({
  name: 'BNode',
  predicate: obj => obj instanceof PlatformBlankNode,
  serializer: obj => obj.toJSON(),
});
deserializerFor<PlatformBlankNode>({
  name: 'BNode',
  deserializer: PlatformBlankNode.fromJSON,
});

export function bnode(value?: string): BNode {
  if (typeof value === 'string') {
    return new PlatformBlankNode(value);
  } else {
    return new PlatformBlankNode(Math.random().toString(36).substring(7));
  }
}

export function isBnode(term: TermLike): term is BNode {
  return (term.termType as Term['termType']) === 'BlankNode';
}

class PlatformVariable implements Variable, TermExtension {
  private readonly _value: string;

  constructor(value: string) {
    if (value.startsWith('?') || value.startsWith('$')) {
      throw new Error('Variable name cannot start with ? or $');
    }
    this._value = value;
  }

  get termType(): 'Variable' {
    return 'Variable';
  }

  get value(): string {
    return this._value;
  }

  equals(other: Term | undefined | null): boolean {
    if (!(other && typeof other === 'object')) { return false; }
    return equalTerms(this, other);
  }

  hashCode(): number {
    return hashTerm(this);
  }

  toString(): string {
    return termToString(this);
  }

  toJSON() {
    return {
      'termType': 'Variable',
      'value': this.value,
    };
  }

  static fromJSON(obj: Pick<PlatformVariable, 'value'>): PlatformVariable {
    return new PlatformVariable(obj.value);
  }
}

serializerFor<PlatformVariable>({
  name: 'Variable',
  predicate: obj => obj instanceof PlatformVariable,
  serializer: obj => obj.toJSON(),
});
deserializerFor<PlatformVariable>({
  name: 'Variable',
  deserializer: PlatformVariable.fromJSON,
});

class PlatformDefaultGraph implements DefaultGraph, TermExtension {
  private readonly _value = '';

  constructor() {
    return (DEFAULT_GRAPH as PlatformDefaultGraph) || this;
  }

  get termType(): 'DefaultGraph' {
    return 'DefaultGraph';
  }

  get value(): '' {
    return this._value;
  }

  equals(other: Term | undefined | null): boolean {
    if (!(other && typeof other === 'object')) { return false; }
    return equalTerms(this, other);
  }

  hashCode(): number {
    return hashTerm(this);
  }

  toString(): string {
    return termToString(this);
  }

  toJSON() {
    return {
      'termType': 'DefaultGraph',
    };
  }

  static fromJSON(obj: {}): PlatformDefaultGraph {
    return new PlatformDefaultGraph();
  }
}

export const DEFAULT_GRAPH: DefaultGraph = new PlatformDefaultGraph();

serializerFor<PlatformDefaultGraph>({
  name: 'DefaultGraph',
  predicate: obj => obj instanceof PlatformDefaultGraph,
  serializer: obj => obj.toJSON(),
});
deserializerFor<PlatformDefaultGraph>({
  name: 'DefaultGraph',
  deserializer: PlatformDefaultGraph.fromJSON,
});

class PlatformQuad implements Quad {
  private _s: Iri | BNode | Variable | Quad;
  private _p: Iri | Variable;
  private _o: Iri | BNode | Literal | Variable | Quad;
  private _g: Iri | BNode | DefaultGraph | Variable;

  constructor(
    s: Iri | BNode | Variable | Quad,
    p: Iri | Variable,
    o: Iri | BNode | Literal | Variable | Quad,
    g: Iri | BNode | DefaultGraph | Variable = DEFAULT_GRAPH
  ) {
    this._s = s;
    this._p = p;
    this._o = o;
    this._g = g;
  }

  get termType(): 'Quad' {
    return 'Quad';
  }

  get value(): '' {
    return '';
  }

  get subject() {
    return this._s;
  }

  get predicate() {
    return this._p;
  }

  get object() {
    return this._o;
  }

  get graph() {
    return this._g;
  }

  /** Alias for `Quad.subject` */
  get s() { return this._s; }
  /** Alias for `Quad.predicate` */
  get p() { return this._p; }
  /** Alias for `Quad.object` */
  get o() { return this._o; }

  equals(other: Term | undefined | null): boolean {
    if (!(other && typeof other === 'object')) { return false; }
    return equalTerms(this, other);
  }

  hashCode(): number {
    return hashTerm(this);
  }

  toString(): string {
    return termToString(this);
  }
}

export function quad(
  s: Quad['subject'],
  p: Quad['predicate'],
  o: Quad['object'],
  g?: Quad['graph']
): Quad {
  return new PlatformQuad(s, p, o, g);
}

/** Alias for `quad()` for backwards compatibility. */
export const triple = quad;

export function isQuad(term: TermLike): term is Quad {
  return (term.termType as Term['termType']) === 'Quad';
}

export function looksLikeTerm(value: unknown): value is TermLike {
  if (!(value && typeof value === 'object')) { return false; }
  return typeof (value as Partial<Term>).termType === 'string'
    && typeof (value as Partial<Term>).equals === 'function';
}

export function isKnownTerm(value: TermLike): value is Term {
  switch (value.termType as Term['termType']) {
    case 'NamedNode':
    case 'Literal':
    case 'BlankNode':
    case 'DefaultGraph':
    case 'Variable':
    case 'Quad':
      return true;
  }
  return false;
}

export function isNode(value: TermLike): value is Node {
  switch (value.termType as Term['termType']) {
    case 'NamedNode':
    case 'Literal':
    case 'BlankNode':
      return true;
  }
  return false;
}

class DataFactory implements RdfJs.DataFactory<Quad, Quad> {
  namedNode = <V extends string = string>(value: V): RdfJs.NamedNode<V> => {
    return iri(value) as Iri<V>;
  }
  blankNode = (value?: string): RdfJs.BlankNode => {
    return bnode(value);
  }
  literal = (value: string, languageOrDatatype?: string | RdfJs.NamedNode): RdfJs.Literal => {
    return new PlatformLiteral(value, languageOrDatatype);
  }
  variable = (value: string): RdfJs.Variable => {
    return new PlatformVariable(value);
  }
  defaultGraph = (): RdfJs.DefaultGraph => {
    return DEFAULT_GRAPH;
  }
  quad = (
    subject: Quad['subject'],
    predicate: Quad['predicate'],
    object: Quad['object'],
    graphTerm?: Quad['graph']
  ): Quad => {
    return new PlatformQuad(subject, predicate, object, graphTerm);
  }
}

export const DATA_FACTORY = new DataFactory();

export class Graph {
  private _triples: Immutable.Set<Quad>;

  constructor(triples: Immutable.Set<Quad>) {
    this._triples = triples;
  }

  get triples(): Immutable.Set<Quad> {
    return this._triples;
  }
}

export function graph(triples: ReadonlyArray<Quad> | Immutable.Set<Quad>): Graph {
  return new Graph(Immutable.Set<Quad>(triples));
}

export function union(...graphs: Graph[]): Graph {
  return graph(
    Immutable.Set(graphs).map(g => g.triples).flatten() as Immutable.Set<Quad>
  );
}

export class PointedGraph {
  private _pointer: Node;
  private _graph: Graph;

  constructor(pointer: Node, graphContent: Graph) {
    this._pointer = pointer;
    this._graph = graphContent;
  }

  get pointer(): Node {
    return this._pointer;
  }

  get graph(): Graph {
    return this._graph;
  }
}

export function pg(pointer: Node, graphContent: Graph) {
  return new PointedGraph(pointer, graphContent);
}

export function hashTerm(node: Term): number {
  let hash = 0;
  switch (node.termType) {
    case 'NamedNode':
    case 'BlankNode':
      hash = hashString(node.value);
      break;
    case 'Literal':
      hash = hashString(node.value);
      if (node.datatype) {
        // tslint:disable-next-line: no-bitwise
        hash = (hash * 31 + hashString(node.datatype.value)) | 0;
      }
      if (node.language) {
        // tslint:disable-next-line: no-bitwise
        hash = (hash * 31 + hashString(node.language)) | 0;
      }
      break;
    case 'Variable':
      hash = hashString(node.value);
      break;
    case 'Quad': {
      // tslint:disable: no-bitwise
      hash = 1;
      hash = (hash * 31 + hashTerm(node.subject)) | 0;
      hash = (hash * 31 + hashTerm(node.predicate)) | 0;
      hash = (hash * 31 + hashTerm(node.object)) | 0;
      hash = (hash * 31 + hashTerm(node.graph)) | 0;
      // tslint:enable: no-bitwise
    }
  }
  return smi(hash);
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
      const {value} = b as Iri | BNode | Variable | DefaultGraph;
      return a.value === value;
    }
    case 'Literal': {
      const {value, language, datatype} = b as Literal;
      return a.value === value
        && a.datatype.value === datatype.value
        && a.language === language;
    }
    case 'Quad': {
      const other = b as Quad;
      return (
        equalTerms(a.subject, other.subject) &&
        equalTerms(a.predicate, other.predicate) &&
        equalTerms(a.object, other.object) &&
        equalTerms(a.graph, other.graph)
      );
    }
  }
  return false;
}

export function termToString(node: Term): string {
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
        return stringLiteral + '^^' + termToString(datatype);
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
      result += termToString(node.subject) + ' ';
      result += termToString(node.predicate) + ' ';
      result += termToString(node.object) + ' ';
      if (node.graph.termType !== 'DefaultGraph') {
        result += termToString(node.graph) + ' ';
      }
      result += '>>';
      return result;
    }
  }
}

function escapeLiteralValue(value: string): string {
  return value
      .replace('"', '\\"')
      .replace('\t', '\\t')
      .replace('\r', '\\r')
      .replace('\n', '\\n');
}

// http://jsperf.com/hashing-strings
export function hashString(string: string) {
  // This is the hash from JVM
  // The hash code for a string is computed as
  // s[0] * 31 ^ (n - 1) + s[1] * 31 ^ (n - 2) + ... + s[n - 1],
  // where s[i] is the ith character of the string and n is the length of
  // the string. We "mod" the result to make it between 0 (inclusive) and 2^31
  // (exclusive) by dropping high bits.
  let hash = 0;
  for (let ii = 0; ii < string.length; ii++) {
    // tslint:disable-next-line: no-bitwise
    hash = (31 * hash + string.charCodeAt(ii)) | 0;
  }
  return smi(hash);
}

// v8 has an optimization for storing 31-bit signed numbers.
// Values which have either 00 or 11 as the high order bits qualify.
// This function drops the highest order bit in a signed number, maintaining
// the sign bit.
export function smi(i32: number) {
  // tslint:disable-next-line: no-bitwise
  return ((i32 >>> 1) & 0x40000000) | (i32 & 0xBFFFFFFF);
}

export const EMPTY_GRAPH = graph([]);

export function getValueFromPropertyPath<T extends Node = Node>(
  propertyPath: Array<Iri>, g: PointedGraph
): Data.Maybe<T> {
  const values = getValuesFromPropertyPath(propertyPath, g);
  if (values.length > 1) {
    throw new Error('more than one value found in the graph for property path ' + propertyPath);
  }
  return Maybe.fromNullable(
    getValuesFromPropertyPath(propertyPath, g)[0]
  ) as Data.Maybe<T>;
}

export function getValuesFromPropertyPath<T extends Node = Node>(
  propertyPath: Array<Iri>, g: PointedGraph
): Array<T> {
  // reduce property path from left to right traversing the graph
  const nodes =
    _.reduce(
      propertyPath,
      (ss, p) =>
        _.flatMap(
          ss, iriPointer => g.graph.triples
            .filter(t => t.s.equals(iriPointer) && t.p.equals(p) && isNode(t.o))
            .toArray()
        ).map(t => t.o as Node),
      [g.pointer]
    );
  return _.uniqBy(nodes, node => node.value) as Array<T>;
}

/**
 * Extracts local name for URI the same way as it's done in RDF4J.
 */
export function getLocalName(uri: string): string | undefined {
  let index = uri.indexOf('#');
  if (index < 0) {
    index = uri.lastIndexOf('/');
  }
  if (index < 0) {
    index = uri.lastIndexOf(':');
  }
  if (index < 0) {
    return undefined;
  }
  return uri.substring(index + 1);
}
