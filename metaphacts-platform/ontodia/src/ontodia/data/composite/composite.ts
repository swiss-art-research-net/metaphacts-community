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
import { DataProvider, LinkElementsParams, FilterParams } from '../provider';
import {
    Dictionary, ClassModel, LinkTypeModel, ElementModel, LinkModel, LinkCount, PropertyModel,
    ElementIri, ElementTypeIri, LinkTypeIri, PropertyTypeIri,
} from '../model';
import { Rdf } from '../rdf';
import {
    CompositeResponse,
    mergeClassTree,
    mergePropertyInfo,
    mergeClassInfo,
    mergeLinkTypesInfo,
    mergeLinkTypes,
    mergeElementInfo,
    mergeLinksInfo,
    mergeLinkTypesOf,
    mergeLinkElements,
    mergeFilter,
} from './mergeUtils';

export interface DPDefinition {
    name: string;
    dataProvider: DataProvider;
    useInStats?: boolean;
}

function isDefinition(dp: DataProvider | DPDefinition): dp is DPDefinition {
    const definition = dp as Partial<DPDefinition>;
    return definition.name !== undefined && definition.dataProvider !== undefined;
}

export type MergeMode = 'fetchAll' | 'sequentialFetching';

export class CompositeDataProvider implements DataProvider {
    readonly factory: Rdf.DataFactory;
    dataProviders: DPDefinition[];
    mergeMode: MergeMode = 'fetchAll';

    constructor(
        dataProviders: (DataProvider | DPDefinition)[],
        params: {
            factory?: Rdf.DataFactory;
            mergeMode?: MergeMode;
        } = {}
    ) {
        let dpCounter = 1;
        this.dataProviders = dataProviders.map(dp => {
            if (isDefinition(dp)) {
                return dp;
            } else {
                return {
                    name: 'dataProvider_' + dpCounter++,
                    dataProvider: dp,
                };
            }
        });

        this.factory = params.factory ?? Rdf.OntodiaDataFactory;
        if (params.mergeMode) {
            this.mergeMode = params.mergeMode;
        }
    }

    classTree(): Promise<ClassModel[]> {
        return this.fetchSequentially('classTree', mergeClassTree, undefined);
    }

    propertyInfo(params: { propertyIds: PropertyTypeIri[] }): Promise<Dictionary<PropertyModel>> {
        if (this.mergeMode === 'fetchAll') {
            return this.fetchSequentially('propertyInfo', mergePropertyInfo, params);
        } else {
            let propertyIds = params.propertyIds;
            return this.queueProcessResults((previousResult: Dictionary<PropertyModel>, dp: DPDefinition) => {
                propertyIds = propertyIds.filter(id => !previousResult || !previousResult[id]);
                if (dp.dataProvider.propertyInfo && propertyIds.length > 0) {
                    return dp.dataProvider.propertyInfo({propertyIds});
                } else {
                    return undefined;
                }
            }).then(mergePropertyInfo);
        }
    }

    classInfo(params: { classIds: ElementTypeIri[] }): Promise<ClassModel[]> {
        if (this.mergeMode === 'fetchAll') {
            return this.fetchSequentially('classInfo', mergeClassInfo, params);
        } else {
            let classIds = params.classIds;
            return this.queueProcessResults((previousResult: ClassModel[], dp: DPDefinition) => {
                classIds = classIds.filter(id => !previousResult || previousResult.map(cm => cm.id).indexOf(id) === -1);
                return classIds.length > 0 ? dp.dataProvider.classInfo({ classIds: classIds }) : undefined;
            }).then(mergeClassInfo);
        }
    }

    linkTypesInfo(params: { linkTypeIds: LinkTypeIri[] }): Promise<LinkTypeModel[]> {
        if (this.mergeMode === 'fetchAll') {
            return this.fetchSequentially('linkTypesInfo', mergeLinkTypesInfo, params);
        } else {
            let linkTypeIds = params.linkTypeIds;
            return this.queueProcessResults((previousResult: LinkTypeModel[], dp: DPDefinition) => {
                linkTypeIds = linkTypeIds.filter(id =>
                    !previousResult || previousResult.map(lt => lt.id).indexOf(id) === -1);
                return linkTypeIds.length > 0 ? dp.dataProvider.linkTypesInfo({ linkTypeIds: linkTypeIds }) : undefined;
            }).then(mergeLinkTypesInfo);
        }
    }

    linkTypes(): Promise<LinkTypeModel[]> {
        return this.fetchSequentially('linkTypes', mergeLinkTypes, undefined);
    }

    elementInfo(params: { elementIds: ElementIri[] }): Promise<Dictionary<ElementModel>> {
        if (this.mergeMode === 'fetchAll') {
            return this.fetchSequentially('elementInfo', mergeElementInfo, params);
        } else {
            let elementIds = params.elementIds;
            return this.queueProcessResults((previousResult: Dictionary<ElementModel>, dp: DPDefinition) => {
                elementIds = elementIds.filter(id => !previousResult || !previousResult[id]);
                return elementIds.length > 0 ? dp.dataProvider.elementInfo({ elementIds: elementIds }) : undefined;
            }).then(response => mergeElementInfo(response, this.factory));
        }
    }

    linksInfo(params: {
        elementIds: ElementIri[];
        linkTypeIds?: LinkTypeIri[];
    }): Promise<LinkModel[]> {
        if (this.mergeMode === 'fetchAll') {
            return this.fetchSequentially('linksInfo', mergeLinksInfo, params);
        } else {
            let elementIds = params.elementIds;
            return this.queueProcessResults((previousResult: LinkModel[], dp: DPDefinition) => {
                elementIds = elementIds.filter(id => {
                    if (previousResult) {
                        for (const linkModel of previousResult) {
                            if (linkModel.sourceId === id) { return false; }
                        }
                    }
                    return true;
                });
                return elementIds.length > 0 ?
                    dp.dataProvider.linksInfo({ elementIds: elementIds, linkTypeIds: params.linkTypeIds }) : undefined;
            }).then(mergeLinksInfo);
        }
    }

    linkTypesOf(params: { elementId: ElementIri }): Promise<LinkCount[]> {
        if (this.mergeMode === 'fetchAll') {
            return this.fetchSequentially('linkTypesOf', mergeLinkTypesOf, params);
        } else {
            return this.queueProcessResults((previousResult: LinkCount[], dp: DPDefinition) => {
                if (!previousResult || previousResult && previousResult.length === 0) {
                    return dp.dataProvider.linkTypesOf(params);
                } else {
                    return undefined;
                }
            }).then(mergeLinkTypesOf);
        }
    }

    linkElements(params: LinkElementsParams): Promise<Dictionary<ElementModel>> {
        if (this.mergeMode === 'fetchAll') {
            return this.fetchSequentially('linkElements', mergeLinkElements, params);
        } else {
            return this.queueProcessResults((previousResult: Dictionary<ElementModel>, dp: DPDefinition) => {
                if (!previousResult || previousResult && Object.keys(previousResult).length === 0) {
                    return dp.dataProvider.linkElements(params);
                } else {
                    return undefined;
                }
            }).then(response  => mergeLinkElements(response, this.factory));
        }
    }

    filter(params: FilterParams): Promise<Dictionary<ElementModel>> {
        if (this.mergeMode === 'fetchAll') {
            return this.fetchSequentially('filter', mergeFilter, params);
        } else {
            return this.queueProcessResults((previousResult: Dictionary<ElementModel>, dp: DPDefinition) => {
                if (!previousResult || previousResult && Object.keys(previousResult).length === 0) {
                    return dp.dataProvider.filter(params);
                } else {
                    return undefined;
                }
            }).then(response => mergeFilter(response, this.factory));
        }
    }

    private processResults<ResponseType>(
        responsePromise: Promise<ResponseType>,
        dpName: string,
        useProviderInStats?: boolean,
    ): Promise<CompositeResponse<ResponseType | undefined>> {
        return responsePromise
            .then((response): CompositeResponse<ResponseType | undefined> => (
                {dataSourceName: dpName, useInStats: useProviderInStats, response: response}
            ))
            .catch((error): CompositeResponse<ResponseType | undefined> => {
                // tslint:disable-next-line:no-console
                console.error(error);
                return {dataSourceName: dpName, useInStats: useProviderInStats, response: undefined};
            });
    }

    private queueProcessResults<ResponseType>(
        callBack: (previousResult: ResponseType, dp: DPDefinition) => Promise<ResponseType> | undefined,
    ): Promise<CompositeResponse<ResponseType>[]> {
        let counter = 0;
        const responseList: CompositeResponse<ResponseType>[] = [];

        const recursiveCall = (result?: ResponseType): Promise<CompositeResponse<ResponseType>[]> => {
            if (this.dataProviders.length > counter) {
                const dp = this.dataProviders[counter++];
                const callBackResult = callBack(result!, dp);

                if (!callBackResult) { return Promise.resolve(responseList); }
                return callBackResult.then(newResult => {
                    responseList.push({
                        dataSourceName: dp.name,
                        response: newResult,
                    });
                    return recursiveCall(newResult);
                }).catch(error => {
                    // tslint:disable-next-line:no-console
                    console.error(error);
                    return recursiveCall(result);
                });
            } else {
                return Promise.resolve(responseList);
            }
        };
        return recursiveCall();
    }

    private fetchSequentially<K extends keyof DataProvider>(
        functionName: K,
        mergeFunction: (
            response: CompositeResponse<OperationResult<K>>[],
            factory: Rdf.DataFactory
        ) => OperationResult<K>,
        params: OperationParams<K>,
    ) {
        const resultPromises = this.dataProviders.map((dp: DPDefinition) => {
            const providerMethod = dp.dataProvider[functionName] as unknown as
                (this: DataProvider, params: OperationParams<K>) => Promise<OperationResult<K>>;
            return this.processResults(providerMethod.call(dp.dataProvider, params), dp.name, dp.useInStats);
        });
        return Promise.all(resultPromises).then(results => {
            const nonEmptyResponses = results.filter(
                (r): r is CompositeResponse<OperationResult<K>> => r.response !== undefined
            );
            return mergeFunction(nonEmptyResponses, this.factory);
        });
    }
}

type OperationParams<K extends keyof DataProvider> =
    NonNullable<DataProvider[K]> extends (params: infer P) => any ? P : never;
type OperationResult<K extends keyof DataProvider> =
    NonNullable<DataProvider[K]> extends (...args: any[]) => Promise<infer R> ? R : never;
