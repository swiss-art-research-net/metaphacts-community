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
import { ReactNode } from 'react';
import { hcl } from 'd3-color';
import { ReactElement, MouseEvent } from 'react';

import { TypeStyleResolver } from '../customization/props';
import { DefaultTypeStyleBundle } from '../customization/defaultTypeStyles';

import { ElementModel, ElementTypeIri, isEncodedBlank } from '../data/model';
import { Rdf } from '../data/rdf';
import { hashFnv32a, getUriLocalName } from '../data/utils';

import { Events, EventSource, EventObserver, PropertyChange } from '../viewUtils/events';

import { Element, Link } from './elements';
import { Vector } from './geometry';
import { DiagramModel } from './model';
import { RenderingState } from './renderingState';
import { PaperWidgetProps } from './paperArea';

export enum IriClickIntent {
    JumpToEntity = 'jumpToEntity',
    OpenEntityIri = 'openEntityIri',
    OpenOtherIri = 'openOtherIri',
}
export interface IriClickEvent {
    iri: string;
    element: Element;
    clickIntent: IriClickIntent;
    originalEvent: MouseEvent<any>;
}
export type IriClickHandler = (event: IriClickEvent) => void;

export type LabelLanguageSelector =
    (labels: ReadonlyArray<Rdf.Literal>, language: string) => Rdf.Literal | undefined;

export interface ViewOptions {
    typeStyleResolver?: TypeStyleResolver;
    selectLabelLanguage?: LabelLanguageSelector;
    onIriClick?: IriClickHandler;
}

export interface TypeStyle {
    color: { h: number; c: number; l: number };
    icon?: string;
}

export interface DiagramViewEvents {
    changeLanguage: PropertyChange<DiagramView, string>;
    syncUpdateAll: {};
    updateWidget: UpdateWidgetEvent;
    dispose: {};
    changeHighlight: PropertyChange<DiagramView, Highlighter>;
}

export interface UpdateWidgetEvent {
    readonly key: string;
    readonly widget: ReactElement<PaperWidgetProps> | undefined;
}

export enum WidgetAttachment {
    Viewport = 'viewport',
    OverElements = 'overElements',
    OverLinks = 'overLinks',
}

export interface WidgetStatic {
    readonly attachment: WidgetAttachment;
    new (...args: any[]): { readonly props: PaperWidgetProps };
}

export interface DropOnPaperEvent {
    readonly dragEvent: DragEvent;
    readonly paperPosition: Vector;
    // TODO: provide target canvas here instead
    readonly _renderingState: RenderingState;
}

export type Highlighter = ((item: Element | Link) => boolean) | undefined;

export type ElementDecoratorResolver = (element: Element, renderingState: RenderingState) => ReactNode | undefined;

export class DiagramView {
    private readonly listener = new EventObserver();
    private readonly source = new EventSource<DiagramViewEvents>();
    readonly events: Events<DiagramViewEvents> = this.source;

    private disposed = false;

    private readonly colorSeed = 0x0BADBEEF;

    private readonly resolveTypeStyle: TypeStyleResolver;

    private _language = 'en';

    private dropHandlers: Array<(e: DropOnPaperEvent) => void> = [];

    private _highlighter: Highlighter;

    private _elementDecorator: ElementDecoratorResolver | undefined;

    constructor(
        public readonly model: DiagramModel,
        public readonly options: ViewOptions = {},
    ) {
        this.resolveTypeStyle = options.typeStyleResolver || DefaultTypeStyleBundle;
    }

    getLanguage(): string { return this._language; }
    setLanguage(value: string) {
        if (!value) {
            throw new Error('Cannot set empty language.');
        }
        const previous = this._language;
        if (previous === value) { return; }
        this._language = value;
        this.source.trigger('changeLanguage', {source: this, previous});
    }

    performSyncUpdate() {
        this.source.trigger('syncUpdateAll', {});
    }

    onIriClick(iri: string, element: Element, clickIntent: IriClickIntent, event: React.MouseEvent<any>) {
        event.persist();
        event.preventDefault();
        const {onIriClick} = this.options;
        if (onIriClick) {
            onIriClick({iri, element, clickIntent, originalEvent: event});
        }
    }

    setWidget(key: string, widget: ReactElement<PaperWidgetProps> | undefined) {
        this.source.trigger('updateWidget', {key, widget});
    }

    pushDragDropHandler(handler: (e: DropOnPaperEvent) => void) {
        this.dropHandlers.push(handler);
    }

    popDragDropHandler(handler: (e: DropOnPaperEvent) => void) {
        const topHandler = this.dropHandlers.pop();
        if (topHandler !== handler) {
            throw new Error('Inconsistent popDragDropHandler() call');
        }
    }

    handleDropOnPaper(e: DropOnPaperEvent): void {
        if (this.dropHandlers.length > 0) {
            const lastHandler = this.dropHandlers[this.dropHandlers.length - 1];
            lastHandler(e);
        }
    }

    selectLabel(
        labels: ReadonlyArray<Rdf.Literal>,
        language?: string
    ): Rdf.Literal | undefined {
        const targetLanguage = typeof language === 'undefined' ? this.getLanguage() : language;
        const {selectLabelLanguage = defaultSelectLabel} = this.options;
        return selectLabelLanguage(labels, targetLanguage);
    }

    formatLabel(
        labels: ReadonlyArray<Rdf.Literal>,
        fallbackIri: string,
        language?: string
    ): string {
        const label = this.selectLabel(labels, language);
        return resolveLabel(label, fallbackIri);
    }

    public getElementTypeString(elementModel: ElementModel): string {
        return elementModel.types.map(typeId => {
            const type = this.model.createClass(typeId);
            return this.formatLabel(type.label, type.id);
        }).sort().join(', ');
    }

    public getTypeStyle(types: ElementTypeIri[]): TypeStyle {
        types.sort();

        const customStyle = this.resolveTypeStyle(types);

        const icon = customStyle ? customStyle.icon : undefined;
        let color: { h: number; c: number; l: number };
        if (customStyle && customStyle.color) {
            color = hcl(customStyle.color);
        } else {
            const hue = getHueFromClasses(types, this.colorSeed);
            color = {h: hue, c: 40, l: 75};
        }
        return {icon, color};
    }

    formatIri(iri: string): string {
        if (isEncodedBlank(iri)) {
            return '(blank node)';
        }
        return `<${iri}>`;
    }

    dispose() {
        if (this.disposed) { return; }
        this.source.trigger('dispose', {});
        this.listener.stopListening();
        this.disposed = true;
    }

    get highlighter() { return this._highlighter; }
    setHighlighter(value: Highlighter) {
        const previous = this._highlighter;
        if (previous === value) { return; }
        this._highlighter = value;
        this.source.trigger('changeHighlight', {source: this, previous});
    }

    _setElementDecorator(decorator: ElementDecoratorResolver) {
        this._elementDecorator = decorator;
    }

    _decorateElement(element: Element, renderingState: RenderingState): ReactNode | undefined {
        return this._elementDecorator?.(element, renderingState);
    }
}

function getHueFromClasses(classes: ReadonlyArray<ElementTypeIri>, seed?: number): number {
    let hash = seed;
    for (const name of classes) {
        hash = hashFnv32a(name, hash);
    }
    const MAX_INT32 = 0x7fffffff;
    return 360 * ((hash === undefined ? 0 : hash) / MAX_INT32);
}

function defaultSelectLabel(
    texts: ReadonlyArray<Rdf.Literal>,
    language: string
): Rdf.Literal | undefined {
    if (texts.length === 0) { return undefined; }
    let defaultValue: Rdf.Literal | undefined;
    let englishValue: Rdf.Literal | undefined;
    for (const text of texts) {
        if (text.language === language) {
            return text;
        } else if (text.language === '') {
            defaultValue = text;
        } else if (text.language === 'en') {
            englishValue = text;
        }
    }
    return (
        defaultValue !== undefined ? defaultValue :
        englishValue !== undefined ? englishValue :
        texts[0]
    );
}

function resolveLabel(label: Rdf.Literal | undefined, fallbackIri: string): string {
    if (label) { return label.value; }
    return getUriLocalName(fallbackIri) || fallbackIri;
}

export function assertWidgetComponent(widget: WidgetStatic) {
    if (!widget.attachment) {
        throw new Error('Canvas widget component is missing required "attachment" static property.');
    }
}
