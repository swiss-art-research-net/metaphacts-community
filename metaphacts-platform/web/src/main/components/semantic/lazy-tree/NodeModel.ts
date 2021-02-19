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
import * as Kefir from 'kefir';

import { KeyedForest, KeyPath, Traversable } from './KeyedForest';

export interface TreeNode {
  readonly children?: ReadonlyArray<TreeNode>;
  readonly expanded?: boolean;
  readonly loading?: boolean;
  readonly error?: unknown;
}
export namespace TreeNode {
  export type Properties<T> = {
    children?: ReadonlyArray<T>;
    expanded?: boolean;
    loading?: boolean;
    error?: unknown;
  };

  export function set<T extends TreeNode>(node: T, props: Properties<T>): T {
    return {...node as any, ...props} as T;
  }
}

export type ChildrenLoader<T> = (parent: T) => Kefir.Property<T>;
export type ForestChange<T> = Kefir.Property<(forest: KeyedForest<T>) => KeyedForest<T>>;

export function queryMoreChildren<T extends TreeNode & Traversable<T>>(
  loadChildren: ChildrenLoader<T>,
  forest: KeyedForest<T>,
  path: KeyPath
): [KeyedForest<T>, ForestChange<T>] {
  const node = forest.fromKeyPath(path);
  if (node.loading || node.error) { return [forest, Kefir.constant(r => r)]; }

  const newForest = forest.updateNode(path, target => TreeNode.set(target, {loading: true}));

  const change = loadChildren(node).map(loaded => {
    return (currentForest: KeyedForest<T>) => currentForest.updateNode(path, currentNode => {
      if (loaded.error) {
        console.error(loaded.error);
      }
      return TreeNode.set(loaded, {
        loading: false,
        children: updateProposedNodes(
          currentForest.keyOf,
          /* proposed */ loaded.children,
          /* actual */ currentNode.children
        )
      });
    });
  });

  return [newForest, change];
}

function updateProposedNodes<T>(
  keyOf: (item: T) => string,
  proposedNodes: ReadonlyArray<T>,
  actualNodes: ReadonlyArray<T> | undefined
): ReadonlyArray<T> {
  if (!actualNodes) {
    return proposedNodes;
  }
  const actualByKey = new Map<string, T>();
  for (const actual of actualNodes) {
    actualByKey.set(keyOf(actual), actual);
  }
  return proposedNodes.map(proposed => actualByKey.get(keyOf(proposed)) ?? proposed);
}

export function mergeRemovingDuplicates<T>(
  keyOf: (item: T) => string,
  oldNodes: ReadonlyArray<T>,
  newNodes: ReadonlyArray<T>
): T[] {
  const existingKeys = new Set<string>();
  for (const old of oldNodes) {
    existingKeys.add(keyOf(old));
  }
  const nodes = [...oldNodes];
  // don't trust data source to return elements with distinct IRIs
  for (const node of newNodes) {
    const key = keyOf(node);
    if (!existingKeys.has(key)) {
      existingKeys.add(key);
      nodes.push(node);
    }
  }
  return nodes;
}

export function loadPath<T extends TreeNode & Traversable<T>>(
  shouldLoadChildren: (parent: T) => boolean,
  loadChildren: ChildrenLoader<T>,
  forest: KeyedForest<T>,
  path: KeyPath
): Kefir.Property<KeyedForest<T>> {
  let pathIndex = 0;
  let latest = forest;
  let loadedPath: KeyPath = latest.getKeyPath(latest.root);
  return Kefir.repeat<void>(() => {
    if (pathIndex >= path.length) {
      return false;
    }
    const targetKey = path[pathIndex];
    const levelPath: KeyPath = [...loadedPath, targetKey];
    return loadAtLevel(
      shouldLoadChildren,
      loadChildren,
      latest,
      levelPath
    ).map(loaded => {
      latest = loaded;
      loadedPath = levelPath;
      pathIndex++;
    });
  }).takeErrors(1).last().map(() => latest).toProperty();
}

/**
 * Loads subtree which includes target tree path for all tree levels in parallel
 * (target path must exist in the tree).
 */
export function loadExistingPathInParallel<T extends TreeNode & Traversable<T>>(
  shouldLoadChildren: (parent: T) => boolean,
  loadChildren: ChildrenLoader<T>,
  forest: KeyedForest<T>,
  path: KeyPath
) {
  if (!forest.fromKeyPath(path)) {
    throw new Error('Cannot load path in parallel because it does not exists');
  }

  let current = forest;
  const tasks: Array<Kefir.Property<void>> = [];
  for (let i = 1; i < path.length; i++) {
    const targetPath = path.slice(0, i + 1);
    const parentPath = path.slice(0, i);
    let levelForest = forest.updateChildren(parentPath, () => []);
    const task = loadAtLevel(
      shouldLoadChildren,
      loadChildren,
      levelForest,
      targetPath
    ).map(loaded => {
      const loadedParent = loaded.fromKeyPath(parentPath);
      const currentTarget = current.fromKeyPath(targetPath);
      // update current forest with loaded parent node
      // but restore target child which may also be already loaded
      current = current
        .updateNode(parentPath, () => loadedParent)
        .updateNode(targetPath, () => currentTarget);
    });
    tasks.push(task);
  }

  return Kefir.merge(tasks).takeErrors(1).last().map(() => current).toProperty();
}

function loadAtLevel<T extends TreeNode & Traversable<T>>(
  shouldLoadChildren: (parent: T) => boolean,
  loadChildren: ChildrenLoader<T>,
  forest: KeyedForest<T>,
  path: KeyPath
): Kefir.Property<KeyedForest<T>> {
  let emittedOnce = false;
  let latestLocal = forest;
  const targetKey = path[path.length - 1];
  const parentPath = path.slice(0, path.length - 1);
  return Kefir.repeat<null>(() => {
    if (!emittedOnce) {
      // emit at least once for `.last()` to work correctly
      emittedOnce = true;
      return Kefir.constant<null>(null);
    }

    const parent = latestLocal.fromKeyPath(parentPath);
    const children: ReadonlyArray<T> = parent.children;
    if (children) {
      const target = children.find(child => latestLocal.keyOf(child) === targetKey);
      if (target) {
        return false;
      }
    }

    if (shouldLoadChildren(parent)) {
      const [loading, forestChange] = queryMoreChildren(loadChildren, latestLocal, parentPath);
      return forestChange.map(change => {
        latestLocal = change(latestLocal);
        return null;
      });
    } else {
      return Kefir.constantError<any>(new Error(
        `Failed to find child ${targetKey} on parent ${latestLocal.keyOf(parent)}`
      ));
    }
  }).takeErrors(1).last().map(() => latestLocal).toProperty();
}

export function expandPath<T extends TreeNode & Traversable<T>>(
  forest: KeyedForest<T>, path: KeyPath
) {
  const expandNode = (node: T, nextPathIndex: number): T => {
    if (nextPathIndex >= path.length) {
      // leave target node collapsed
      return node;
    }
    const key = path[nextPathIndex];
    const index = forest.getChildIndex(node, key);
    const child = node.children[index];
    const children = [...node.children];
    children.splice(index, 1, expandNode(child, nextPathIndex + 1));
    return TreeNode.set(node, {children, expanded: true});
  };
  return forest.setRoot(expandNode(forest.root, 0));
}
