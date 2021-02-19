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
import * as request from 'platform/api/http';
import * as Kefir from 'kefir';
import * as fileSaver from 'file-saver';

import { requestAsProperty } from 'platform/api/async';
import { Rdf, turtle } from 'platform/api/rdf';
import { SparqlUtil } from 'platform/api/sparql';

export const GRAPH_STORE_SERVICE_URL = '/rdf-graph-store';

class GraphStoreService {
  createGraph(
    {targetGraph, graphData, repository}: {
      targetGraph: Rdf.Iri;
      graphData: Rdf.Graph;
      repository?: string;
    }
  ): Kefir.Property<Rdf.Iri> {
    return turtle.serialize.serializeGraph(graphData)
      .flatMap(turtleString => this.createGraphRequest({targetGraph, turtleString, repository}))
      .map(location => Rdf.iri(location))
      .toProperty();
  }

  private createGraphRequest(
    {targetGraph, turtleString, repository}: {
      targetGraph: Rdf.Iri;
      turtleString: string;
      repository?: string;
    }
  ): Kefir.Property<string> {
    const req = request
      .post(GRAPH_STORE_SERVICE_URL)
      .query({graph: targetGraph.value, repository: repository})
      .send(turtleString)
      .type('text/turtle');

    return requestAsProperty(req)
      .map(res => res.header['location']);
  }

  updateGraph(
    {targetGraph, graphData, repository}: {
      targetGraph: Rdf.Iri;
      graphData: Rdf.Graph;
      repository?: string;
    }
  ): Kefir.Property<Rdf.Iri> {
    return turtle.serialize.serializeGraph(graphData)
      .flatMap(turtleString => this.updateGraphRequest({targetGraph, turtleString, repository}))
      .map(location => Rdf.iri(location))
      .toProperty();
  }

  updateGraphRequest(
    {targetGraph, turtleString, repository}: {
      targetGraph: Rdf.Iri;
      turtleString: string;
      repository?: string;
    }
  ): Kefir.Property<string> {
    const req = request
      .put(GRAPH_STORE_SERVICE_URL)
      .query({graph: targetGraph.value, repository: repository})
      .send(turtleString)
      .type('text/turtle');

    return requestAsProperty(req)
      .map(res => res.header['location']);
  }

  createGraphFromFile(
    {targetGraph, keepSourceGraphs, file, contentType, onProgress, repository}: {
      targetGraph: Rdf.Iri;
      keepSourceGraphs: boolean;
      file: File;
      contentType: string;
      onProgress: (percent: number) => void;
      repository?: string;
    }
  ): Kefir.Property<boolean> {
    const req = request.post(GRAPH_STORE_SERVICE_URL)
      .query({
        graph: targetGraph.value,
        keepSourceGraphs: keepSourceGraphs,
        repository: repository,
      })
      .type(contentType)
      .send(file)
      .on('progress',
        (e: {percent: number}) => onProgress(e.percent)
      );

    return requestAsProperty(req)
      .map(() => true);
  }

  updateGraphFromFile(
    {targetGraph, file, contentType, onProgress, repository}: {
      targetGraph: Rdf.Iri;
      file: File;
      contentType: string;
      onProgress: (percent: number) => void;
      repository?: string;
    }
  ): Kefir.Property<boolean> {
    const req = request.put(GRAPH_STORE_SERVICE_URL)
      .query({graph: targetGraph.value, repository: repository})
      .type(contentType)
      .send(file)
      .on('progress',
        (e: { percent: number }) => onProgress(e.percent)
      );

    return requestAsProperty(req)
      .map(() => true);
  }

  getGraph(
    {targetGraph, repository}: {
      targetGraph: Rdf.Iri;
      repository?: string;
    }
  ): Kefir.Property<Rdf.Graph> {
    const req = request
      .get(GRAPH_STORE_SERVICE_URL)
      .query({graph: targetGraph.value, repository: repository})
      .accept('text/turtle');

    return requestAsProperty(req)
      .flatMap(res => turtle.deserialize.turtleToGraph(res.text))
      .toProperty();
  }

  getRawGraph(
    {targetGraph, repository}: {
      targetGraph: Rdf.Iri;
      repository?: string;
    }
  ): Kefir.Property<string> {
    const req = request
        .get(GRAPH_STORE_SERVICE_URL)
        .query({graph: targetGraph.value, repository: repository})
        .accept('text/turtle');

    return requestAsProperty(req)
      .map(res => res.ok ? res.text : null);
  }

  deleteGraph(
    {targetGraph, repository}: {
      targetGraph: Rdf.Iri;
      repository?: string;
    }
  ): Kefir.Property<boolean> {
    const req = request.del(GRAPH_STORE_SERVICE_URL)
      .query({graph: targetGraph.value, repository: repository});

    return requestAsProperty(req)
      .map(() => true);
  }

  downloadGraph(
    {targetGraph, acceptHeader, fileName, repository}: {
      targetGraph: Rdf.Iri;
      acceptHeader: SparqlUtil.ResultFormat;
      fileName: string;
      repository?: string;
    }
  ): Kefir.Property<boolean> {
     const req = request
        .get(GRAPH_STORE_SERVICE_URL)
        .query({graph: targetGraph.value, repository: repository})
        .accept(acceptHeader);

    return requestAsProperty(req)
      .mapErrors(err => this.mapGraphStoreError(err))
      .map(res => this.download(res.text, acceptHeader, fileName));
  }

  private download(response: string, header: SparqlUtil.ResultFormat, filename: string): boolean {
    let blob = new Blob([response], {type: header});
    fileSaver.saveAs(blob, filename);
    return true;
  }

  private mapGraphStoreError(err: any): string {
    if (err && typeof err === 'object') {
      const status = err['status'];
      if (status === 413) {
        return 'File too large. Please contact your administrator.';
      } else if (typeof err.response?.text === 'string') {
        return err.response?.text;
      } else {
        return err;
      }
    }
    return null;
  }
}

export const RDFGraphStoreService = new GraphStoreService();
