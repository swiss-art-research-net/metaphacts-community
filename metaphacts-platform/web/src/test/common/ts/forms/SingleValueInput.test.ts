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

import { Rdf, XsdDataTypeValidation, vocabularies } from 'platform/api/rdf';
import { FieldState, FieldValue, validateType } from 'platform/components/forms';

import { mockLanguagePreferences } from 'platform-tests/mocks';

import { DATATYPES_FIXTURIES } from './fixturies/Datatypes';

mockLanguagePreferences();

describe('SingleValueInput Component', () => {
  it('correctly validates form values', () => {
    for (const fixture of DATATYPES_FIXTURIES) {
      const datatype = XsdDataTypeValidation.parseXsdDatatype(fixture.datatype).iri;
      const isIri = datatype.equals(vocabularies.xsd.anyURI);

      for (const validValue of fixture.values.valid) {
        const rdfValue = isIri ? Rdf.iri(validValue as string) : Rdf.literal(validValue, datatype);
        const result = validateType({value: rdfValue}, datatype);
        expect(FieldValue.getErrors(result).length).to.be.equal(0,
          `${rdfValue} should be valid value of type <${XsdDataTypeValidation.datatypeToString(datatype)}>, ` +
          `but there was errors: ` +
          FieldValue.getErrors(result).map(e => `"${e.message}"`).join('\n'));
      }

      for (const invalidValue of fixture.values.invalid) {
        const rdfValue = isIri
          ? Rdf.iri(invalidValue as string)
          : Rdf.literal(invalidValue, datatype);
        const result = validateType({value: rdfValue}, datatype);
        expect(FieldValue.getErrors(result).length).to.be.equal(1,
          `Validation "${rdfValue} is <${XsdDataTypeValidation.datatypeToString(datatype)}>" should produce ` +
          `the following error: "${fixture.invalidMessage}" but there was none.`);
        expect(FieldState.getFirst(FieldValue.getErrors(result)).message).to.be.equal(fixture.invalidMessage,
          `Invalid error message when validating "${rdfValue} is <${XsdDataTypeValidation.datatypeToString(datatype)}>"`);
      }
    }
  });
});
