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
import { expect } from 'chai';
import { Component, createElement, Props } from 'react';
import * as D from 'react-dom-factories';
import { cloneDeepWith } from 'lodash';

import { SemanticContext } from 'platform/api/components';
import { ComponentClassMetadata } from 'platform/api/module-loader';
import {
  DeserializedComponent, componentToGraph, graphToComponent,
} from 'platform/api/persistence/ComponentPersistence';
import { Rdf } from 'platform/api/rdf';
import { TemplateScope } from 'platform/api/services/template';

interface TestProps extends Props<TestComponent> {
  array: number[];
  map?: { [key: string]: boolean };
  callback?: () => void;
}

class TestComponent extends Component<TestProps, {}> {}

function addComponentTag(componentClass: ComponentClassMetadata, tag: string) {
  componentClass.__htmlTag = tag;
}

addComponentTag(TestComponent as ComponentClassMetadata, 'mp-test');

describe('ComponentPersistence', () => {
  it('converts simple platform component to a graph and back', () => {
    const props: TestProps = {
      array: [1, 2, 3],
      map: {
        foo: true,
        'other:bar': false,
      },
      callback: () => { throw new Error('Shouldn\'t be called'); },
    };
    const component = createElement(TestComponent, props,
      createElement(TestComponent, {array: [4, 5]}),
      createElement(TestComponent, {array: [6, 7]},
        createElement(TestComponent, {array: [6]}),
      ),
      D.div({
        className: 'testDiv',
        style: {marginTop: 5},
      })
    );
    const outerContext: SemanticContext = {
      semanticContext: {
        repository: 'assets',
      }
    };
    const {pointer, graph} = componentToGraph({
      component,
      componentRoot: Rdf.iri(''),
      semanticContext: outerContext.semanticContext,
    });
    const {component: result, context} = graphToComponent(pointer, graph);
    const expected: DeserializedComponent = {
      type: 'mp-test',
      props: {
        array: [1, 2, 3],
        map: {
          foo: true,
          'other:bar': false,
        },
        markupTemplateScope: null,
      },
      children: [
        {
          type: 'mp-test',
          props: {
            array: [4, 5],
            markupTemplateScope: null,
          },
          children: [],
        },
        {
          type: 'mp-test',
          props: {
            array: [6, 7],
            markupTemplateScope: null,
          },
          children: [
            {
              type: 'mp-test',
              props: {
                array: [6],
                markupTemplateScope: null,
              },
              children: [],
            }
          ]
        },
        {
          type: 'div',
          props: {
            className: 'testDiv',
            style: {marginTop: 5},
          },
          children: [],
        }
      ]
    };

    const resultWithoutTemplateScopes = excludeTemplateScopes(result);
    expect(resultWithoutTemplateScopes).to.be.deep.equals(expected);
    expect(context).to.be.deep.equals(outerContext);
  });
});

function excludeTemplateScopes(component: DeserializedComponent): DeserializedComponent {
  return cloneDeepWith(component, value => {
    if (typeof value === 'object' && value instanceof TemplateScope) {
      return null;
    }
  });
}
