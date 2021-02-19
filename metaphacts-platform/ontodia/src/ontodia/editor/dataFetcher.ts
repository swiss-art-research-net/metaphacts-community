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
    ElementModel, ClassModel, LinkTypeModel, PropertyModel,
    ElementIri, ElementTypeIri, LinkTypeIri, PropertyTypeIri,
} from '../data/model';
import { DataProvider } from '../data/provider';

import { RichClass, LinkType, RichProperty } from '../diagram/elements';
import { Graph } from '../diagram/graph';

import { BufferingQueue } from '../viewUtils/async';

export class DataFetcher {
    private classQueue = new BufferingQueue<ElementTypeIri>(classIds => {
        this.dataProvider.classInfo({classIds}).then(this.onClassesLoaded);
    });
    private linkTypeQueue = new BufferingQueue<LinkTypeIri>(linkTypeIds => {
        this.dataProvider.linkTypesInfo({linkTypeIds}).then(this.onLinkTypesLoaded);
    });
    private propertyTypeQueue = new BufferingQueue<PropertyTypeIri>(propertyIds => {
        this.dataProvider.propertyInfo!({propertyIds}).then(this.onPropertyTypesLoaded);
    });

    constructor(
        private graph: Graph,
        private dataProvider: DataProvider,
    ) {}

    fetchElementData(elementIris: ReadonlyArray<ElementIri>): Promise<void> {
        if (elementIris.length === 0) {
            return Promise.resolve();
        }
        return this.dataProvider.elementInfo({elementIds: [...elementIris]})
            .then(this.onElementInfoLoaded);
    }

    private onElementInfoLoaded = (elements: { [elementId: string]: ElementModel | undefined }) => {
        for (const element of this.graph.getElements()) {
            if (!Object.prototype.hasOwnProperty.call(elements, element.iri)) { continue; }
            const loadedModel = elements[element.iri];
            if (loadedModel) {
                element.setData(loadedModel);
            }
        }
    }

    fetchClass(model: RichClass): void {
        this.classQueue.push(model.id);
    }

    private onClassesLoaded = (classInfos: ClassModel[]) => {
        for (const {id, label, count} of classInfos) {
            const model = this.graph.getClass(id);
            if (!model) { continue; }
            model.setLabel(label.values);
            if (typeof count === 'number') {
                model.setCount(count);
            }
        }
    }

    fetchLinkType(linkType: LinkType): void {
        this.linkTypeQueue.push(linkType.id);
    }

    private onLinkTypesLoaded = (linkTypesInfo: LinkTypeModel[]) => {
        for (const {id, label} of linkTypesInfo) {
            const model = this.graph.getLinkType(id);
            if (!model) { continue; }
            model.setLabel(label.values);
        }
    }

    fetchPropertyType(propertyType: RichProperty): void {
        if (!this.dataProvider.propertyInfo) { return; }
        this.propertyTypeQueue.push(propertyType.id);
    }

    private onPropertyTypesLoaded = (propertyModels: { [propertyId: string]: PropertyModel | undefined }) => {
        for (const propId in propertyModels) {
            if (!Object.prototype.hasOwnProperty.call(propertyModels, propId)) { continue; }
            const propertyModel = propertyModels[propId];
            if (!propertyModel) { continue; }
            const {id, label} = propertyModel;
            const targetProperty = this.graph.getProperty(id);
            if (targetProperty) {
                targetProperty.setLabel(label.values);
            }
        }
    }
}
