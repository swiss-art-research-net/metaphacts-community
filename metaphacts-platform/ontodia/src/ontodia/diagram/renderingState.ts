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
    LinkRouter, RoutedLink, RoutedLinks, TemplateResolver, ElementTemplate,
    LinkTemplateResolver, LinkTemplate, LinkStyle, LinkMarkerStyle,
} from '../customization/props';
import { DefaultLinkTemplateBundle } from '../customization/defaultLinkStyles';
import { StandardTemplate, DefaultElementTemplateBundle } from '../customization/templates';

import { ElementTypeIri, LinkTypeIri } from '../data/model';
import { Events, EventObserver, EventSource, PropertyChange } from '../viewUtils/events';

import { Element, Link, LinkType } from './elements';
import { Rect, Size, SizeProvider, isPolylineEqual } from './geometry';
import { DefaultLinkRouter } from './linkRouter';
import { DiagramModel } from './model';
import { DiagramView } from './view';

export interface RenderingStateOptions {
    readonly model: DiagramModel;
    readonly router?: LinkRouter;
    readonly linkTemplateResolver?: LinkTemplateResolver;
    readonly elementTemplateResolver?: TemplateResolver;
}

export enum RenderingLayer {
    Element = 1,
    ElementSize,
    PaperArea,
    Link,
    Editor,

    FirstToUpdate = Element,
    LastToUpdate = Editor,
}

export interface RenderingStateEvents {
    syncUpdate: { readonly layer: RenderingLayer };
    changeElementSize: PropertyChange<Element, Size>;
    changeLinkLabelBounds: PropertyChange<Link, Rect | undefined>;
    updateRoutings: PropertyChange<RenderingState, RoutedLinks>;
    changeLinkTemplates: {};
}

const EMPTY_SIZE: Size = {width: 0, height: 0};

export class RenderingState implements SizeProvider {
    private readonly listener = new EventObserver();
    private readonly source = new EventSource<RenderingStateEvents>();
    readonly events: Events<RenderingStateEvents> = this.source;

    private readonly model: DiagramModel;
    private readonly router: LinkRouter;
    private readonly resolveLinkTemplate: LinkTemplateResolver;
    private readonly resolveElementTemplate: TemplateResolver;

    private elementSizes = new WeakMap<Element, Size>();
    private linkLabelBounds = new WeakMap<Link, Rect | undefined>();
    private routings: RoutedLinks = new Map<string, RoutedLink>();
    private linkTemplates = new Map<LinkTypeIri, FilledLinkTemplate>();
    private nextLinkTemplateIndex = 0;

    constructor(options: RenderingStateOptions) {
        this.model = options.model;
        this.router = options.router ?? new DefaultLinkRouter();
        this.resolveLinkTemplate = options.linkTemplateResolver ?? DefaultLinkTemplateBundle;
        this.resolveElementTemplate = options.elementTemplateResolver ?? DefaultElementTemplateBundle;
        this.initRouting();
    }

    performSyncUpdate() {
        for (let layer = RenderingLayer.FirstToUpdate; layer <= RenderingLayer.LastToUpdate; layer++) {
            this.source.trigger('syncUpdate', {layer});
        }
    }

    private initRouting() {
        this.updateRoutings();

        this.listener.listen(this.model.events, 'changeCells', () =>  this.updateRoutings());
        this.listener.listen(this.model.events, 'linkEvent', ({key, data}) => {
            if (data.changeVertices) {
                this.updateRoutings();
            }
        });
        this.listener.listen(this.model.events, 'elementEvent', ({key, data}) => {
            if (data.changePosition) {
                this.updateRoutings();
            }
        });
    }

    private updateRoutings() {
        const previousRoutes = this.routings;
        const computedRoutes = this.router.route(this.model, this);
        previousRoutes.forEach((previous, linkId) => {
            const computed = computedRoutes.get(linkId);
            if (computed && sameRoutedLink(previous, computed)) {
                // replace new route with the old one if they're equal
                // so other components can use a simple reference equality checks
                computedRoutes.set(linkId, previous);
            }
        });
        this.routings = computedRoutes;
        this.source.trigger('updateRoutings', {source: this, previous: previousRoutes});
    }

    getRoutings() {
        return this.routings;
    }

    getRouting(linkId: string): RoutedLink | undefined {
        return this.routings.get(linkId);
    }

    getElementSize(element: Element): Size {
        return this.elementSizes.get(element) || EMPTY_SIZE;
    }

    setElementSize(element: Element, size: Size) {
        const previous = this.elementSizes.get(element) || EMPTY_SIZE;
        const same = (
            previous.width === size.width &&
            previous.height === size.height
        );
        if (same) { return; }
        this.elementSizes.set(element, size);
        this.source.trigger('changeElementSize', {source: element, previous});
        this.updateRoutings();
    }

    getLinkLabelBounds(link: Link) {
        return this.linkLabelBounds.get(link);
    }

    setLabelBounds(link: Link, value: Rect | undefined) {
        const previous = this.linkLabelBounds.get(link);
        if (previous === value) { return; }
        this.linkLabelBounds.set(link, value);
        this.source.trigger('changeLinkLabelBounds', {source: link, previous});
    }

    getLinkTemplates(): ReadonlyMap<LinkTypeIri, FilledLinkTemplate> {
        return this.linkTemplates;
    }

    createLinkTemplate(linkType: LinkType): FilledLinkTemplate {
        const existingTemplate = this.linkTemplates.get(linkType.id);
        if (existingTemplate) {
            return existingTemplate;
        }

        const index = this.nextLinkTemplateIndex;
        this.nextLinkTemplateIndex++;

        const result = this.resolveLinkTemplate(linkType.id) || {};
        const template = fillLinkTemplateDefaults(result, index);

        this.linkTemplates.set(linkType.id, template);
        this.source.trigger('changeLinkTemplates', {});
        return template;
    }

    getElementTemplate(types: ElementTypeIri[]): ElementTemplate {
        return this.resolveElementTemplate(types) || StandardTemplate;
    }
}

function sameRoutedLink(a: RoutedLink, b: RoutedLink) {
    return (
        a.linkId === b.linkId &&
        a.labelTextAnchor === b.labelTextAnchor &&
        isPolylineEqual(a.vertices, b.vertices)
    );
}

export interface FilledLinkTemplate {
    readonly index: number;
    readonly markerSource: LinkMarkerStyle | undefined | null;
    readonly markerSourceId: string;
    readonly markerTarget: LinkMarkerStyle | undefined | null;
    readonly markerTargetId: string;
    renderLink: (link: Link, view: DiagramView) => LinkStyle;
    setLinkLabel: ((link: Link, label: string) => void) | undefined | null;
}

function fillLinkTemplateDefaults(template: LinkTemplate, index: number): FilledLinkTemplate {
    const {
        markerSource,
        markerTarget = {},
        renderLink = () => ({}),
        setLinkLabel,
    } = template;
    return {
        index,
        markerSource,
        markerSourceId: `ontodia-mstart-${index}`,
        markerTarget: markerTarget ? {
            ...markerTarget,
            d: markerTarget.d ?? 'M0,0 L0,8 L9,4 z',
            width: markerTarget.width ?? 9,
            height: markerTarget.height ?? 8,
            fill: markerTarget.fill ?? 'black',
        } : null,
        markerTargetId: `ontodia-mend-${index}`,
        renderLink,
        setLinkLabel,
    };
}
