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

import {
  transitiveReduction, findRoots,
} from 'platform/components/semantic/lazy-tree';

interface JSONGraphNode {
  [key: string]: JSONGraphNode;
}

interface GraphNode {
  key: string;
  children: Set<GraphNode>;
}

function graphFromUnorderedJSON(graph: JSONGraphNode): GraphNode[] {
  const allNodes = new Map<string, GraphNode>();

  function getNode(key: string) {
    if (allNodes.has(key)) {
      return allNodes.get(key);
    } else {
      const node: GraphNode = {key, children: new Set()};
      allNodes.set(key, node);
      return node;
    }
  }

  function readJSON(root: JSONGraphNode, parentKey?: string) {
    for (const key in root) {
      if (root.hasOwnProperty(key)) {
        const node = getNode(key);
        readJSON(root[key], key);
        if (parentKey) {
          getNode(parentKey).children.add(node);
        }
      }
    }
  }

  readJSON(graph);
  return Array.from(allNodes.values());
}

function graphToUnorderedEdges(nodes: GraphNode[]) {
  if (nodes.length === 0) { return null; }
  const root: JSONGraphNode = {};
  for (const source of nodes) {
    const children: JSONGraphNode = {};
    source.children.forEach(target => {
      children[target.key] = null;
    });
    root[source.key] = children;
  }
  return root;
}

describe('GraphAlgorithms', () => {
  describe('transitive reduction', () => {
    it('reducts single transitive relation', () => {
      const graph = graphFromUnorderedJSON({
        A: {
          B: {
            C: {D: null},
            D: null,
          },
          C: null,
          D: null,
        },
      });

      transitiveReduction(graph);

      expect(graphToUnorderedEdges(graph)).to.be.deep.equal({
        A: {B: null},
        B: {C: null},
        C: {D: null},
        D: {},
      });
    });

    it('reducts multiple transitive relations', () => {
      const graph = graphFromUnorderedJSON({
        A: {
          B: {
            C: {
              D: null,
              E: {
                F: {
                  G: {H: null},
                  H: null,
                },
                G: null,
                H: null,
              },
            },
            D: null,
          },
          C: null,
          D: null,
        },
      });

      transitiveReduction(graph);

      expect(graphToUnorderedEdges(graph)).to.be.deep.equal({
        A: {B: null},
        B: {C: null},
        C: {D: null, E: null},
        D: {},
        E: {F: null},
        F: {G: null},
        G: {H: null},
        H: {},
      });
    });

    it('reducts non-tree transitive relations', () => {
      const graph = graphFromUnorderedJSON({
        A: {
          B: {
            C: {D: null},
            F: null,
            D: null,
          },
          E: {
            F: {D: null},
            C: null,
            D: null,
          },
        },
      });

      transitiveReduction(graph);

      expect(graphToUnorderedEdges(graph)).to.be.deep.equal({
        A: {B: null, E: null},
        B: {C: null, F: null},
        C: {D: null},
        D: {},
        E: {C: null, F: null},
        F: {D: null},
      });
    });
  });

  it('finds roots in DAG', () => {
    const graph = graphFromUnorderedJSON({
      B: {
        C: {D: null},
        F: null,
        D: null,
      },
      E: {
        F: {D: null},
        C: null,
        D: null,
      },
    });

    const rootKeys = Array.from(findRoots(graph).values()).map(root => root.key);
    rootKeys.sort();

    expect(rootKeys).to.be.deep.equal(['B', 'E']);
  });
});
