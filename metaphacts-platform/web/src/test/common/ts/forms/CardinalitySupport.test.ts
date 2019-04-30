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

import { createElement} from 'react';
import { expect } from 'chai';
import { mount } from 'enzyme';
import * as sinon from 'sinon';

import { Rdf, vocabularies } from 'platform/api/rdf';
import { __unsafe__setCurrentResource } from 'platform/api/navigation';

import {
  ResourceEditorForm, PlainTextInput, DataState, FieldValue, FieldDefinitionProp,
  normalizeFieldDefinition,
} from 'platform/components/forms';

import { AsyncForm } from './fixturies/AsyncForm';

__unsafe__setCurrentResource(Rdf.iri('http://test'));

const fieldProps = {
  definition: normalizeFieldDefinition({
    id: '',       // these will be overwritten bz the field definition in the test
    label: '',    // these will be overwritten bz the field definition in the test
    xsdDatatype: vocabularies.xsd._string,
    minOccurs: 0, // these will be overwritten bz the field definition in the test
    maxOccurs: 0, // these will be overwritten bz the field definition in the test
    selectPattern: '',
  }),
  for: 'testId',
  value: FieldValue.empty,
  dataState: DataState.Ready,
};

const ADD_BUTTON_SELECTOR = '.cardinality-support__add-value';
const REMOVE_BUTTON_SELECTOR = '.cardinality-support__remove-value';

describe('CardinalitySupport', () => {
  const children = [
    createElement(PlainTextInput, fieldProps),
  ];

  const server = sinon.fakeServer.create();
  server.respondWith(
    'GET', '/rest/data/rdf/namespace/getRegisteredPrefixes',
    [200, { 'Content-Type': 'application/json' }, '{ }']
  );

  it('remove and add values according to minOccurs=2 and maxOccurs=3 definitions', () => {
    const fields: FieldDefinitionProp[] = [{
      id: 'testId',
      xsdDatatype: vocabularies.xsd._string,
      minOccurs: 2,
      maxOccurs: 3,
    }];
    return new AsyncForm(fields, children).mount().then(asyncForm => {
      const form = asyncForm.wrapper;
      expect(form.find('PlainTextInput').length).to.be.eql(2,
        'should render field with two inputs pre-initalized');

      const addButton = form.find(ADD_BUTTON_SELECTOR);
      expect(addButton).to.have.length(1, 'does have an add value button');

      return asyncForm.performChangeAndWaitUpdate(() => addButton.simulate('click'));
    }).then(asyncForm => {
      const form = asyncForm.wrapper;
      expect(form.find('PlainTextInput').length).to.be.eql(3,
        'can add field value until number of values equals maxOccurs');
      expect(form.find(ADD_BUTTON_SELECTOR).length).to.be.equal(0,
        'can\'t add field value when number of values equals maxOccurs');

      const removeButton = form.find(REMOVE_BUTTON_SELECTOR).first();
      return asyncForm.performChangeAndWaitUpdate(() => removeButton.simulate('click'));
    }).then(asyncForm => {
      const form = asyncForm.wrapper;
      expect(form.find('PlainTextInput').length).to.be.eql(2,
        'can remove field value when number of values is not lower minOccurs');
      const removeButton = form.find(REMOVE_BUTTON_SELECTOR);
      expect(removeButton.length).to.be.eql(0,
        'can\'t remove field when number of values is equals to minOccurs');
    });
  });

  it('remove and add values according to minOccurs=0 and maxOccurs=2 definitions', () => {
    const fields: FieldDefinitionProp[] = [{
      id: 'testId',
      xsdDatatype: vocabularies.xsd._string,
      minOccurs: 0,
      maxOccurs: 2,
    }];
    return new AsyncForm(fields, children).mount().then(asyncForm => {
      const form = asyncForm.wrapper;
      expect(form.find('PlainTextInput').length).to.be.eql(1,
        'render field component with 1 inputs pre-initalized');

      const addButton = form.find(ADD_BUTTON_SELECTOR);
      expect(addButton).to.have.length(1, 'does have an add value button initalized');
      expect(form.find('PlainTextInput').length).to.be.eql(1, 'does have one input initalized');

      return asyncForm.performChangeAndWaitUpdate(() => addButton.simulate('click'));
    }).then(asyncForm => {
      const form = asyncForm.wrapper;
      expect(form.find('PlainTextInput').length).to.be.eql(2,
        'can add field value until number of values equals maxOccurs');
      expect(form.find(ADD_BUTTON_SELECTOR).length).to.be.equal(0,
        'can\'t add field value when number of values equals maxOccurs');

      const removeButton = form.find(REMOVE_BUTTON_SELECTOR).first();
      return asyncForm.performChangeAndWaitUpdate(() => removeButton.simulate('click'));
    }).then(asyncForm => {
      const form = asyncForm.wrapper;
      expect(form.find('PlainTextInput').length).to.be.eql(1,
        'can remove field value when number of values is not lower minOccurs');

      const removeButton = form.find(REMOVE_BUTTON_SELECTOR).first();
      return asyncForm.performChangeAndWaitUpdate(() => removeButton.simulate('click'));
    }).then(asyncForm => {
      const form = asyncForm.wrapper;

      expect(form.find('PlainTextInput').everyWhere(input => {
        const node: HTMLElement = input.getDOMNode();
        // element should be invisible
        return node.offsetParent === null;
      })).to.be.equal(true, 'can remove last value as well');

      expect(form.find(REMOVE_BUTTON_SELECTOR).length).to.be.equal(0,
        'can\'t remove field when number of values is equals to minOccurs (0)');
    });
  });
});
