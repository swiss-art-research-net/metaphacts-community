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
import * as N3 from 'n3';
import * as Kefir from 'kefir';
import * as _ from 'lodash';
import type * as RdfJs from 'rdf-js';

import * as Rdf from '../core/Rdf';

/**
 * Provides functions for RDF serialization into Turtle.
 * As well as converters between {@link ../core/Rdf} and {@link n3}
 */
export module serialize {

  export const Format = {
    Turtle: 'turtle',
    NTriples: 'N-Triples',
    Trig: 'application/trig',
    NQuads: 'N-Quads',
  };

  /**
   * Serialize {@link Rdf.Graph} into Turtle format.
   */
  export function serializeGraph(
    graph: Rdf.Graph, format: string = Format.Turtle
  ): Kefir.Property<string> {
    const writer = new N3.Writer({format: format});
    graph.triples.forEach(
      // type-cast here due to incorrect N3 typings
      // (too concrete N3.Quad type -- should be RDF/JS one)
      triple => writer.addQuad(triple as unknown as N3.Quad)
    );
    return Kefir.fromNodeCallback<string>(
      writer.end.bind(writer)
    ).toProperty();
  }

  /**
   * Convert {@link Rdf.Node} into N3 value.
   *
   * @see https://github.com/RubenVerborgh/N3.js#triple-representation
   */
  export function nodeToN3(value: Rdf.Node): string {
    return Rdf.termToString(value);
  }
}

/**
 * Provides functions for RDF de-serialization from Turtle.
 * As well as converters between {@link ../core/Rdf} and {@link n3}
 */
export module deserialize {

  /**
   * Deserialize Turtle string as {@link Rdf.Graph}.
   */
  export function turtleToGraph(turtle: string): Kefir.Property<Rdf.Graph> {
    return turtleToTriples(turtle).map(Rdf.graph);
  }

  /**
   * Deserialize Turtle string as array of {@link Rdf.Quad}
   */
  export function turtleToTriples(turtle: string): Kefir.Property<Rdf.Quad[]> {
    return Kefir.stream<Rdf.Quad>(emitter => {
      initN3Parser(emitter, turtle);
    }).scan(
      (acc: Rdf.Quad[], x: Rdf.Quad) => {
        acc.push(x);
        return acc;
      }, []
    ).last();
  }

  /**
   * Converts N3.js representation of the RDF value into {@link Rdf.Node}.
   */
  export function n3ValueToRdf(value: string): Rdf.Node {
    const parser = new N3.Parser({
      // type-cast here due to incorrect N3 typings
      // (too concrete N3.Quad type -- should be RDF/JS one)
      factory: Rdf.DATA_FACTORY as RdfJs.DataFactory<any, any>,
      blankNodePrefix: '',
    });
    const [quad] = parser.parse(`<s:s> <p:p> ${value} .`);
    switch (quad.object.termType) {
      case 'NamedNode':
      case 'BlankNode':
      case 'Literal':
        return quad.object;
      default:
        throw new Error('Unexpected N3 term type: ' + quad.object.termType);
    }
  }

  /**
   * Create streaming Turtle parser.
   */
  function initN3Parser(emitter: Kefir.Emitter<Rdf.Quad>, turtle: string): N3.Parser {
    const parser = new N3.Parser({
      // type-cast here due to incorrect N3 typings
      // (too concrete N3.Quad type -- should be RDF/JS one)
      factory: Rdf.DATA_FACTORY as RdfJs.DataFactory<any, any>,
      blankNodePrefix: '',
    });
    parser.parse(turtle, (error, triple, prefixes) => {
      if (error) {
        emitter.error(error);
      }
      if (triple != null) {
        // triple is always Rdf.Triple here because we passed Rdf.DATA_FACTORY above
        emitter.emit(triple as unknown as Rdf.Quad);
      } else {
        emitter.end();
      }
    });
    return parser;
  }
}
