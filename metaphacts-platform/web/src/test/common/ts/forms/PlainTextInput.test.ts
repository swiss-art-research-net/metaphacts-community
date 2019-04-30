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

import { createElement } from 'react';
import * as sinon from 'sinon';
import { clone } from 'lodash';
import { expect } from 'chai';
import { mount } from 'enzyme';
import { FormControl } from 'react-bootstrap';
import ReactSelect from 'react-select';

import { ConfigHolder } from 'platform/api/services/config-holder';
import * as LanguageService from 'platform/api/services/language';

sinon.stub(ConfigHolder, 'getUIConfig', function() {
  return {preferredLanguages: []};
});
sinon.stub(LanguageService, 'getPreferredUserLanguage', function() {
  return undefined;
});

import { Rdf } from 'platform/api/rdf';
import { PlainTextInput, PlainTextInputProps, FieldValue } from 'platform/components/forms';
const LangLiteral = Rdf.LangLiteral;

import { PROPS as BASIC_PROPS } from './fixturies/FieldProps';

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
      const langLiteral = new LangLiteral('value', 'language');
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
