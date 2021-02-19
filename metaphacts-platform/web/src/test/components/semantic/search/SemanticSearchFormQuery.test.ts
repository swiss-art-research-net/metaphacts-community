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
import { expect } from 'chai';
import * as Immutable from 'immutable';
import * as SparqlJs from 'sparqljs';

import { Rdf } from 'platform/api/rdf';
import { SparqlUtil } from 'platform/api/sparql';

import * as Forms from 'platform/components/forms';
import {
  QueryTemplateArgument, _bindQueryArguments,
} from 'platform/components/semantic/search/web-components/SemanticSearchFormQuery';

describe('SemanticSearchFormQuery', () => {
  it('binds atomic arguments', () => {
    const query = SparqlUtil.parseQuery(`
      PREFIX foaf: <http://xmlns.com/foaf/0.1/>
      SELECT ?person WHERE {
        ?person a foaf:Person .
        ?person foaf:knows ?someone .
        ?person foaf:name ?foundName .
        FILTER(REGEX(STR(?foundName), ?name, "i"))
      }
    `) as SparqlJs.SelectQuery;
    const queryArguments: { [argumentId: string]: QueryTemplateArgument } = {
      'someone': {type: 'xsd:anyURI', optional: true},
      'name': {type: 'xsd:string'},
    };
    const model = Forms.CompositeValue.set(Forms.CompositeValue.empty, {
      definitions: makeFields([
        {id: 'someone'},
        {id: 'name', minOccurs: 1, maxOccurs: 1},
      ]),
      fields: makeFieldStates({
        'someone': [
          valueFromTerm(Rdf.iri('http://example.com/a')),
          valueFromTerm(Rdf.iri('http://example.com/b')),
          valueFromTerm(Rdf.iri('http://example.com/c')),
        ],
        'name': [
          valueFromTerm(Rdf.literal('neil')),
        ],
      }),
    });

    _bindQueryArguments(query, queryArguments, model);

    const actual = SparqlUtil.parseQuery(SparqlUtil.serializeQuery(query));
    const expected = SparqlUtil.parseQuery(`
      PREFIX foaf: <http://xmlns.com/foaf/0.1/>
      SELECT ?person WHERE {
        VALUES (?someone) {
          (<http://example.com/a>)
          (<http://example.com/b>)
          (<http://example.com/c>)
        }
        ?person a foaf:Person .
        ?person foaf:knows ?someone .
        ?person foaf:name ?foundName .
        FILTER(REGEX(STR(?foundName), "neil"^^<http://www.w3.org/2001/XMLSchema#string>, "i"))
      }
    `);
    expect(actual).to.be.deep.equal(expected);
  });

  it('binds composite arguments with OR operator', () => {
    const query = SparqlUtil.parseQuery(`
      PREFIX foaf: <http://xmlns.com/foaf/0.1/>
      SELECT ?person ?friendName WHERE {
        ?person a foaf:Person .
        FILTER(?knowsAny)
      }
    `) as SparqlJs.SelectQuery;
    const queryArguments: { [argumentId: string]: QueryTemplateArgument } = {
      'knowsAny': {
        operator: 'or',
        pattern: `
          ?person foaf:knows ?anyone .
          ?anyone foaf:name ?friendName .
          FILTER(REGEX(STR(?friendName), ?name, "i"))
        `,
        arguments: {
          'name': {type: 'xsd:string'}
        }
      }
    };
    const model = Forms.CompositeValue.set(Forms.CompositeValue.empty, {
      definitions: makeFields([
        {id: 'knowsAny'},
      ]),
      fields: makeFieldStates({
        'knowsAny': [
          makeNamedEntityComposite('neil'),
          makeNamedEntityComposite('eva'),
        ]
      })
    });

    _bindQueryArguments(query, queryArguments, model);

    const actual = SparqlUtil.parseQuery(SparqlUtil.serializeQuery(query));
    const expected = SparqlUtil.parseQuery(`
      PREFIX foaf: <http://xmlns.com/foaf/0.1/>
      SELECT ?person ?friendName WHERE {
        ?person a foaf:Person
        {
          ?person foaf:knows ?anyone_0 .
          ?anyone_0 foaf:name ?friendName .
          FILTER(REGEX(STR(?friendName), "neil"^^<http://www.w3.org/2001/XMLSchema#string>, "i"))
        }
        UNION
        {
          ?person foaf:knows ?anyone_1 .
          ?anyone_1 foaf:name ?friendName .
          FILTER(REGEX(STR(?friendName), "eva"^^<http://www.w3.org/2001/XMLSchema#string>, "i"))
        }
      }
    `);
    expect(actual).to.be.deep.equal(expected);
  });

  it('binds composite arguments with AND operator', () => {
    const query = SparqlUtil.parseQuery(`
      PREFIX foaf: <http://xmlns.com/foaf/0.1/>
      SELECT ?person WHERE {
        ?person a foaf:Person .
        FILTER(?knowsAll)
      }
    `) as SparqlJs.SelectQuery;
    const queryArguments: { [argumentId: string]: QueryTemplateArgument } = {
      'knowsAll': {
        operator: 'and',
        pattern: `
          ?person foaf:knows ?other .
          ?other foaf:name ?otherName .
          FILTER(REGEX(STR(?otherName), ?name, "i"))
        `,
        arguments: {
          'name': {type: 'xsd:string'}
        }
      }
    };
    const model = Forms.CompositeValue.set(Forms.CompositeValue.empty, {
      definitions: makeFields([
        {id: 'knowsAll'},
      ]),
      fields: makeFieldStates({
        'knowsAll': [
          makeNamedEntityComposite('neil'),
          makeNamedEntityComposite('eva'),
        ]
      })
    });

    _bindQueryArguments(query, queryArguments, model);

    const actual = SparqlUtil.parseQuery(SparqlUtil.serializeQuery(query));
    const expected = SparqlUtil.parseQuery(`
      PREFIX foaf: <http://xmlns.com/foaf/0.1/>
      SELECT ?person WHERE {
        ?person a foaf:Person
        {
          ?person foaf:knows ?other_0 .
          ?other_0 foaf:name ?otherName_0 .
          FILTER(REGEX(STR(?otherName_0), "neil"^^<http://www.w3.org/2001/XMLSchema#string>, "i"))
        }
        {
          ?person foaf:knows ?other_1 .
          ?other_1 foaf:name ?otherName_1 .
          FILTER(REGEX(STR(?otherName_1), "eva"^^<http://www.w3.org/2001/XMLSchema#string>, "i"))
        }
      }
    `);
    expect(actual).to.be.deep.equal(expected);
  });
});

function makeNamedEntityComposite(name: string): Forms.CompositeValue {
  return Forms.CompositeValue.set(Forms.CompositeValue.empty, {
    definitions: makeFields([
      {id: 'name', minOccurs: 1, maxOccurs: 1},
    ]),
    fields: makeFieldStates({
      'name': [
        valueFromTerm(Rdf.literal(name)),
      ]
    })
  });
}

function makeFields(
  fieldProps: ReadonlyArray<Forms.FieldDefinitionProp>
): Immutable.Map<string, Forms.FieldDefinition> {
  return Immutable.Map<string, Forms.FieldDefinition>().withMutations(map => {
    for (const fieldProp of fieldProps) {
      const field = Forms.normalizeFieldDefinition(fieldProp);
      map.set(field.id, field);
    }
  });
}

function makeFieldStates(
  values: { [fieldId: string]: ReadonlyArray<Forms.FieldValue> }
): Immutable.Map<string, Forms.FieldState> {
  return Immutable.Map<string, Forms.FieldState>().withMutations(map => {
    for (const fieldId of Object.keys(values)) {
      map.set(fieldId, {
        values: values[fieldId],
        errors: Forms.FieldError.noErrors,
      });
    }
  });
}

function valueFromTerm(term: Rdf.Iri | Rdf.Literal) {
  return Forms.FieldValue.fromLabeled({value: term});
}
