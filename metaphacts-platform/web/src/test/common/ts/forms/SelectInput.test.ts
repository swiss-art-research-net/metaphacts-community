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
import { createElement } from 'react';
import { expect } from 'chai';
import * as sinon from 'sinon';
import ReactSelect from 'react-select';

import { Rdf } from 'platform/api/rdf';
import {
  SelectInput, SelectInputProps, FieldValue, normalizeFieldDefinition,
} from 'platform/components/forms';

import { shallow, mount } from 'platform-tests/configuredEnzyme';
import { mockLanguagePreferences } from 'platform-tests/mocks';

mockLanguagePreferences();

const DATATYPE = Rdf.iri('http://www.w3.org/2001/XMLSchema-datatypes#string');

const definition = normalizeFieldDefinition({
  id: 'nameProp',
  label: 'labelProp',
  xsdDatatype: DATATYPE,
  minOccurs: 1,
  maxOccurs: 1,
  valueSetPattern: '',
});

const baseInputProps: SelectInputProps = {
  for: 'date',
};

const BASIC_PROPS: SelectInputProps = {
  ...baseInputProps,
  definition,
  handler: SelectInput.makeHandler({definition, baseInputProps}),
  value: FieldValue.empty,
};

describe('SelectInput Component', () => {
  const baseSelect = shallow(createElement(SelectInput, BASIC_PROPS));
  const select = baseSelect.find(ReactSelect);

  it('render with default parameters', () => {
    expect(select).to.have.length(1);
  });

  it('show correct values', () => {
    const val = FieldValue.fromLabeled({
      value: Rdf.iri('http://www.metaphacts.com/resource/example/test'),
      label: 'test',
    });
    BASIC_PROPS.value = val;
    const selectFiled = mount(createElement(SelectInput, BASIC_PROPS));
    expect(selectFiled.find(ReactSelect).props().value).to.be.eql(val);
  });

  it('call callback when value is changed', () => {
    const callback = sinon.spy();
    const props: SelectInputProps = {...BASIC_PROPS, updateValue: callback};
    const wrapper = shallow(createElement(SelectInput, props));
    wrapper.find(ReactSelect).simulate('change');
    expect(callback.called).to.be.true;
  });
});
