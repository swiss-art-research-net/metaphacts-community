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
import { List } from 'immutable';

import { KeyedForest } from 'platform/components/semantic/lazy-tree';

import { Node, node, cloneSubtree } from './Forests';

describe('KeyedForest', () => {
  const bar1 = node('bar',
    node('baz'),
    node('bazz'));
  const bar2 = node('bar',
    node('foo'));

  const roots: ReadonlyArray<Node> = [
    node('first',
      bar1,
      node('quax'),
      node('frob',
        node('frob.1',
          node('child1'),
          node('child2')),
        node('frob.2'),
        node('frob.3'))),
    node('second'),
    node('third',
      bar2),
  ];

  const forest = KeyedForest.create(item => item.key, {key: 'root', children: roots});

  it('builds key mappings with duplicate keys', () => {
    const bars = forest.nodes.get('bar').toArray();
    expect(bars.length).to.be.equal(2);
    expect(bars).to.include(bar1);
    expect(bars).to.include(bar2);
  });

  it('builds parent mappings', () => {
    const parent = forest.getFirst('frob');
    const child = forest.getFirst('frob.3');
    expect(forest.getParent(child)).to.be.equal(parent);
  });

  it('reconcile after node updates', () => {
    const changedSubChild = node('frob.1',
      // swap children of frob.1
      cloneSubtree(forest, 'child2'),
      cloneSubtree(forest, 'child1')
    );

    const updated = forest.updateNode(['third'], item =>
      node('frob',
        changedSubChild,
        cloneSubtree(forest, 'frob.2'),
        cloneSubtree(forest, 'frob.3')
      ));

    it('updates mappings', () => {
      const nodes = updated.nodes.get('frob.1').toArray();
      expect(nodes.length).to.be.equal(1);
      expect(nodes).to.include(changedSubChild);
    });
  });
});
