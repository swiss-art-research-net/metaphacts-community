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
package com.metaphacts.lookup.impl;

import java.net.MalformedURLException;
import java.net.URL;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import javax.annotation.Nullable;
import javax.ws.rs.HttpMethod;
import javax.ws.rs.client.ClientBuilder;
import javax.ws.rs.client.Entity;
import javax.ws.rs.client.Invocation;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Form;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;

import com.metaphacts.cache.RemoteServiceConfiguration;
import com.metaphacts.cache.RemoteValueCache;
import com.metaphacts.resource.TypeService;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.repository.Repository;
import org.glassfish.jersey.client.ClientConfig;
import org.glassfish.jersey.client.ClientProperties;
import org.glassfish.jersey.client.authentication.HttpAuthenticationFeature;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.common.cache.CacheBuilder;
import com.google.common.net.UrlEscapers;
import com.google.inject.Inject;
import com.metaphacts.cache.DescriptionService;
import com.metaphacts.cache.LabelService;
import com.metaphacts.cache.RemoteLiteralCache;
import com.metaphacts.lookup.api.EntityTypesFetchingException;
import com.metaphacts.lookup.api.LookupProcessingException;
import com.metaphacts.lookup.api.LookupService;
import com.metaphacts.lookup.impl.RemoteLookupConfig.QueryMethod;
import com.metaphacts.lookup.model.LookupEntityType;
import com.metaphacts.lookup.model.LookupQuery;
import com.metaphacts.lookup.model.LookupRequest;
import com.metaphacts.lookup.model.LookupResponse;
import com.metaphacts.lookup.model.LookupServiceManifest;
import com.metaphacts.lookup.model.LookupServiceManifest.BasicService;
import com.metaphacts.secrets.SecretResolver;
import com.metaphacts.secrets.SecretsHelper;
import com.metaphacts.util.LanguageHelper;

/**
 * This instance passes all request to a remote {@link LookupService}
 *
 * <p>
 * The URL address of the external service can be defined using following
 * parameter: <code>lookup.experimental.remoteServiceUrl</code> If the target
 * LookupService uses basic authentication it's also possible to provide login
 * and password for authentication using:
 * <code>lookup.experimental.remoteServiceLogin</code> and
 * <code>lookup.experimental.remoteServicePassword</code>. You can also change
 * query method using <code>lookup.experimental.queryMethod</code> parameter.
 * Available values: see {@link QueryMethod}
 *
 * Example repository config:
 *
 * <pre>
 *  &#64;prefix rdfs: &lt;http://www.w3.org/2000/01/rdf-schema#> .
 *  &#64;prefix rep: &lt;http://www.openrdf.org/config/repository#> .
 *  &#64;prefix sparql: &lt;http://www.openrdf.org/config/repository/sparql#> .
 *  &#64;prefix xsd: &lt;http://www.w3.org/2001/XMLSchema#> .
 *  &#64;prefix lookup: &lt;http://www.metaphacts.com/ontologies/platform/repository/lookup#> .
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
 *      #lookup:remoteTimeout 10 ;
 *      #lookup:remoteInformationServiceEnabled true;
 *      lookup:remoteQueryMethod "postDataForm"
 *    ];
 *    rdfs:label "Remote Lookup" .
 * </pre>
 *
 * <p>
 * Additionally, the RemoteLookupService provides a {@link LabelService} and
 * {@link DescriptionService} when enabled in the configuration via property
 * {@code lookup:remoteInformationServiceEnabled true;} and supported by the
 * remote system as specified in its reconciliation manifest with the URLs of
 * the respective service.
 * </p>
 *
 * <p>
 * Please refer to
 * https://reconciliation-api.github.io/specs/latest/#reconciliation-queries for
 * details on the OpenRefine Reconciliation API
 * </p>
 */
public class RemoteLookupService extends AbstractLookupService<RemoteLookupConfig>
    implements LabelService.Provider, DescriptionService.Provider, TypeService.Provider {
    private static final Logger logger = LogManager.getLogger(RemoteLookupService.class);

    private static final String LABEL_CACHE_ID_PREFIX = "repository.LabelCache";
    private static final String DESCRIPTION_CACHE_ID_PREFIX = "repository.DescriptionCache";
    private static final String TYPE_CACHE_ID_PREFIX = "repository.TypeCache";

    protected ObjectMapper mapper;
    protected Optional<LabelService> labelService;
    protected Optional<DescriptionService> descriptionService;
    protected Optional<TypeService> typeService;
    protected Optional<LookupServiceManifest> manifest;

    @Inject(optional=true)
    protected SecretResolver secretResolver;

    public RemoteLookupService(RemoteLookupConfig config) {
        super(config);

        this.labelService = null;
        this.descriptionService = null;
        this.mapper = new ObjectMapper();
        this.mapper.setSerializationInclusion(JsonInclude.Include.NON_NULL);
        this.mapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
        this.mapper.enable(DeserializationFeature.ACCEPT_EMPTY_STRING_AS_NULL_OBJECT);
    }

    protected void invalidateServiceConfig() {
        synchronized (this) {
            labelService = null;
            descriptionService = null;
            manifest = null;
        }
    }

    protected void ensureRemoteServicesInitialized() {
        synchronized (this) {
            if (labelService == null || descriptionService == null || typeService == null) {
                initRemoteServices();
            }
        }
    }

    protected void initRemoteServices() {
        synchronized (this) {
            if (labelService != null && descriptionService != null && typeService != null) {
                return;
            }
        }
        labelService = Optional.empty();
        descriptionService = Optional.empty();
        typeService = Optional.empty();

        boolean initRemoteServices = this.config.isRemoteInformationServiceEnabled();
        String remoteServiceUrl = getRemoteServiceUrl();
        if (!initRemoteServices) {
            logger.debug("Remote services disabled for {}", remoteServiceUrl);
            return;
        }
        logger.debug("Remote services enabled for {}", remoteServiceUrl);

        LookupServiceManifest manifest = getManifest().orElse(null);
        if (manifest != null) {
            BasicService labelServiceSpec = manifest.getLabelService();
            if (labelServiceSpec != null) {
                String url = labelServiceSpec.getUrl();
                try {
                    url = resolveUrl(getRemoteServiceUrl(), url);
                    logger.info("Setting up remote label service for {}", url);
                    String labelCacheId = getLabelCacheId();
                    this.labelService = Optional
                            .ofNullable(buildLabelService(buildRemoteLiteralCache(labelCacheId, url)));
                } catch (MalformedURLException e) {
                    logger.warn("Invalid label service URL: " + url);
                }
            }
            else {
                logger.debug("No remote label service offered for {}", remoteServiceUrl);
            }

            BasicService descriptionServiceSpec = manifest.getDescriptionService();
            if (descriptionServiceSpec != null) {
                String url = descriptionServiceSpec.getUrl();
                try {
                    url = resolveUrl(getRemoteServiceUrl(), url);
                    logger.info("Setting up remote description service for {}", url);
                    String descriptionCacheId = getDescriptionCacheId();
                    this.descriptionService = Optional
                            .ofNullable(buildDescriptionService(buildRemoteLiteralCache(descriptionCacheId, url)));
                } catch (MalformedURLException e) {
                    logger.warn("Invalid description service URL: " + url);
                }
            }
            else {
                logger.debug("No remote description service offered for {}", remoteServiceUrl);
            }

            BasicService typeServiceSpec = manifest.getTypeService();
            if (typeServiceSpec != null) {
                String url = typeServiceSpec.getUrl();
                try {
                    url = resolveUrl(getRemoteServiceUrl(), url);
                    logger.info("Setting up remote type service for {}", url);
                    String typeCacheId = getTypeCacheId();
                    this.typeService = Optional
                        .ofNullable(buildTypeService(buildRemoteValueCache(typeCacheId, url)));
                } catch (MalformedURLException e) {
                    logger.warn("Invalid type service URL: " + url);
                }
            }
            else {
                logger.debug("No remote type service offered for {}", remoteServiceUrl);
            }
        } else {
            logger.warn(
        "Remote services disabled for {} because the manifest could not be retrieved. See previous log output for details",
                remoteServiceUrl
            );
        }
    }

    protected String resolveUrl(String remoteServiceUrl, String url) {
        try {
            URL serviceURL = new URL(remoteServiceUrl);
            URL combinedURL = new URL(serviceURL, url);
            return combinedURL.toString();
        } catch (Exception e) {
            String message = String.format("URL {} (based on {}) is not valid: {}", url, remoteServiceUrl,
                    e.getMessage());
            logger.warn(message);
            logger.debug("Details: ", e);
            throw new RuntimeException(message, e);
        }
    }

    protected String getLabelCacheId() {
        return LABEL_CACHE_ID_PREFIX + "." + this.getServiceId();
    }

    protected String getDescriptionCacheId() {
        return DESCRIPTION_CACHE_ID_PREFIX + "." + this.getServiceId();
    }

    protected String getTypeCacheId() {
        return TYPE_CACHE_ID_PREFIX + "." + this.getServiceId();
    }

    /**
     * Resolve the given user preferredLanguage using {@link LanguageHelper} and add
     * those system preferred languages which are not already provided.
     *
     * @param preferredLanguage
     * @return
     */
    protected List<String> resolvePreferredLanguagesInternal(@Nullable String preferredLanguage) {
        return LanguageHelper.getPreferredLanguages(preferredLanguage, globalConfig.getUiConfig().getPreferredLanguages());
    }

    @Override
    protected LookupResponse doLookup(LookupRequest request) throws LookupProcessingException {
        Map<String, LookupQuery> reqObject = new HashMap<>();
        reqObject.put(request.getQueryId(), request.getQuery());

        Response remoteResponse = prepareRequest(reqObject).invoke();

        String jsonString = remoteResponse.readEntity(String.class);
        Map<String, LookupResponse> responses;
        try {
            responses = this.mapper.readValue(
                jsonString, new TypeReference<>() {}
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
        try {
            return getManifest().map(manifest -> manifest.getDefaultTypes()).orElse(Collections.emptyList());
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    /**
     * Get the manifest of the remote service. Once retrieved the manifest is
     * cached.
     *
     * @return manifest or empty if the manifest could not be loaded.
     */
    protected Optional<LookupServiceManifest> getManifest() {
        synchronized (this) {
            if (manifest == null) {
                try {
                    manifest = Optional.ofNullable(fetchManifest());
                } catch (Exception e) {
                    logger.warn("Failed to fetch manifest from {}: {}", getRemoteServiceUrl(), e.getMessage());
                    logger.debug("Details: ", e);
                    manifest = Optional.empty();
                }
            }
        }

        return manifest;
    }

    /**
     * Fetch manifest from remote service.
     *
     * <p>
     * Note: one would typically rather use #getManifest() to get a cached version
     * of the manifest
     * </p>
     *
     * @return remote service manifest
     * @throws LookupProcessingException
     * @see #getManifest()
     */
    protected LookupServiceManifest fetchManifest() throws LookupProcessingException {
        String remoteServiceUrl = getRemoteServiceUrl();
        try {
            logger.debug("Fetching manifest from remote service {}", remoteServiceUrl);
            Response response = this.getTarget().request().header("Accept", MediaType.APPLICATION_JSON)
                    .build(HttpMethod.GET).invoke();

            String jsonString = response.readEntity(String.class);
            logger.trace("Manifest for remote service {}: {}", remoteServiceUrl, jsonString);
            return this.mapper.readValue(jsonString, new TypeReference<>() {});
        } catch (Exception e) {
            logger.warn("Failed to fetch or parse manifest from remote service {}: {}", remoteServiceUrl,
                    e.getMessage());
            logger.debug("Details: ", e);
            throw new LookupProcessingException("Failed to fetch or parse manifest.", e);
        }
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
        Integer timeout = this.getRemoteTimeout();

        ClientConfig configuration = new ClientConfig();
        // define timeout
        if (timeout != null) {
            configuration.property(ClientProperties.CONNECT_TIMEOUT, timeout * 1000);
            configuration.property(ClientProperties.READ_TIMEOUT, timeout * 1000);
        }

        WebTarget client = ClientBuilder.newClient(configuration).target(url);

        if (username != null && password != null) {
            client.register(HttpAuthenticationFeature.basic(username, password));
        }
        return client;
    }

    protected Integer getRemoteTimeout() {
        Integer timeout = config.getRemoteTimeout();
        if (timeout == null) {
            if (globalConfig != null) {
                timeout = globalConfig.getEnvironmentConfig().getSparqlHttpConnectionTimeout();
            }
        }
        if (timeout == null) {
            timeout = 30;
        }
        return timeout;
    }

    protected String getRemoteServiceUrl() {
        return config.getRemoteServiceUrl();
    }

    protected String getRemoteServiceUser() {
        return SecretsHelper.resolveSecretOrFallback(secretResolver, config.getRemoteServiceUser());
    }

    protected String getRemoteServicePassword() {
        return SecretsHelper.resolveSecretOrFallback(secretResolver, config.getRemoteServicePassword());
    }

    protected String getRemoteServiceRepository() {
        return config.getTargetRepository();
    }

    protected QueryMethod getQueryMethod() {
        return config.getQueryMethod();
    }

    protected RemoteValueCache buildRemoteValueCache(String cacheId, String url)
        throws MalformedURLException {
        return new RemoteValueCache(
            cacheId,
            new RemoteServiceConfiguration(
                url,
                getRemoteServiceRepository(),
                getRemoteServiceUser(),
                getRemoteServicePassword(),
                getRemoteTimeout()
            )
        );
    }

    protected RemoteLiteralCache buildRemoteLiteralCache(String cacheId, String url)
        throws MalformedURLException {
        return new RemoteLiteralCache(
                cacheId,
                new RemoteServiceConfiguration(
                    url,
                    getRemoteServiceRepository(),
                    getRemoteServiceUser(),
                    getRemoteServicePassword(),
                    getRemoteTimeout()
                )
        ) {
            @Override
            protected List<String> resolvePreferredLanguages(@Nullable String preferredLanguage) {
                return resolvePreferredLanguagesInternal(preferredLanguage);
            }

            @Override
            protected CacheBuilder<Object,Object> createCacheBuilder() {
                return cacheManager.newBuilder(cacheId, globalConfig.getCacheConfig().getDescriptionCacheSpec());
            }
        };
    }

    protected LabelService buildLabelService(RemoteLiteralCache cache) {
        return new LabelService() {
            @Override
            public Optional<Literal> getLabel(IRI resourceIri, Repository repository,
                    @Nullable String preferredLanguage ) {
                return cache.getLiteral(resourceIri, repository, preferredLanguage);
            }

            @Override
            public Map<IRI, Optional<Literal>> getLabels(Iterable<? extends IRI> resourceIris,
                    Repository repository, @Nullable String preferredLanguage) {
                return cache.getLiterals(resourceIris, repository, preferredLanguage);
            }
        };
    }

    protected DescriptionService buildDescriptionService(RemoteLiteralCache cache) {
        return new DescriptionService() {
            @Override
            public Optional<Literal> getDescription(IRI resourceIri, Repository repository,
                    @Nullable String preferredLanguage ) {
                return cache.getLiteral(resourceIri, repository, preferredLanguage);
            }

            @Override
            public Map<IRI, Optional<Literal>> getDescriptions(Iterable<? extends IRI> resourceIris,
                    Repository repository, @Nullable String preferredLanguage) {
                return cache.getLiterals(resourceIris, repository, preferredLanguage);
            }
        };
    }

    protected TypeService buildTypeService(RemoteValueCache cache) {
        return new TypeService() {
            @Override
            public Iterable<IRI> getTypes(IRI resource, Repository repository) {
                return cache.getValuesFor(resource, repository);
            }

            @Override
            public Optional<IRI> getPrimaryType(IRI resource, Repository repository) {
                return cache.getFirstValueFor(resource, repository);
            }

            @Override
            public Map<IRI, Optional<Iterable<IRI>>> getAllTypes(Iterable<? extends IRI> resourceIris, Repository repository) {
                return cache.getAll(repository, resourceIris);
            }
        };
    }

    @Override
    public Optional<DescriptionService> getDescriptionService() {
        ensureRemoteServicesInitialized();
        return this.descriptionService;
    }

    @Override
    public Optional<LabelService> getLabelService() {
        ensureRemoteServicesInitialized();
        return this.labelService;
    }

    @Override
    public Optional<TypeService> getTypeService() {
        ensureRemoteServicesInitialized();
        return this.typeService;
    }

    @Override
    public String toString() {
        return getClass().getSimpleName() + " for " + getRemoteServiceUrl();
    }
}
