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
import { ElementTypeIri, LinkTypeIri, PropertyTypeIri } from '../data/model';
import { OrderedMap } from '../viewUtils/collections';
import { EventSource, Events, AnyEvent, AnyListener } from '../viewUtils/events';

import {
    Element as DiagramElement, ElementEvents,
    Link as DiagramLink, LinkEvents,
    LinkType, LinkTypeEvents,
    RichClass, RichClassEvents,
    RichProperty,
} from './elements';

export interface GraphEvents {
    changeCells: CellsChangedEvent;
    elementEvent: AnyEvent<ElementEvents>;
    linkEvent: AnyEvent<LinkEvents>;
    linkTypeEvent: AnyEvent<LinkTypeEvents>;
    classEvent: AnyEvent<RichClassEvents>;
}

export interface CellsChangedEvent {
    readonly updateAll: boolean;
    readonly changedElement?: DiagramElement;
    readonly changedLinks?: ReadonlyArray<DiagramLink>;
}

export class Graph {
    private readonly source = new EventSource<GraphEvents>();
    readonly events: Events<GraphEvents> = this.source;

    private elements = new OrderedMap<DiagramElement>();
    private links = new OrderedMap<DiagramLink>();

    private classesById = new Map<ElementTypeIri, RichClass>();
    private propertiesById = new Map<PropertyTypeIri, RichProperty>();

    private linkTypes = new Map<LinkTypeIri, LinkType>();
    private static nextLinkTypeIndex = 0;

    getElements() { return this.elements.items; }
    getLinks() { return this.links.items; }

    getLink(linkId: string): DiagramLink | undefined {
        return this.links.get(linkId);
    }

    findLink(linkTypeId: LinkTypeIri, sourceId: string, targetId: string): DiagramLink | undefined {
        const source = this.getElement(sourceId);
        if (!source) { return undefined; }
        const index = findLinkIndex(source.links, linkTypeId, sourceId, targetId);
        return index >= 0 ? source.links[index] : undefined;
    }

    sourceOf(link: DiagramLink) {
        return this.getElement(link.sourceId);
    }

    targetOf(link: DiagramLink) {
        return this.getElement(link.targetId);
    }

    reorderElements(compare: (a: DiagramElement, b: DiagramElement) => number) {
        this.elements.reorder(compare);
    }

    getElement(elementId: string): DiagramElement | undefined {
        return this.elements.get(elementId);
    }

    addElement(element: DiagramElement): void {
        if (this.getElement(element.id)) {
            throw new Error(`Element '${element.id}' already exists.`);
        }
        element.events.onAny(this.onElementEvent);
        this.elements.push(element.id, element);
        this.source.trigger('changeCells', {updateAll: false, changedElement: element});
    }

    private onElementEvent: AnyListener<ElementEvents> = (data, key) => {
        this.source.trigger('elementEvent', {key, data});
    }

    removeElement(elementId: string): void {
        const element = this.elements.get(elementId);
        if (element) {
            const options = {silent: true};
            // clone links to prevent modifications during iteration
            const changedLinks = [...element.links];
            for (const link of changedLinks) {
                this.removeLink(link.id, options);
            }
            this.elements.delete(elementId);
            element.events.offAny(this.onElementEvent);
            this.source.trigger('changeCells', {updateAll: false, changedElement: element, changedLinks});
        }
    }

    addLink(link: DiagramLink): void {
        if (this.getLink(link.id)) {
            throw new Error(`Link '${link.id}' already exists.`);
        }
        const linkType = this.getLinkType(link.typeId);
        if (!linkType) {
            throw new Error(`Link type '${link.typeId}' not found.`);
        }
        this.registerLink(link);
    }

    private registerLink(link: DiagramLink) {
        this.sourceOf(link)!.links.push(link);
        if (link.sourceId !== link.targetId) {
            this.targetOf(link)!.links.push(link);
        }

        link.events.onAny(this.onLinkEvent);
        this.links.push(link.id, link);
        this.source.trigger('changeCells', {updateAll: false, changedLinks: [link]});
    }

    private onLinkEvent: AnyListener<LinkEvents> = (data, key) => {
        this.source.trigger('linkEvent', {key, data});
    }

    removeLink(linkId: string, options?: { silent?: boolean }) {
        const link = this.links.delete(linkId);
        if (link) {
            const {typeId, sourceId, targetId} = link;
            link.events.offAny(this.onLinkEvent);
            this.removeLinkReferences(typeId, sourceId, targetId);
            if (!(options && options.silent)) {
                this.source.trigger('changeCells', {updateAll: false, changedLinks: [link]});
            }
        }
    }

    private removeLinkReferences(linkTypeId: LinkTypeIri, sourceId: string, targetId: string) {
        const source = this.getElement(sourceId);
        if (source) {
            removeLinkFrom(source.links, linkTypeId, sourceId, targetId);
        }
        const target = this.getElement(targetId);
        if (target) {
            removeLinkFrom(target.links, linkTypeId, sourceId, targetId);
        }
    }

    getLinkTypes(): LinkType[] {
        const result: LinkType[] = [];
        this.linkTypes.forEach(type => result.push(type));
        return result;
    }

    getLinkType(linkTypeId: LinkTypeIri): LinkType | undefined {
        return this.linkTypes.get(linkTypeId);
    }

    addLinkType(linkType: LinkType): void {
        if (this.getLinkType(linkType.id)) {
            throw new Error(`Link type '${linkType.id}' already exists.`);
        }
        linkType.setIndex(Graph.nextLinkTypeIndex++);
        linkType.events.onAny(this.onLinkTypeEvent);
        this.linkTypes.set(linkType.id, linkType);
    }

    private onLinkTypeEvent: AnyListener<LinkTypeEvents> = (data, key) => {
        this.source.trigger('linkTypeEvent', {key, data});
    }

    getProperty(propertyId: PropertyTypeIri): RichProperty | undefined {
        return this.propertiesById.get(propertyId);
    }

    addProperty(property: RichProperty): void {
        if (this.getProperty(property.id)) {
            throw new Error(`Property '${property.id}' already exists.`);
        }
        this.propertiesById.set(property.id, property);
    }

    getClass(classId: ElementTypeIri): RichClass | undefined {
        return this.classesById.get(classId);
    }

    getClasses(): RichClass[] {
        const classes: RichClass[] = [];
        this.classesById.forEach(richClass => classes.push(richClass));
        return classes;
    }

    addClass(classModel: RichClass): void {
        if (this.getClass(classModel.id)) {
            throw new Error(`Class '${classModel.id}' already exists.`);
        }
        classModel.events.onAny(this.onClassEvent);
        this.classesById.set(classModel.id, classModel);
    }

    private onClassEvent: AnyListener<RichClassEvents> = (data, key) => {
        this.source.trigger('classEvent', {key, data});
    }
}

function removeLinkFrom(links: DiagramLink[], linkTypeId: LinkTypeIri, sourceId: string, targetId: string) {
    if (!links) { return; }
    while (true) {
        const index = findLinkIndex(links, linkTypeId, sourceId, targetId);
        if (index < 0) { break; }
        links.splice(index, 1);
    }
}

function findLinkIndex(haystack: DiagramLink[], linkTypeId: LinkTypeIri, sourceId: string, targetId: string) {
    for (let i = 0; i < haystack.length; i++) {
        const link = haystack[i];
        if (link.sourceId === sourceId &&
            link.targetId === targetId &&
            link.typeId === linkTypeId
        ) {
            return i;
        }
    }
    return -1;
}
