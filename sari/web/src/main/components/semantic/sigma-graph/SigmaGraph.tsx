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
//@ts-nocheck

import * as React from 'react';
import * as assign from 'object-assign';
import { createElement } from 'react';

import { Component } from 'platform/api/components';
import { BuiltInEvents, trigger } from 'platform/api/events';
import { ErrorNotification } from 'platform/components/ui/notification';
import { Spinner } from 'platform/components/ui/spinner';
import { addNotification } from 'platform/components/ui/notification';

import { MultiDirectedGraph } from "graphology";
import { SigmaContainer, ControlsContainer, SearchControl } from "@react-sigma/core";
import getNodeProgramImage from "sigma/rendering/webgl/programs/node.image";

import { SigmaGraphConfig } from './Config'
import { GraphEvents } from './GraphEvents'
import { GraphControls } from './GraphControls'
import { clearStateFromLocalStorage, createGraphFromElements, getStateFromLocalStorage, loadGraphDataFromQuery, saveStateIntoLocalStorage } from './Common'
import ArrowEdgeProgram from './programs/edge.arrow'

import "@react-sigma/core/lib/react-sigma.min.css";
import "./styles.css"
export interface State {
    elements: Cy.ElementDefinition[];
    graph: MultiDirectedGraph;
    noResults?: boolean;
    isLoading?: boolean;
    error?: any;
    warning?: string;
  }
export class SigmaGraph extends Component<SigmaGraphConfig, State> {

    constructor(props: SigmaGraphConfig, context: any) {
        super(props, context);
        this.state = {
          elements: [],
          graph: undefined,
          noResults: false,
          isLoading: true
        };
      }
    
    componentDidMount() : void {
        this.loadInitialGraphData(this.props);      
        window.addEventListener('beforeunload', () => this.componentCleanup());
    }

    componentWillUnmount() : void {        
        this.componentCleanup();
        window.removeEventListener('beforeunload', () => this.componentCleanup()); // remove the event handler for normal unmounting
        
    }

    private componentCleanup() : void {
        if (this.props.persistGraph) {
            saveStateIntoLocalStorage(this.state.graph, this.props.query);
        }
    }

    private loadInitialGraphData(props: SigmaGraphConfig) : void {
        this.setState({ error:undefined });
        const graphFromLocalStorage = props.persistGraph ? getStateFromLocalStorage(props.query) : null;
        if (graphFromLocalStorage) {
            this.setState({
                graph: graphFromLocalStorage,
                isLoading: false
            })
            addNotification({
                level: 'success',
                position: this.props.persistGraphMessagePosition ? this.props.persistGraphMessagePosition : 'tr',
                message: this.props.persistGraphMessage ? this.props.persistGraphMessage : "The graph has been restored from the browser's local storage.",
                action: {
                    label: 'Reset',
                    callback: () => {
                        clearStateFromLocalStorage()
                        this.loadInitialGraphData(this.props); 
                    }
                }
            });
        } else {
            loadGraphDataFromQuery(props.query, this.context.semanticContext).onValue((elements) => {
                    this.setState({
                        elements: elements,
                        noResults: !elements.length,
                        isLoading: false
                    })
                })
                .onError((error) => { this.setState({ error: error, isLoading: false }) })
                .onEnd(() => {

                    const config = assign({},
                        {
                            grouping: this.props.grouping || { enabled: false},
                            sizes: this.props.sizes || { nodes: 10, edges: 5 },
                        },
                        this.props
                    );
                    const graph = createGraphFromElements(this.state.elements, config)
                    this.setState({ graph: graph})
                    if (this.props.id) {
                        trigger({ eventType: BuiltInEvents.ComponentLoaded, source: this.props.id });
                    }
                })
        }
    }

    render() {
        const width = this.props.width || "800px";
        const height = this.props.height || "600px";
        const searchBox = this.props.searchBox || false;
        const controls = this.props.controls || false;
        const edgeFilter = this.props.edgeFilter || false;
        
        const sigmaSettings = { 
            defaultEdgeType: "arrow",
            defaultNodeType: "image",
            nodeProgramClasses: { image: getNodeProgramImage() },
            edgeProgramClasses: { arrow: ArrowEdgeProgram },
            renderEdgeLabels: true,
            maxEdgeSize: 2,
        };
        
        const colours = this.props.colours || {};
        const grouping = this.props.grouping || { enabled: false};
        const nodeQuery = this.props.nodeQuery || "";
        const sizes = this.props.sizes || { nodes: 10, edges: 5 };
        const persistGraph = this.props.persistGraph || false;

        if (this.state.isLoading) {
            return createElement(Spinner);
        } else if (this.state.error) {
            return createElement(ErrorNotification, { errorMessage: this.state.error });
        } else {
            return (
                <SigmaContainer
                    graph={ this.state.graph } 
                    style={{ height: `${height}`, width: `${width}` }}
                    settings={ sigmaSettings }
                >   
                    <GraphEvents 
                        context={ this.context.semanticContext} 
                        colours={ colours }
                        edgeFilter={ edgeFilter }
                        grouping={ grouping } 
                        nodeQuery={ nodeQuery }
                        persistGraph={ persistGraph }
                        sizes={ sizes } 
                    />
                    {searchBox &&  <ControlsContainer position="bottom-left"><SearchControl /> </ControlsContainer>}
                    {controls && <GraphControls position="top-left" />}
                </SigmaContainer>

            )
        }
    }
}

export default SigmaGraph