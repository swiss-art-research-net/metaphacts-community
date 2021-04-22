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
    ElementModel, LinkModel, ElementIri, ElementTypeIri, LinkIri, LinkTypeIri, PropertyTypeIri,
    isEncodedBlank,
} from '../data/model';
import { Rdf } from '../data/rdf';
import { GenerateID } from '../data/schema';

import { EventSource, Events, EventObserver, AnyEvent } from '../viewUtils/events';

import {
    Element, ElementEvents, Link, LinkEvents, LinkType, LinkTypeEvents, LinkTemplateState,
    RichClass, RichClassEvents, RichProperty, RichPropertyEvents,
} from './elements';
import { Vector } from './geometry';
import { Graph, CellsChangedEvent } from './graph';
import { CommandHistory, Command } from './history';

export interface DiagramModelEvents {
    changeCells: CellsChangedEvent;
    elementEvent: AnyEvent<ElementEvents>;
    linkEvent: AnyEvent<LinkEvents>;
    linkTypeEvent: AnyEvent<LinkTypeEvents>;
    classEvent: AnyEvent<RichClassEvents>;
    propertyEvent: AnyEvent<RichPropertyEvents>;
    layoutGroupContent: { readonly group: string };
    changeGroupContent: { readonly group: string };
}

export interface CreateLinkProps {
    id?: string;
    sourceId: string;
    targetId: string;
    data: LinkModel;
    vertices?: ReadonlyArray<Vector>;
    linkState?: LinkTemplateState;
}

/**
 * Model of diagram.
 */
export class DiagramModel {
    protected readonly source = new EventSource<DiagramModelEvents>();
    readonly events: Events<DiagramModelEvents> = this.source;

    protected graph = new Graph();
    protected graphListener = new EventObserver();

    constructor(
        readonly factory: Rdf.DataFactory,
        readonly history: CommandHistory,
    ) {}

    get elements() { return this.graph.getElements(); }
    get links() { return this.graph.getLinks(); }

    getElement(elementId: string): Element | undefined {
        return this.graph.getElement(elementId);
    }

    getLinkById(linkId: string): Link | undefined {
        return this.graph.getLink(linkId);
    }

    linksOfType(linkTypeId: LinkTypeIri): ReadonlyArray<Link> {
        return this.graph.getLinks().filter(link => link.typeId === linkTypeId);
    }

    findLink(
        linkTypeId: LinkTypeIri,
        sourceId: string,
        targetId: string,
        linkIri?: LinkIri
    ): Link | undefined {
        return this.graph.findLink(linkTypeId, sourceId, targetId, linkIri);
    }

    sourceOf(link: Link) { return this.getElement(link.sourceId); }
    targetOf(link: Link) { return this.getElement(link.targetId); }

    isLinkVisible(link: Link): boolean {
        const linkType = this.getLinkType(link.typeId);
        return Boolean(
            this.sourceOf(link) &&
            this.targetOf(link) &&
            linkType && linkType.visible
        );
    }

    getPresentLinkTypes(): LinkType[] {
        const typeIris = new Set<LinkTypeIri>();
        for (const link of this.links) {
            typeIris.add(link.typeId);
        }
        return Array.from(typeIris, iri => this.getLinkType(iri)!);
    }

    protected resetGraph() {
        if (this.graphListener) {
            this.graphListener.stopListening();
            this.graphListener = new EventObserver();
        }
        this.graph = new Graph();
    }

    protected subscribeGraph() {
        this.graphListener.listen(this.graph.events, 'changeCells', e => {
            this.source.trigger('changeCells', e);
        });
        this.graphListener.listen(this.graph.events, 'elementEvent', e => {
            this.source.trigger('elementEvent', e);
        });
        this.graphListener.listen(this.graph.events, 'linkEvent', e => {
            this.source.trigger('linkEvent', e);
        });
        this.graphListener.listen(this.graph.events, 'linkTypeEvent', e => {
            this.source.trigger('linkTypeEvent', e);
        });
        this.graphListener.listen(this.graph.events, 'classEvent', e => {
            this.source.trigger('classEvent', e);
        });
        this.graphListener.listen(this.graph.events, 'propertyEvent', e => {
            this.source.trigger('propertyEvent', e);
        });

        this.source.trigger('changeCells', {updateAll: true});
    }

    reorderElements(compare: (a: Element, b: Element) => number) {
        this.graph.reorderElements(compare);
    }

    createElement(elementIriOrModel: ElementIri | ElementModel, group?: string): Element {
        const elementIri = typeof elementIriOrModel === 'string'
            ? elementIriOrModel : (elementIriOrModel as ElementModel).id;

        const elements = this.elements.filter(el => el.iri === elementIri && el.group === group);
        if (elements.length > 0) {
            // usually there should be only one element
            return elements[0];
        }

        let data = typeof elementIriOrModel === 'string'
            ? placeholderDataFromIri(elementIri, this.factory)
            : elementIriOrModel as ElementModel;
        data = {...data, id: data.id};
        const element = new Element({id: GenerateID.forElement(), data, group});
        this.addElement(element);
        return element;
    }

    addElement(element: Element): void {
        this.history.execute(
            addElement(this.graph, element, [])
        );
    }

    removeElement(elementId: string) {
        const element = this.getElement(elementId);
        if (element) {
            this.history.execute(
                removeElement(this.graph, element)
            );
        }
    }

    createLink(props: CreateLinkProps): Link | undefined {
        const {id, sourceId, targetId, data, vertices, linkState} = props;
        const existingLink = this.findLink(data.linkTypeId, sourceId, targetId, data.linkIri);
        if (existingLink) {
            existingLink.setLayoutOnly(false);
            existingLink.setData(data);
            return existingLink;
        }

        this.createLinkType(data.linkTypeId);

        const source = this.getElement(sourceId);
        const target = this.getElement(targetId);
        if (!(source && target)) {
            // link is invisible
            return undefined;
        }

        const createdLink = new Link({
            id,
            sourceId,
            targetId,
            data,
            vertices,
            linkState,
        });

        this.addLink(createdLink);
        return createdLink;
    }

    addLink(link: Link): void {
        this.graph.addLink(link);
    }

    removeLink(linkId: string): void {
        this.graph.removeLink(linkId);
    }

    getClass(classIri: ElementTypeIri): RichClass | undefined {
        return this.graph.getClass(classIri);
    }

    createClass(classIri: ElementTypeIri): RichClass {
        const existing = this.graph.getClass(classIri);
        if (existing) {
            return existing;
        }
        const classModel = new RichClass({id: classIri});
        this.addClass(classModel);
        return classModel;
    }

    addClass(model: RichClass) {
        this.graph.addClass(model);
    }

    getLinkType(linkTypeIri: LinkTypeIri): LinkType | undefined {
        return this.graph.getLinkType(linkTypeIri);
    }

    createLinkType(linkTypeIri: LinkTypeIri): LinkType {
        const existing = this.graph.getLinkType(linkTypeIri);
        if (existing) {
            return existing;
        }
        const linkType = new LinkType({id: linkTypeIri});
        this.graph.addLinkType(linkType);
        return linkType;
    }

    getProperty(propertyTypeIri: PropertyTypeIri): RichProperty | undefined {
        return this.graph.getProperty(propertyTypeIri);
    }

    createProperty(propertyIri: PropertyTypeIri): RichProperty {
        const existing = this.graph.getProperty(propertyIri);
        if (existing) {
            return existing;
        }
        const property = new RichProperty({id: propertyIri});
        this.graph.addProperty(property);
        return property;
    }

    triggerLayoutGroupContent(group: string) {
        this.source.trigger('layoutGroupContent', {group});
    }

    triggerChangeGroupContent(group: string) {
        this.source.trigger('changeGroupContent', {group});
    }

    createTemporaryElement(): Element {
        const target = new Element({
            id: GenerateID.forElement(),
            data: placeholderDataFromIri('' as ElementIri, this.factory),
            temporary: true,
        });

        this.graph.addElement(target);

        return target;
    }
}

export function placeholderDataFromIri(iri: ElementIri, factory: Rdf.DataFactory): ElementModel {
    return {
        id: iri,
        types: [],
        label: {
            values: isEncodedBlank(iri) ? [factory.literal('(blank)')] : [],
        },
        properties: {},
    };
}

function addElement(graph: Graph, element: Element, connectedLinks: ReadonlyArray<Link>): Command {
    return Command.create('Add element', () => {
        graph.addElement(element);
        for (const link of connectedLinks) {
            const existing = graph.getLink(link.id) || graph.findLink(link.typeId, link.sourceId, link.targetId);
            if (!existing) {
                graph.addLink(link);
            }
        }
        return removeElement(graph, element);
    });
}

function removeElement(graph: Graph, element: Element): Command {
    return Command.create('Remove element', () => {
        const connectedLinks = [...element.links];
        graph.removeElement(element.id);
        return addElement(graph, element, connectedLinks);
    });
}
