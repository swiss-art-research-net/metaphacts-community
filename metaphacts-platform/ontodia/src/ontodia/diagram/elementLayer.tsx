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
import { findDOMNode } from 'react-dom';
import { hcl } from 'd3-color';

import { Property, ElementTypeIri, PropertyTypeIri } from '../data/model';
import { TemplateProps } from '../customization/props';
import { Debouncer } from '../viewUtils/async';
import { EventObserver } from '../viewUtils/events';
import { PropTypes } from '../viewUtils/react';
import { KeyedObserver, observeElementTypes, observeProperties } from '../viewUtils/keyedObserver';

import { setElementExpanded } from './commands';
import { Element, ElementRedrawMode } from './elements';
import { RenderingLayer, RenderingState } from './renderingState';
import { DiagramView, IriClickIntent } from './view';

export interface Props {
    view: DiagramView;
    renderingState: RenderingState;
    group?: string;
    style: React.CSSProperties;
}

interface State {
    readonly elementStates: ReadonlyMap<string, ElementState>;
}

interface ElementState {
    element: Element;
    templateProps: TemplateProps;
    blurred: boolean;
}

// tslint:disable:no-bitwise
enum RedrawFlags {
    None = 0,
    Render = 1,
    RedrawTemplate = Render | (1 << 1),
    RecomputeTemplate = Render | RedrawTemplate | (1 << 2),
    RecomputeBlurred = Render | (1 << 3),
}
// tslint:enable:no-bitwise

interface RedrawBatch {
    requests: Map<string, RedrawFlags>;
    forAll: RedrawFlags;
}

interface SizeUpdateRequest {
    element: Element;
    node: HTMLDivElement;
}

export class ElementLayer extends React.Component<Props, State> {
    private readonly listener = new EventObserver();

    private redrawBatch: RedrawBatch = {
        requests: new Map<string, RedrawFlags>(),
        forAll: RedrawFlags.None,
    };
    private delayedRedraw = new Debouncer();

    private sizeRequests = new Map<string, SizeUpdateRequest>();
    private delayedUpdateSizes = new Debouncer();

    constructor(props: Props, context: any) {
        super(props, context);
        const {view, group} = this.props;
        this.state = {
            elementStates: applyRedrawRequests(
                view,
                group,
                this.redrawBatch,
                new Map<string, ElementState>()
            )
        };
    }

    render() {
        const {view, renderingState, style} = this.props;
        const {elementStates} = this.state;

        const elementsToRender: ElementState[] = [];
        for (const {id} of view.model.elements) {
            const state = elementStates.get(id);
            if (state) {
                elementsToRender.push(state);
            }
        }

        return <div className='ontodia-element-layer'
            style={style}>
            {elementsToRender.map(state => {
                const overlayElement = (
                    <OverlayedElement key={state.element.id}
                        state={state}
                        view={view}
                        renderingState={renderingState}
                        onInvalidate={this.requestRedraw}
                        onResize={this.requestSizeUpdate}
                    />
                );
                const elementDecorator = view._decorateElement(state.element, renderingState);
                if (elementDecorator) {
                    return (
                        <div key={state.element.id}>
                            {overlayElement}
                            {elementDecorator}
                        </div>
                    );
                }
                return overlayElement;
            })}
        </div>;
    }

    componentDidMount() {
        const {view, renderingState} = this.props;
        this.listener.listen(view.model.events, 'changeCells', e => {
            if (e.updateAll) {
                this.requestRedrawAll(RedrawFlags.None);
            } else {
                if (e.changedElement) {
                    this.requestRedraw(e.changedElement, RedrawFlags.Render);
                }
            }
        });
        this.listener.listen(view.events, 'changeLanguage', () => {
            this.requestRedrawAll(RedrawFlags.RecomputeTemplate);
        });
        this.listener.listen(view.events, 'changeHighlight', () => {
            this.requestRedrawAll(RedrawFlags.RecomputeBlurred);
        });
        this.listener.listen(view.model.events, 'elementEvent', ({data}) => {
            const invalidatesTemplate = data.changeData || data.changeExpanded || data.changeElementState;
            if (invalidatesTemplate) {
                this.requestRedraw(invalidatesTemplate.source, RedrawFlags.RecomputeTemplate);
            }
            if (data.changePosition) {
                this.requestRedraw(data.changePosition.source, RedrawFlags.Render);
            }
            if (data.requestedRedraw) {
                this.requestRedraw(
                    data.requestedRedraw.source, redrawModeToRedrawFlags(data.requestedRedraw.mode)
                );
            }
        });
        this.listener.listen(renderingState.events, 'syncUpdate', ({layer}) => {
            if (layer === RenderingLayer.Element) {
                this.delayedRedraw.runSynchronously();
            } else if (layer === RenderingLayer.ElementSize) {
                this.delayedUpdateSizes.runSynchronously();
            }
        });
    }

    componentWillReceiveProps(nextProps: Props) {
        if (this.props.group !== nextProps.group) {
            this.setState((state): State => ({
                elementStates: applyRedrawRequests(
                    nextProps.view,
                    nextProps.group,
                    this.redrawBatch,
                    state.elementStates
                )
            }));
        }
    }

    componentWillUnmount() {
        this.listener.stopListening();
        this.delayedRedraw.dispose();
        this.delayedUpdateSizes.dispose();
    }

    private requestRedraw = (element: Element, request: RedrawFlags) => {
        // tslint:disable:no-bitwise
        const flagsWithForAll = this.redrawBatch.forAll | request;
        if (flagsWithForAll === this.redrawBatch.forAll) {
            // forAll flags already include the request
            return;
        }
        const existing = this.redrawBatch.requests.get(element.id) ?? RedrawFlags.None;
        this.redrawBatch.requests.set(element.id, existing | request);
        this.delayedRedraw.call(this.redrawElements);
        // tslint:enable:no-bitwise
    }

    private requestRedrawAll(request: RedrawFlags) {
        // tslint:disable-next-line:no-bitwise
        this.redrawBatch.forAll |= request;
        this.delayedRedraw.call(this.redrawElements);
    }

    private redrawElements = () => {
        const props = this.props;
        this.setState((state): State => ({
            elementStates: applyRedrawRequests(
                props.view,
                props.group,
                this.redrawBatch,
                state.elementStates
            )
        }));
    }

    private requestSizeUpdate = (element: Element, node: HTMLDivElement) => {
        this.sizeRequests.set(element.id, {element, node});
        this.delayedUpdateSizes.call(this.recomputeQueuedSizes);
    }

    private recomputeQueuedSizes = () => {
        const batch = this.sizeRequests;
        this.sizeRequests = new Map<string, SizeUpdateRequest>();
        batch.forEach(({element, node}) => {
            const {clientWidth, clientHeight} = node;
            this.props.renderingState.setElementSize(
                element,
                {width: clientWidth, height: clientHeight}
            );
        });
    }
}

function applyRedrawRequests(
    view: DiagramView,
    targetGroup: string | undefined,
    batch: RedrawBatch,
    previous: ReadonlyMap<string, ElementState>,
): ReadonlyMap<string, ElementState> {
    const computed = new Map<string, ElementState>();
    for (const element of view.model.elements) {
        if (element.group !== targetGroup) { continue; }
        const elementId = element.id;
        if (previous.has(elementId)) {
            let state = previous.get(elementId)!;
            // tslint:disable:no-bitwise
            const request = (batch.requests.get(elementId) || RedrawFlags.None) | batch.forAll;
            if (request & RedrawFlags.Render) {
                let templateProps = state.templateProps;
                if ((request & RedrawFlags.RecomputeTemplate) === RedrawFlags.RecomputeTemplate) {
                    templateProps = computeTemplateProps(state.element, view);
                } else if ((request & RedrawFlags.RedrawTemplate) === RedrawFlags.RedrawTemplate) {
                    templateProps = {...templateProps};
                }
                state = {
                    element,
                    templateProps,
                    blurred: (
                        (request & RedrawFlags.RecomputeBlurred) === RedrawFlags.RecomputeBlurred
                            ? computeIsBlurred(state.element, view) : state.blurred
                    ),
                };
            }
            computed.set(elementId, state);
            batch.requests.delete(elementId);
            // tslint:enable:no-bitwise
        } else {
            computed.set(element.id, {
                element,
                templateProps: computeTemplateProps(element, view),
                blurred: computeIsBlurred(element, view),
            });
        }
    }
    batch.forAll = RedrawFlags.None;
    return computed;
}

interface OverlayedElementProps {
    state: ElementState;
    view: DiagramView;
    renderingState: RenderingState;
    onInvalidate: (model: Element, request: RedrawFlags) => void;
    onResize: (model: Element, node: HTMLDivElement) => void;
}

export interface ElementContextWrapper { ontodiaElement: ElementContext; }
export const ElementContextTypes: { [K in keyof ElementContextWrapper]: any } = {
    ontodiaElement: PropTypes.anything,
};

export interface ElementContext {
    element: Element;
}

class OverlayedElement extends React.Component<OverlayedElementProps, {}> {
    static childContextTypes = ElementContextTypes;

    private readonly listener = new EventObserver();
    private disposed = false;

    private typesObserver!: KeyedObserver<ElementTypeIri>;
    private propertiesObserver!: KeyedObserver<PropertyTypeIri>;

    getChildContext(): ElementContextWrapper {
        const ontodiaElement: ElementContext = {
            element: this.props.state.element,
        };
        return {ontodiaElement};
    }

    private rerenderTemplate = () => {
        if (this.disposed) { return; }
        this.props.onInvalidate(this.props.state.element, RedrawFlags.RecomputeTemplate);
    }

    render(): React.ReactElement<any> {
        const {state: {element, blurred}} = this.props;
        if (element.temporary) {
            return <div />;
        }

        const {x = 0, y = 0} = element.position;
        const transform = `translate(${x}px,${y}px)`;

        // const angle = model.get('angle') || 0;
        // if (angle) { transform += `rotate(${angle}deg)`; }

        const className = (
            `ontodia-overlayed-element ${blurred ? 'ontodia-overlayed-element--blurred' : ''}`
        );
        return <div className={className}
            // set `element-id` to translate mouse events to paper
            data-element-id={element.id}
            style={{position: 'absolute', transform}}
            tabIndex={0}
            ref={this.onMount}
            // resize element when child image loaded
            onLoad={this.onLoadOrErrorEvent}
            onError={this.onLoadOrErrorEvent}
            onClick={this.onClick}
            onDoubleClick={this.onDoubleClick}>
            <TemplatedElement {...this.props} />
        </div>;
    }

    private onMount = (node: HTMLDivElement | null) => {
        if (!node) { return; }
        const {state, onResize} = this.props;
        onResize(state.element, node);
    }

    private onLoadOrErrorEvent = () => {
        const {state, onResize} = this.props;
        onResize(state.element, findDOMNode(this) as HTMLDivElement);
    }

    private onClick = (e: React.MouseEvent<EventTarget>) => {
        if (e.target instanceof HTMLElement && e.target.localName === 'a') {
            const anchor = e.target as HTMLAnchorElement;
            const {view, state} = this.props;
            const clickIntent = e.target.getAttribute('data-iri-click-intent') === IriClickIntent.OpenEntityIri ?
                IriClickIntent.OpenEntityIri : IriClickIntent.OpenOtherIri;
            view.onIriClick(decodeURI(anchor.href), state.element, clickIntent, e);
        }
    }

    private onDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        const {view, state: {element}} = this.props;
        view.model.history.execute(
            setElementExpanded(element, !element.isExpanded)
        );
    }

    componentDidMount() {
        const {state, view} = this.props;
        this.listener.listen(state.element.events, 'requestedFocus', () => {
            const element = findDOMNode(this) as HTMLElement;
            if (element) { element.focus(); }
        });
        this.typesObserver = observeElementTypes(
            view.model, 'changeLabel', this.rerenderTemplate
        );
        this.propertiesObserver = observeProperties(
            view.model, 'changeLabel', this.rerenderTemplate
        );
        this.observeTypes();
    }

    componentWillUnmount() {
        this.listener.stopListening();
        this.typesObserver.stopListening();
        this.propertiesObserver.stopListening();
        this.disposed = true;
    }

    shouldComponentUpdate(nextProps: OverlayedElementProps) {
        return this.props.state !== nextProps.state;
    }

    componentDidUpdate() {
        this.observeTypes();
        this.props.onResize(this.props.state.element, findDOMNode(this) as HTMLDivElement);
    }

    private observeTypes() {
        const {state: {element}} = this.props;
        this.typesObserver.observe(element.data.types);
        this.propertiesObserver.observe(Object.keys(element.data.properties) as PropertyTypeIri[]);
    }
}

class TemplatedElement extends React.Component<OverlayedElementProps, {}> {
    private cachedTemplateClass: React.ComponentClass<TemplateProps> | undefined;
    private cachedTemplateProps: TemplateProps | undefined;

    render() {
        const {state, renderingState} = this.props;
        const {element, templateProps} = state;
        const templateClass = renderingState.getElementTemplate(element.data.types);
        this.cachedTemplateClass = templateClass;
        this.cachedTemplateProps = templateProps;
        return React.createElement(templateClass, templateProps);
    }

    shouldComponentUpdate(nextProps: OverlayedElementProps) {
        const templateClass = nextProps.renderingState.getElementTemplate(nextProps.state.element.data.types);
        return !(
            this.cachedTemplateClass === templateClass &&
            this.cachedTemplateProps === nextProps.state.templateProps
        );
    }
}

export function computeTemplateProps(model: Element, view: DiagramView): TemplateProps {
    const types = model.data.types.length > 0
        ? view.getElementTypeString(model.data) : undefined;
    const label = view.formatLabel(model.data.label.values, model.iri);
    const {color, icon} = computeStyleFor(model, view);
    const propsAsList = computePropertyTable(model, view);

    return {
        elementId: model.id,
        data: model.data,
        iri: model.iri,
        types,
        label,
        color,
        iconUrl: icon,
        imgUrl: model.data.image,
        isExpanded: model.isExpanded,
        props: model.data.properties,
        propsAsList,
    };
}

function computePropertyTable(
    model: Element, view: DiagramView
): Array<{ id: string; name: string; property: Property }> {
    if (!model.data.properties) { return []; }

    const propertyIris = Object.keys(model.data.properties) as PropertyTypeIri[];
    const propTable = propertyIris.map(key => {
        const property = view.model.createProperty(key);
        const name = view.formatLabel(property.label, key);
        return {
            id: key,
            name: name,
            property: model.data.properties[key]!,
        };
    });

    propTable.sort((a, b) => {
        const aLabel = (a.name || a.id).toLowerCase();
        const bLabel = (b.name || b.id).toLowerCase();
        return aLabel.localeCompare(bLabel);
    });
    return propTable;
}

function computeStyleFor(model: Element, view: DiagramView) {
    const {color: {h, c, l}, icon} = view.getTypeStyle(model.data.types);
    return {
        icon,
        color: hcl(h, c, l).toString(),
    };
}

function computeIsBlurred(element: Element, view: DiagramView): boolean {
    return view.highlighter ? !view.highlighter(element) : false;
}

function redrawModeToRedrawFlags(mode: ElementRedrawMode): RedrawFlags {
    switch (mode) {
        case ElementRedrawMode.Render:
            return RedrawFlags.Render;
        case ElementRedrawMode.RedrawTemplate:
            return RedrawFlags.RedrawTemplate;
        case ElementRedrawMode.RecomputeTemplate:
            return RedrawFlags.RecomputeTemplate;
    }
}
