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
    Dictionary, ElementModel, LinkModel, LinkTypeModel,
    ElementIri, LinkTypeIri, ElementTypeIri, PropertyTypeIri,
} from '../data/model';
import { DataProvider } from '../data/provider';
import { Rdf } from '../data/rdf';
import { PLACEHOLDER_LINK_TYPE } from '../data/schema';

import { Element, LinkType, RichClass, RichProperty, LinkTypeEvents, Link } from '../diagram/elements';
import { CommandHistory, Command } from '../diagram/history';
import { DiagramModel, DiagramModelEvents, placeholderDataFromIri } from '../diagram/model';

import { EventSource, Events, Listener } from '../viewUtils/events';

import { DataFetcher } from './dataFetcher';
import {
    SerializedDiagram, LayoutData, LinkTypeOptions,
    makeSerializedDiagram, makeLayoutData, emptyDiagram, emptyLayoutData
} from './serializedDiagram';

export interface GroupBy {
    linkType: string;
    linkDirection: 'in' | 'out';
}

export interface AsyncModelEvents extends DiagramModelEvents {
    loadingStart: { source: AsyncModel };
    loadingSuccess: { source: AsyncModel };
    loadingError: {
        source: AsyncModel;
        error: any;
    };
    createLoadedLink: {
        source: AsyncModel;
        model: LinkModel;
        setLink(mappedLink: LinkModel | null): void;
    };
}

export class AsyncModel extends DiagramModel {
    declare readonly events: Events<AsyncModelEvents>;

    private _dataProvider!: DataProvider;
    private fetcher: DataFetcher | undefined;

    private linkSettings: { [linkTypeId: string]: LinkTypeOptions } = {};

    constructor(
        factory: Rdf.DataFactory,
        history: CommandHistory,
        private groupByProperties: ReadonlyArray<GroupBy>,
    ) {
        super(factory, history);
    }

    private get asyncSource(): EventSource<AsyncModelEvents> {
        return this.source as EventSource<any>;
    }

    get dataProvider() { return this._dataProvider; }

    private setDataProvider(dataProvider: DataProvider) {
        this._dataProvider = dataProvider;
        this.fetcher = new DataFetcher(this.graph, dataProvider);
    }

    createNewDiagram(dataProvider: DataProvider): Promise<void> {
        this.resetGraph();
        this.setDataProvider(dataProvider);
        this.asyncSource.trigger('loadingStart', {source: this});

        return this.dataProvider.linkTypes().then((linkTypes: LinkTypeModel[]) => {
            const allLinkTypes = this.initLinkTypes(linkTypes);
            return this.loadAndRenderLayout({
                allLinkTypes,
                markLinksAsLayoutOnly: false,
            });
        }).catch(error => {
            // tslint:disable-next-line:no-console
            console.error(error);
            this.asyncSource.trigger('loadingError', {source: this, error});
            return Promise.reject(error);
        });
    }

    importLayout(params: {
        dataProvider: DataProvider;
        preloadedElements?: Dictionary<ElementModel>;
        validateLinks?: boolean | 'dismiss';
        diagram?: Partial<SerializedDiagram>;
        hideUnusedLinkTypes?: boolean;
    }): Promise<void> {
        this.resetGraph();
        this.setDataProvider(params.dataProvider);
        this.asyncSource.trigger('loadingStart', {source: this});

        return this.dataProvider.linkTypes().then(linkTypes => {
            const allLinkTypes = this.initLinkTypes(linkTypes);
            const diagram = params.diagram ? params.diagram : emptyDiagram();
            if (diagram.linkTypeOptions) {
                this.setLinkSettings(diagram.linkTypeOptions);
            }
            const loadingModels = this.loadAndRenderLayout({
                layoutData: diagram.layoutData,
                preloadedElements: params.preloadedElements || {},
                markLinksAsLayoutOnly: Boolean(params.validateLinks),
                allLinkTypes,
                hideUnusedLinkTypes: params.hideUnusedLinkTypes,
            });
            const requestingLinks = params.validateLinks
                ? this.requestLinksOfType() : Promise.resolve();
            return Promise.all([loadingModels, requestingLinks]);
        }).then(() => {
            if (params.validateLinks === 'dismiss') {
                this.removeLayoutOnlyLinks();
            }
            this.history.reset();
            this.asyncSource.trigger('loadingSuccess', {source: this});
        }).catch(error => {
            // tslint:disable-next-line:no-console
            console.error(error);
            this.asyncSource.trigger('loadingError', {source: this, error});
            return Promise.reject(error);
        });
    }

    exportLayout(): SerializedDiagram {
        const layoutData = makeLayoutData(this.graph.getElements(), this.graph.getLinks());
        const linkTypeOptions = this.graph.getLinkTypes()
            // do not serialize default link type options
            .filter(linkType =>
                !(linkType.visible && linkType.showLabel) &&
                linkType.id !== PLACEHOLDER_LINK_TYPE
            )
            .map(({id, visible, showLabel}): LinkTypeOptions =>
                ({'@type': 'LinkTypeOptions', property: id, visible, showLabel})
            );
        return makeSerializedDiagram({layoutData, linkTypeOptions});
    }

    private initLinkTypes(linkTypes: LinkTypeModel[]): LinkType[] {
        const types: LinkType[] = [];
        for (const {id, label} of linkTypes) {
            const linkType = new LinkType({id, label: label.values});
            this.graph.addLinkType(linkType);
            types.push(linkType);
        }
        return types;
    }

    private setLinkSettings(settings: ReadonlyArray<LinkTypeOptions>) {
        for (const setting of settings) {
            const {visible = true, showLabel = true} = setting;
            const linkTypeId = setting.property as LinkTypeIri;
            this.linkSettings[linkTypeId] = {'@type': 'LinkTypeOptions', property: linkTypeId, visible, showLabel};
            const linkType = this.getLinkType(linkTypeId);
            if (linkType) {
                linkType.setVisibility({visible, showLabel});
            }
        }
    }

    private loadAndRenderLayout(params: {
        layoutData?: LayoutData;
        preloadedElements?: Dictionary<ElementModel>;
        markLinksAsLayoutOnly: boolean;
        allLinkTypes: ReadonlyArray<LinkType>;
        hideUnusedLinkTypes?: boolean;
    }) {
        const {
            layoutData = emptyLayoutData(),
            preloadedElements = {},
            markLinksAsLayoutOnly,
            hideUnusedLinkTypes,
        } = params;

        const elementIrisToRequestData: ElementIri[] = [];
        const usedLinkTypes: { [typeId: string]: LinkType } = {};

        for (const layoutElement of layoutData.elements) {
            const {'@id': id, iri, position, isExpanded, group, elementState} = layoutElement;
            const template = preloadedElements[iri];
            const data = template || placeholderDataFromIri(iri, this.factory);
            const element = new Element({id, data, position, expanded: isExpanded, group, elementState});
            this.graph.addElement(element);
            if (!template) {
                elementIrisToRequestData.push(element.iri);
            }
        }

        for (const layoutLink of layoutData.links) {
            const {'@id': id, iri, property, source, target, vertices, linkState} = layoutLink;
            const linkType = this.createLinkType(property);
            usedLinkTypes[linkType.id] = linkType;
            const sourceElement = this.getElement(source['@id']);
            const targetElement = this.getElement(target['@id']);
            if (!(sourceElement && targetElement)) { continue; }
            const link = this.createLink({
                id,
                sourceId: sourceElement.id,
                targetId: targetElement.id,
                data: {
                    linkTypeId: linkType.id,
                    sourceId: sourceElement.iri,
                    targetId: targetElement.iri,
                    linkIri: iri,
                    properties: {},
                },
                vertices,
                linkState,
            });
            if (link) {
                link.setLayoutOnly(markLinksAsLayoutOnly);
            }
        }

        this.subscribeGraph();
        const requestingModels = this.requestElementData(elementIrisToRequestData);

        if (hideUnusedLinkTypes && params.allLinkTypes) {
            this.hideUnusedLinkTypes(params.allLinkTypes, usedLinkTypes);
        }

        return requestingModels;
    }

    private removeLayoutOnlyLinks() {
        for (const link of [...this.links]) {
            if (link.layoutOnly) {
                this.removeLink(link.id);
            }
        }
    }

    private hideUnusedLinkTypes(
        allTypes: ReadonlyArray<LinkType>,
        usedTypes: { [typeId: string]: LinkType }
    ) {
        for (const linkType of allTypes) {
            if (!usedTypes[linkType.id]) {
                linkType.setVisibility({
                    visible: false,
                    showLabel: linkType.showLabel,
                });
            }
        }
    }

    requestElementData(elementIris: ReadonlyArray<ElementIri>): Promise<void> {
        return this.fetcher!.fetchElementData(elementIris);
    }

    requestLinksOfType(linkTypeIds?: LinkTypeIri[]): Promise<void> {
        return this.dataProvider.linksInfo({
            elementIds: this.graph.getElements().map(element => element.iri),
            linkTypeIds,
        }).then(links => this.onLinkInfoLoaded(links));
    }

    createClass(classId: ElementTypeIri): RichClass {
        if (this.graph.getClass(classId)) {
            return super.getClass(classId)!;
        }
        const classModel = super.createClass(classId);
        if (this.fetcher) {
            this.fetcher.fetchClass(classModel);
        }
        return classModel;
    }

    createLinkType(linkTypeId: LinkTypeIri): LinkType {
        if (this.graph.getLinkType(linkTypeId)) {
            return super.createLinkType(linkTypeId);
        }
        const linkType = super.createLinkType(linkTypeId);
        const setting = this.linkSettings[linkType.id];
        if (setting) {
            const {visible, showLabel = true} = setting;
            linkType.setVisibility({visible, showLabel});
        }
        if (this.fetcher) {
            this.fetcher.fetchLinkType(linkType);
        }
        return linkType;
    }

    createProperty(propertyIri: PropertyTypeIri): RichProperty {
        if (this.graph.getProperty(propertyIri)) {
            return super.createProperty(propertyIri);
        }
        const property = super.createProperty(propertyIri);
        if (this.fetcher) {
            this.fetcher.fetchPropertyType(property);
        }
        return property;
    }

    private onLinkInfoLoaded(links: LinkModel[]) {
        let mappedLink: LinkModel | null = null;
        const setLink = (link: LinkModel | null) => {
            mappedLink = link;
        };
        for (const linkModel of links) {
            this.createLinkType(linkModel.linkTypeId);
            mappedLink = linkModel;
            this.asyncSource.trigger('createLoadedLink', {source: this, model: linkModel, setLink});
            if (mappedLink) {
                this.createLinks(mappedLink);
            }
        }
    }

    createLinks(data: LinkModel) {
        const sources = this.graph.getElements().filter(el => el.iri === data.sourceId);
        const targets = this.graph.getElements().filter(el => el.iri === data.targetId);
        for (const source of sources) {
            for (const target of targets) {
                this.createLink({sourceId: source.id, targetId: target.id, data});
            }
        }
    }

    loadEmbeddedElements(elementIri: ElementIri): Promise<Dictionary<ElementModel>> {
        const elements = this.groupByProperties.map(groupBy =>
            this.dataProvider.filter({
                refElementId: elementIri,
                refElementLinkId: groupBy.linkType as LinkTypeIri,
                linkDirection: groupBy.linkDirection,
            })
        );
        return Promise.all(elements).then(res => {
            const models: Dictionary<ElementModel> = {};
            for (const items of res) {
                for (const {element} of items) {
                    models[element.id] = element;
                }
            }
            return models;
        });
    }
}

export function requestElementData(model: AsyncModel, elementIris: ReadonlyArray<ElementIri>): Command {
    return Command.effect('Fetch element data', () => {
        model.requestElementData(elementIris);
    });
}

export function restoreLinksBetweenElements(model: AsyncModel): Command {
    return Command.effect('Restore links between elements', () => {
        model.requestLinksOfType();
    });
}
