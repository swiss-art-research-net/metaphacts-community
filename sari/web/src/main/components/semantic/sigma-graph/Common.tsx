/*
 * Copyright (C) 2022, © Swiss Art Research Infrastructure, University of Zurich
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { Cancellation } from 'platform/api/async';
import { getGraphDataWithLabels } from 'platform/components/semantic/graph/GraphInternals';
import { QueryContext } from 'platform/api/sparql/SparqlClient';

import { MultiDirectedGraph } from "graphology";

import { SigmaGraphConfig, DEFAULT_HIDE_PREDICATES } from './Config';
const SAVED_STATE_LOCAL_STORAGE_KEY = 'sigmaGraph-key';
const SAVED_STATE_LOCAL_STORAGE_GRAPH = 'sigmaGraph-graph';

const DEFAULT_COLOUR_NODE = "#000";
const DEFAULT_COLOUR_EDGE = "#aaa";

export function applyGroupingToGraph(graph: MultiDirectedGraph, props: SigmaGraphConfig) {
    // Retrieve all predicate attributes that appear in the edges of the graph
    const predicates = graph.edges().map((edge) => graph.getEdgeAttribute(edge, 'predicate')).filter((value, index, self) => self.indexOf(value) === index);

    // Store nodes by shared type and predicate in a map
    const nodesBySourceTypeAndPredicate = {};

    // Iterate through nodes of the graph and group nodes that share a source node, type and predicate
    for (const node of graph.nodes()) {
        const types = graph.getNodeAttribute(node, 'types');
        const typesString = types.map((type) => type.value).sort().join('');
    
        // Iterate through source nodes
        for (const source of graph.inNeighbors(node)) {
            // Iterate through predicates
            for (const predicate of predicates) {
                // Check if there is an edge from the source to the node with the given predicate
                const edges = graph.edges().filter((edge) => graph.getEdgeAttribute(edge, 'predicate') == predicate).filter((edge) => graph.source(edge) == source && graph.target(edge) == node)
                if (edges.length > 0) {
                    // Check if the map already contains an entry for the current source node, type combination and predicate
                    const key = source + typesString + predicate;
                    if (nodesBySourceTypeAndPredicate[key]) {
                        // Add the current node to the array of nodes that share the current source node, type combination and predicate
                        nodesBySourceTypeAndPredicate[key]['nodes'].push(node);
                    } else {
                        // Create a new entry in the map for the current source node, type combination and predicate
                        nodesBySourceTypeAndPredicate[key] = {
                            'nodes': [node],
                            'predicate': predicate,
                            'labels': edges.map((edge) => graph.getEdgeAttribute(edge, 'label')),
                            'source': source,
                            'types': types,
                            'typeLabels': graph.getNodeAttributes(node)['typeLabels']
                        }
                    }
                }
            }
        }
    }

    // Create a new graph that will contain the grouped nodes
    const groupedGraph = new MultiDirectedGraph();
    
    // If the number of nodes in entry contains less than the group size we remove the entry from the map
    // and add the nodes and corresponding edges to the grouped graph
    for(const key in nodesBySourceTypeAndPredicate) {
        const entry = nodesBySourceTypeAndPredicate[key];
        if (entry['nodes'].length < props.grouping.threshold) {
            // Add source node to graph
            if (!groupedGraph.hasNode(entry['source'])) {
                groupedGraph.addNode(entry['source'], graph.getNodeAttributes(entry['source']));
            }

            // Add nodes to graph
            for (const node of entry['nodes']) {
                // Check if node already exists in the grouped graph
                if (!groupedGraph.hasNode(node)) {
                    groupedGraph.addNode(node, graph.getNodeAttributes(node));
                }
            }

            // Add edges to graph
            for (const node of entry['nodes']) {
                if(!groupedGraph.hasEdge(entry['source']+node)) {
                    groupedGraph.addEdgeWithKey(entry['source']+node, entry['source'], node, {
                        label: entry['labels'].join(' '),
                        size: props.sizes.edges,
                        color: props.colours && props.colours.edge || DEFAULT_COLOUR_EDGE
                    })
                }
            }

            // Remove entry from map
            delete nodesBySourceTypeAndPredicate[key];
        }
    }

    // Add nodes to grouped grpah
    for(const key in nodesBySourceTypeAndPredicate) {
        const entry = nodesBySourceTypeAndPredicate[key];
        // Add source node to graph
        if (!groupedGraph.hasNode(entry['source'])) {
            groupedGraph.addNode(entry['source'], graph.getNodeAttributes(entry['source']));
        }

        // Add grouped nodes to a list
        const children = []
        for (const node of entry['nodes']) {
            const attributes = graph.getNodeAttributes(node);
            attributes.parent = key;
            children.push({
                node: node,
                attributes: attributes
            })
        }

        // Add a new node that represents the group of nodes that share the current source node, type combination and predicate
        if(!groupedGraph.hasNode(key)) {
            groupedGraph.addNode(key, {
                grouped: true,
                children: children,
                label: graph.getNodeAttribute(entry['nodes'][0], 'typeLabels') + ' (' + entry['nodes'].length + ')',
                typeLabels: graph.getNodeAttribute(entry['nodes'][0], 'typeLabels'),
                size: props.sizes.nodes * 1.5,
                color: graph.getNodeAttribute(entry['nodes'][0], 'color'), // We just use the color of the first node
                x: graph.getNodeAttribute(entry['nodes'][0], 'x'),
                y: graph.getNodeAttribute(entry['nodes'][0], 'y')
            })
        }
    }

    // Add edges to grouped graph
    for(const key in nodesBySourceTypeAndPredicate) {
        const entry = nodesBySourceTypeAndPredicate[key];
        // Add an edge from the source node to the group node if it doesn't already exist
        if (!groupedGraph.hasEdge(entry['source']+key)) {
            groupedGraph.addEdgeWithKey(entry['source']+key, entry['source'], key, {
                label: entry['labels'].join(' '),
                size: props.sizes.edges,
                color: props.colours && props.colours.edge || DEFAULT_COLOUR_EDGE
            })
        }
    }
    
    return groupedGraph;
}

export function cleanGraph(graph: MultiDirectedGraph) {
    // Check for groups that only contain one element
    const nodes = graph.nodes();
    for (const node of nodes) {
        if (graph.getNodeAttribute(node, 'children')) {
            const children = graph.getNodeAttribute(node, 'children');
            if (children.length == 1) {
                releaseNodeFromGroup(graph, children[0].node, node);
                graph.dropNode(node);
            } else if (children.length == 0) {
                graph.dropNode(node);
            }
        }
    }
}

export function createGraphFromElements(elements: any[], props: SigmaGraphConfig) {
    const graph = new MultiDirectedGraph();
    const nodeSize = props.sizes.nodes || 10;
    const edgeSize = props.sizes.edges || 5;
    // Order elements by <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> key
    elements.sort((a, b) => {
        if (a.data['<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>'] && b.data['<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>']) {
            return a.data['<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>'][0].value.localeCompare(b.data['<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>'][0].value);
        } else if (a.data['<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>']) {
            return -1;
        } else if (b.data['<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>']) {
            return 1;
        } else {
            return 0;
        }
    })
    for (const element of elements) {
        if (element.group == "nodes") {
            let color = props.colours && props.colours.node || DEFAULT_COLOUR_NODE;
            const types = element.data['<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>']
            if (props.colours && element.data['<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>']) {
                for (const type of types) {
                    if (props.colours[type.value]) {
                        color = props.colours[type.value];
                        break;
                    }
                }
            }
            graph.addNode(element.data.id, {
                childrenCollapsed: false,
                hidden: false,
                label: element.data.label,
                typeLabels: element.data.typeLabels,
                color: color,
                types: types,
                size: nodeSize,
                image: element.data.thumbnail
            })
        }
    }

    for (const element of elements) {
        if (element.group == "edges") {
            const color = props.colours && props.colours.edge || DEFAULT_COLOUR_EDGE;
            graph.addEdgeWithKey(element.data.id, element.data.source, element.data.target, {
                label: element.data.label,
                predicate: element.data.resource,
                size: edgeSize,
                color: color
            })
        }
    }

    graph.nodes().forEach((node, i) => {
        const angle = (i * 2 * Math.PI) / graph.order;
        graph.setNodeAttribute(node, "x", 100 * Math.cos(angle));
        graph.setNodeAttribute(node, "y", 100 * Math.sin(angle));
    });

    if (props.grouping.enabled) {
        const groupedGraph = applyGroupingToGraph(graph, props);
        return groupedGraph;
    } else {
        return graph
    }

}

export function clearStateFromLocalStorage() {
    localStorage.removeItem(SAVED_STATE_LOCAL_STORAGE_KEY);
    localStorage.removeItem(SAVED_STATE_LOCAL_STORAGE_GRAPH);
}

export function getStateFromLocalStorage(key: string) {
    if (localStorage.getItem(SAVED_STATE_LOCAL_STORAGE_KEY) == key) {
        const compressed = localStorage.getItem(SAVED_STATE_LOCAL_STORAGE_GRAPH)
        const jsonGraph = JSON.parse(decompressFromEncodedURIComponent(compressed));
        const graph = new MultiDirectedGraph();
        graph.import(jsonGraph);
        return graph
    }

    // If the query is not the same as the one in local storage, we clear the local storage
    localStorage.removeItem(SAVED_STATE_LOCAL_STORAGE_KEY);
    localStorage.removeItem(SAVED_STATE_LOCAL_STORAGE_GRAPH);
    return null;
}

export function mergeGraphs(graph, newGraph) {
     // Merge new graph with sigma graph
     newGraph.forEachNode((node, attributes) => {
        if (!graph.hasNode(node)) {
            graph.addNode(node, attributes);
        }
    })
    newGraph.forEachEdge((edge, attributes, source, target) => {
        if (!graph.hasEdge(edge)) {
            graph.addEdgeWithKey(edge, source, target, attributes);
        }
    })
    // If the new graph contains grouped nodes, it might be that a node that
    // is part of a group is already present as an individual node in the graph. 
    // In this case we need to remove the grouped node from its group and add a
    // corresponding edge from the groups source to the node.
    const nodes = graph.nodes();
    const nodesToRelease = [];
    for (const node of nodes) {
        if (graph.getNodeAttribute(node, 'grouped')) {
            // Look at children of group and check if they are already present in the graph
            const children = graph.getNodeAttribute(node, 'children');
            for (const child of children) {
                if (graph.hasNode(child.node)) {
                    nodesToRelease.push({group: node, child: child});
                }
            }
        }
    }
    for (const node of nodesToRelease) {
        releaseNodeFromGroup(graph, node.child.node, node.group);
    }
}

export function loadGraphDataFromQuery(query: string, context: QueryContext) {
    const cancellation = new Cancellation();
    const config = {
        query: query,
        hidePredicates: DEFAULT_HIDE_PREDICATES
    }
    return cancellation.map(getGraphDataWithLabels(config, { context }))
}

export function releaseNodeFromGroup(graph: MultiDirectedGraph, childNode: string, groupNode: string)  {
    const children = graph.getNodeAttribute(groupNode, "children");
    const edges = graph.inEdges(groupNode);
    const groupNodeAttributes = graph.getNodeAttributes(groupNode);
    for (const child of children) {
        if (child.node == childNode) {
            // If additional data has been retrieved and
            // merged into the graph, the node might already exist
            if (!graph.hasNode(childNode)) {
                child.attributes.x = groupNodeAttributes.x;
                child.attributes.y = groupNodeAttributes.y;
                graph.addNode(childNode, child.attributes);
            }
            // Remove the child node from the children array
            children.splice(children.indexOf(child), 1)
            graph.setNodeAttribute(groupNode, "children", children)
            // Update group node label
            const typeLabels = graph.getNodeAttribute(groupNode, "typeLabels")
            const uniqueTypeLabels = typeLabels.filter((value, index, array) => array.indexOf(value) === index);
            graph.setNodeAttribute(groupNode, "label", uniqueTypeLabels + ' (' + (children.length) + ')')
            // Add edges from group source node to child node
            for (const edge of edges) {
                const sourceNode = graph.source(edge);
                const edgeAttributes = graph.getEdgeAttributes(edge);
                // Check if edge already exists
                if (!graph.hasEdge(sourceNode+childNode)) {
                    graph.addEdgeWithKey(sourceNode+childNode, sourceNode, childNode, edgeAttributes)
                }
            }
        }
    }
}

export function saveStateIntoLocalStorage(graph: MultiDirectedGraph, key: string) {
    const exportedGraph = graph.export();
    const compressed = compressToEncodedURIComponent(JSON.stringify(exportedGraph));
    localStorage.setItem(SAVED_STATE_LOCAL_STORAGE_KEY, key)
    localStorage.setItem(SAVED_STATE_LOCAL_STORAGE_GRAPH, compressed)
}