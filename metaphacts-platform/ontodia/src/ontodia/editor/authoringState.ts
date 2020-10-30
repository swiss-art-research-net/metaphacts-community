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
import { ElementModel, LinkModel, ElementIri, sameLink, hashLink } from '../data/model';

import { cloneMap } from '../viewUtils/collections';
import { ReadonlyHashMap, HashMap } from '../viewUtils/hashMap';

export interface AuthoringState {
    readonly elements: ReadonlyMap<ElementIri, ElementChange>;
    readonly links: ReadonlyHashMap<LinkModel, LinkChange>;
}

export type AuthoringEvent = ElementChange | LinkChange;

export enum AuthoringKind {
    ChangeElement = 'changeElement',
    ChangeLink = 'changeLink',
}

export interface ElementChange {
    readonly type: AuthoringKind.ChangeElement;
    readonly before?: ElementModel;
    readonly after: ElementModel;
    readonly newIri?: ElementIri;
    readonly deleted: boolean;
}

export interface LinkChange {
    readonly type: AuthoringKind.ChangeLink;
    readonly before?: LinkModel;
    readonly after: LinkModel;
    readonly deleted: boolean;
}

interface MutableAuthoringState extends AuthoringState {
    readonly elements: Map<ElementIri, ElementChange>;
    readonly links: HashMap<LinkModel, LinkChange>;
}

export namespace AuthoringState {
    export const empty: AuthoringState = {
        elements: new Map<ElementIri, ElementChange>(),
        links: new HashMap<LinkModel, LinkChange>(hashLink, sameLink),
    };

    export function isEmpty(state: AuthoringState) {
        return state.elements.size === 0 && state.links.size === 0;
    }

    export function clone(index: AuthoringState): MutableAuthoringState {
        return {
            elements: cloneMap(index.elements),
            links: index.links.clone(),
        };
    }

    export function has(state: AuthoringState, event: AuthoringEvent): boolean {
        return event.type === AuthoringKind.ChangeElement
            ? state.elements.get(event.after.id) === event
            : state.links.get(event.after) === event;
    }

    export function discard(state: AuthoringState, discarded: AuthoringEvent): AuthoringState {
        if (!has(state, discarded)) {
            return state;
        }
        const newState = clone(state);
        if (discarded.type === AuthoringKind.ChangeElement) {
            newState.elements.delete(discarded.after.id);
            if (!discarded.before) {
                state.links.forEach(e => {
                    if (isLinkConnectedToElement(e.after, discarded.after.id)) {
                        newState.links.delete(e.after);
                    }
                });
            }
        } else {
            newState.links.delete(discarded.after);
        }
        return newState;
    }

    export function addElement(state: AuthoringState, item: ElementModel): AuthoringState {
        const event: ElementChange = {type: AuthoringKind.ChangeElement, after: item, deleted: false};
        const newState = clone(state);
        newState.elements.set(event.after.id, event);
        return newState;
    }

    export function addLink(state: AuthoringState, item: LinkModel): AuthoringState {
        const event: LinkChange = {type: AuthoringKind.ChangeLink, after: item, deleted: false};
        const newState = clone(state);
        newState.links.set(event.after, event);
        return newState;
    }

    export function changeElement(state: AuthoringState, before: ElementModel, after: ElementModel): AuthoringState {
        const newState = clone(state);
        // delete previous state for an entity
        newState.elements.delete(before.id);

        const previous = state.elements.get(before.id);
        if (previous && !previous.before) {
            // adding or changing new entity
            newState.elements.set(after.id, {
                type: AuthoringKind.ChangeElement,
                after,
                deleted: false,
            });
            if (before.id !== after.id) {
                state.links.forEach(e => {
                    if (!e.before && isLinkConnectedToElement(e.after, before.id)) {
                        const updatedLink = updateLinkToReferByNewIri(e.after, before.id, after.id);
                        newState.links.delete(e.after);
                        newState.links.set(updatedLink, {
                            type: AuthoringKind.ChangeLink,
                            after: updatedLink,
                            deleted: false,
                        });
                    }
                });
            }
        } else {
            // changing existing entity
            const iriChanged = after.id !== before.id;
            const previousBefore = previous ? previous.before : undefined;
            newState.elements.set(before.id, {
                type: AuthoringKind.ChangeElement,
                // always initialize 'before', otherwise entity will be considered new
                before: previousBefore || before,
                after: iriChanged ? {...after, id: before.id} : after,
                newIri: iriChanged ? after.id : undefined,
                deleted: false,
            });
        }

        return newState;
    }

    export function changeLink(state: AuthoringState, before: LinkModel, after: LinkModel): AuthoringState {
        if (!sameLink(before, after)) {
            throw new Error('Cannot move link to another element or change its type');
        }
        const newState = clone(state);
        const previous = state.links.get(before);
        newState.links.set(before, {
            type: AuthoringKind.ChangeLink,
            before: previous ? previous.before : undefined,
            after: after,
            deleted: false,
        });
        return newState;
    }

    export function deleteElement(state: AuthoringState, model: ElementModel): AuthoringState {
        const newState = clone(state);
        newState.elements.delete(model.id);
        state.links.forEach(e => {
            if (isLinkConnectedToElement(e.after, model.id)) {
                newState.links.delete(e.after);
            }
        });
        if (!isNewElement(state, model.id)) {
            newState.elements.set(model.id, {
                type: AuthoringKind.ChangeElement,
                before: model,
                after: model,
                deleted: true,
            });
        }
        return newState;
    }

    export function deleteLink(state: AuthoringState, target: LinkModel): AuthoringState {
        const newState = clone(state);
        newState.links.delete(target);
        if (!isNewLink(state, target)) {
            newState.links.set(target, {
                type: AuthoringKind.ChangeLink,
                before: target,
                after: target,
                deleted: true,
            });
        }
        return newState;
    }

    export function deleteNewLinksConnectedToElements(
        state: AuthoringState, elementIris: Set<ElementIri>
    ): AuthoringState {
        const newState = clone(state);
        state.links.forEach(e => {
            if (!e.before) {
                const target = e.after;
                if (elementIris.has(target.sourceId) || elementIris.has(target.targetId)) {
                    newState.links.delete(target);
                }
            }
        });
        return newState;
    }

    export function isNewElement(state: AuthoringState, target: ElementIri): boolean {
        const event = state.elements.get(target);
        return Boolean(event && event.type === AuthoringKind.ChangeElement && !event.before);
    }

    export function isDeletedElement(state: AuthoringState, target: ElementIri): boolean {
        const event = state.elements.get(target);
        return Boolean(event && event.deleted);
    }

    export function isElementWithModifiedIri(state: AuthoringState, target: ElementIri): boolean {
        return typeof getElementModifiedIri(state, target) === 'string';
    }

    export function getElementModifiedIri(state: AuthoringState, target: ElementIri): ElementIri | undefined {
        const event = state.elements.get(target);
        if (event && event.type === AuthoringKind.ChangeElement && event.before) {
            return event.newIri;
        }
        return undefined;
    }

    export function isNewLink(state: AuthoringState, linkModel: LinkModel): boolean {
        const event = state.links.get(linkModel);
        return Boolean(event && !event.before);
    }

    export function isDeletedLink(state: AuthoringState, linkModel: LinkModel): boolean {
        const event = state.links.get(linkModel);
        return event && event.deleted ||
            isDeletedElement(state, linkModel.sourceId) ||
            isDeletedElement(state, linkModel.targetId);
    }

    export function isUncertainLink(state: AuthoringState, linkModel: LinkModel): boolean {
        return !isDeletedLink(state, linkModel) && (
            isElementWithModifiedIri(state, linkModel.sourceId) ||
            isElementWithModifiedIri(state, linkModel.targetId)
        );
    }
}

export interface TemporaryState {
    readonly elements: ReadonlyMap<ElementIri, ElementModel>;
    readonly links: ReadonlyHashMap<LinkModel, LinkModel>;
}

export namespace TemporaryState {
    export const empty: TemporaryState = {
        elements: new Map<ElementIri, ElementModel>(),
        links: new HashMap<LinkModel, LinkModel>(hashLink, sameLink),
    };

    export function addElement(state: TemporaryState, element: ElementModel) {
        const elements = cloneMap(state.elements);
        elements.set(element.id, element);
        return {...state, elements};
    }

    export function deleteElement(state: TemporaryState, element: ElementModel) {
        const elements = cloneMap(state.elements);
        elements.delete(element.id);
        return {...state, elements};
    }

    export function addLink(state: TemporaryState, link: LinkModel) {
        const links = state.links.clone();
        links.set(link, link);
        return {...state, links};
    }
    export function deleteLink(state: TemporaryState, link: LinkModel) {
        const links = state.links.clone();
        links.delete(link);
        return {...state, links};
    }
}

export function isLinkConnectedToElement(link: LinkModel, elementIri: ElementIri) {
    return link.sourceId === elementIri || link.targetId === elementIri;
}

function updateLinkToReferByNewIri(link: LinkModel, oldIri: ElementIri, newIri: ElementIri): LinkModel {
    return {
        ...link,
        sourceId: link.sourceId === oldIri ? newIri : link.sourceId,
        targetId: link.targetId === oldIri ? newIri : link.targetId,
    };
}
