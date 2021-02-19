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
import * as Immutable from 'immutable';
import * as Kefir from 'kefir';
import { orderBy } from 'lodash';
import * as SparqlJs from 'sparqljs';

import { Rdf } from 'platform/api/rdf';
import { SparqlClient } from 'platform/api/sparql';
import { getLabels } from 'platform/api/services/resource-label';

import { breakGraphCycles, transitiveReduction, findRoots } from './GraphAlgorithms';
import { KeyedForest, mapBottomUp } from './KeyedForest';
import { TreeNode, mergeRemovingDuplicates } from './NodeModel';

export interface TreeQueryPatterns {
  /**
   * Tree roots SPARQL query with no input and `[?item, ?label, ?hasChildren]` output variables:
   *  - `?item` - result root node IRI;
   *  - `?label` (optional) - display label for `?item` (if not provided the display label is
   *    retrieved using the label service);
   *  - `?hasChildren` (optional) - pre-computed flag to visually indicate that the `?item` node
   *    does not have children without expanding it;
   *
   * Be aware to have a distinct association of node and label to not produce any cross products.
   *
   * If the order is not explicitly defined in the query using `ORDER BY`, the result is sorted
   * by the display label.
   */
  rootsQuery: string;
  /**
   * Children SPARQL query with `[?parent]` input and `[?item, ?label, ?hasChildren]` output
   * variables:
   *  - `?parent` - parametrized variable with node IRI to retrieve children for;
   *  - `?item` - result child node IRI;
   *  - `?label` (optional) - display label for `?item` (if not provided the display label is
   *    retrieved using the label service);
   *  - `?hasChildren` (optional) - pre-computed flag to visually indicate that the `?item` node
   *    does not have children without expanding it;
   *
   * Be aware to have a distinct association of node and label to not produce any cross products.
   *
   * If the order is not explicitly defined in the query using `ORDER BY`, the result is sorted
   * by the display value.
   */
  childrenQuery: string;
  /**
   * A SPARQL query to recursively compute the parent hierarchy for search results.
   * Can be used together with the `search-query` setting.
   *
   * The query has `[?item]` inputs through `VALUES(...)` clause
   * and `[?item, ?parent, ?parentLabel]` outputs:
   *  - `?item` - child node IRI provided with `VALUES(?item) { ... }` clause;
   *  - `?parent` - result parent node IRI for `?item` node;
   *  - `?parentLabel` (optional) - display label for `?parent` (if not provided the display label
   *    is retrieved using the label service);
   *
   * Be aware to have a distinct association of node and label to not produce any cross products.
   */
  parentsQuery?: string;
  /**
   * A SPARQL query to compute a search result for a given user input.
   *
   * The query has `[?__token__]` input and `[?item, ?score, ?label, ?hasChildren]` outputs:
   *  - `?__token__` - parametrized search input string;
   *  - `?item` - search result node IRI;
   *  - `?score` (optional) - search result score of `?item` for tree sorting;
   *  - `?label` (optional) - display label for `?item` (if not provided the display label is
   *    retrieved using the label service);
   *  - `?hasChildren` (optional) - pre-computed flag to visually indicate that the `?item` node
   *    does not have children without expanding it;
   *
   * Be aware to have a distinct association of node and label to not produce any cross products.
   *
   * Note that the parent hierarchy is computed recursively using the `parents-query` configuration
   * setting.
   */
  searchQuery?: string;
}

export interface NodeDataPatterns {
  /**
   * A SPARQL query to fetch additional data to use in the node template.
   *
   * The query gets a set of `[?item]` inputs (i.e. the node identifiers)
   * injected through a `VALUES` clause. These `?item` values can be used
   * in the query to compute additional properties or to perform aggregations.
   *
   * Bindings produced by this query can be accessed in the node template
   * as `{{data.myBinding.value}}`.
   *
   * Example:
   * ```
   * SELECT ?item ?myBinding WHERE {
   *   ?item :myProperty ?myBinding .
   * }
   * ```
   */
  nodeDataQuery?: string;
}

export interface Node extends TreeNode {
  readonly iri: Rdf.Iri;
  readonly label?: Rdf.Literal;
  /** Additional bindings loaded with `node-data-query` */
  readonly data: SparqlClient.StarBinding;
  /** Error which happened during node data loading. */
  readonly dataError?: unknown;
  readonly children?: ReadonlyArray<Node>;
  readonly reachedLimit?: boolean;
  /** search relevance */
  readonly score?: number;
}
export namespace Node {
  export const rootKey = 'SparqlNode:root';
  export const keyOf = (node: Node) => node.iri ? node.iri.value : rootKey;
  export const readyToLoadRoot: Node = {
    iri: Rdf.iri(rootKey),
    data: {},
    children: undefined,
    reachedLimit: false,
  };
  export const emptyRoot: Node = {
    iri: Rdf.iri(rootKey),
    data: {},
    children: [],
    reachedLimit: true,
  };

  export const readyToLoadForest = KeyedForest.create(keyOf, readyToLoadRoot);
  export const emptyForest = KeyedForest.create(keyOf, emptyRoot);

  export function set(node: Node, props: Partial<Node>): Node {
    return {...node, ...props};
  }

  export function getLabel(node: Node) {
    return node.label ? node.label.value : node.iri.value;
  }
}

export class SparqlNodeModel {
  private readonly rootsQuery: SparqlJs.SelectQuery;
  private readonly childrenQuery: SparqlJs.SelectQuery;
  private readonly parentsQuery: SparqlJs.SelectQuery;
  private readonly nodeDataQuery: SparqlJs.SelectQuery;
  private readonly limit: number | undefined;

  readonly sparqlOptions: () => SparqlClient.SparqlOptions;

  constructor(params: {
    rootsQuery: SparqlJs.SelectQuery;
    childrenQuery: SparqlJs.SelectQuery;
    parentsQuery: SparqlJs.SelectQuery;
    nodeDataQuery?: SparqlJs.SelectQuery;
    limit?: number;
    sparqlOptions: () => SparqlClient.SparqlOptions;
  }) {
    const {rootsQuery, childrenQuery, parentsQuery, nodeDataQuery, limit, sparqlOptions} = params;
    this.rootsQuery = rootsQuery;
    this.childrenQuery = childrenQuery;
    this.parentsQuery = parentsQuery;
    this.nodeDataQuery = nodeDataQuery;
    this.limit = limit;
    this.sparqlOptions = sparqlOptions;
  }

  hasMoreChildren(node: Node): boolean {
    return !node.error && !node.reachedLimit;
  }

  loadMoreChildren(parent: Node): Kefir.Property<Node> {
    const parametrized = Node.keyOf(parent) === Node.rootKey
      ? this.rootsQuery : SparqlClient.setBindings(this.childrenQuery, {'parent': parent.iri});

    const hasLimit = typeof this.limit === 'number';
    if (hasLimit) {
      parametrized.limit = this.limit;
      parametrized.offset = parent.children ? parent.children.length : 0;
    }

    type Result = { nodes?: Node[]; error?: any; };
    return SparqlClient.selectStar(parametrized, this.sparqlOptions())
      .map<Result>(queryResult => ({nodes: nodesFromQueryResult(queryResult)}))
      .flatMap<Result>(({nodes}) => {
        return requestNodeData(nodes, this.nodeDataQuery, this.sparqlOptions())
          .map(augmentNode => {
            nodes.forEach(augmentNode);
            return {nodes};
          });
      })
      .flatMapErrors<Result>(error => Kefir.constant({error}))
      .map(({nodes, error}): Node => {
        if (error) {
          return Node.set(parent, {error});
        } else {
          const initialChildren = parent.children ? parent.children : [];
          const children = mergeRemovingDuplicates(Node.keyOf, initialChildren, nodes);
          if (!parametrized.order) {
            children.sort(compareChildrenByLabel);
          }
          return Node.set(parent, {
            error: undefined,
            children,
            reachedLimit: !hasLimit
              || children.length === initialChildren.length
              || nodes.length < this.limit,
          });
        }
      }).toProperty();
  }

  loadFromLeafs(
    leafs: ReadonlyArray<Node>,
    options: { transitiveReduction: boolean }
  ): Kefir.Property<Node> {
    const initialOrphans = Immutable.List(leafs as Node[])
      .groupBy(node => node.iri.value)
      .map(group => group.first())
      .map<MutableNode>(({iri, data, score, label, reachedLimit}) => ({
          iri, data, label, score, reachedLimit,
          children: new Set<MutableNode>(),
      }))
      .toArray();

    if (initialOrphans.length === 0) {
      return Kefir.constant(Node.readyToLoadRoot);
    }
    return requestNodeData(initialOrphans, this.nodeDataQuery, this.sparqlOptions())
      .flatMap(augmentNode => {
        initialOrphans.forEach(augmentNode);
        return restoreGraphFromLeafs(
          initialOrphans, this.parentsQuery, this.sparqlOptions()
        );
      })
      .flatMap(nodes => {
        const nodeForRequest: Array<{ iri: Rdf.Iri; label?: Rdf.Literal }> = [];
        nodes.forEach(node => {
          nodeForRequest.push({iri: node.iri, label: node.label});
        });
        return requestNodeData(nodeForRequest, this.nodeDataQuery, this.sparqlOptions())
          .map(augmentNode => {
            nodes.forEach(augmentNode);
            return nodes;
          });
      }).map(nodes => {
        const graph = Array.from(nodes.values());
        breakGraphCycles(graph);
        if (options.transitiveReduction) {
          transitiveReduction(graph);
        }
        const roots = findRoots(graph);
        const children = asImmutableForest(roots);
        return Node.set(Node.readyToLoadRoot, {children});
      })
      .toProperty();
  }

  /** @returns parent key for the specified child key. */
  loadParent(key: string): Kefir.Property<string> {
    const parameters = [{item: Rdf.iri(key)}];
    const parametrized = SparqlClient.prepareParsedQuery(parameters)(this.parentsQuery);
    return SparqlClient.selectStar(parametrized, this.sparqlOptions())
      .flatMap(({results}): Kefir.Observable<string> => {
        for (const {item, parent} of results.bindings) {
          if (!(item && item.value === key)) { continue; }
          if (!(parent && Rdf.isIri(parent))) {
            return Kefir.constantError<any>(new Error(
              `parentsQuery returned tuple without 'parent' (or it isn't an IRI)`
            ));
          }
          return Kefir.constant(parent.value);
        }
        return Kefir.constant(Node.rootKey);
      }).toProperty();
  }

  loadNode(iri: Rdf.Iri): Kefir.Property<Node> {
    return requestNodeData([{iri}], this.nodeDataQuery, this.sparqlOptions())
      .map(augmentNode => {
        const node: Node = {iri, data: {}};
        augmentNode(node);
        return node;
      });
  }
}

export function nodesFromQueryResult(result: SparqlClient.SparqlStarSelectResult): Node[] {
  return result.results.bindings.map((binding): Node => {
    const {item, label, hasChildren} = binding;
    if (!(item && Rdf.isIri(item))) { return undefined; }

    const nodeLabel = (label && Rdf.isLiteral(label)) ? label : undefined;

    return hasChildren && hasChildren.value === 'false'
      ? {iri: item, data: {}, label: nodeLabel, children: [], reachedLimit: true}
      : {iri: item, data: {}, label: nodeLabel, reachedLimit: false};
  }).filter(node => node !== undefined);
}

function compareChildrenByLabel({label: label1}: Node, {label: label2}: Node) {
  return label1.value > label2.value ? 1 : label1.value < label2.value ? -1 : 0;
}

/**
 * Marks every node with at least one child as finished loading.
 */
export function sealLazyExpanding(root: Node): Node {
  return mapBottomUp<Node>(root, node => {
    const sealed = !node.reachedLimit && node.children && node.children.length > 0
      ? Node.set(node, {reachedLimit: true}) : node;
    const expanded = sealed.reachedLimit && !sealed.expanded
      ? Node.set(sealed, {expanded: true}) : sealed;
    return expanded;
  });
}

export interface MutableNode {
  iri: Rdf.Iri;
  label?: Rdf.Literal;
  data: SparqlClient.StarBinding;
  dataError?: unknown;
  reachedLimit: boolean;
  children: Set<MutableNode>;
  score?: number;
}

function restoreGraphFromLeafs(
  leafs: MutableNode[],
  parentsQuery: SparqlJs.SelectQuery,
  options: SparqlClient.SparqlOptions
): Kefir.Property<Map<string, MutableNode>> {
  return Kefir.stream<Map<string, MutableNode>>(emitter => {
    const nodes = new Map(leafs.map<[string, MutableNode]>(
      node => [node.iri.value, node]));
    let unresolvedOrphans = new Set(nodes.keys());
    let disposed = false;
    let subscription: Kefir.Subscription | undefined;

    const onError = (error: any) => {
      disposed = true;
      emitter.error(error);
      emitter.end();
    };

    type ParentsResult = { requested: string[]; result: SparqlClient.SparqlStarSelectResult; };
    let onResult: (result: ParentsResult) => void;

    const request = (orphanKeys: string[]) => {
      const parametrized = SparqlClient.prepareParsedQuery(
        orphanKeys.map(key => ({'item': Rdf.iri(key)})))(parentsQuery);
        subscription = SparqlClient.selectStar(parametrized, options)
          .map(result => ({result, requested: orphanKeys}))
          .observe({
            value: onResult,
            error: onError,
          });
    };

    onResult = ({requested, result}) => {
      if (disposed) { return; }

      for (const {item, parent, parentLabel} of result.results.bindings) {
        if (!(item && Rdf.isIri(item) && parent && Rdf.isIri(parent))) { continue; }

        unresolvedOrphans.delete(item.value);
        const node = nodes.get(item.value);

        const existingParent = nodes.get(parent.value);
        if (existingParent) {
          existingParent.children.add(node);
        } else {
          const parentOrphan: MutableNode = {
            iri: parent,
            data: {},
            label: (parentLabel && Rdf.isLiteral(parentLabel)) ? parentLabel : undefined,
            reachedLimit: false,
            children: new Set<MutableNode>([nodes.get(item.value)]),
          };
          nodes.set(parentOrphan.iri.value, parentOrphan);
          unresolvedOrphans = unresolvedOrphans.add(parentOrphan.iri.value);
        }
      }

      for (const requestedKey of requested) {
        unresolvedOrphans.delete(requestedKey);
      }

      if (unresolvedOrphans.size === 0) {
        emitter.emit(nodes);
        emitter.end();
      } else {
        request(Array.from(unresolvedOrphans.values()));
      }
    };

    request(leafs.map(orphan => orphan.iri.value));

    return () => {
      disposed = true;
      if (subscription) {
        subscription.unsubscribe();
        subscription = undefined;
      }
    };
  }).toProperty();
}

const COMPARE_BY_SCORE_THEN_BY_LABEL: ReadonlyArray<(node: Node) => any> = [
  (node: Node) => typeof node.score === 'number' ? -node.score : 0,
  (node: Node) => node.label ? node.label.value : node.iri.value,
];

/** Convert into immutable tree and sort by search relevance. */
function asImmutableForest(roots: Set<MutableNode>): ReadonlyArray<Node> {
  return Array.from(roots).map((root): Node => {
    const children = orderBy(asImmutableForest(root.children), COMPARE_BY_SCORE_THEN_BY_LABEL);
    const total = children.reduce((sum, {score = 0}) => sum + score, 0);
    return {
      iri: root.iri,
      data: root.data,
      dataError: root.dataError,
      label: root.label,
      children,
      reachedLimit: root.reachedLimit,
      score: total + (root.score === undefined ? 0 : root.score),
    };
  });
}

interface PartialMutableNode {
  iri: Rdf.Iri;
  data: SparqlClient.StarBinding;
  dataError?: unknown;
  label?: Rdf.Literal;
}

function requestNodeData(
  items: ReadonlyArray<{ readonly iri: Rdf.Iri; readonly label?: Rdf.Literal }>,
  nodeDataQuery: SparqlJs.SelectQuery | undefined,
  sparqlOptions: SparqlClient.SparqlOptions
): Kefir.Property<(node: PartialMutableNode) => void> {
  if (items.length === 0) {
    return Kefir.constant(() => {/* nothing */});
  }

  let nodeDataTask: Kefir.Property<Map<string, SparqlClient.StarBinding>>;
  if (nodeDataQuery) {
    const values = items.map(item => ({item: item.iri}));
    const parametrizedQuery = SparqlClient.prepareParsedQuery(values)(nodeDataQuery);
    nodeDataTask = SparqlClient.selectStar(parametrizedQuery, sparqlOptions)
      .map(({results}) => {
        const indexedData = new Map<string, SparqlClient.StarBinding>();
        for (const binding of results.bindings) {
          if (binding.item && Rdf.isIri(binding.item)) {
            indexedData.set(binding.item.value, binding);
          }
        }
        return indexedData;
      });
  } else {
    nodeDataTask = Kefir.constant(new Map<string, SparqlClient.StarBinding>());
  }

  const unlabeledNodes: Rdf.Iri[] = [];
  for (const item of items) {
    if (!item.label) {
      unlabeledNodes.push(item.iri);
    }
  }
  const labelsTask = unlabeledNodes.length > 0
    ? getLabels(unlabeledNodes, sparqlOptions)
    : Kefir.constant(Immutable.Map<Rdf.Iri, string>());

  return Kefir.combine({
    indexedData: nodeDataTask
      .flatMapErrors(() => Kefir.constant(
        new Map<string, SparqlClient.StarBinding>()
      )),
    indexedDataError: nodeDataTask
      .map(() => undefined)
      .flatMapErrors(error => Kefir.constant(error)),
    indexedLabels: labelsTask,
  }, ({indexedData, indexedDataError, indexedLabels}) => {
    return (node: PartialMutableNode) => {
      const data = indexedData.get(node.iri.value);
      const label = indexedLabels.get(node.iri);
      node.data = data || node.data,
      node.label = typeof label === 'string' ? Rdf.literal(label) : node.label;
      if (indexedDataError) {
        node.dataError = indexedDataError;
      }
    };
  }).toProperty();
}
