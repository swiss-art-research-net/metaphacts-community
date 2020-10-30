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
require('../../styles/main.scss');

require('whatwg-fetch');
require('es6-promise/auto');
require('./viewUtils/polyfills');

export * from './customization/props';
export * from './customization/templates';

export * from './data/model';
export * from './data/metadataApi';
export * from './data/validationApi';
export * from './data/provider';
export { DIAGRAM_CONTEXT_URL_V1, PLACEHOLDER_ELEMENT_TYPE, PLACEHOLDER_LINK_TYPE } from './data/schema';

export * from './data/composite/composite';
export * from './data/demo/provider';
export {
   Rdf, RdfDataProvider, RdfDataProviderOptions, RdfFile, LodDataProvider, LodDataProviderOptions,
   RdfParser, RdfExtLegacyGraph, RdfExtLegacyTriple, RdfExtLegacyTerm,
} from './data/rdf';
export * from './data/sparql/sparqlDataProvider';
export * from './data/sparql/sparqlDataProviderSettings';
export * from './data/sparql/graphBuilder';
export * from './data/sparql/sparqlGraphBuilder';
export { SparqlResponse } from './data/sparql/sparqlModels';
export { parseTurtleText } from './data/sparql/turtle';

export { RestoreGeometry, setElementExpanded, setElementData, setLinkData, performLayout } from './diagram/commands';
export { CanvasWidget, CanvasWidgetProps, WidgetDock, getCanvasWidgetPosition } from './diagram/canvasWidget';
export {
    Cell, Element, ElementEvents, ElementTemplateState,
    Link, LinkEvents, LinkTemplateState, LinkVertex, LinkDirection,
    LinkType, LinkTypeEvents,
    RichClass, RichClassEvents,
    RichProperty, RichPropertyEvents,
} from './diagram/elements';
export { EmbeddedLayer } from './diagram/embeddedLayer';
export * from './diagram/geometry';
export * from './diagram/history';
export { DiagramModel, DiagramModelEvents } from './diagram/model';
export * from './diagram/view';
export { PointerEvent, PointerUpEvent, ZoomEvent, ViewportOptions, ScaleOptions } from './diagram/paperArea';
export { RenderingState, RenderingStateEvents, RenderingLayer } from './diagram/renderingState';

export * from './editor/asyncModel';
export { EditLayerMode } from './editor/editLayer';
export { AuthoredEntity, AuthoredEntityProps, AuthoredEntityContext } from './editor/authoredEntity';
export * from './editor/authoringState';
export {
    EditorOptions, EditorEvents, EditorController, PropertyEditor, PropertyEditorOptions, SelectionItem,
} from './editor/editorController';
export { ValidationState, ElementValidation, LinkValidation } from './editor/validation';

export {
    LayoutData, LayoutElement, LayoutLink, SerializedDiagram,
    convertToSerializedDiagram, makeSerializedDiagram, LinkTypeOptions, makeLayoutData
} from './editor/serializedDiagram';

export { Cancellation, CancellationToken, CancelledError } from './viewUtils/async';
export * from './viewUtils/events';
export { ToDataURLOptions } from './viewUtils/toSvg';
export {
    LayoutFunction, LayoutFunctionParams, CalculatedLayout, UnzippedCalculatedLayout,
    LayoutNode, LayoutEdge, calculateLayout, applyLayout, forceLayout, removeOverlaps,
} from './viewUtils/layout';

export { PropertySuggestionParams, PropertyScore } from './widgets/connectionsMenu';
export { ClassTree, ClassTreeProps } from './widgets/classTree';
export { InstancesSearch, InstancesSearchProps, InstancesSearchCommands, SearchCriteria } from './widgets/instancesSearch';
export { LinkTypesToolbox } from './widgets/linksToolbox';
export { Navigator, NavigatorConfig } from './widgets/navigator';
export { Halo, HaloProps, HaloTemplateProps } from './widgets/halo';
export { HaloLink, HaloLinkProps } from './widgets/haloLink';
export { ElementSearch, ElementSearchProps } from './widgets/elementSearch';

export { DefaultToolbar, DefaultToolbarProps } from './workspace/defaultToolbar';
export { DefaultWorkspaceLayout, DefaultWorkspaceLayoutProps } from './workspace/defaultWorkspaceLayout';
export {
    Workspace, WorkspaceProps, WorkspaceLanguage, WorkspaceMethods, renderTo,
} from './workspace/workspace';
export { WorkspaceEventHandler, WorkspaceEventKey } from './workspace/workspaceContext';
export { DraggableHandle } from './workspace/draggableHandle';
export * from './workspace/layout';
export {
    Canvas, CanvasProps, CanvasCommands, CanvasMethods, CanvasState, CanvasContext, CanvasContextWrapper,
    CanvasContextTypes, ExportPngOptions, PerformLayoutParams,
} from './workspace/canvas';
export { WorkspaceContext, WorkspaceContextWrapper, WorkspaceContextTypes } from './workspace/workspaceContext';

import * as InternalApi from './internalApi';

export { InternalApi };
