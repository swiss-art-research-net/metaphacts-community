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
import * as Rdf from '../rdf/rdfModel';
import {
    Dictionary, ClassModel, LinkTypeModel, ElementModel, LinkModel, LinkCount, Property, PropertyModel,
    LinkedElement, ElementIri, hashLink, sameLink,
} from '../model';
import { objectValues } from '../../viewUtils/collections';
import { HashSet } from '../../viewUtils/hashMap';

export interface CompositeResponse<Type> {
    dataSourceName: string;
    useInStats?: boolean;
    response: Type;
}

export function mergeClassTree(composite: CompositeResponse<ClassModel[]>[]): ClassModel[] {
    const lists = composite.filter(r => r.response).map(({useInStats, response}) =>
        ({useInStats, classes: classTreeToArray(response)})
    );
    const dictionary: Dictionary<ClassModel> = {};
    const topLevelModels: Dictionary<ClassModel> = {};
    const childrenMap: Dictionary<string[]> = {};

    for (const {useInStats, classes} of lists) {
        for (const model of classes) {
            const childrenIds: string[] = childrenMap[model.id] || [];
            model.children.map(ch => ch.id).forEach(id => {
                if (childrenIds.indexOf(id) === -1) {
                    childrenIds.push(id);
                }
            });
            model.children = [];

            if (!useInStats) {
                delete model.count;
            }

            if (!dictionary[model.id]) {
                topLevelModels[model.id] = model;
                dictionary[model.id] = model;
                childrenMap[model.id] = childrenIds;
            } else {
                topLevelModels[model.id] = mergeClassModel(dictionary[model.id]!, model);
                dictionary[model.id] = topLevelModels[model.id];
            }
        }
    }

    const models = objectValues(dictionary);
    for (const m of models) {
        m.children = (childrenMap[m.id] || []).map(id => {
            delete topLevelModels[id];
            return dictionary[id]!;
        });
    }

    return objectValues(topLevelModels);
}

export function mergePropertyInfo(
    response: CompositeResponse<Dictionary<PropertyModel>>[],
): Dictionary<PropertyModel> {
    const result: Dictionary<PropertyModel> = {};
    const props = response.filter(r => r.response).map(r => r.response);
    for (const model of props) {
        const keys = Object.keys(model);
        for (const key of keys) {
            const prop = model[key]!;
            if (!result[key]) {
                result[key] = prop;
            } else {
                result[key]!.label = mergeLabels(result[key]!.label, prop.label);
            }
        }
    }
    return result;
}

export function mergeClassInfo(response: CompositeResponse<ClassModel[]>[]): ClassModel[] {
    const dictionaries = response.filter(r => r.response).map(r => r.response);
    const dictionary: Dictionary<ClassModel> = {};

    for (const models of dictionaries) {
        for (const model of models) {
            if (!dictionary[model.id]) {
                dictionary[model.id] = model;
            } else {
                dictionary[model.id] = mergeClassModel(dictionary[model.id]!, model);
            }
        }
    }
    return objectValues(dictionary);
}

export function mergeLinkTypesInfo(response: CompositeResponse<LinkTypeModel[]>[]): LinkTypeModel[] {
    const lists = response.filter(r => r.response).map(r => r.response);

    const mergeLinkType = (a: LinkTypeModel, b: LinkTypeModel): LinkTypeModel => {
        return {
            id: a.id,
            label: mergeLabels(a.label, b.label),
            count: (a.count || 0) + (b.count || 0),
        };
    };

    const dictionary: Dictionary<LinkTypeModel> = {};

    for (const linkTypes of lists) {
        for (const linkType of linkTypes) {
            if (!dictionary[linkType.id]) {
                dictionary[linkType.id] = linkType;
            } else {
                dictionary[linkType.id] = mergeLinkType(dictionary[linkType.id]!, linkType);
            }
        }
    }
    return objectValues(dictionary);
}

export function mergeLinkTypes(response: CompositeResponse<LinkTypeModel[]>[]): LinkTypeModel[] {
    return mergeLinkTypesInfo(response);
}

export function mergeElementInfo(
    response: CompositeResponse<Dictionary<ElementModel>>[]
): Dictionary<ElementModel> {
    const dictionary: Dictionary<ElementModel> = {};

    for (const resp of response) {
        const list = objectValues(resp.response);

        for (const em of list) {
            if (!em.sources) {
                em.sources = [resp.dataSourceName];
            }
            if (!dictionary[em.id]) {
                dictionary[em.id] = em;
            } else {
                dictionary[em.id] = mergeElementModels(dictionary[em.id]!, em);
            }
        }
    }
    return dictionary;
}

function mergeElementModels(a: ElementModel, b: ElementModel): ElementModel {
    const types = a.types;
    for (const t of b.types) {
        if (types.indexOf(t) === -1) {
            types.push(t);
        }
    }
    const sources: string[] = [];
    if (a.sources) {
        for (const s of a.sources) {
            if (sources.indexOf(s) === -1) {
                sources.push(s);
            }
        }
    }
    if (b.sources) {
        for (const s of b.sources) {
            if (sources.indexOf(s) === -1) {
                sources.push(s);
            }
        }
    }
    return {
        id: a.id,
        label: mergeLabels(a.label, b.label),
        types: types,
        image: a.image || b.image,
        properties: mergeProperties(a.properties, b.properties),
        sources: sources,
    };
}

export function mergeProperties(a: Dictionary<Property>, b: Dictionary<Property>): Dictionary<Property> {
    const result: Dictionary<Property> = {...a};

    for (const propertyIri in b) {
        if (!Object.prototype.hasOwnProperty.call(b, propertyIri)) { continue; }

        if (Object.prototype.hasOwnProperty.call(result, propertyIri)) {
            const set = new HashSet(Rdf.hashTerm, Rdf.equalTerms);
            const values: Array<Rdf.NamedNode | Rdf.Literal> = [];
            const aProperty = a[propertyIri];
            if (aProperty) {
                for (const aValue of aProperty.values) {
                    if (!set.has(aValue)) {
                        set.add(aValue);
                        values.push(aValue);
                    }
                }
            }
            const bProperty = b[propertyIri];
            if (bProperty) {
                for (const bValue of bProperty.values) {
                    if (!set.has(bValue)) {
                        set.add(bValue);
                        values.push(bValue);
                    }
                }
            }
            if (values.length > 0) {
                result[propertyIri] = {values};
            }
        } else {
            result[propertyIri] = b[propertyIri];
        }
    }

    return result;
}

export function mergeLinksInfo(response: CompositeResponse<LinkModel[]>[]): LinkModel[] {
    const linkSet = new HashSet(hashLink, sameLink);
    const resultInfo: LinkModel[] = [];

    for (const info of response) {
        if (!info.response) { continue; }
        for (const linkModel of info.response) {
            if (linkSet.has(linkModel)) { continue; }
            linkSet.add(linkModel);
            resultInfo.push(linkModel);
        }
    }

    return resultInfo;
}

export function mergeLinkTypesOf(response: CompositeResponse<LinkCount[]>[]): LinkCount[] {
    const lists = response.filter(r => r.response).map(r => r.response);
    const dictionary: Dictionary<LinkCount> = {};

    const merge = (a: LinkCount, b: LinkCount): LinkCount => {
        return {
            id: a.id,
            inCount: a.inCount + b.inCount,
            outCount: a.outCount + b.outCount,
        };
    };

    for (const linkCount of lists) {
        for (const lCount of linkCount) {
            if (!dictionary[lCount.id]) {
                dictionary[lCount.id] = lCount;
            } else {
                dictionary[lCount.id] = merge(lCount, dictionary[lCount.id]!);
            }
        }
    }
    return objectValues(dictionary);
}

export function mergeFilter(
    responses: CompositeResponse<LinkedElement[]>[]
): LinkedElement[] {
    const elementIris: ElementIri[] = [];
    const index = new Map<ElementIri, LinkedElement>();
    for (const response of responses) {
        for (const item of response.response) {
            if (!item.element.sources) {
                item.element.sources = [response.dataSourceName];
            }
            let indexedItem = index.get(item.element.id);
            if (indexedItem) {
                const mergedItem = mergeLinkedElements(indexedItem, item);
                index.set(item.element.id, mergedItem);
            } else {
                indexedItem = item;
                elementIris.push(item.element.id);
                index.set(item.element.id, item);
            }
        }
    }
    const result: LinkedElement[] = [];
    for (const elementIri of elementIris) {
        const item = index.get(elementIri);
        if (item) {
            result.push(item);
        }
    }
    return result;
}

function mergeLinkedElements(a: LinkedElement, b: LinkedElement): LinkedElement {
    const element = mergeElementModels(a.element, b.element);

    const inLinks = [...a.inLinks];
    for (const link of b.inLinks) {
        if (inLinks.indexOf(link) < 0) {
            inLinks.push(link);
        }
    }

    const outLinks = [...a.outLinks];
    for (const link of b.outLinks) {
        if (outLinks.indexOf(link) < 0) {
            outLinks.push(link);
        }
    }

    return {element, inLinks, outLinks};
}

export function classTreeToArray(models: ClassModel[]): ClassModel[] {
    let resultArray: ClassModel[] = models;

    function getDescendants(model: ClassModel): ClassModel[] {
        let descendants = model.children || [];
        for (const descendant of descendants) {
            const nextGeneration = getDescendants(descendant);
            descendants = descendants.concat(nextGeneration);
        }
        return descendants;
    }

    for (const model of models) {
        const descendants = getDescendants(model);
        resultArray = resultArray.concat(descendants);
    }

    return resultArray;
}

export function mergeLabels(
    a: { values: Rdf.Literal[] },
    b: { values: Rdf.Literal[] },
): { values: Rdf.Literal[] } {
    const set = new HashSet(Rdf.hashTerm, Rdf.equalTerms);
    const merged: Rdf.Literal[] = [];

    for (const label of a.values) {
        if (set.has(label)) { continue; }
        set.add(label);
        merged.push(label);
    }

    for (const label of b.values) {
        if (set.has(label)) { continue; }
        set.add(label);
        merged.push(label);
    }

    return {values: merged};
}

export function mergeCounts(a?: number, b?: number): number | undefined {
    if (a === undefined && b === undefined) { return undefined; }

    return (a || 0) + (b || 0);
}

export function mergeClassModel(a: ClassModel, b: ClassModel): ClassModel {
    const childrenDictionary: Dictionary<ClassModel> = {};
    for (const child of a.children.concat(b.children)) {
        if (!childrenDictionary[child.id]) {
            childrenDictionary[child.id] = child;
        }
    }

    return {
        id: a.id,
        label: mergeLabels(a.label, b.label),
        count: mergeCounts(a.count, b.count),
        children: objectValues(childrenDictionary),
    };
}
