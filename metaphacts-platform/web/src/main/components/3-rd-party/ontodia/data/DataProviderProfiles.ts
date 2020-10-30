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
import { SparqlDataProviderSettings } from 'ontodia';

export const OwlNoStatsSettings: SparqlDataProviderSettings = {
  linkConfigurations: [],
  propertyConfigurations: [],

  defaultPrefix:
`PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX owl:  <http://www.w3.org/2002/07/owl#>
\n`,

  schemaLabelProperty: 'rdfs:label',
  dataLabelProperty: 'rdfs:label',

  fullTextSearch: {
    prefix: '',
    queryPattern:
`OPTIONAL { ?inst \${dataLabelProperty} ?search1 }
FILTER REGEX(COALESCE(STR(?search1), STR(?extractedLabel)), "\${text}", "i")
BIND(0 as ?score)
`,
    extractLabel: true,
  },

  classTreeQuery:
`SELECT ?class ?parent WHERE {
  { ?class a rdfs:Class }
  UNION
  { ?class a owl:Class }
  FILTER ISIRI(?class)
  OPTIONAL { ?class rdfs:subClassOf ?parent. FILTER ISIRI(?parent) }
}`,

  linksInfoQuery:
`SELECT ?source ?type ?target WHERE {
  VALUES (?source) {\${ids}}
  VALUES (?target) {\${ids}}
  \${linkConfigurations}
}`,

  elementInfoQuery:
`CONSTRUCT {
  ?inst rdf:type ?class .
  ?inst ?propType ?propValue.
} WHERE {
  VALUES (?inst) {\${ids}}
  OPTIONAL { ?inst a ?class }
  OPTIONAL {
    \${propertyConfigurations}
    FILTER (isLiteral(?propValue))
  }
}
`,

  imageQueryPattern:
`{ ?inst ?linkType ?image }
UNION
{ [] ?linkType ?inst. BIND(?inst as ?image) }
`,

  linkTypesOfQuery:
`SELECT DISTINCT ?link WHERE {
  \${linkConfigurations}
}
`,

  linkTypesStatisticsQuery:
`SELECT ?link ?outCount ?inCount WHERE {
  {
    SELECT (\${linkId} as ?link) (count(?outObject) as ?outCount) WHERE {
      \${linkConfigurationOut} .
      \${navigateElementFilterOut}
    } LIMIT 101
  }
  {
    SELECT (\${linkId} as ?link) (count(?inObject) as ?inCount) WHERE {
      \${linkConfigurationIn} .
      \${navigateElementFilterIn}
    } LIMIT 101
  }
}`,

  filterRefElementLinkPattern: '',
  filterTypePattern: `?inst a ?instType. ?instType rdfs:subClassOf* ?class`,
  filterElementInfoPattern:
`OPTIONAL { ?inst rdf:type ?foundClass }
BIND (COALESCE(?foundClass, owl:Thing) as ?class)
`,

  filterAdditionalRestriction: '',
};
