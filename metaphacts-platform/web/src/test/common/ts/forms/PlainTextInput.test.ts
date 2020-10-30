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
import { createElement } from 'react';
import * as sinon from 'sinon';
import { clone } from 'lodash';
import { expect } from 'chai';
import { FormControl } from 'react-bootstrap';
import ReactSelect from 'react-select';

import { Rdf } from 'platform/api/rdf';
import { PlainTextInput, PlainTextInputProps, FieldValue } from 'platform/components/forms';

import { mount } from 'platform-tests/configuredEnzyme';
import { mockLanguagePreferences } from 'platform-tests/mocks';

import { PROPS as BASIC_PROPS } from './fixturies/FieldProps';

mockLanguagePreferences();

describe('Plain Text Component', () => {
  const inputComponent = mount(createElement(PlainTextInput, BASIC_PROPS));

  describe('render', () => {
    it('with default parameters', () => {
      expect(inputComponent.find(FormControl)).to.have.length(1);
    });
  });

  it('call callback when value is changed', () => {
    const callback = sinon.spy();
    const props: PlainTextInputProps = {...BASIC_PROPS, updateValue: callback};
    const wrapper = mount(createElement(PlainTextInput, props));
    wrapper.find('input').simulate('change');
    expect(callback.called).to.be.true;
  });

  it('render input when multiline option is false', () => {
    expect(inputComponent.find(FormControl)).to.have.length(1);
  });

  it('render textarea when multiline option is true', () => {
    const props: PlainTextInputProps = {...BASIC_PROPS, multiline: true};
    const wrapper = mount(createElement(PlainTextInput, props));
    expect(wrapper.find('TextareaAutosize')).to.have.length(1);
  });

  describe('languages', () => {
    const propsWithLang: PlainTextInputProps = {...BASIC_PROPS, languages: ['lang1', 'lang2']};
    const inputWithLang = mount(createElement(PlainTextInput, propsWithLang));

    it('render language select list', () => {
      expect(inputWithLang.find(ReactSelect)).to.have.length(1);
    });

    it('without language select when languages not exist', () => {
      expect(inputComponent.find(ReactSelect)).to.not.have.length(1);
    });

    it('show empty language when default don\'t exist', () => {
      expect(inputWithLang.find(ReactSelect).props().value).to.eql({
        key: undefined,
        label: 'No language',
      });
    });

    it('show default language when its langLiteral', () => {
      const langLiteral = Rdf.langLiteral('value', 'language');
      let props = clone(BASIC_PROPS);
      props.value = FieldValue.fromLabeled({value: langLiteral});
      const wrapper = mount(createElement(PlainTextInput, props));
      expect(wrapper.find(ReactSelect).props().value).to.eql({key: 'language', label: 'language'});
    });

    it('show "No language" if literal', () => {
      const props: PlainTextInputProps = {...BASIC_PROPS, languages: ['lang1', 'lang2']};
      const literalInput = mount(createElement(PlainTextInput, props));
      expect(
        literalInput.find(ReactSelect).props().value
      ).to.eql({
        key: undefined,
        label: 'No language',
      });
    });
  });
});
