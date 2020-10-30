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
import {
    Dictionary, ClassModel, LinkTypeModel, ElementModel, LinkModel, LinkCount, PropertyModel,
    ElementIri, ElementTypeIri, LinkTypeIri, PropertyTypeIri,
} from './model';
import * as Rdf from './rdf/rdfModel';

/**
 * DataProvider is responsible for getting data into Ontodia
 *
 * It has three parts:
 *  - Schema extraction - classTree(), linkTypes()
 *  - On-demand schema extraction - classInfo(), propertyInfo(), linkTypeInfo()
 *  - elements and links extraction - elementsInfo() and linksInfo()
 *  - navigation - linkTypesOf(), linkElements()
 *  - filtering - filter
 *
 *  Schema extraction is executed on initialization and used to display class tree.
 *
 *  On-demand schema extraction occurs when element with yet unknown type or link type appears any part of Ontodia.
 *
 *  Elements and links extraction is executed when new element is placed on the diagram or diagram is restored from
 *  saved state to get all the data for it
 *
 *  Navigation functions are called when user brings up navigation menu to display available links
 *  and places chosen elements on the diagram.
 *
 *  When possible, Ontodia will group requests into batches to reduce round-trips and this will reduce calls to
 *  data provider.
 *
 */
export interface DataProvider {
    /** RDF/JS data factory to create IRI, Literal and other terms. */
    readonly factory: Rdf.DataFactory;

    /** should return start-up class tree. In case of huge class tree some limits should be imposed.
     * It can contain count of instances for each class if it's possible to get it from source.
     */
    classTree(): Promise<ClassModel[]>;
    /*
     initial fetching of link types along with statistics.
     Since this list is not much use in UI, this method is subject to be removed.
      */
    linkTypes(): Promise<LinkTypeModel[]>;

    /**
     * Class information
     */
    classInfo(params: {
        classIds: ElementTypeIri[];
    }): Promise<ClassModel[]>;

    /**
     * Data properties information
     */
    propertyInfo?(params: { propertyIds: PropertyTypeIri[] }): Promise<Dictionary<PropertyModel>>;

    /**
     * Link type information.
     */
    linkTypesInfo(params: {
        linkTypeIds: LinkTypeIri[];
    }): Promise<LinkTypeModel[]>;

    /**
     * Getting the elements from the data source on diagram initialization and on navigation events
     */
    elementInfo(params: { elementIds: ElementIri[] }): Promise<Dictionary<ElementModel>>;

    /**
     * Returns all links between specified elements.
     */
    linksInfo(params: {
        elementIds: ElementIri[];
        /** Hint to limit returned links to only those link types, may be ignored by provider. */
        linkTypeIds?: LinkTypeIri[];
    }): Promise<LinkModel[]>;

    /**
     * Get link types of element to build navigation menu
     */
    linkTypesOf(params: { elementId: ElementIri }): Promise<LinkCount[]>;

    /**
     * returns elements following link for specified element.
     * Has overlapping functionality with filter, but easier less powerful and easier to implement
     * linkId could be null, if it's the case method should return all elements from all links from current element.
     */
    linkElements(params: LinkElementsParams): Promise<Dictionary<ElementModel>>;

    /**
     * Supports filter functionality with different filters - by type,
     * by element and it's connection, by full-text search.
     * Implementation should implement all possible combinations.
     */
    filter(params: FilterParams): Promise<Dictionary<ElementModel>>;
}

export interface LinkElementsParams {
    elementId: ElementIri;
    linkId?: LinkTypeIri;
    limit?: number;
    offset: number;
    direction?: 'in' | 'out';
}

export interface FilterParams {
    /**
     * element type filter
     */
    elementTypeId?: ElementTypeIri;
    /**
     * text search
     */
    text?: string;

    /**
     * Reference element id to limit elements accessible through links from this elements only.
     * Could be used with refElementLinkId to limit link types which to follow.
     */
    refElementId?: ElementIri;

    /**
     * Reference element link type id. Is used only when refElementId is set.
     */
    refElementLinkId?: LinkTypeIri;

    /**
     * Reference element link type direction ('in' | 'out'). Is used only when refElementLinkId is set.
     */
    linkDirection?: 'in' | 'out';

    /**
     * Limit number of elements returned. Defaults depend on data provider implementation
     */
    limit?: number;

    /**
     * Offset within matched data set to use
     */
    offset: number;

    /**
     * Right now this is unused in sparql data provider.
     * It was introduced to order results by particular language when doing substring match with regexps.
     * It's subject to be removed.
     */
    languageCode: string;
}
