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
import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { Rdf } from 'platform/api/rdf';
import { Component, ComponentContext, ContextTypes } from 'platform/api/components';
import { SparqlClient } from 'platform/api/sparql';

import { TemplateItem } from 'platform/components/ui/template';

import { ProviderProps, TreeNode } from './SemanticTree';

import * as styles from './D3Tree.scss';

export interface D3TreeProps extends ProviderProps {
  provider: D3TreeProviderKind;
  options?: D3TreeOptions;
}

export interface D3TreeOptions {
  /**
   * Minimum height of the entire tree in pixels.
   *
   * If the content is larger than the minimum height, the min-height property has no effect.
   * By default the height will be estimated.
   *
   * @default 300
   */
  minHeight?: number;
  /**
   * Width of each node (template) element in pixels.
   *
   * @default 30
   */
  nodeWidth?: number;
  /**
   * Height of each node (template) element in pixels.
   *
   * @default 120
   */
  nodeHeight?: number;
  /**
   * Left margin of each node (template) element in pixels.
   *
   * @default 8
   */
  nodeLeftMargin?: number;
}

export type D3TreeProviderKind = 'd3-sankey' | 'd3-dendrogram' | 'd3-collapsible-tree';

let D3Bundle: any;
function loadD3() {
  return Promise.all([
    import('d3'),
    import('d3-sankey'),
    import('d3-scale'),
  ]).then(([d3, sankey, scale]) => {
    D3Bundle = {...d3, ...sankey, ...scale};
  });
}

export class D3Tree extends Component<D3TreeProps, {}> {
  static readonly defaultProps: Required<Pick<D3TreeProps, 'options'>> = {
    options: {},
  };

  private root: HTMLDivElement;
  private openedKeys: Set<string>;
  private onUnmount: Array<() => void> = [];
  private treeRendered = false;
  private unmounted = false;

  constructor(props: D3TreeProps, context: any) {
    super(props, context);
    this.openedKeys = new Set(props.keysOpened);
  }

  render() {
    return <div className={styles.root} ref={this.onMount} />;
  }

  componentDidMount() {
    if (!D3Bundle) {
      loadD3().then(() => {
        if (!this.unmounted) {
          this.tryRenderTree();
        }
      });
    }
  }

  componentWillUnmount() {
    for (const handler of this.onUnmount) {
      handler();
    }
    this.onUnmount.length = 0;
    this.unmounted = true;
  }

  private onMount = (root: HTMLDivElement) => {
    this.root = root;
    this.tryRenderTree();
  }

  private tryRenderTree() {
    if (this.treeRendered) { return; }
    if (D3Bundle && this.root) {
      this.drawTree(D3Bundle, this.root);
    }
  }

  private drawTree(d3: any, target: HTMLDivElement) {
    const renderData = this.createRenderer(d3);

    const redraw = () => {
      d3.select(target).selectAll('svg').remove();

      const {
        minHeight = 300,
        nodeWidth = 120,
        nodeHeight = 25,
        nodeLeftMargin = 8,
      } = this.props.options;

      renderData({
        selector: target,
        props: this.props,
        openedKeys: this.openedKeys,
        width: target.clientWidth,
        marginTop: 0,
        marginBottom: 0,
        minHeight,
        nodeWidth,
        nodeHeight,
        nodeLeftMargin,
        componentContext: this.context,
      });
    };

    window.addEventListener('resize', redraw);
    this.onUnmount.push(() => {
      window.removeEventListener('resize', redraw);
      d3.select(target).select('svg').remove();
    });

    redraw();
  }

  private createRenderer(d3: any): (config: TreeConfig) => void {
    const {provider, nodeData} = this.props;
    if (provider === 'd3-dendrogram') {
      const dendrogramData = nodeData.map(convertDataToD3Dendrogram);
      return config => {
        dendrogramData.forEach((data, index, array) => dendrogram(d3, data, {
          ...config,
          minHeight: config.minHeight / array.length,
          marginTop: index === 0 ? 20 : 0,
          marginBottom: index === array.length - 1 ? 20 : 0,
        }));
      };
    } else if (provider === 'd3-collapsible-tree') {
      const dendrogramData = nodeData.map(convertDataToD3Dendrogram);
      return config => {
        dendrogramData.forEach((data, index, array) => collapsibleDendrogram(d3, data, {
          ...config,
          minHeight: config.minHeight / array.length,
          marginTop: index === 0 ? 20 : 0,
          marginBottom: index === array.length - 1 ? 20 : 0,
        }));
      };
    } else if (provider === 'd3-sankey') {
      const sankeyData = convertDataToD3Sankey(nodeData);
      return config => sankey(d3, sankeyData, {
        ...config,
        marginTop: 20,
        marginBottom: 20,
      });
    } else {
      throw new Error(`Unknown D3 tree provider '${provider}'`);
    }
  }
}

interface DendrogramNode {
  name: string;
  data: SparqlClient.StarBinding;
  children?: DendrogramNode[];
  _children?: DendrogramNode[];
  parent?: DendrogramNode;
  depth?: number;
  x?: number;
  y?: number;
  x0?: number;
  y0?: number;
}

function convertDataToD3Dendrogram(node: TreeNode): DendrogramNode {
  return {
    name: node.key,
    data: node.data,
    children: node.children
      ? node.children.map(convertDataToD3Dendrogram)
      : [],
  };
}

interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
}

interface SankeyNode {
  key: string;
  data: SparqlClient.StarBinding;
  label: string;
  name: string;
}

interface SankeyLink {
  source: number;
  target: number;
  value?: number;
}

function convertDataToD3Sankey(data: ReadonlyArray<TreeNode>): SankeyData {
  const nodes: SankeyNode[] = [];
  const links: SankeyLink[] = [];
  const indices: { [key: string]: number } = {};
  let index = 0;

  const traverse = (item: TreeNode) => {
    // reuse sankey node when tree node has the same key
    if (typeof indices[item.key] === 'number') { return; }
    nodes.push({key: item.key, data: item.data, label: item.key, name: item.key});
    indices[item.key] = index++;
    for (const child of item.children ? item.children : []) {
      traverse(child);
      links.push({source: indices[item.key], target: indices[child.key]});
    }
  };

  data.forEach(traverse);
  return {nodes, links};
}

interface TreeConfig extends D3TreeOptions {
  selector: HTMLElement;
  props: D3TreeProps;
  openedKeys: Set<string>;

  width?: number;
  height?: number;
  marginTop: number;
  marginBottom: number;

  componentContext: ComponentContext;
}

function dendrogram(d3: any, tree: DendrogramNode, config: TreeConfig) {
  const margin = computeDendrogramMargin(config);
  const opts = {
    width: computeEffectiveWidth(tree, config, margin.left + margin.right),
    height: computeEffectiveHeight(tree, config, margin.top + margin.bottom),
    radius: 5,
    selector: config.selector || null,
  };

  const svg = d3.select(config.selector).append('svg')
    .attr('width', opts.width)
    .attr('height', opts.height)
    .append('g')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

  const cluster = d3.layout.cluster()
    .size([
      opts.height - margin.top - margin.bottom,
      opts.width - margin.left - margin.right,
    ]);
  const nodes = cluster.nodes(tree);
  const links = cluster.links(nodes);

  const diagonal = d3.svg.diagonal()
    .projection((d: any) => [d.y, d.x]);

  svg.selectAll('.link').data(links).enter().append('path').attr('class', 'link')
    .attr('d', diagonal);

  const node = svg.selectAll('.node').data(nodes).enter().append('g').attr('class', 'node')
    .attr('transform', (d: any) => 'translate(' + d.y + ',' + d.x + ')');
  node.append('circle').attr('class', 'node-circle')
    .attr('r', opts.radius);
  appendDendrogramNode(node, config);
}

function appendDendrogramNode(selection: any /* D3 selection */, config: TreeConfig) {
  return selection
    .append((d: DendrogramNode) => createTemplateAsForeignObject(config, d.data))
    .attr('class', 'node-text')
    .attr('x', (d: any) => config.nodeLeftMargin)
    .attr('y', -config.nodeHeight / 2);
}

function collapsibleDendrogram(d3: any, tree: DendrogramNode, config: TreeConfig) {
  function onClick(d: DendrogramNode) {
    toggleExpanded(d, config.openedKeys);
    update(d);
  }

  function onDoubleClick(d: DendrogramNode) {
    if (d.parent) {
      toggleExpanded(d.parent, config.openedKeys);
      update(d.parent);
    }
  }

  const nodeWidthWithMargin = config.nodeLeftMargin + config.nodeWidth;
  function setFixedNodeDepth(nodes: DendrogramNode[]) {
    nodes.forEach(d => { d.y = d.depth * nodeWidthWithMargin; });
  }

  const margin = computeDendrogramMargin(config);
  const opts = {
    radius: 5,
    selector: config.selector,
  };

  function computeLayout() {
    const size = {
      width: computeEffectiveWidth(tree, config, margin.left + margin.right),
      height: computeEffectiveHeight(tree, config, margin.top + margin.bottom),
    };
    const cluster = d3.layout.cluster().size([
      size.height - margin.top - margin.bottom,
      size.width - margin.left - margin.right,
    ]);
    const nodes = cluster.nodes(tree);
    const links = cluster.links(nodes);
    return {size, nodes, links};
  }

  const {size, nodes, links} = computeLayout();
  setFixedNodeDepth(nodes);

  const diagonal = d3.svg.diagonal()
    .projection((d: any) => [d.y, d.x]);
  const svg = d3.select(opts.selector, 'dendrogram').append('svg')
    .attr('width', size.width)
    .attr('height', size.height);
  const rootGroup = svg.append('g')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

  // link
  rootGroup.selectAll('.link')
    .data(links)
    .enter()
    .append('path')
      .attr('class', 'link')
      .attr('d', diagonal);

  const node = rootGroup.selectAll('.node')
    .data(nodes)
    .enter()
    .append('g')
      .attr('class', 'node')
      .attr('transform', (d: any) => 'translate(' + d.y + ',' + d.x + ')')
      .on('click', onClick);
  // circle
  node.append('circle')
    .attr('class', 'node-circle')
    .attr('r', (d: any) => (1 + d.value / 12) * 4 || opts.radius);
  // node template
  appendDendrogramNode(node, config);

  const root = tree;
  root.x0 = size.height / 4;
  root.y0 = 0;

  if (config.props.collapsed) {
    collapse(root);
    expandKeys(root, config.openedKeys);
  }

  update(root);

  function update(source: DendrogramNode) {
    const duration = 750;

    // Compute the new tree layout.
    const layout = computeLayout();

    setFixedNodeDepth(layout.nodes);
    svg.transition().duration(duration)
      .attr('width', layout.size.width)
      .attr('height', layout.size.height);

    // Update the nodes…
    let i = 0;
    const node = rootGroup.selectAll('g.node')
      .data(layout.nodes, (d: any) => { return d.id || (d.id = ++i); });

    // Enter any new nodes at the parent's previous position.
    const nodeEnter = node.enter().append('g').attr('class', 'node')
      .attr('transform', (d: any) => 'translate(' + source.y0 + ',' + source.x0 + ')')
      .on('click', onClick)
      .on('dblclick', onDoubleClick);

    nodeEnter.append('circle')
      .attr('class', (d: any) => d._children ? 'node-circle-children' : 'node-circle')
      .attr('r', (d: any) => (1 + d.value / 12) * 4 || opts.radius);
    appendDendrogramNode(nodeEnter, config)
      .style('fill-opacity', 1e-6);

    // Transition nodes to their new position.
    const nodeUpdate = node.transition().duration(duration)
      .attr('transform', (d: any) => 'translate(' + d.y + ',' + d.x + ')');
    nodeUpdate.select('circle')
      .attr('class', (d: any) => d._children ? 'node-circle-children' : 'node-circle')
      .attr('r', (d: any) => (1 + d.value / 12) * 4 || opts.radius);
    nodeUpdate.select('text').attr('text', 'node-text')
      .style('fill-opacity', 1);

    // Transition exiting nodes to the parent's new position.
    const nodeExit = node.exit().transition().duration(duration)
      .attr('transform', (d: any) => 'translate(' + source.y + ',' + source.x + ')')
      .remove();
    nodeExit.select('circle').attr('class', 'node-circle')
      .attr('r', (d: any) => (1 + d.value / 12) * 4 || opts.radius);
    nodeExit.select('text').attr('text', 'node-text')
      .style('fill-opacity', 1e-6);

    // Update the links…
    const linkPath = rootGroup.selectAll('path.link')
      .data(layout.links, (d: any) => d.target.id);

    // Enter any new links at the parent's previous position.
    linkPath.enter().insert('path', 'g').attr('class', 'link')
      .attr('d', (d: any) => {
        const o = {x: source.x0, y: source.y0};
        return diagonal({source: o, target: o});
      });

    // Transition links to their new position.
    linkPath.transition().duration(duration)
      .attr('d', diagonal);

    // Transition exiting nodes to the parent's new position.
    linkPath.exit().transition().duration(duration)
      .attr('d', (d: any) => {
        const o = {x: source.x, y: source.y};
        return diagonal({source: o, target: o});
      })
      .remove();

    // Stash the old positions for transition.
    layout.nodes.forEach((d: any) => { d.x0 = d.x; d.y0 = d.y; });
  }
}

function collapse(d: DendrogramNode) {
  if (d.children) {
    d._children = d.children;
    d.children = null;
    d._children.forEach(collapse);
  }
}

function toggleExpanded(node: DendrogramNode, openedKeys?: Set<string>) {
  if (node.children) {
    node._children = node.children;
    node.children = null;
    if (openedKeys) {
      openedKeys.delete(node.name);
    }
  } else if (node._children) {
    node.children = node._children;
    node._children = null;
    if (openedKeys) {
      openedKeys.add(node.name);
    }
  }
}

/**
 * @returns true if `keys` contains any descedant node key; otherwise false.
 */
function expandKeys(node: DendrogramNode, keys: ReadonlySet<string>): boolean {
  let shouldExpand = keys.has(node.name);

  const nodeChildren = node.children || node._children;
  if (nodeChildren) {
    for (const child of (node.children || node._children)) {
      if (expandKeys(child, keys)) {
        shouldExpand = true;
      }
    }
  }

  if (shouldExpand && !node.children) {
    toggleExpanded(node);
  }

  return shouldExpand;
}

function computeDendrogramMargin(config: TreeConfig) {
  return {
    top: config.marginTop,
    bottom: config.marginBottom,
    left: config.nodeLeftMargin + config.nodeWidth / 2,
    right: config.nodeLeftMargin + config.nodeWidth * 2,
  };
}

function computeEffectiveWidth(tree: DendrogramNode, config: TreeConfig, margin: number) {
  const estimated = estimateTotalWidth(tree, config);
  const width = estimated + margin;
  return Math.max(width, config.width);
}

function computeEffectiveHeight(tree: DendrogramNode, config: TreeConfig, margin: number) {
  let height: number;
  if (typeof config.height === 'number') {
    height = config.height;
  } else {
    const estimated = estimateTotalHeight(tree, config.nodeHeight);
    height = estimated + margin;
  }
  return Math.max(height, config.minHeight);
}

function estimateTotalWidth(node: DendrogramNode, config: TreeConfig): number {
  let width = config.nodeWidth;
  if (node.children) {
    let maxChildWidth = 0;
    for (const child of node.children) {
      maxChildWidth = Math.max(maxChildWidth, estimateTotalWidth(child, config));
    }
    if (maxChildWidth > 0) {
      width += config.nodeLeftMargin + maxChildWidth;
    }
  }
  return width;
}

function estimateTotalHeight(node: DendrogramNode, nodeHeight: number): number {
  let childrenHeight = 0;
  if (node.children) {
    for (const child of node.children) {
      childrenHeight += estimateTotalHeight(child, nodeHeight);
    }
  }
  return Math.max(childrenHeight, nodeHeight);
}

function sankey(d3: any, graph: SankeyData, config: TreeConfig) {
  const margin = {top: config.marginTop, bottom: config.marginBottom, left: 120, right: 200};
  const opts = {
    width: config.width,
    height: config.height || config.minHeight,
    selector: config.selector,
  };

  const links = graph.links;
  for (let i = 0; i < links.length; i++) {
    links[i].value = 2;
  }

  const sankey = d3.sankey()
    .nodeWidth(15)
    .nodePadding(10)
    .size([
      opts.width - margin.left - margin.right,
      opts.height - margin.top - margin.bottom,
    ]);
  sankey(graph);

  const svg = d3.select(opts.selector, 'sankey').append('svg')
    .attr('width', opts.width)
    .attr('height', opts.height)
    .append('g')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

  const color = d3.scaleOrdinal(d3.schemeCategory10);

  const link = svg.append('g').attr('class', 'links')
    .selectAll('path').data(graph.links).enter().append('path')
    .attr('d', d3.sankeyLinkHorizontal())
    .attr('stroke-width', (d: any) => Math.max(1, d.width));

  link.append('title')
    .text((d: any) => 'no title');

  const node = svg.append('g')
    .attr('class', 'nodes')
    .selectAll('g')
    .data(graph.nodes)
    .enter()
    .append('g')
      .attr('class', 'node');

  node.append('rect')
    .attr('x', (d: any) => d.x0)
    .attr('y', (d: any) => d.y0)
    .attr('width', (d: any) => d.x1 - d.x0)
    .attr('height', (d: any) => d.y1 - d.y0)
    .attr('fill', (d: any) => color(d.name))
    .attr('opacity', 0.5);

  node
    .append((d: SankeyNode) => createTemplateAsForeignObject(config, d.data))
    .attr('class', 'node-text')
    .attr('x', (d: any) => d.x1 + 6)
    .attr('y', (d: any) => ((d.y1 + d.y0) - config.nodeHeight) / 2);

  node.append('title')
    .text((d: any) => 'no title');
}

function createTemplateAsForeignObject(
  config: TreeConfig,
  data: SparqlClient.StarBinding
): SVGForeignObjectElement {
  const root = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
  const {nodeWidth, nodeHeight, props} = config;
  root.setAttribute('width', String(nodeWidth));
  root.setAttribute('height', String(nodeHeight));
  // TODO: is it required to call `unmountComponentAtNode()`
  // in case when container already detached from the DOM?
  ReactDOM.render(<NodeCell config={config} data={data} />, root);
  return root;
}

interface NodeCellProps {
  config: TreeConfig;
  data: SparqlClient.StarBinding;
}

class NodeCell extends Component<NodeCellProps, {}> {
  static childContextTypes = ContextTypes;

  getChildContext() {
    const {componentContext} = this.props.config;
    // filter componentContext to keep only properties defined in childContextTypes
    const childContext: { [key: string]: any } = {};
    for (const key in componentContext) {
      if (componentContext.hasOwnProperty(key) && NodeCell.childContextTypes[key]) {
        childContext[key] = componentContext[key as keyof typeof componentContext];
      }
    }
    return childContext as ComponentContext;
  }

  render() {
    const {config: {nodeWidth, nodeHeight, props}, data} = this.props;
    return (
      <div className='node-cell' style={{width: nodeWidth, height: nodeHeight}}>
        <TemplateItem template={{
          source: props.tupleTemplate,
          options: {data, ...data},
        }} />
      </div>
    );
  }
}
