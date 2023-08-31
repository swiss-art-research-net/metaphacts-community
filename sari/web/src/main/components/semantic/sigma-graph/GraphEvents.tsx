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
/* eslint-disable react/prop-types */
//@ts-nocheck

import * as React from 'react';
import { useEffect, useState } from 'react';

import { listen, trigger } from 'platform/api/events';
import { Cancellation } from 'platform/api/async';

import { inferSettings } from 'graphology-layout-forceatlas2'
import { useWorkerLayoutForceAtlas2 } from "@react-sigma/layout-forceatlas2";
import { ControlsContainer, useCamera, useRegisterEvents, useSigma, useSetSettings } from "@react-sigma/core";
import { Attributes } from "graphology-types";

import { GraphEventsConfig } from './Config';
import { cleanGraph, createGraphFromElements, loadGraphDataFromQuery, mergeGraphs, releaseNodeFromGroup } from './Common';
import { ScatterGroupNode, FocusNode, NodeClicked, TriggerNodeClicked } from './EventTypes';
import { EdgeFilterControl } from './EdgeFilterControl'
import { Panel } from './ControlPanel'

import "@react-sigma/core/lib/react-sigma.min.css";

export const GraphEvents: React.FC<GraphEventsConfig> = (props) => {

    const registerEvents = useRegisterEvents();
    const sigma = useSigma();
    const setSettings = useSetSettings();
    const camera = useCamera();

    const [ activeNode, setActiveNode ] = useState<string | null>(null);
    const [ draggedNode, setDraggedNode ] = useState<string | null>(null);

    const [ edgeLabels, setEdgeLabels ] = useState<{label: string, visible: boolean}[]>([]);
    const [ edgeLabelsNeedUpdate, setEdgeLabelsNeedUpdate ] = useState<boolean>(false);
    
    const cancellation = new Cancellation();

    // Configure layout
    const graph = useSigma().getGraph();
    const layoutSettings = inferSettings(graph);
    const { start, stop, kill, isRunning } = useWorkerLayoutForceAtlas2({ settings: layoutSettings });

    const scatterGroupNode = (node: string, mode = 'replace') => {
        handleGroupedNodeClicked(node, () => { return undefined}, mode);
    }

    const getEdgeLabelVisibilityString = () => {
        const visibleEdgeLabels = edgeLabels.filter(d => d.visible);
        if (visibleEdgeLabels.length === edgeLabels.length) {
            return "";
        } else {
            return ` (${visibleEdgeLabels.length}/${edgeLabels.length})`;
        }
    }

    const focusNode = (node: string) => {
        highlightNode(node);
        camera.gotoNode(node);
    }

    const highlightNode = (node: string) => {
        for (const node of sigma.getGraph().nodes()) {
            sigma.getGraph().setNodeAttribute(node, "highlighted", false);
        }
        sigma.getGraph().setNodeAttribute(node, "highlighted", true);
    }

    const handleGroupedNodeClicked = (node: string, callback = () => { return undefined}, mode: string | boolean = false) => {
        if (!mode) {
            mode = props.grouping.behaviour || null;
        }
        if (!mode) {
            return
        }
        if (mode == "expand" || mode == "replace") {
            const graph = sigma.getGraph();
            const children = graph.getNodeAttribute(node, "children");
            const incomingEdges = graph.inEdges(node);
            for (const child of children) {
                // Add child node to graph if it is not already there
                if (!graph.hasNode(child.node)) {
                    graph.addNode(child.node, child.attributes);
                }
            }
            for (const child of children) {
                for (const edge of incomingEdges) {
                    const edgeAttributes = graph.getEdgeAttributes(edge);
                    if (mode == "replace") {
                        // Add edge from source node to child node
                        const edgeSource = graph.source(edge);
                        if (!graph.hasEdge(edgeSource+child.node)) {
                            graph.addEdgeWithKey(edgeSource+child.node, edgeSource, child.node, edgeAttributes);
                        }
                    } else if (mode == "expand") {
                        // Add edge from grouped node to child node
                        if (!graph.hasEdge(node, child.node)) {
                            graph.addEdge(node, child.node, edgeAttributes);
                        }
                    }
                }
            }
            if (mode == "replace") {
                // Remove the grouped node
                graph.dropNode(node);
            }
        }
        callback();
    }

    const handleNodeClicked = (node: string, omitEvent = false, callback = () => { return undefined} ) => {
        const attributes = sigma.getGraph().getNodeAttributes(node);
        const callbackWithCleaning = () => {
            cleanGraph(sigma.getGraph());
            if (!isRunning) {
                try {
                    start();
                } catch (e) {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const error = e;
                }
            }
            callback();
        }
        if (attributes.grouped) {
            handleGroupedNodeClicked(node, callbackWithCleaning);
        } else {     
            // If node query is defined, load additional data
            if (props.nodeQuery) {
                loadMoreDataForNode(node, callbackWithCleaning)
            }
        }
        if (!omitEvent) {
            // Fire event// Trigger external event
            // Node IRIs are stored with < and > brackets, so we need to remove them
            // when triggering the event
            const data = { 
                id: node,
                attributes: attributes,
                nodes: attributes.children ? attributes.children.map( (childNode: { "node": string, "attributes": any }) => childNode.node.substring(1, childNode.node.length - 1)) : [ node.substring(1, node.length - 1) ]
            }
            trigger({
                eventType: NodeClicked,
                source: node,
                data: data
            })
            // Restart layout
            start()
        }
        sigma.refresh()
    }

    const loadMoreDataForNode = (node: string, callback = () => { return undefined; }) => {
        let query = props.nodeQuery
        let newElements = []

        // Use regex to replace all occurrences of $subject or ?subject with the node IRI
        query = query.replace(/\$subject|\?subject/g, node)
        
        loadGraphDataFromQuery(query, props.context).onValue((elements) => {
            newElements = elements
        })
        .onEnd(() => {
            const graph = sigma.getGraph();
            const newGraph = createGraphFromElements(newElements, props);
            // Add new nodes and edges to the graph
            mergeGraphs(graph, newGraph);
            setEdgeLabelsNeedUpdate(true);
            callback();            
        })
    }
    
    // Control layout
    useEffect(() => {
        start();
        return () => kill();
    }, [start, kill]);

    // Listen to external events
    useEffect(() => {
        cancellation.map(
            listen({
                eventType: TriggerNodeClicked,
                target: props.id
            })
        ).observe({
                value: ( event ) => {
                    if (event.data.node)  {
                        // Add < and > brackets to node IRI
                        const node = "<" + event.data.node + ">";
                        // Check if parent node exists in graph
                        if (!sigma.getGraph().hasNode(node)) {
                            // Node might be in group
                            // Look at all nodes with children attributes and see if the parent node is in there
                            const nodes = sigma.getGraph().nodes();
                            for (const possibleGroupNode of nodes) {
                                const children = sigma.getGraph().getNodeAttribute(possibleGroupNode, "children");
                                if (children) {
                                    for (const child of children) {
                                        if (child.node == node) {
                                            // Parent node is in group, so we need to release it
                                            releaseNodeFromGroup(sigma.getGraph(), node, possibleGroupNode);
                                            break;
                                        }
                                    }
                                }
                            }
                        } 
                        if (sigma.getGraph().hasNode(node)) {
                            if(activeNode) {
                                sigma.getGraph().setNodeAttribute(activeNode, "highlighted", false);
                            }
                            handleNodeClicked(node, true, () => {         
                                highlightNode(node);
                            })
                        }
                    } else {
                        console.log("No node defined");
                    }
                }
        });
        cancellation.map(
            listen({
                eventType: FocusNode,
                target: props.id
            })
        ).observe({
            value: ( event ) => {
                if (event.data.node) {
                    // Add < and > brackets to node IRI
                    const node = "<" + event.data.node + ">";
                    if (sigma.getGraph().hasNode(node)) {
                        focusNode(node);
                    }
                }
            }
        });
        cancellation.map(
            listen({
                eventType: ScatterGroupNode,
                target: props.id
            })
        ).observe({
            value: ( event ) => {
                if (event.data.id) {
                    const node = event.data.id
                    if (sigma.getGraph().hasNode(node)) {
                        scatterGroupNode(node);
                    }
                }
            }
        });
        return undefined;
    })

    // Listen to mouse events
    useEffect(() => {
        sigma.on("enterNode", (e) => {
            setActiveNode(e.node);
            sigma.getGraph().setNodeAttribute(e.node, "highlighted", true);
        });
        sigma.on("leaveNode", (e) => { 
            setActiveNode(null);
            sigma.getGraph().removeNodeAttribute(e.node, "highlighted");
        });

        // Register the events
        registerEvents({
            mouseup: () => {
                if (draggedNode) {
                    setDraggedNode(null);
                    sigma.getGraph().removeNodeAttribute(draggedNode, "highlighted");
                } 
                if (activeNode) {
                    handleNodeClicked(activeNode);
                }
            },
            mousedown: () => {
                // Stop the layout
                stop();
                // Disable the autoscale at the first down interaction
                if (!sigma.getCustomBBox()) {
                    sigma.setCustomBBox(sigma.getBBox()) 
                }
                if (activeNode) {
                    setDraggedNode(activeNode);
                }
            },
            mousemove: (e) => {
                if (draggedNode) {
                    // Get new position of node
                    const pos = sigma.viewportToGraph(e);
                    sigma.getGraph().setNodeAttribute(draggedNode, "x", pos.x);
                    sigma.getGraph().setNodeAttribute(draggedNode, "y", pos.y);
                    sigma.refresh();
                    // Prevent sigma to move camera:
                    e.preventSigmaDefault();
                }
            }
        });
    }, [registerEvents, sigma, draggedNode, activeNode]);

    // Control visibility of edges and nodes
    useEffect(() => {
        setSettings({
          nodeReducer: (node, data) => {
            const graph = sigma.getGraph();
            const newData: Attributes = { ...data, image: data.image || false};
    
            if (activeNode) {
              if (node != activeNode &&  !graph.neighbors(activeNode).includes(node)) {
                newData.color = "#E2E2E2";
                newData.image = false;
              }
            }

            if (props.edgeFilter) {
                // Retrieve all edges for this node
                const edges = sigma.getGraph().edges(node);

                // Retrieve all labels for the visible edges
                const visibleEdgeLabels = edgeLabels.filter(d => d.visible).map(d => d.label);

                // Filter all edges whose label is not in visibleEdgeLabels
                const visibleEdges = edges.filter((edge: string) => {
                    const edgeAttributes = sigma.getGraph().getEdgeAttributes(edge);
                    return visibleEdgeLabels.includes(edgeAttributes.label);
                });

                // If there are no visible edges, hide the node
                if (visibleEdges.length === 0) {
                    newData.hidden = true;
                }     
            }
            return newData;
          },
          edgeReducer: (edge, data) => {
            const graph = sigma.getGraph();
            const newData = { ...data, color: data.color || false, hidden: data.hidden || false};
    

            if (activeNode && !graph.extremities(edge).includes(activeNode)) {
              newData.color = "rgba(0,0,0,0.03)"
            }

            if (props.edgeFilter) {
                const visibleEdgeLabels = edgeLabels.filter(d => d.visible).map(d => d.label);
                if (! visibleEdgeLabels.includes(data.label)) {
                    newData.hidden = true;
                }
            }

            return newData;
          },
        });
    }, [activeNode, edgeLabels, setSettings, sigma]);

    // Retrieve set of labels
    useEffect(() => {
        const currentEdgeLabels: string[] = [];
        sigma.getGraph().forEachEdge((edge: string, attributes: Attributes) => {
            if (attributes.label && !currentEdgeLabels.includes(attributes.label)) {
                currentEdgeLabels.push(attributes.label);
            }
        });
        const newEdgeLabels = currentEdgeLabels.map((label) => {
            if (edgeLabels.find((d) => d.label === label)) {
                return edgeLabels.find((d) => d.label === label);
            } else {
                return {label, visible: true};
            }
        })
        // Order labels alphabetically
        newEdgeLabels.sort((a, b) => a.label.localeCompare(b.label));
        setEdgeLabels(newEdgeLabels);
        setEdgeLabelsNeedUpdate(false);
    }, [sigma, edgeLabelsNeedUpdate, activeNode]);

    if ( props.edgeFilter ) {

        // Generate a string based on how many of the edge labels are visible
        // If all are visible, return an empty string
        // If not all are visible but, for example, 4 out of 14, return 4/14
        

        return <ControlsContainer position="bottom-right">
            <Panel title={"Filter" + getEdgeLabelVisibilityString()}>
                <EdgeFilterControl 
                    edgeLabels={edgeLabels}
                    setEdgeLabels={setEdgeLabels}
                />
            </Panel>
        </ControlsContainer>
    }

    return null;
}

export default GraphEvents