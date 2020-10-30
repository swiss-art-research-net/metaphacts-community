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
import { List } from 'immutable';

import { KeyedForest, TreeNode, mapBottomUp } from 'platform/components/semantic/lazy-tree';

export interface Node {
  readonly key: string;
  readonly children: ReadonlyArray<Node>;
  readonly hasMoreChildren?: boolean;
  readonly isExpanded?: boolean;
}

export function node(key: string, ...children: Node[]): Node {
  return {key, children};
}

export const FOREST = KeyedForest.create(item => item.key || 'Life', node(undefined,
  node('Bacteria',
    node('Cyanobacteria'),
    node('Proteobacteria'),
    node('Gram Positives')
  ),
  node('Archaea',
    node('T. celer'),
    node('Methanobacterium')
  ),
  node('Eucaryota',
    node('Diplomonads'),
    node('Fungi'),
    node('Plants',
      node('Mosses'),
      node('Horsetails'),
      node('Seed plants',
        node('Flowers')
      )
    ),
    node('Animals',
      node('Invertebrates',
        node('Arachnids'),
        node('Insects'),
        node('Worms')
      ),
      node('Vertibrates',
        node('Fish'),
        node('Reptiles',
          node('Birds') // node with the same key
        ),
        node('Birds'), // node with the same key
        node('Mammals')
      )
    )
  )
));

export function cloneSubtree(forest: KeyedForest<Node>, key: string): Node {
  const cloneRoot = forest.getFirst(key);
  return mapBottomUp(cloneRoot, item => ({...item}));
}

export function toUnorderedJSON(forest: { readonly root: Node }) {
  return nodesToUnorderedJSON(forest.root.children);
}

interface JSONNode {
  [key: string]: JSONNode;
}

function nodesToUnorderedJSON(nodes: ReadonlyArray<Node>): JSONNode {
  if (!nodes) { return null; }
  const result: JSONNode = {};
  for (const {key, children} of nodes) {
    result[key] = nodesToUnorderedJSON(children);
  }
  return result;
}
