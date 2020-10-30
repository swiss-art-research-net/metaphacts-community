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
import * as React from 'react';
import * as saveAs from 'file-saverjs';

import { LinkTemplateResolver, LinkRouter, TemplateResolver } from '../customization/props';
import { performLayout } from '../diagram/commands';
import { Element, Link } from '../diagram/elements';
import { Rect, Size, Vector, SizeProvider, getContentFittingBox } from '../diagram/geometry';
import {
    PaperArea, PaperWidgetProps, ZoomOptions, PointerEvent, PointerUpEvent, ZoomEvent, ViewportOptions
} from '../diagram/paperArea';
import { RenderingState } from '../diagram/renderingState';

import { Events, EventObserver, EventTrigger } from '../viewUtils/events';
import { LayoutFunction, LayoutFunctionParams, forceLayout } from '../viewUtils/layout';
import { PropTypes } from '../viewUtils/react';
import { ToDataURLOptions, dataURLToBlob } from '../viewUtils/toSvg';

import {
    WorkspaceContext, WorkspaceContextWrapper, WorkspaceContextTypes, WorkspaceCommands,
} from './workspaceContext';

export interface CanvasProps {
    commands: Events<CanvasCommands> & EventTrigger<CanvasCommands>;
    zoomOptions?: ZoomOptions;
    style?: React.CSSProperties;
    autoZoom?: boolean;
    postLoadingAction?: PostLoadingAction;
    onPointerDown?: (e: PointerEvent) => void;
    onPointerMove?: (e: PointerEvent) => void;
    onPointerUp?: (e: PointerUpEvent) => void;
    onZoom?: (e: ZoomEvent) => void;
    onScroll?: () => void;
    linkTemplateResolver?: LinkTemplateResolver;
    linkRouter?: LinkRouter;
    elementTemplateResolver?: TemplateResolver;
    children?: React.ReactElement<PaperWidgetProps> | ReadonlyArray<React.ReactElement<PaperWidgetProps>>;
}

export type PostLoadingAction = 'none' | 'centerContent' | 'zoomToFit';

export interface CanvasCommands {
    centerTo: { readonly position: Vector };
    setZoomLevel: { readonly scale: number };
    zoomBy: { readonly value: number };
    zoomIn: {};
    zoomOut: {};
    zoomToFit: { readonly boundingBox?: Rect };
    zoomToContent: {
        readonly elements: ReadonlyArray<Element>;
        readonly links: ReadonlyArray<Link>;
    };
    exportSvg: { readonly fileName: string };
    exportPng: ExportPngOptions;
    print: { readonly windowFeatures?: string };
    forceLayout: {};
    moveElementToCenter: {
        readonly element: Element;
        readonly position?: Vector;
    };
}

export interface ExportPngOptions extends ToDataURLOptions {
    readonly fileName: string;
}

export interface CanvasMethods {
    readonly canvasState: CanvasState;
    getCommands(): Events<CanvasCommands> & EventTrigger<CanvasCommands>;
    /** Returns visible viewport in paper coords. */
    getViewport(): Rect;
    exportAsSvgString(): Promise<string>;
    exportAsDataUrl(options: ToDataURLOptions): Promise<string>;
    forceLayout(): Promise<void>;
    performLayout(layoutFunction: LayoutFunction, params: PerformLayoutParams): void;
}

export type PerformLayoutParams = Omit<LayoutFunctionParams, 'model' | 'sizeProvider'>;

export interface CanvasState extends SizeProvider {
    performSyncUpdate(): void;
    getElementSize(element: Element): Size;
    getLinkLabelBounds(link: Link): Rect | undefined;
}

export interface CanvasContext {
    readonly canvas: CanvasMethods;
}

export interface CanvasContextWrapper {
    ontodiaCanvas: CanvasContext;
}

export const CanvasContextTypes: { [K in keyof CanvasContextWrapper]: any } = {
    ontodiaCanvas: PropTypes.anything,
};

const ONTODIA_WEBSITE = 'https://ontodia.org/';
const ONTODIA_LOGO_SVG: string = require('../../../images/ontodia-logo.svg');
const CANVAS_CLASS = 'ontodia-canvas';

export class Canvas extends React.Component<CanvasProps> implements CanvasMethods {
    static contextTypes = WorkspaceContextTypes;
    declare readonly context: WorkspaceContextWrapper;

    static childContextTypes = CanvasContextTypes;

    private readonly paperListener = new EventObserver();
    private readonly commandListener = new EventObserver();
    private readonly workspaceCommandListener = new EventObserver();

    private renderingState: RenderingState;
    private paperArea: PaperArea | null = null;

    constructor(props: CanvasProps, context: any) {
        super(props, context);
        this.renderingState = CanvasImplementation.makeRenderingState(this.props, this.context.ontodiaWorkspace);
        this.observeCommands(this.props.commands);
        const {workspaceCommands} = this.context.ontodiaWorkspace;
        this.observeWorkspaceCommands(workspaceCommands);
    }

    getChildContext(): CanvasContextWrapper {
        const ontodiaCanvas: CanvasContext = {canvas: this};
        return {ontodiaCanvas};
    }

    get canvasState(): CanvasState {
        return this.renderingState;
    }

    getCommands(): Events<CanvasCommands> & EventTrigger<CanvasCommands> {
        return this.props.commands;
    }

    componentWillReceiveProps(nextProps: CanvasProps) {
        if (this.props.commands !== nextProps.commands) {
            this.commandListener.stopListening();
            this.observeCommands(nextProps.commands);
        }
    }

    componentWillUnmount() {
        this.paperListener.stopListening();
        this.commandListener.stopListening();
        this.workspaceCommandListener.stopListening();
    }

    private observeCommands(commands: Events<CanvasCommands>) {
        this.commandListener.listen(commands, 'centerTo', e => {
            this.paperArea?.centerTo(e.position);
        });
        this.commandListener.listen(commands, 'setZoomLevel', e => {
            this.paperArea?.setScale(e.scale);
        });
        this.commandListener.listen(commands, 'zoomBy', e => {
            this.paperArea?.zoomBy(e.value);
        });
        this.commandListener.listen(commands, 'zoomIn', () => {
            this.paperArea?.zoomIn();
        });
        this.commandListener.listen(commands, 'zoomOut', () => {
            this.paperArea?.zoomOut();
        });
        this.commandListener.listen(commands, 'zoomToFit', e => {
            if (this.paperArea) {
                CanvasImplementation.zoomToFit(this.paperArea, e.boundingBox);
            }
        });
        this.commandListener.listen(commands, 'zoomToContent', e => {
            if (this.paperArea) {
                const boundingBox = getContentFittingBox(e.elements, e.links, this.renderingState);
                CanvasImplementation.zoomToFit(this.paperArea, boundingBox);
            }
        });
        this.commandListener.listen(commands, 'exportSvg', e => {
            if (!this.paperArea) { return; }
            this.exportAsSvgString().then(svg => {
                CanvasImplementation.exportSvg(svg, e);
            });
        });
        this.commandListener.listen(commands, 'exportPng', e => {
            if (!this.paperArea) { return; }
            const {fileName, ...options} = e;
            this.exportAsDataUrl({backgroundColor: 'white', ...options}).then(dataUri => {
                CanvasImplementation.exportPng(dataUri, e);
            });
        });
        this.commandListener.listen(commands, 'print', e => {
            if (!this.paperArea) { return; }
            this.exportAsSvgString().then(svg => {
                CanvasImplementation.print(svg, e);
            });
        });
        this.commandListener.listen(commands, 'forceLayout', () => {
            this.forceLayout();
            if (this.paperArea) {
                this.renderingState.performSyncUpdate();
                this.paperArea.zoomToFit();
            }
        });
        this.commandListener.listen(commands, 'moveElementToCenter', e => {
            CanvasImplementation.moveElementToCenter(this.paperArea, this.renderingState, e.element, e.position);
        });
    }

    private observeWorkspaceCommands(commands: Events<WorkspaceCommands>) {
        this.workspaceCommandListener.listen(commands, 'forEachCanvas', ({callback}) => {
            callback(this);
        });
        this.workspaceCommandListener.listen(commands, 'forAnyCanvas', e => {
            if (e.handled) { return; }
            const {callback} = e;
            callback(this);
            e.handled = true;
        });
    }

    render() {
        const {view} = this.context.ontodiaWorkspace;
        const {zoomOptions, children, style} = this.props;
        return <div className={CANVAS_CLASS} style={style}>
            <PaperArea ref={this.onPaperMount}
                view={view}
                renderingState={this.renderingState}
                zoomOptions={zoomOptions}>
                {children}
            </PaperArea>
        </div>;
    }

    private onPaperMount = (paperArea: PaperArea | null) => {
        this.paperArea = paperArea;
        CanvasImplementation.handlePaperMount(
            paperArea,
            this.renderingState,
            this.paperListener,
            this.props,
            this.context.ontodiaWorkspace
        );
        if (this.paperArea) {
            this.paperArea.internal_setWatermark(ONTODIA_LOGO_SVG, ONTODIA_WEBSITE);
        }
    }

    getViewport(): Rect {
        return CanvasImplementation.getViewport(this.paperArea!);
    }

    exportAsSvgString(): Promise<string> {
        return this.paperArea!.exportSVG();
    }

    exportAsDataUrl(options: ToDataURLOptions): Promise<string> {
        return this.paperArea!.exportPNG(options);
    }

    forceLayout(): Promise<void> {
        this.performLayout(forceLayout, {});
        return Promise.resolve();
    }

    performLayout(layoutFunction: LayoutFunction, params: PerformLayoutParams): void {
        CanvasImplementation.executeLayoutCommand(
            this.context.ontodiaWorkspace,
            this.renderingState,
            layoutFunction,
            params
        );
    }
}

export namespace CanvasImplementation {
    export function handlePaperMount(
        paperArea: PaperArea | null,
        renderingState: RenderingState,
        paperListener: EventObserver,
        props: CanvasProps,
        context: WorkspaceContext
    ) {
        const {editor} = context;
        if (paperArea) {
            paperListener.listen(context.view.events, 'syncUpdateAll', () => {
                renderingState.performSyncUpdate();
            });
            paperListener.listen(editor.model.events, 'loadingSuccess', () => {
                renderingState.performSyncUpdate();
                performPostLoadingAction(paperArea, props);
            });
            // indirectly read options from `props` object to prevent stale values
            paperListener.listen(editor.events, 'addElements', () => {
                if (props.autoZoom) {
                    paperArea.zoomToFit();
                }
            });
            paperListener.listen(paperArea.events, 'pointerDown', e => props.onPointerDown?.(e));
            paperListener.listen(paperArea.events, 'pointerMove', e => props.onPointerMove?.(e));
            paperListener.listen(paperArea.events, 'pointerUp', e => {
                editor.handlePaperPointerUp(e);
                props.onPointerUp?.(e);
            });
            paperListener.listen(paperArea.events, 'zoom', e => props.onZoom?.(e));
            paperListener.listen(paperArea.events, 'scroll', () => props.onScroll?.());
        } else {
            paperListener.stopListening();
        }
    }

    export function performPostLoadingAction(paperArea: PaperArea, props: CanvasProps): void {
        switch (props.postLoadingAction) {
            case 'none':
                break;
            case 'centerContent':
            default:
                paperArea.centerContent();
                break;
            case 'zoomToFit':
                paperArea.zoomToFit();
                break;
        }
    }

    export function makeRenderingState(props: CanvasProps, context: WorkspaceContext) {
        return new RenderingState({
            model: context.view.model,
            router: props.linkRouter,
            linkTemplateResolver: props.linkTemplateResolver,
            elementTemplateResolver: props.elementTemplateResolver,
        });
    }

    export function zoomToFit(
        paperArea: PaperArea,
        boundingBox: Rect | undefined,
        options?: ViewportOptions
    ): Promise<void> {
        if (boundingBox) {
            return paperArea.zoomToFitRect(boundingBox, options);
        } else {
            return paperArea.zoomToFit(options);
        }
    }

    export function getViewport(paperArea: PaperArea) {
        const {clientWidth, clientHeight} = paperArea.getAreaMetrics();
        const start = paperArea.clientToPaperCoords(0, 0);
        const end = paperArea.clientToPaperCoords(clientWidth, clientHeight);
        return {
            x: start.x,
            y: start.y,
            width: end.x - start.x,
            height: end.y - start.y,
        };
    }

    export function exportSvg(svg: string, options: CanvasCommands['exportSvg']): void {
        const xmlEncodingHeader = '<?xml version="1.0" encoding="UTF-8"?>';
        const blob = new Blob([xmlEncodingHeader + svg], {type: 'image/svg+xml'});
        saveAs(blob, options.fileName);
    }

    export function exportPng(dataUri: string, options: CanvasCommands['exportPng']): void {
        const blob = dataURLToBlob(dataUri);
        saveAs(blob, options.fileName);
    }

    export function print(svg: string, options: CanvasCommands['print']): void {
        const {windowFeatures = 'width=1280,height=720'} = options;
        const printWindow = window.open('', undefined, windowFeatures);
        if (!printWindow) {
            throw new Error('Failed to open window to print canvas');
        }
        printWindow.document.write(svg);
        printWindow.document.close();
        printWindow.print();
    }

    export function executeLayoutCommand(
        context: WorkspaceContext,
        renderingState: RenderingState,
        layoutFunction: LayoutFunction,
        params: PerformLayoutParams
    ): void {
        const {view} = context;
        view.model.history.execute(
            performLayout(layoutFunction, {
                ...params,
                model: view.model,
                sizeProvider: renderingState,
            })
        );
    }

    export function moveElementToCenter(
        paperArea: PaperArea | null,
        renderingState: RenderingState,
        element: Element,
        position: Vector | undefined
    ) {
        let targetPosition: Vector;
        if (position) {
            targetPosition = position;
        } else if (paperArea) {
            const viewport = paperArea.getAreaMetrics();
            targetPosition = paperArea.clientToPaperCoords(viewport.clientWidth / 2, viewport.clientHeight / 2);
        } else {
            return;
        }

        element.setPosition(targetPosition);
        renderingState.performSyncUpdate();

        const {width, height} = renderingState.getElementSize(element);
        element.setPosition({
            x: targetPosition.x - width / 2,
            y: targetPosition.y - height / 2,
        });
    }
}
