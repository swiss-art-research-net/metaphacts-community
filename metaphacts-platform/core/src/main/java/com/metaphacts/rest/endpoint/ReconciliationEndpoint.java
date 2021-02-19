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
package com.metaphacts.rest.endpoint;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import javax.annotation.Nullable;
import javax.inject.Inject;
import javax.inject.Singleton;
import javax.validation.constraints.NotNull;
import javax.ws.rs.Consumes;
import javax.ws.rs.FormParam;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.HeaderParam;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.UriInfo;

import com.metaphacts.util.LanguageHelper;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.shiro.SecurityUtils;
import org.apache.shiro.authz.annotation.RequiresPermissions;
import org.apache.shiro.authz.permission.WildcardPermission;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.repository.Repository;
import org.glassfish.jersey.media.multipart.FormDataParam;
import org.glassfish.jersey.server.JSONP;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.google.common.collect.Maps;
import com.google.common.base.Strings;
import com.metaphacts.cache.DescriptionService;
import com.metaphacts.cache.LabelService;
import com.metaphacts.config.Configuration;
import com.metaphacts.lookup.api.EntityTypesFetchingException;
import com.metaphacts.lookup.api.LookupService;
import com.metaphacts.lookup.api.LookupServiceManager;
import com.metaphacts.lookup.model.LookupMultiRequest;
import com.metaphacts.lookup.model.LookupMultiResponse;
import com.metaphacts.lookup.model.LookupQuery;
import com.metaphacts.lookup.model.LookupRequest;
import com.metaphacts.lookup.model.LookupResponse;
import com.metaphacts.repository.RepositoryManager;
import com.metaphacts.security.Permissions;
import com.metaphacts.security.PlatformTaskWrapper;
import com.metaphacts.ui.templates.ST;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;

/**
 * Endpoint for interacting with {@link LookupService}s
 *
 */
@Path("reconciliation")
@Singleton
public class ReconciliationEndpoint {
    private static final Logger logger = LogManager.getLogger(ReconciliationEndpoint.class);
    private static final ValueFactory vf = SimpleValueFactory.getInstance();
    public static final int RESPONSE_TIMEOUT = 60;

    @Inject
    protected RepositoryManager repositoryManager;

    @Inject
    private LabelService labelCache;

    @Inject
    private DescriptionService descriptionCache;

    @Inject
    protected Configuration config;

    @Inject
    private LookupServiceManager lookupServiceManager;

    @Inject
    private ST st;

    @Context
    UriInfo uriInfo;

    /**
     * Perform a query provided as body part
     *
     * @example: curl -X POST -H "Content-Type: application/json" -d '{ "q0" : {
     *           "query" : "Mannheim", "limit": "5" } }'
     *           http://localhost:10214/rest/reconciliation/{lookupServiceName}
     */
    @POST
    @Operation(
        summary = "Returns reconciliation multi response which contains reconciliation candidates grouped by query ids",
        responses = {
            @ApiResponse(description = "Reconciliation multi response",
                content = @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = LookupMultiResponse.class)
                )
            )
        }
    )
    @Path("/{lookupServiceName}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces({"application/javascript", MediaType.APPLICATION_JSON})
    @JSONP(queryParam="callback")
    @RequiresPermissions(value = {Permissions.RECONCILIATION_SERVICE.LOOKUP})
    public Response lookupRawJson(
        Map<String, LookupQuery> queries,
        @PathParam("lookupServiceName") String lookupServiceName,
        @Nullable @HeaderParam("accept-language") String prefLang1,
        @Nullable @QueryParam("preferredLanguage") String prefLang2
    ) {
        return this.lookupByRawJson(queries, lookupServiceName, selectPreferredLanguage(prefLang1, prefLang2));
    }

    /**
     * Perform a query provided as body part
     *
     * @example: curl -X POST -H "Content-Type: application/json" -d '{ "q0" : {
     *           "query" : "Mannheim", "limit": "5" } }'
     *           http://localhost:10214/rest/reconciliation
     */
    @POST
    @Operation(
            summary = "Returns reconciliation multi response which contains reconciliation candidates grouped by query ids",
            responses = {
                    @ApiResponse(description = "Reconciliation multi response",
                            content = @Content(
                                    mediaType = "application/json",
                                    schema = @Schema(implementation = LookupMultiResponse.class)
                            )
                    )
            }
    )
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces({"application/javascript", MediaType.APPLICATION_JSON})
    @JSONP(queryParam="callback")
    @RequiresPermissions(value = {Permissions.RECONCILIATION_SERVICE.LOOKUP})
    public Response lookupRawJson(
        Map<String, LookupQuery> queries,
        @Nullable @HeaderParam("accept-language") String prefLang1,
        @Nullable @QueryParam("preferredLanguage") String prefLang2
    ) {
        return this.lookupByRawJson(queries, null, selectPreferredLanguage(prefLang1, prefLang2));
    }

    /**
     * Perform a query provided as form data
     *
     * @example: curl -X POST 'http://localhost:10214/rest/reconciliation/{lookupServiceName}' -d
     *           'queries={"q1":{"query":"VincentvanGogh","limit":3},"q2":{"query":"Car","limit":3},"q3":{"query":"Home","limit":3},"q0":{"query":"Meinheim","limit":3}}'
     */
    @POST
    @Operation(
        summary = "Returns reconciliation multi response which contains reconciliation candidates grouped by query ids",
        responses = {
            @ApiResponse(description = "Reconciliation multi response",
                content = @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = LookupMultiResponse.class)
                )
            )
        }
    )
    @Path("/{lookupServiceName}")
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    @Produces({MediaType.APPLICATION_JSON, "application/javascript"})
    @JSONP(queryParam="callback")
    @RequiresPermissions(value = {Permissions.RECONCILIATION_SERVICE.LOOKUP})
    public Response lookupFormData(
        @FormDataParam("queries") String queries,
        @PathParam("lookupServiceName") String lookupServiceName,
        @Nullable @HeaderParam("accept-language") String prefLang1,
        @Nullable @QueryParam("preferredLanguage") String prefLang2
    ) {
        return this.lookupEntry(queries, lookupServiceName, selectPreferredLanguage(prefLang1, prefLang2));
    }

    /**
     * Perform a query provided as form data
     *
     * @example: curl -X POST 'http://localhost:10214/rest/reconciliation' -d
     *           'queries={"q1":{"query":"VincentvanGogh","limit":3},"q2":{"query":"Car","limit":3},"q3":{"query":"Home","limit":3},"q0":{"query":"Meinheim","limit":3}}'
     */
    @POST
    @Operation(
            summary = "Returns reconciliation multi response which contains reconciliation candidates grouped by query ids",
            responses = {
                    @ApiResponse(description = "Reconciliation multi response",
                            content = @Content(
                                    mediaType = "application/json",
                                    schema = @Schema(implementation = LookupMultiResponse.class)
                            )
                    )
            }
    )
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    @Produces({MediaType.APPLICATION_JSON, "application/javascript"})
    @JSONP(queryParam="callback")
    @RequiresPermissions(value = {Permissions.RECONCILIATION_SERVICE.LOOKUP})
    public Response lookupFormData(
        @FormDataParam("queries") String queries,
        @Nullable @HeaderParam("accept-language") String prefLang1,
        @Nullable @QueryParam("preferredLanguage") String prefLang2
    ) {
        return this.lookupEntry(queries, null, selectPreferredLanguage(prefLang1, prefLang2));
    }

    /**
     * Perform a query provided as url encoded form data
     *
     * @example: curl -X POST 'http://localhost:10214/rest/reconciliation/{lookupServiceName}'
     *           --data-urlencode
     *           'queries={"q1":{"query":"VincentvanGogh","limit":3},"q2":{"query":"Car","limit":3},"q3":{"query":"Home","limit":3},"q0":{"query":"Meinheim","limit":3}}'
     */
    @POST
    @Operation(
        summary = "Returns reconciliation multi response which contains reconciliation candidates grouped by query ids",
        responses = {
            @ApiResponse(description = "Reconciliation multi response",
                content = @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = LookupMultiResponse.class)
                )
            )
        }
    )
    @Path("/{lookupServiceName}")
    @Consumes(MediaType.APPLICATION_FORM_URLENCODED)
    @Produces({MediaType.APPLICATION_JSON, "application/javascript"})
    @JSONP(queryParam="callback")
    @RequiresPermissions(value = {Permissions.RECONCILIATION_SERVICE.LOOKUP})
    public Response lookupUrlEncodedFormData(
        @FormParam("queries") String queries,
        @PathParam("lookupServiceName") String lookupServiceName,
        @Nullable @HeaderParam("accept-language") String prefLang1,
        @Nullable @QueryParam("preferredLanguage") String prefLang2
    ) {
        return this.lookupEntry(queries, lookupServiceName, selectPreferredLanguage(prefLang1, prefLang2));
    }

    /**
     * Perform a query provided as url encoded form data
     *
     * @example: curl -X POST 'http://localhost:10214/rest/reconciliation'
     *           --data-urlencode
     *           'queries={"q1":{"query":"VincentvanGogh","limit":3},"q2":{"query":"Car","limit":3},"q3":{"query":"Home","limit":3},"q0":{"query":"Meinheim","limit":3}}'
     */
    @POST
    @Operation(
            summary = "Returns reconciliation multi response which contains reconciliation candidates grouped by query ids",
            responses = {
                    @ApiResponse(description = "Reconciliation multi response",
                            content = @Content(
                                    mediaType = "application/json",
                                    schema = @Schema(implementation = LookupMultiResponse.class)
                            )
                    )
            }
    )
    @Consumes(MediaType.APPLICATION_FORM_URLENCODED)
    @Produces({MediaType.APPLICATION_JSON, "application/javascript"})
    @JSONP(queryParam="callback")
    @RequiresPermissions(value = {Permissions.RECONCILIATION_SERVICE.LOOKUP})
    public Response lookupUrlEncodedFormData(
        @FormParam("queries") String queries,
        @Nullable @HeaderParam("accept-language") String prefLang1,
        @Nullable @QueryParam("preferredLanguage") String prefLang2
    ) {
        return this.lookupEntry(queries, null, selectPreferredLanguage(prefLang1, prefLang2));
    }

    /**
     * Perform a query provided a request parameter (if any) or return the service
     * manifest if there is no parameter.
     *
     * @example: 1) curl http://localhost:10214/rest/reconciliation/{lookupServiceName} 2) curl
     *           http://localhost:10214/rest/reconciliation/{lookupServiceName}?queries=%7B%22q0%22%3A%7B%22query%22%3A%22foo%22%7D%7D
     */
    @GET
    @Operation(
        summary = "Returns the Manifest of the reconciliation service or reconciliation multi response which contains reconciliation candidates grouped by query ids",
        responses = {
            @ApiResponse(description = "The service manifest",
                content = @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = LookupMultiResponse.class)
                )
            ),
            @ApiResponse(description = "Reconciliation multi response",
                content = @Content(mediaType = "application/json")
            )
        }
    )
    @Path("/{lookupServiceName}")
    @Produces({"application/javascript", MediaType.APPLICATION_JSON})
    @JSONP(queryParam="callback")
    @RequiresPermissions(value = {Permissions.RECONCILIATION_SERVICE.LOOKUP})
    public Response lookupOrGetManifest(
        @QueryParam("queries") String stringQueries,
        @PathParam("lookupServiceName") String lookupServiceName,
        @Nullable @HeaderParam("accept-language") String prefLang1,
        @Nullable @QueryParam("preferredLanguage") String prefLang2
    ) {
        return this.lookupOrGetManifestForService(stringQueries, lookupServiceName, selectPreferredLanguage(prefLang1, prefLang2));
    }

    /**
     * Perform a query provided a request parameter (if any) or return the service
     * manifest if there is no parameter.
     *
     * @example: 1) curl http://localhost:10214/rest/reconciliation 2) curl
     *           http://localhost:10214/rest/reconciliation?queries=%7B%22q0%22%3A%7B%22query%22%3A%22foo%22%7D%7D
     */
    @GET
    @Operation(
            summary = "Returns the Manifest of the reconciliation service or reconciliation multi response which contains reconciliation candidates grouped by query ids",
            responses = {
                    @ApiResponse(description = "The service manifest",
                            content = @Content(
                                    mediaType = "application/json",
                                    schema = @Schema(implementation = LookupMultiResponse.class)
                            )
                    ),
                    @ApiResponse(description = "Reconciliation multi response",
                            content = @Content(mediaType = "application/json")
                    )
            }
    )
    @Produces({"application/javascript", MediaType.APPLICATION_JSON})
    @JSONP(queryParam="callback")
    @RequiresPermissions(value = {Permissions.RECONCILIATION_SERVICE.LOOKUP})
    public Response lookupOrGetManifest(
        @QueryParam("queries") String stringQueries,
        @Nullable @HeaderParam("accept-language") String prefLang1,
        @Nullable @QueryParam("preferredLanguage") String prefLang2
    ) {
        return this.lookupOrGetManifestForService(stringQueries, null, selectPreferredLanguage(prefLang1, prefLang2));
    }

    @GET
    @Path("description")
    @Operation(
        summary = "Provides description for specified resource.",
        responses = {
            @ApiResponse(description = "HTML-snippet which contains description for specified resource",
                content = @Content(
                    mediaType = MediaType.TEXT_HTML,
                    schema = @Schema(implementation = String.class)
                )
            )
        }
    )
    @Produces({MediaType.TEXT_HTML})
    @JSONP(queryParam="callback")
    @RequiresPermissions(value = {Permissions.RECONCILIATION_SERVICE.READ_DESCRIPTION})
    public Response getDescription(
        @NotNull @QueryParam("uri") String uri,
        @QueryParam("repository") String repositoryId
    ) {
        IRI resourceIri = vf.createIRI(uri);
        Repository repository = repositoryId == null ?
            this.repositoryManager.getDefault() :
            this.repositoryManager.getRepository(repositoryId);
        String resourceLabel = LabelService.resolveLabelWithFallback(
                this.labelCache.getLabel(resourceIri, repository, this.getPreferredLanguageForDescription()),
                resourceIri
        );
        Literal resourceDescriptionLiteral = this.descriptionCache
                .getDescription(resourceIri, repository, this.getPreferredLanguageForDescription()).orElse(null);

        Map<String, Object> map = st.getDefaultPageLayoutTemplateParams();
        map.put("resourceIri", resourceIri.stringValue());
        map.put("resourceLabel", resourceLabel);
        // TODO: also add types (will be implemented by description service)
        //map.put("resourceTypes", resourceTypes);
        if (resourceDescriptionLiteral != null) {
            map.put("resourceDescription", resourceDescriptionLiteral.stringValue());
        }
        try {
            return Response.status(Response.Status.OK).entity(
                st.renderPageLayoutTemplate(ST.TEMPLATES.ENTITY_DESCRIPTION, map)
            ).build();
        } catch (IOException e) {
            logger.warn(e.getMessage());
            logger.debug("Details: ", e);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .type("text/plain").entity(
                    "Failed to prepare template for " + resourceIri.stringValue() + "."
                ).build();
        }
    }

    protected Response lookupByRawJson(
        Map<String, LookupQuery> queries,
        String lookupServiceName,
        @Nullable String preferredLanguage
    ) {
        LookupMultiRequest multiRequest;
        try {
            multiRequest = this.prepareMultiRequest(queries, preferredLanguage);
        } catch (IllegalArgumentException illegalArgumentException) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .type("text/plain").entity("Lookup preferredLanguage has wrong format.").build();
        }
        try {
            return Response.ok(this.lookup(multiRequest, lookupServiceName).getResponses()).build();
        } catch (TimeoutException timeoutException) {
            return Response.status(Response.Status.REQUEST_TIMEOUT)
                    .type("text/plain").entity("Failed to wait for lookup service results.").build();
        } catch (Exception internalException) {
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .type("text/plain").entity("Failed to process lookup service results. See log for details.").build();
        }
    }

    protected Response lookupOrGetManifestForService(
        String stringQueries,
        @Nullable String lookupServiceName,
        @Nullable String preferredLanguage
    ) {
        // if no queries are supplied it is a request for the service manifest
        if (
            stringQueries == null &&
            SecurityUtils.getSubject().isPermitted(
                new WildcardPermission(Permissions.RECONCILIATION_SERVICE.READ_MANIFEST)
            )
        ) {
            try {
                return Response.ok(this.getServiceManifest(lookupServiceName)).build();
            } catch (EntityTypesFetchingException e) {
                logger.warn(e.getMessage());
                logger.debug("Details: ", e);
                return Response.status(Response.Status.REQUEST_TIMEOUT)
                        .type("text/plain").entity("Failed to fetch list of available entityTypes.").build();
            }
        }
        return this.lookupEntry(stringQueries, lookupServiceName, preferredLanguage);
    }

    protected String getPreferredLanguageForDescription() {
        return config.getUiConfig().resolvePreferredLanguage(null);
    }

    protected Response lookupEntry(
        String stringQueries,
        @Nullable String lookupServiceName,
        @Nullable String preferredLanguage
    ) {
        Map<String, LookupQuery> queries;
        ObjectMapper mapper = new ObjectMapper();
        try {
            queries = mapper.readValue(stringQueries, new TypeReference<Map<String, LookupQuery>>() {});
        } catch (Exception e) {
            String errorMessage = "The error occurred during the parsing of provided query. Error message:" + e.getMessage();
            logger.warn(errorMessage);
            logger.debug("Details: ", e);
            return Response.status(Response.Status.BAD_REQUEST)
                .type("text/plain").entity(errorMessage).build();
        }
        LookupMultiRequest multiRequest;
        try {
            multiRequest = this.prepareMultiRequest(queries, preferredLanguage);
        } catch (IllegalArgumentException illegalArgumentException) {
            return Response.status(Response.Status.BAD_REQUEST)
                .type("text/plain").entity("Lookup preferredLanguage has wrong format.").build();
        }
        try {
            return Response.ok(this.lookup(multiRequest, lookupServiceName).getResponses()).build();
        } catch (TimeoutException timeoutException) {
            return Response.status(Response.Status.REQUEST_TIMEOUT)
                .type("text/plain").entity("Failed to wait for lookup service results.").build();
        } catch (Exception internalException) {
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .type("text/plain").entity("Failed to process lookup service results. See log for details.").build();
        }
    }

    protected LookupMultiResponse lookup(LookupMultiRequest multiRequest, @Nullable String lookupServiceName) throws TimeoutException {
        LookupService service = getLookupService(lookupServiceName);
        // TODO: share thread pool between requests
        ExecutorService executorService = createExecutorService(multiRequest.getRequests().size());
        Map<String, LookupResponse> responseMap = Maps.newConcurrentMap();
        try {
            multiRequest.getRequests().entrySet().stream().forEach(entry -> executorService.submit(PlatformTaskWrapper.INSTANCE.wrap(() -> {
                LookupRequest request = entry.getValue();
                String queryId = request.getQueryId();
                try {
                    LookupResponse response = service.lookup(request);
                    responseMap.put(queryId, response);
                } catch (Exception e) {
                    String exceptionMessage =
                        "The error occurred during the execution request \"" +
                        entry.getKey() +  "\". " + e.getMessage();
                    logger.warn(exceptionMessage, e.getMessage());
                    logger.debug("Details: ", e);
                    // store empty response to not fail the overall request
                    responseMap.put(queryId, new LookupResponse(queryId, Collections.emptyList()));
                }
            })));
        } finally {
            executorService.shutdown();
            try {
                if(!executorService.awaitTermination(RESPONSE_TIMEOUT, TimeUnit.SECONDS)) {
                    TimeoutException e = new TimeoutException("Failed to wait for lookup service results!");
                    logger.warn(e.getMessage());
                    logger.debug("Details: ", e);
                    throw e;
                }
            } catch (InterruptedException e) {
                String exceptionMessage = "Failed to wait for lookup service results: " + e.getMessage();
                logger.warn(exceptionMessage);
                logger.debug("Details: ", e);
                executorService.shutdownNow();
                throw new TimeoutException(exceptionMessage);
            }
        }

        return new LookupMultiResponse(responseMap);
    }

    protected LookupService getLookupService(@Nullable String lookupServiceName) {
        Optional<LookupService> lookupService;
        if (Strings.isNullOrEmpty(lookupServiceName)) {
            lookupService = this.lookupServiceManager.getDefaultExternalLookupService();
        } else {
            lookupService = this.lookupServiceManager.getLookupServiceByName(lookupServiceName);
        }
        if (!lookupService.isPresent()) {
            throw new IllegalArgumentException("No default LookupService available");
        }
        return lookupService.get();
    }

    protected ExecutorService createExecutorService(int numRequests) {
        Integer maxThreads = config.getLookupConfig().getMaxParallelSearch();

        return Executors.newFixedThreadPool(
            numRequests > maxThreads ? maxThreads : numRequests
        );
    }

    // TODO: extend service manifest
    private JsonNode getServiceManifest(@Nullable String lookupServiceName) throws EntityTypesFetchingException {
        return createServiceManifest(lookupServiceName);
    }

    protected LookupMultiRequest prepareMultiRequest(Map<String, LookupQuery> request, @Nullable String preferredLanguage) throws IllegalArgumentException {
        Map<String, LookupRequest> requests = new LinkedHashMap<>();
        LanguageHelper.LanguageValidationResults validation = LanguageHelper.validatePreferredLanguage(preferredLanguage);
        if (!validation.isValid) {
            throw new IllegalArgumentException(validation.errorMessage);
        }
        for (Map.Entry<String, LookupQuery> entry : request.entrySet()) {
            LookupQuery query = entry.getValue();
            query.setPreferredLanguage(
                LanguageHelper.mergePreferredLanguages(
                    query.getPreferredLanguage(),
                    preferredLanguage
                )
            );
            requests.put(entry.getKey(), new LookupRequest(entry.getKey(), query));
        }

        return new LookupMultiRequest(requests);
    }

    protected JsonNode createServiceManifest(@Nullable String lookupServiceName) throws EntityTypesFetchingException {
        ObjectMapper mapper = new ObjectMapper();
        final ObjectNode serviceManifest = mapper.createObjectNode();
        serviceManifest.put("name", "mp-reconciliation");
        serviceManifest.put("identifierSpace", "http://www.metaphacts.com/ontologies/platform/reconciliation#");
        serviceManifest.put("schemaSpace", "http://www.metaphacts.com/ontologies/platform/reconciliation-schema#");

        serviceManifest.putArray("defaultTypes").addAll(
                mapper.convertValue(getLookupService(lookupServiceName).getAvailableEntityTypes(), ArrayNode.class)
        );

        try {
            final ObjectNode previewService = serviceManifest.putObject("preview");
            previewService.put("url", uriInfo.resolve(new URI("reconciliation/description")).toString() + "?uri={{id}}");
            previewService.put("width", 300);
            previewService.put("height", 200);
        } catch (URISyntaxException e) {
            logger.warn("Failed to create preview URL: {}", e.getMessage());
            logger.debug("Details: ",  e);
        }

        try {
            final ObjectNode view = serviceManifest.putObject("view");
            view.put("url", uriInfo.resolve(new URI("../resource/")).toString() + "?uri={{id}}");
        } catch (URISyntaxException e) {
            logger.warn("Failed to create view URL: {}", e.getMessage());
            logger.debug("Details: ",  e);
        }

        return serviceManifest;
    }

    /**
     * This function selects from one of two provided language strings where
     * the {@param langFromHeader} will be selected if both are provided.
     * @param langFromHeader nullable string
     * @param langFromParam nullable string
     * @return
     */
    protected String selectPreferredLanguage(@Nullable String langFromHeader, @Nullable String langFromParam) {
        return !Strings.isNullOrEmpty(langFromParam) ? langFromParam :
            !Strings.isNullOrEmpty(langFromHeader) ? langFromHeader : null;
    }
}
