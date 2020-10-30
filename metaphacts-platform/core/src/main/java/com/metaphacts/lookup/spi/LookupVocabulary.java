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
package com.metaphacts.lookup.spi;

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;

import com.metaphacts.lookup.api.LookupService;

/**
 * Vocabulary for {@link LookupService} and related classes.
 * 
 * @author Wolfgang Schell <ws@metaphacts.com>
 */
public interface LookupVocabulary {
    static final ValueFactory VF = SimpleValueFactory.getInstance();
    
    /**
     * Namespace for the common configuration properties of lookup services.
     */
    public static final String LOOKUP_NAMESPACE = "http://www.metaphacts.com/ontologies/platform/repository/lookup#";
    
    public static final IRI LOOKUP_TYPE = VF.createIRI(LOOKUP_NAMESPACE, "type");
    public static final String LOOKUP_TYPE_NONE = "none";
    
    
    public static final IRI LOOKUP_CONFIGURATION = VF.createIRI(LOOKUP_NAMESPACE, "configuration");
    
    public static final IRI LOOKUP_TARGETREPOSITORY = VF.createIRI(LOOKUP_NAMESPACE, "targetRepository");
    public static final IRI LOOKUP_QUERY_ENTITYTYPES = VF.createIRI(LOOKUP_NAMESPACE, "entityTypesQuery");
    public static final IRI LOOKUP_QUERY_DATASET = VF.createIRI(LOOKUP_NAMESPACE, "datasetQuery");
    public static final IRI LOOKUP_DATASET_NAME = VF.createIRI(LOOKUP_NAMESPACE, "datasetName");
    public static final IRI LOOKUP_DATASET_ID = VF.createIRI(LOOKUP_NAMESPACE, "datasetId");
    public static final IRI LOOKUP_CACHE_CONFIG = VF.createIRI(LOOKUP_NAMESPACE, "cacheConfig");
    public static final IRI LOOKUP_QUERY_TEMPLATE = VF.createIRI(LOOKUP_NAMESPACE, "queryTemplate");
    public static final IRI LOOKUP_QUERY_SEARCHBLOCKTEMPLATE = VF.createIRI(LOOKUP_NAMESPACE, "searchBlockTemplate");
    public static final IRI LOOKUP_QUERY_TYPEBLOCKTEMPLATE = VF.createIRI(LOOKUP_NAMESPACE, "typeBlockTemplate");
    public static final IRI LOOKUP_QUERY_OBJECTPROPERTYBLOCKTEMPLATE = VF.createIRI(LOOKUP_NAMESPACE, "objectPropertyBlockTemplate");
    public static final IRI LOOKUP_QUERY_DATAPROPERTYBLOCKTEMPLATE = VF.createIRI(LOOKUP_NAMESPACE, "dataPropertyBlockTemplate");
    
    public static final IRI LOOKUP_REMOTESERVICE_URL = VF.createIRI(LOOKUP_NAMESPACE, "remoteServiceUrl");
    public static final IRI LOOKUP_REMOTESERVICE_USER = VF.createIRI(LOOKUP_NAMESPACE, "remoteServiceUser");
    public static final IRI LOOKUP_REMOTESERVICE_PASSWORD = VF.createIRI(LOOKUP_NAMESPACE, "remoteServicePassword");
    public static final IRI LOOKUP_REMOTESERVICE_QUERYMETHOD = VF.createIRI(LOOKUP_NAMESPACE, "remoteQueryMethod");
    
    public static final IRI LOOKUP_SERVICE_MEMBER = VF.createIRI(LOOKUP_NAMESPACE, "serviceMember");
}
