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
import {
    ElementModel, LinkModel, ElementIri, ElementTypeIri, LinkTypeIri, PropertyTypeIri,
} from '../data/model';
import { Rdf } from '../data/rdf';
import { GenerateID } from '../data/schema';

import { EventSource, Events, PropertyChange } from '../viewUtils/events';

import { Vector, isPolylineEqual } from './geometry';

export type Cell = Element | Link | LinkVertex;

export enum ElementRedrawMode {
    /** Update size, position, decorators without invalidating custom template component. */
    Render = 1,
    /** Invalidate custom template component without recomputing its props. */
    RedrawTemplate,
    /** Fully recompute custom template component props. */
    RecomputeTemplate,
}

export interface ElementEvents {
    changeData: PropertyChange<Element, ElementModel>;
    changePosition: PropertyChange<Element, Vector>;
    changeExpanded: PropertyChange<Element, boolean>;
    changeGroup: PropertyChange<Element, string | undefined>;
    changeElementState: PropertyChange<Element, ElementTemplateState | undefined>;
    requestedFocus: { source: Element };
    requestedGroupContent: { source: Element };
    requestedAddToFilter: {
        source: Element;
        linkType?: LinkType;
        direction?: 'in' | 'out';
    };
    requestedRedraw: {
        source: Element;
        mode: ElementRedrawMode;
    };
}

export class Element {
    private readonly source = new EventSource<ElementEvents>();
    readonly events: Events<ElementEvents> = this.source;

    readonly id: string;
    /** All in and out links of the element */
    readonly links: Link[] = [];

    private _data: ElementModel;
    private _position: Vector;
    private _expanded: boolean;
    private _group: string | undefined;
    private _elementState: ElementTemplateState | undefined;
    private _temporary: boolean;

    constructor(props: {
        id: string;
        data: ElementModel;
        position?: Vector;
        expanded?: boolean;
        group?: string;
        elementState?: ElementTemplateState;
        temporary?: boolean;
    }) {
        const {
            id,
            data,
            position = {x: 0, y: 0},
            expanded = false,
            group,
            elementState,
            temporary = false,
        } = props;

        this.id = id;
        this._data = data;
        this._position = position;
        this._expanded = expanded;
        this._group = group;
        this._elementState = elementState;
        this._temporary = temporary;
    }

    get iri() { return this._data.id; }

    get data() { return this._data; }
    setData(value: ElementModel) {
        const previous = this._data;
        if (previous === value) { return; }
        this._data = value;
        this.source.trigger('changeData', {source: this, previous});
        updateLinksToReferByNewIri(this, previous.id, value.id);
    }

    get position(): Vector { return this._position; }
    setPosition(value: Vector) {
        const previous = this._position;
        const same = (
            previous.x === value.x &&
            previous.y === value.y
        );
        if (same) { return; }
        this._position = value;
        this.source.trigger('changePosition', {source: this, previous});
    }

    get isExpanded(): boolean { return this._expanded; }
    setExpanded(value: boolean) {
        const previous = this._expanded;
        if (previous === value) { return; }
        this._expanded = value;
        this.source.trigger('changeExpanded', {source: this, previous});
    }

    get group(): string | undefined { return this._group; }
    setGroup(value: string | undefined) {
        const previous = this._group;
        if (previous === value) { return; }
        this._group = value;
        this.source.trigger('changeGroup', {source: this, previous});
    }

    get elementState(): ElementTemplateState | undefined { return this._elementState; }
    setElementState(value: ElementTemplateState | undefined) {
        const previous = this._elementState;
        if (previous === value) { return; }
        this._elementState = value;
        this.source.trigger('changeElementState', {source: this, previous});
    }

    get temporary(): boolean { return this._temporary; }

    focus() {
        this.source.trigger('requestedFocus', {source: this});
    }

    requestGroupContent() {
        this.source.trigger('requestedGroupContent', {source: this});
    }

    addToFilter(linkType?: LinkType, direction?: 'in' | 'out') {
        this.source.trigger('requestedAddToFilter', {
            source: this, linkType, direction,
        });
    }

    redraw(mode = ElementRedrawMode.Render) {
        this.source.trigger('requestedRedraw', {source: this, mode});
    }
}

export interface ElementTemplateState {
    [propertyIri: string]: any;
}

export interface AddToFilterRequest {
    element: Element;
    linkType?: LinkType;
    direction?: 'in' | 'out';
}

function updateLinksToReferByNewIri(element: Element, oldIri: ElementIri, newIri: ElementIri) {
    if (oldIri === newIri) { return; }
    for (const link of element.links) {
        let data = link.data;
        if (data.sourceId === oldIri) {
            data = {...data, sourceId: newIri};
        }
        if (data.targetId === oldIri) {
            data = {...data, targetId: newIri};
        }
        link.setData(data);
    }
}

export interface RichClassEvents {
    changeLabel: PropertyChange<RichClass, ReadonlyArray<Rdf.Literal>>;
    changeCount: PropertyChange<RichClass, number | undefined>;
}

export class RichClass {
    private readonly source = new EventSource<RichClassEvents>();
    readonly events: Events<RichClassEvents> = this.source;

    readonly id: ElementTypeIri;

    private _label: ReadonlyArray<Rdf.Literal>;
    private _count: number | undefined;

    constructor(props: {
        id: ElementTypeIri;
        label?: ReadonlyArray<Rdf.Literal>;
        count?: number;
    }) {
        const {id, label = [], count} = props;
        this.id = id;
        this._label = label;
        this._count = count;
    }

    get label() { return this._label; }
    setLabel(value: ReadonlyArray<Rdf.Literal>) {
        const previous = this._label;
        if (previous === value) { return; }
        this._label = value;
        this.source.trigger('changeLabel', {source: this, previous});
    }

    get count() { return this._count; }
    setCount(value: number | undefined) {
        const previous = this._count;
        if (previous === value) { return; }
        this._count = value;
        this.source.trigger('changeCount', {source: this, previous});
    }
}

export interface RichPropertyEvents {
    changeLabel: PropertyChange<RichProperty, ReadonlyArray<Rdf.Literal>>;
}

export class RichProperty {
    private readonly source = new EventSource<RichPropertyEvents>();
    readonly events: Events<RichPropertyEvents> = this.source;

    readonly id: PropertyTypeIri;

    private _label: ReadonlyArray<Rdf.Literal>;

    constructor(props: {
        id: PropertyTypeIri;
        label?: ReadonlyArray<Rdf.Literal>;
    }) {
        const {id, label = []} = props;
        this.id = id;
        this._label = label;
    }

    get label(): ReadonlyArray<Rdf.Literal> { return this._label; }
    setLabel(value: ReadonlyArray<Rdf.Literal>) {
        const previous = this._label;
        if (previous === value) { return; }
        this._label = value;
        this.source.trigger('changeLabel', {source: this, previous});
    }
}

export interface LinkEvents {
    changeData: PropertyChange<Link, LinkModel>;
    changeLayoutOnly: PropertyChange<Link, boolean>;
    changeVertices: PropertyChange<Link, ReadonlyArray<Vector>>;
    changeLinkState: PropertyChange<Link, LinkTemplateState | undefined>;
}

export class Link {
    private readonly source = new EventSource<LinkEvents>();
    readonly events: Events<LinkEvents> = this.source;

    readonly id: string;

    private _typeId: LinkTypeIri;
    private _sourceId: string;
    private _targetId: string;

    private _data: LinkModel;
    private _layoutOnly = false;
    private _vertices: ReadonlyArray<Vector>;

    private _linkState: LinkTemplateState | undefined;

    constructor(props: {
        id?: string;
        sourceId: string;
        targetId: string;
        data: LinkModel;
        vertices?: ReadonlyArray<Vector>;
        linkState?: LinkTemplateState;
    }) {
        const {id = GenerateID.forLink(), sourceId, targetId, data, vertices = [], linkState} = props;
        this.id = id;
        this._typeId = data.linkTypeId;
        this._sourceId = sourceId;
        this._targetId = targetId;
        this._data = data;
        this._vertices = vertices;
        this._linkState = linkState;
    }

    get typeId() { return this._typeId; }
    get sourceId(): string { return this._sourceId; }
    get targetId(): string { return this._targetId; }

    get data() { return this._data; }
    setData(value: LinkModel) {
        const previous = this._data;
        if (previous === value) { return; }
        this._data = value;
        this._typeId = value.linkTypeId;
        this.source.trigger('changeData', {source: this, previous});
    }

    get layoutOnly(): boolean { return this._layoutOnly; }
    setLayoutOnly(value: boolean) {
        const previous = this._layoutOnly;
        if (previous === value) { return; }
        this._layoutOnly = value;
        this.source.trigger('changeLayoutOnly', {source: this, previous});
    }

    get vertices(): ReadonlyArray<Vector> { return this._vertices; }
    setVertices(value: ReadonlyArray<Vector>) {
        const previous = this._vertices;
        if (isPolylineEqual(this._vertices, value)) { return; }
        this._vertices = value;
        this.source.trigger('changeVertices', {source: this, previous});
    }

    get linkState(): LinkTemplateState | undefined { return this._linkState; }
    setLinkState(value: LinkTemplateState | undefined) {
        const previous = this._linkState;
        if (previous === value) { return; }
        this._linkState = value;
        this.source.trigger('changeLinkState', {source: this, previous});
    }
}

export interface LinkTemplateState {
    [propertyIri: string]: any;
}

export interface LinkTypeEvents {
    changeLabel: PropertyChange<LinkType, ReadonlyArray<Rdf.Literal>>;
    changeIsNew: PropertyChange<LinkType, boolean>;
    changeVisibility: PropertyChange<LinkType, { visible: boolean; showLabel: boolean }>;
}

export class LinkType {
    private readonly source = new EventSource<LinkTypeEvents>();
    readonly events: Events<LinkTypeEvents> = this.source;

    readonly id: LinkTypeIri;

    private _label: ReadonlyArray<Rdf.Literal>;
    private _isNew = false;

    private _visible = true;
    private _showLabel = true;

    constructor(props: {
        id: LinkTypeIri;
        label?: ReadonlyArray<Rdf.Literal>;
    }) {
        const {id, label = []} = props;
        this.id = id;
        this._label = label;
    }

    get label() { return this._label; }
    setLabel(value: ReadonlyArray<Rdf.Literal>) {
        const previous = this._label;
        if (previous === value) { return; }
        this._label = value;
        this.source.trigger('changeLabel', {source: this, previous});
    }

    get visible() { return this._visible; }
    get showLabel() { return this._showLabel; }
    setVisibility(params: {
        visible: boolean;
        showLabel: boolean;
    }) {
        const previousVisible = this._visible;
        const previousShowLabel = this._showLabel;
        if (previousVisible === params.visible && previousShowLabel === params.showLabel) {
            return;
        }
        this._visible = params.visible;
        this._showLabel = params.showLabel;
        this.source.trigger('changeVisibility', {
            source: this,
            previous: {visible: previousVisible, showLabel: previousShowLabel},
        });
    }

    get isNew() { return this._isNew; }
    setIsNew(value: boolean) {
        const previous = this._isNew;
        if (previous === value) { return; }
        this._isNew = value;
        this.source.trigger('changeIsNew', {source: this, previous});
    }
}

export class LinkVertex {
    constructor(
        readonly link: Link,
        readonly vertexIndex: number,
    ) {}

    createAt(location: Vector) {
        const vertices = [...this.link.vertices];
        vertices.splice(this.vertexIndex, 0, location);
        this.link.setVertices(vertices);
    }

    moveTo(location: Vector) {
        const vertices = [...this.link.vertices];
        vertices.splice(this.vertexIndex, 1, location);
        this.link.setVertices(vertices);
    }

    remove() {
        const vertices = [...this.link.vertices];
        const [location] = vertices.splice(this.vertexIndex, 1);
        this.link.setVertices(vertices);
    }
}
