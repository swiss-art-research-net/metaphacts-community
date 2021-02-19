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
import { clone } from 'lodash';

import { Rdf } from 'platform/api/rdf';
import {
  FieldValue, FieldError, FieldDefinition, normalizeFieldDefinition,
} from 'platform/components/forms';

import {
  FIELD_DEFINITION,
  FIELD_DEFINITION_CARDINATILIY,
} from './fixturies/FieldDefinition';

describe('FieldCommonTypes', () => {
  it('have noErrors', () => {
    expect(FieldError.noErrors.length).to.be.equal(0);
  });

  it('have noValue', () => {
    expect(FieldValue.isEmpty(FieldValue.empty)).to.be.true;
  });

  it('can normalize field definition', () => {
    const result: FieldDefinition = {
      id: FIELD_DEFINITION.id,
      label: [Rdf.langLiteral(FIELD_DEFINITION.label as string, '')],
      description: FIELD_DEFINITION.description,
      categories: [],
      xsdDatatype: Rdf.iri('test'),
      minOccurs: 1,
      maxOccurs: 2,
      order: 0,
      defaultValues: [],
      selectPattern: '',
      constraints: [
        {
          validatePattern: 'ASK { ?s ?p ?o }',
          message: 'test',
        },
        {
          validatePattern: 'ASK { BIND(false as ?b). FILTER(?b=true)}',
          message: 'Value does not pass the SPARQL ASK test.',
        },
      ],
      valueSetPattern: '',
      autosuggestionPattern: 'SELECT * WHERE { ?s ?p ?o }',
    };
    expect(normalizeFieldDefinition(FIELD_DEFINITION)).to.eql(result);
  });

  it('can normalize field definition with cardinality', () => {
    const result: FieldDefinition = {
      id: 'test',
      minOccurs: 0,
      maxOccurs: Infinity,
      order: 0,
      defaultValues: [],
      categories: [],
      constraints: [],
    };
    expect(normalizeFieldDefinition(FIELD_DEFINITION_CARDINATILIY)).to.eql(result);
  });

  it('add minOccur', () => {
    let definition = clone(FIELD_DEFINITION);
    delete definition.minOccurs;
    expect(normalizeFieldDefinition(definition).minOccurs).to.be.eql(0);
  });

  it('add maxOccur', () => {
    let definition = clone(FIELD_DEFINITION);
    delete definition.maxOccurs;
    expect(normalizeFieldDefinition(definition).maxOccurs).to.be.eql(Infinity);
  });

  it('preserves omitted XSD datatype', () => {
    let definition = clone(FIELD_DEFINITION);
    delete definition.xsdDatatype;
    expect(normalizeFieldDefinition(definition).xsdDatatype).to.be.eql(undefined);
  });

  it('normalizes dataType', () => {
    let definition = clone(FIELD_DEFINITION);
    definition.xsdDatatype = 'http://www.w3.org/2001/XMLSchema-datatypes#string';
    expect(
      normalizeFieldDefinition(definition).xsdDatatype
    ).to.be.eql(
      Rdf.iri('http://www.w3.org/2001/XMLSchema#string')
    );
  });
});
