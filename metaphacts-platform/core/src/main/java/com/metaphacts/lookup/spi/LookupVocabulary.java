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
    static final String LOOKUP_NAMESPACE = "http://www.metaphacts.com/ontologies/platform/repository/lookup#";

    static final IRI LOOKUP_TYPE = VF.createIRI(LOOKUP_NAMESPACE, "type");
    static final String LOOKUP_TYPE_NONE = "none";

    static final IRI LOOKUP_CONFIGURATION = VF.createIRI(LOOKUP_NAMESPACE, "configuration");

    static final IRI LOOKUP_SCORE_FACTOR = VF.createIRI(LOOKUP_NAMESPACE, "scoreFactor");
    static final IRI LOOKUP_SCORE_OFFSET = VF.createIRI(LOOKUP_NAMESPACE, "scoreOffset");
    static final IRI LOOKUP_TARGET_REPOSITORY = VF.createIRI(LOOKUP_NAMESPACE, "targetRepository");
    static final IRI LOOKUP_QUERY_ENTITYTYPES = VF.createIRI(LOOKUP_NAMESPACE, "entityTypesQuery");
    static final IRI LOOKUP_QUERY_DATASET = VF.createIRI(LOOKUP_NAMESPACE, "datasetQuery");
    static final IRI LOOKUP_DATASET_NAME = VF.createIRI(LOOKUP_NAMESPACE, "datasetName");
    static final IRI LOOKUP_DATASET_ID = VF.createIRI(LOOKUP_NAMESPACE, "datasetId");
    static final IRI LOOKUP_CACHE_CONFIG = VF.createIRI(LOOKUP_NAMESPACE, "cacheConfig");
    static final IRI LOOKUP_PREFERRED_LANGUAGE = VF.createIRI(LOOKUP_NAMESPACE, "preferredLanguage");
    static final IRI LOOKUP_QUERY_TEMPLATE = VF.createIRI(LOOKUP_NAMESPACE, "queryTemplate");
    static final IRI LOOKUP_QUERY_SEARCHBLOCKTEMPLATE = VF.createIRI(LOOKUP_NAMESPACE, "searchBlockTemplate");
    static final IRI LOOKUP_QUERY_TYPEBLOCKTEMPLATE = VF.createIRI(LOOKUP_NAMESPACE, "typeBlockTemplate");
    static final IRI LOOKUP_QUERY_OBJECTPROPERTYBLOCKTEMPLATE = VF.createIRI(LOOKUP_NAMESPACE,
            "objectPropertyBlockTemplate");
    static final IRI LOOKUP_QUERY_DATAPROPERTYBLOCKTEMPLATE = VF.createIRI(LOOKUP_NAMESPACE,
            "dataPropertyBlockTemplate");

    static final IRI LOOKUP_REMOTESERVICE_URL = VF.createIRI(LOOKUP_NAMESPACE, "remoteServiceUrl");
    static final IRI LOOKUP_REMOTESERVICE_USER = VF.createIRI(LOOKUP_NAMESPACE, "remoteServiceUser");
    static final IRI LOOKUP_REMOTESERVICE_PASSWORD = VF.createIRI(LOOKUP_NAMESPACE, "remoteServicePassword");
    static final IRI LOOKUP_REMOTESERVICE_QUERYMETHOD = VF.createIRI(LOOKUP_NAMESPACE, "remoteQueryMethod");
    static final IRI LOOKUP_REMOTESERVICE_TIMEOUT = VF.createIRI(LOOKUP_NAMESPACE, "remoteTimeout");
    static final IRI LOOKUP_REMOTESERVICE_INFORMATIONENABLED = VF.createIRI(LOOKUP_NAMESPACE,
            "remoteInformationServiceEnabled");

    static final IRI LOOKUP_SERVICE_MEMBER = VF.createIRI(LOOKUP_NAMESPACE, "serviceMember");

    static final String PARAM_TOKEN = "token";
    static final String PARAM_LIMIT = "limit";
    static final String PARAM_TYPE = "type";
    static final String PARAM_PREFERRED_LANGUAGE = "preferredLanguage";
    static final String PARAM_TYPE_STRICT = "typeStrict";
    static final String PARAM_TOKENIZE_QUERY_STRING = "tokenizeQueryString";
    static final String PARAM_EXPAND_TYPES = "expandTypes";
    static final String PARAM_SERVICE_NAME = "serviceName";

    /* configuration properties, used to tweak/restrict how the lookup search executes */

    static final IRI PROPERTY_TOKEN = VF.createIRI(LOOKUP_NAMESPACE, PARAM_TOKEN);
    static final IRI PROPERTY_LIMIT = VF.createIRI(LOOKUP_NAMESPACE, PARAM_LIMIT);

    // note that lookup:type can be used as either a configuration property or a result binding property
    static final IRI PROPERTY_TYPE = VF.createIRI(LOOKUP_NAMESPACE, PARAM_TYPE);
    static final IRI PROPERTY_PREFERRED_LANGUAGE = VF.createIRI(LOOKUP_NAMESPACE, PARAM_PREFERRED_LANGUAGE);
    static final IRI PROPERTY_TYPE_STRICT = VF.createIRI(LOOKUP_NAMESPACE, PARAM_TYPE_STRICT);
    static final IRI PROPERTY_TOKENIZE_QUERY_STRING = VF.createIRI(LOOKUP_NAMESPACE, PARAM_TOKENIZE_QUERY_STRING);
    static final IRI PROPERTY_EXPAND_TYPES = VF.createIRI(LOOKUP_NAMESPACE, PARAM_EXPAND_TYPES);
    static final IRI PROPERTY_SERVICE_NAME = VF.createIRI(LOOKUP_NAMESPACE, PARAM_SERVICE_NAME);

    /* result binding properties, used to bind lookup service results to SPARQL variables */

    static final IRI PROPERTY_NAME = VF.createIRI(LOOKUP_NAMESPACE, "name");
    static final IRI PROPERTY_TYPE_LABEL = VF.createIRI(LOOKUP_NAMESPACE, "typeLabel");
    static final IRI PROPERTY_SCORE = VF.createIRI(LOOKUP_NAMESPACE, "score");
    static final IRI PROPERTY_DESCRIPTION = VF.createIRI(LOOKUP_NAMESPACE, "description");
    static final IRI PROPERTY_DATASET = VF.createIRI(LOOKUP_NAMESPACE, "dataset");
    static final IRI PROPERTY_DATASET_LABEL = VF.createIRI(LOOKUP_NAMESPACE, "datasetLabel");


}
