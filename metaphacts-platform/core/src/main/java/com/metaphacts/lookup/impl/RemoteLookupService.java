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
package com.metaphacts.lookup.impl;

import java.util.LinkedHashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;

import javax.ws.rs.HttpMethod;
import javax.ws.rs.client.ClientBuilder;
import javax.ws.rs.client.Entity;
import javax.ws.rs.client.Invocation;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Form;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;

import org.glassfish.jersey.client.authentication.HttpAuthenticationFeature;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.common.net.UrlEscapers;
import com.google.inject.Inject;
import com.metaphacts.lookup.api.EntityTypesFetchingException;
import com.metaphacts.lookup.api.LookupProcessingException;
import com.metaphacts.lookup.api.LookupService;
import com.metaphacts.lookup.impl.RemoteLookupConfig.QueryMethod;
import com.metaphacts.lookup.model.LookupEntityType;
import com.metaphacts.lookup.model.LookupQuery;
import com.metaphacts.lookup.model.LookupRequest;
import com.metaphacts.lookup.model.LookupResponse;
import com.metaphacts.secrets.SecretResolver;
import com.metaphacts.secrets.SecretsHelper;

/**
 * This instance passes all request to a remote {@link LookupService}
 * 
 * <p>The URL address of the external service can be defined using following parameter:
 * <code>lookup.experimental.remoteServiceUrl<code/>
 * If the target LookupService uses basic authentication it's also possible to 
 * provide login and password for authentication using:
 * <code>lookup.experimental.remoteServiceLogin<code/> and
 * <code>lookup.experimental.remoteServicePassword<code/>.
 * You can also change query method using
 * <code>lookup.experimental.queryMethod<code/> parameter.
 * Available values: see {@link QueryMethod}
 *
 * Example repository config:
 * <pre>
 *  @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
 *  @prefix rep: <http://www.openrdf.org/config/repository#> .
 *  @prefix sparql: <http://www.openrdf.org/config/repository/sparql#> .
 *  @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
 *  @prefix lookup: <http://www.metaphacts.com/ontologies/platform/repository/lookup#> .
 *  
 *  [] a rep:Repository;
 *    rep:repositoryID "remote-lookup";
 *    rep:repositoryImpl [
 *        rep:repositoryType "openrdf:SailRepository";
 *        sr:sailImpl [
 *            sail:sailType "openrdf:MemoryStore"
 *          ]
 *      ];
 *    lookup:configuration [
 *      lookup:type "metaphacts:remoteLookup";
 *      lookup:remoteServiceUrl "https://tools.wmflabs.org/openrefine-wikidata/en/api";
 *      #lookup:remoteServiceUser "myuser";
 *      #lookup:remoteServicePassword "mypasswd";
 *      lookup:remoteQueryMethod "postDataForm"
 *    ];
 *    rdfs:label "Remote Lookup" .
 * </pre>
 * 
 * <p>
 * Please refer to
 * https://reconciliation-api.github.io/specs/latest/#reconciliation-queries for
 * details on the OpenRefine Reconciliation API
 * </p>
 */
public class RemoteLookupService extends AbstractLookupService<RemoteLookupConfig> {
    private ObjectMapper mapper;
    
    @Inject(optional=true)
    private SecretResolver secretResolver;
    
    public RemoteLookupService(RemoteLookupConfig config) {
        super(config);
    
        this.mapper = new ObjectMapper();
        this.mapper.setSerializationInclusion(JsonInclude.Include.NON_NULL);
        this.mapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
        this.mapper.enable(DeserializationFeature.ACCEPT_EMPTY_STRING_AS_NULL_OBJECT);
    }


    @Override
    protected LookupResponse doLookup(LookupRequest request) throws LookupProcessingException {
        Map<String, LookupQuery> reqObject = new LinkedHashMap<>();
        reqObject.put(request.getQueryId(), request.getQuery());

        Response remoteResponse = prepareRequest(reqObject).invoke();

        String jsonString = remoteResponse.readEntity(String.class);
        Map<String, LookupResponse> responses;
        try {
            responses = this.mapper.readValue(
                jsonString, new TypeReference<Map<String, LookupResponse>>() {}
            );
        } catch (JsonProcessingException e) {
            throw new LookupProcessingException(
                "Fail to parse remote response when processing lookup request.", e
            );
        }

        LookupResponse response = responses.get(request.getQueryId());
        if (response == null) {
            response = new LookupResponse(request.getQueryId(), new LinkedList<>());
        } else {
            response.setQueryId(request.getQueryId());
        }
        return response;
    }

    @Override
    public List<LookupEntityType> getAvailableEntityTypes() throws EntityTypesFetchingException {
        Response response = this.getTarget()
                .request()
                .header("Accept", MediaType.APPLICATION_JSON)
                .build(HttpMethod.GET)
                .invoke();

        JsonNode manifest = response.readEntity(JsonNode.class);

        JsonNode defaultTypes = manifest.get("defaultTypes");
        if (defaultTypes != null) {
            try {
                return this.mapper.readValue(defaultTypes.toString(), new TypeReference<List<LookupEntityType>>() {});
            } catch (JsonProcessingException e) {
                throw new EntityTypesFetchingException(
                    "Fail to parse remote response when processing lookup request.", e
                );
            }
        }
        return new LinkedList<>();
    }

    protected Invocation prepareRequest(Map<String, LookupQuery> request) throws LookupProcessingException {
        QueryMethod queryMethod = this.getQueryMethod();
        String requestAsString;
        try {
            requestAsString = this.mapper.writeValueAsString(request);
        } catch (JsonProcessingException e) {
            throw new LookupProcessingException("Request object is not valid JSON.", e);
        }

        if (queryMethod.equals(QueryMethod.get)) {
            return this.getTarget()
                .queryParam("queries", UrlEscapers.urlFragmentEscaper().escape(requestAsString))
                .request()
                .header("Accept", MediaType.APPLICATION_JSON)
                .build(HttpMethod.GET);
        } else {
            Entity<?> entity;
            if (queryMethod.equals(QueryMethod.postRawJson)) {
                entity = Entity.entity(requestAsString, MediaType.APPLICATION_JSON);
            } else if (queryMethod.equals(QueryMethod.postDataForm)) {
                entity = Entity.form(new Form().param("queries", requestAsString));
            } else {
                entity = Entity.entity(new Form().param("queries", requestAsString), MediaType.APPLICATION_FORM_URLENCODED_TYPE);
            }
            return this.getTarget()
                    .request()
                    .header("Accept", MediaType.APPLICATION_JSON)
                    .build(HttpMethod.POST, entity);
        }

    }

    protected WebTarget getTarget() {
        String username = this.getRemoteServiceUser();
        String password = this.getRemoteServicePassword();
        String url = this.getRemoteServiceUrl();
        
        username = SecretsHelper.resolveSecretOrFallback(secretResolver, username);
        password = SecretsHelper.resolveSecretOrFallback(secretResolver, password);

        
        WebTarget client = ClientBuilder.newClient().target(url);

        if (username != null && password != null) {
            client.register(HttpAuthenticationFeature.basic(username, password));
        }
        return client;
    }

    protected String getRemoteServiceUrl() {
        return config.getRemoteServiceUrl();
    }

    protected String getRemoteServiceUser() {
        return config.getRemoteServiceUser();
    }

    protected QueryMethod getQueryMethod() {
        return config.getQueryMethod();
    }

    protected String getRemoteServicePassword() {
        return config.getRemoteServicePassword();
    }
}
