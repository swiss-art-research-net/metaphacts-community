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
import { expect } from 'chai';
import * as sinon from 'sinon';
import { shallow } from 'enzyme';
import { Label, StaticFieldProps, normalizeFieldDefinition } from 'platform/components/forms';
import { FIELD_DEFINITION } from '../fixturies/FieldDefinition';

import { ConfigHolder } from 'platform/api/services/config-holder';
import * as LanguageService from 'platform/api/services/language';

sinon.stub(ConfigHolder, 'getUIConfig', function() {
  return {preferredLanguages: []};
});
sinon.stub(LanguageService, 'getPreferredUserLanguage', function() {
  return undefined;
});

const PROPS: StaticFieldProps = {
  for: 'test',
  definition: normalizeFieldDefinition(FIELD_DEFINITION),
  model: undefined,
};

describe('Field Static Label Component', () => {
  const labelComponent = shallow(createElement(Label, PROPS));

  describe('render', () => {
    it('as span', () => {
      expect(labelComponent.find('span')).to.have.length(1);
    });

    it('with proper classname', () => {
      expect(labelComponent.find('.field-label')).to.have.length(1);
    });

    it('with correct inner text', () => {
      expect(labelComponent.text()).to.be.equal(FIELD_DEFINITION.label);
    });
  });
});
