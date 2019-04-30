/*
 * Copyright (C) 2015-2019, metaphacts GmbH
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

import * as jsonld from 'jsonld';
import { DIAGRAM_CONTEXT_URL_V1 } from 'ontodia';
import * as N3 from 'n3';
import Quad = JsonLd.Quad;
import Term = JsonLd.Term;
import * as Rdf from 'platform/api/rdf/core/Rdf';

export const OntodiaContextV1 = require('ontodia/schema/context-v1.json');

const CONTEXTS = {
  DIAGRAM_CONTEXT_URL_V1: OntodiaContextV1,
};

export function registerCustomContextLoader() {
  (jsonld as any).documentLoader = customContextLoader;
}

function customContextLoader(url: string): Promise<any> {
  if (url in CONTEXTS) {
    return Promise.resolve({
      document: CONTEXTS[url],
      documentUrl: url,
    });
  }
  throw Error('Context not found');
}

// adding parser from Rdf.Graph to json-ld with 'mph/graph' Mime type
export function registerGraphParser() {
  jsonld.registerRDFParser('mph/graph', (input, callback) => {
    const inputGraph = input as Rdf.Graph;
    const quads = inputGraph.triples.forEach(triple => (
      {
        subject: getTerm(triple.s),
        predicate: getTerm(triple.p),
        object: getTerm(triple.o),
        graph: {
          termType: 'DefaultGraph',
          value: '',
        }
      }
    ));
    function getTerm(term: Rdf.Node): Term {
      if (term.isLiteral()) {
        const lang = (term instanceof Rdf.LangLiteral) ? term.lang : '';
        return {
          termType: 'Literal',
          value: term.value,
          language: lang,
          datatype: {
            termType: 'NamedNode',
            value: term.dataType.value,
          },
        };
      } else if (term.isBnode()) {
          return {
            termType: 'BlankNode',
            value: term.value,
          };
      } else if (term.isIri()) {
        return {
          termType: 'NamedNode',
          value: term.value,
        };
      }
    }
    return quads;
  });
}

export function registerTtlParser() {
  jsonld.registerRDFParser('text/turtle', (input, callback) => {
    const quads: Quad[] = [];
    N3.Parser().parse(input, (error, triple, hash) => {
      if (error) {
        callback(error, quads);
      } else if (triple) {
        const quad = createJsonLdQuad(triple);
        quads.push(quad);
      } else if (callback) {
        callback(undefined, quads);
      }
    });
  });
}

function createJsonLdQuad(triple: N3.Triple): Quad {
  return {
    subject: getTerm(triple.subject),
    predicate: getTerm(triple.predicate),
    object: getTerm(triple.object),
    graph: {
      termType: 'DefaultGraph',
      value: '',
    },
  };

  function getTerm(value: string): Term {
    if (N3.Util.isLiteral(value)) {
      return getLiteralTerm(value);
    } else if (N3.Util.isBlank(value)) {
      return {
        termType: 'BlankNode',
        value: value,
      };
    } else {
      return {
        termType: 'NamedNode',
        value: value,
      };
    }
  }

  function getLiteralTerm(literal: string): Term {
    return {
      termType: 'Literal',
      value: N3.Util.getLiteralValue(literal),
      language: N3.Util.getLiteralLanguage(literal),
      datatype: {
        termType: 'NamedNode',
        value: N3.Util.getLiteralType(literal),
      },
    };
  }
}
