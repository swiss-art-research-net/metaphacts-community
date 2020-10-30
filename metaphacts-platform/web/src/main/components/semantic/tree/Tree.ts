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
import { Component, createElement, MouseEvent, ReactNode } from 'react';
import * as D from 'react-dom-factories';
import * as _ from 'lodash';
import * as ReactTreeView from 'react-treeview';
import * as classnames from 'classnames';

import { TemplateItem } from 'platform/components/ui/template';

import { ProviderProps, TreeNode } from './SemanticTree';

import 'react-treeview/react-treeview.css';
import * as styles from './Tree.scss';

export interface TreeProps extends ProviderProps {}

interface State {
  collapsedBookkeeping?: BookeepingDictionary;
  activeNode?: any;
}

interface BookeepingDictionary {
  [index: string]: boolean;
}

export class Tree extends Component<TreeProps, State> {
    private key: string;
    constructor(props: TreeProps, context: any) {
        super(props, context);
        this.key = Math.random().toString(36).slice(2);
        this.state = {
            collapsedBookkeeping: {},
        };
    }

    public render() {
        // TODO add optional button to collapse/expand all nodes
        return D.div(
          { className: styles.tree },
          this.getTrees(this.props.nodeData)
        );
    }

    public componentWillMount() {
      const bookkeeping: BookeepingDictionary = {};
      // initalize the bookkeeping map with all keys of all nodes
      const keys = _.reduce(this.props.nodeData,
        (all, current) => all.concat(this.getAllKeys(current)), []
      );
      // set all markers to default as provided by the props
      _.forEach(keys, k => { bookkeeping[k] = this.props.collapsed; });

      // if in collapsed mode, check of keys that should be opened
      // and set all keys on the path to false (i.e. not collapsed)
      if (this.props.collapsed) {
        _.forEach(this.collectOpenKeys(this.props.nodeData),
          k => { bookkeeping[k] = false; }
        );
      }

      this.setState({ collapsedBookkeeping: bookkeeping });
    }

    private collectOpenKeys = (nodes: ReadonlyArray<TreeNode>): string[] => {
      return _.reduce(nodes,
        (collectedKeys, node) => {
          if (this.nodeHasChildren(node) && this.hasNestedOpenedKey(node)) {
            return collectedKeys.concat(
              this.collectOpenKeys(node.children).concat([this.getNodeKey(node)])
            );
          }
          return collectedKeys;
        }, []
      );
    }

    private getNodeKey = (node: TreeNode): string => {
      return node.key;
    }

    private getAllKeys = (node: TreeNode): any[] => {
      if (!node['children']) {
        return [this.getNodeKey(node)];
      }
      return _.reduce(node['children'],
        (all, current) => all.concat(this.getAllKeys(current)),
        [node.key]
      );
    }

    private handleClick = (node: any, e: MouseEvent<HTMLSpanElement>) => {
        if (this.props.onNodeClick) {
            this.props.onNodeClick(node);
        }
        this.setState({
          activeNode: node,
        });
    }

    private handleCollapsibleClick = (i: string) => {
      this.setState(state => {
        const collapsedBookkeeping = this.state.collapsedBookkeeping;
        collapsedBookkeeping[i] = !collapsedBookkeeping[i];
        return {collapsedBookkeeping: collapsedBookkeeping};
      });
    }

    private getTrees = (data: ReadonlyArray<TreeNode>): ReactNode => {
        return data.map((node, i: number) =>
            this.renderNode(node, i)
        );
    }

    private renderNode = (node: TreeNode, i: number) => {
      const nodeLabelTemplate = createElement(TemplateItem, {
            template: {
                source: this.props.tupleTemplate,
                options: {...node, ...node.data},
            },
        });
        const hasChildren = this.nodeHasChildren(node);

        const nodeKey = node.key;
        const children: ReactNode = (hasChildren && !this.isCollapsed(nodeKey, node))
          ? this.getTrees(node['children'])
          : null;

        const isCollapsed = this.isCollapsed(nodeKey, node);
        const renderedNode = D.span(
            {
              key: this.key + nodeKey + i,
              className: this.getCssClassesForNode(
                Boolean(children), (this.state.activeNode === node)
              ),
              onClick: this.handleClick.bind(null, node),
            },
            nodeLabelTemplate
          );

        return hasChildren
            ? createElement(ReactTreeView, {
                key: nodeKey + isCollapsed,
                nodeLabel: renderedNode,
                collapsed: isCollapsed,
                onClick: this.handleCollapsibleClick.bind(null, nodeKey),
              }, children)
            : renderedNode;
    }

    private nodeHasChildren = (node: any): boolean => {
      return !_.isUndefined(node['children']) && !_.isEmpty(node['children']);
    }

    private getCssClassesForNode = (hasChildren: boolean, isActive: boolean ): string => {
      const base = hasChildren ? styles.treeNode : styles.leafNode;
      return isActive ? classnames([base, styles.activeNode]) : base;
    }

    private isCollapsed = (i: any, node: any): boolean => {
      // check whether any of the deeply nested children nodes is listed
      // to be opened on intial rendering
      // if (this.props.collapsed && this.hasNestedOpenedKey(node)) {
      //   return false;
      // }
      return this.state.collapsedBookkeeping[i];
    }

    private hasNestedOpenedKey = (node: any) => {
      if ( _.includes(this.props.keysOpened, this.getNodeKey(node)) ) {
        return true;
      }
      if (_.isUndefined(node['children'])) {
        return false;
      }
      for ( const n in node['children']) {
        if (this.hasNestedOpenedKey(node['children'][n])) {
          return true;
        }
      }
      return false;
    }
}
