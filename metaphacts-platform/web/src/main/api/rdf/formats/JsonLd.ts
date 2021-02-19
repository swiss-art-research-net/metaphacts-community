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
import * as JsonLd from 'jsonld';
import * as Kefir from 'kefir';
import * as N3 from 'n3';
import type * as RdfJs from 'rdf-js';

import * as Rdf from '../core/Rdf';

// HACK: produce blank nodes with `_:` prefix as a workaround for old JSON-LD version
// Should be fixed by updating JSON-LD.js library
const WORKAROUND_DATA_FACTORY: RdfJs.DataFactory<any, any> = {
  ...Rdf.DATA_FACTORY,
  blankNode: (value?: string) => {
    const original = Rdf.DATA_FACTORY.blankNode(value);
    return original.value.startsWith('_:') ? original : Rdf.bnode('_:' + original.value);
  }
};

registerTtlParser();
registerGraphParser();

export interface LoaderOptions {
  /** @default false */
  fetchRemoteContexts?: boolean;
  overrideContexts?: {
    [contextIri: string]: object
  };
}

const NODE_DOCUMENT_LOADER = JsonLd.documentLoaders.node();

export function makeDocumentLoader(options: LoaderOptions): JsonLd.DocumentLoader {
  return (url, callback) => {
    if (options.overrideContexts && url in options.overrideContexts) {
      return callback(null, {
        // this is for a context via a link header
        contextUrl: null,
        // this is the actual document that was loaded
        document: options.overrideContexts[url],
        // this is the actual context URL after redirects
        documentUrl: url,
      });
    }

    if (options.fetchRemoteContexts) {
      return NODE_DOCUMENT_LOADER(url, callback);
    } else {
      callback(new Error(`Fetching remote JSON-LD contexts is not allowed`), null);
    }
  };
}

export function compact(
  input: object,
  ctx: object | string,
  options: JsonLd.CompactOptions & { documentLoader: JsonLd.DocumentLoader }
): Kefir.Property<any> {
  return Kefir.fromNodeCallback(
    callback => JsonLd.compact(input, ctx, options, callback)
  ).toProperty();
}

export function frame(
  input: object | string,
  frame: object,
  options: JsonLd.FrameOptions & { documentLoader: JsonLd.DocumentLoader }
): Kefir.Property<any> {
  return Kefir.fromNodeCallback(
    callback => JsonLd.frame(input, frame, options, callback)
  ).toProperty();
}

export function fromRdf(
  dataset: object | string,
  options: JsonLd.FromRdfOptions & { documentLoader: JsonLd.DocumentLoader }
): Kefir.Property<any> {
  return Kefir.fromNodeCallback(
    callback => JsonLd.fromRDF(dataset, options, callback)
  ).toProperty();
}

function registerTtlParser() {
  JsonLd.registerRDFParser('text/turtle', (input, callback) => {
    const parser = new N3.Parser({factory: WORKAROUND_DATA_FACTORY});
    try {
      const quads = parser.parse(input);
      callback(undefined, quads as JsonLd.Quad[]);
    } catch (err) {
      callback(err, undefined);
    }
  });
}

/**
 * Registers parser from Rdf.Graph to json-ld with 'mph/graph' MIME-type.
 */
function registerGraphParser() {
  JsonLd.registerRDFParser('mph/graph', (input, callback) => {
    const inputGraph = input as Rdf.Graph;
    return inputGraph.triples.toArray();
  });
}
