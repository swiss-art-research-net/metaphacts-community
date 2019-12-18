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

import * as SparqlJs from 'sparqljs';
import {
  RDFDataProvider,
  SparqlDataProvider,
  SparqlDataProviderSettings,
  DPDefinition,
  SparqlDataProviderOptions,
  LinkConfiguration,
  CompositeDataProvider,
  PropertyConfiguration
} from 'ontodia';

import { Rdf } from 'platform/api/rdf';
import { SparqlUtil, SparqlTypeGuards, VariableRenameBinder } from 'platform/api/sparql';
import { getBaseUrl } from 'platform/api/http';
import { FieldDefinition } from 'platform/components/forms';
import { xsd, rdf } from 'platform/api/rdf/vocabularies';

import { OwlStatsSettings, OwlNoStatsSettings, WikidataSettings } from './DataProviderProfiles';

export const RDF_DATA_PROVIDER_NAME = 'rdf';

const SUPPORTED_PROFILES = {
  'default': OwlStatsSettings,
  'nostats': OwlNoStatsSettings,
  'wikidata': WikidataSettings,
};

export type SupportedConfigName = keyof typeof SUPPORTED_PROFILES;

export function createDataProvider(params: {
  configName?: SupportedConfigName;
  options: SparqlDataProviderOptions;
  settings: SparqlDataProviderSettings;
  repositories: string[];
  createRDFStorage?: boolean;
  fields?: ReadonlyArray<FieldDefinition>;
  forceFields?: ReadonlyMap<string, FieldDefinition>;
}): SparqlDataProvider | CompositeDataProvider {
  const {
    configName, options, settings, repositories, createRDFStorage, fields, forceFields,
  } = params;

  let sparqlProfile: SparqlDataProviderSettings;
  if (configName) {
    sparqlProfile = SUPPORTED_PROFILES[configName];
    if (!sparqlProfile) {
      throw new Error(`Unknown Ontodia configuration '${configName}'`);
    }
  } else {
    sparqlProfile = SUPPORTED_PROFILES['default'];
  }

  // this is workaround for field-based navigation
  const fieldConfigDefaults = createFieldConfiguration(fields, forceFields);

  const effectiveSettings: SparqlDataProviderSettings = {
    ...sparqlProfile,
    ...fieldConfigDefaults,
    ...settings,
  };

  if (repositories.length === 1 && !createRDFStorage) {
    const [repository] = repositories;
    return new OptimizingDataProvider(
      {...options, endpointUrl: getEndpointUrlForRepository(repository)},
      effectiveSettings
    );
  }

  const dataProviders: DPDefinition[] = repositories.map(repository => ({
    name: repository,
    dataProvider: new OptimizingDataProvider(
      {...options, endpointUrl: getEndpointUrlForRepository(repository)},
      effectiveSettings
    )
  }));

  if (createRDFStorage) {
    dataProviders.push({
      name: RDF_DATA_PROVIDER_NAME,
      dataProvider: new RDFDataProvider({data: [], parsers: {}}),
    });
  }

  return new CompositeDataProvider(dataProviders);
}

function getEndpointUrlForRepository(repository: string) {
  const baseEndpointUrl = getBaseUrl() ? getBaseUrl() + '/sparql' : '/sparql';
  return `${baseEndpointUrl}?repository=${repository}`;
}

function createFieldConfiguration(
  fields?: ReadonlyArray<FieldDefinition>, forceFields?: ReadonlyMap<string, FieldDefinition>
): Partial<SparqlDataProviderSettings> {
  const linkConfigurations = createLinkConfigurations(fields);
  const propertyConfigurations = createPropertyConfiguration(fields, forceFields);

  let fieldConfigDefaults: Partial<SparqlDataProviderSettings> = {
    linkConfigurations, propertyConfigurations
  };
  if (linkConfigurations.length > 0) {
    fieldConfigDefaults = {
      ...fieldConfigDefaults,
      elementInfoQuery: `
        CONSTRUCT {
            ?inst rdf:type ?class .
            ?inst rdfs:label ?label .
            ?inst ?propType ?propValue.
        } WHERE {
            VALUES (?inst) {\${ids}}
            OPTIONAL { ?inst a ?class }
            OPTIONAL { ?inst \${dataLabelProperty} ?label }
            OPTIONAL {
              \${propertyConfigurations}
            }
        }
      `,
    };
  }
  return fieldConfigDefaults;
}

class OptimizingDataProvider extends SparqlDataProvider {
  executeSparqlQuery<Binding>(query: string) {
    const optimizedQuery = this.optimizeAndAddPrefixes(query);
    return super.executeSparqlQuery<Binding>(optimizedQuery);
  }

  executeSparqlConstruct(query: string) {
    const optimizedQuery = this.optimizeAndAddPrefixes(query);
    return super.executeSparqlConstruct(optimizedQuery);
  }

  private optimizeAndAddPrefixes(query: string): string {
    try {
      const parsedQuery = SparqlUtil.parseQuery(query);
      return SparqlUtil.serializeQuery(parsedQuery);
    } catch (err) {
      console.warn('Failed to optimize Ontodia query:');
      console.warn(query);
      console.warn(err);
      return query;
    }
  }
}

function createLinkConfigurations(
  fields?: ReadonlyArray<FieldDefinition>
): LinkConfiguration[] {
  if (!fields || fields.length === 0) {
    return [];
  }
  return fields
    .filter(field => {
      // if it's non-literal field or at least have something in range
      return xsd.anyURI.equals(field.xsdDatatype);
    })
    .map(fieldToLinkConfig);
}

function createPropertyConfiguration(
  fields?: ReadonlyArray<FieldDefinition>, forceFields?: ReadonlyMap<string, FieldDefinition>
): PropertyConfiguration[] {
  if (!fields || fields.length === 0) {
    return [];
  }
  return fields
    .filter(field => {
      // pass only literal values
      return (forceFields && forceFields.has(field.iri)) || !xsd.anyURI.equals(field.xsdDatatype);
    })
    .map(fieldToPropertyConfig);
}

function fieldToLinkConfig(field: FieldDefinition): LinkConfiguration {
  const parsedQuery = SparqlUtil.parseQuery(field.selectPattern);
  if (parsedQuery.type === 'query' && parsedQuery.queryType === 'SELECT') {
    const domain = field.domain ? field.domain.map(iri => iri.value) : undefined;

    const directPredicate = parseDirectPredicate(parsedQuery.where);
    if (directPredicate) {
      return {id: field.iri, domain, path: directPredicate};
    }

    new VariableRenameBinder('subject', 'source').query(parsedQuery);
    new VariableRenameBinder('value', 'target').query(parsedQuery);

    return {
      id: field.iri,
      domain,
      path: serializePatterns(parsedQuery.where),
    };
  }
}

function fieldToPropertyConfig(field: FieldDefinition): PropertyConfiguration {
  const parsedQuery = SparqlUtil.parseQuery(field.selectPattern);
  if (parsedQuery.type === 'query' && parsedQuery.queryType === 'SELECT') {
    const domain = field.domain ? field.domain.map(iri => iri.value) : undefined;

    const directPredicate = parseDirectPredicate(parsedQuery.where);
    if (directPredicate) {
      return {id: field.iri, domain, path: directPredicate};
    }

    new VariableRenameBinder('subject', 'inst').query(parsedQuery);
    /* keep the same name for 'value' variable */

    return {
      id: field.iri,
      domain,
      path: serializePatterns(parsedQuery.where),
    };
  }
}

function serializePatterns(patterns: SparqlJs.Pattern[]): string {
  const simpleQuery: SparqlJs.SelectQuery = {
    type: 'query',
    queryType: 'SELECT',
    variables: ['*'],
    prefixes: {},
    where: patterns,
  };
  const query = SparqlUtil.serializeQuery(simpleQuery);
  const prefixLength = 'SELECT * WHERE { '.length;
  const serialized = query.substr(prefixLength, query.length - prefixLength - 2);
  return serialized;
}

function parseDirectPredicate(patterns: SparqlJs.Pattern[]): string | undefined {
  const {isIri} = SparqlTypeGuards;

  let predicate: SparqlJs.Term | undefined;
  for (const pattern of patterns) {
    switch (pattern.type) {
      case 'bgp':
        for (const t of pattern.triples) {
          const isPredicateTriple = (
            /^[?$]subject$/.test(t.subject) &&
            /^[?$]value$/.test(t.object) &&
            isIri(t.predicate)
          );
          const isLabelTriple = /^[?$]label$/.test(t.object);
          if (isPredicateTriple) {
            predicate = t.predicate as SparqlJs.Term;
          } else if (isLabelTriple) {
            // ignore
          } else {
            // pattern is too complex
            return undefined;
          }
        }
        break;
      case 'bind':
        // ignore
        break;
      default:
        // pattern is too complex
        return undefined;
    }
  }
  return predicate;
}
