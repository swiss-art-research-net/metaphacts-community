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
import { Component } from 'react';
import { RdfDataProvider, parseTurtleText } from 'ontodia';
import * as Kefir from 'kefir';

import { Rdf } from 'platform/api/rdf';
import { SparqlClient } from 'platform/api/sparql';

import { DataProviderComponent } from './OntodiaDataProviders';

/**
 * Allows displaying data in `ontodia` that don't exist in the database.
 */
export interface OntodiaRdfDataProviderConfig {
  /**
   * SPARQL query to store data that do not exist in the database.
   */
  provisionQuery?: string;
  /**
   * Graph data to display result of the query.
   */
  provisionGraph?: string;
  /**
   * Repository ID.
   */
  provisionRepository?: string;
}

export type OntodiaRdfDataProviderProps = OntodiaRdfDataProviderConfig;

export class OntodiaRdfDataProvider extends Component<OntodiaRdfDataProviderProps, {}>
  implements DataProviderComponent {
  static defaultProps: Partial<OntodiaRdfDataProviderProps> = {
    provisionRepository: 'default',
  };

  render(): null {
    return null;
  }

  createDataProvider(): RdfDataProvider {
    return new RdfDataProvider({factory: Rdf.DATA_FACTORY, data: [], parsers: {}});
  }

  initializeDataProvider(dataProvider: RdfDataProvider): Kefir.Property<void> {
    return this.importProvisionData(dataProvider);
  }

  getName(): string {
    return `${this.props.provisionRepository}-rdf`;
  }

  private importProvisionData = (rdfDataProvider: RdfDataProvider): Kefir.Property<void> => {
    const {provisionGraph, provisionQuery, provisionRepository} = this.props;
    return Kefir.constant(undefined)
      .flatMap(() => {
        if (provisionGraph) {
          try {
            const quads = parseTurtleText(provisionGraph, Rdf.DATA_FACTORY);
            return Kefir.constant(rdfDataProvider.addGraph(quads));
          } catch (err) {
            return Kefir.constantError(err);
          }
        } else {
          return Kefir.constant(undefined);
        }
      })
      .flatMap(() => {
        if (provisionQuery) {
          return SparqlClient.construct(provisionQuery,
            {context: {repository: provisionRepository}})
            .map(graph => {
              rdfDataProvider.addGraph(graph);
            });
        } else {
          return Kefir.constant(undefined);
        }
      })
      .toProperty();
  }
}

export default OntodiaRdfDataProvider;
