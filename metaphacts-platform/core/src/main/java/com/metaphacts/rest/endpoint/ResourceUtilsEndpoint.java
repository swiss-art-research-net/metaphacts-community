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

import static java.util.stream.Collectors.toMap;
import static javax.ws.rs.core.MediaType.APPLICATION_JSON;

import java.io.IOException;
import java.io.OutputStream;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;

import javax.inject.Inject;
import javax.inject.Singleton;
import javax.ws.rs.Consumes;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.WebApplicationException;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.StreamingOutput;

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.model.Value;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.model.util.Literals;
import org.eclipse.rdf4j.repository.Repository;
import org.eclipse.rdf4j.repository.RepositoryException;

import com.fasterxml.jackson.core.JsonFactory;
import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.metaphacts.cache.DescriptionService;
import com.metaphacts.cache.LabelService;
import com.metaphacts.repository.RepositoryManager;
import com.metaphacts.resource.TypeService;
import com.metaphacts.rest.feature.CacheControl.NoCache;
import com.metaphacts.thumbnails.ThumbnailServiceRegistry;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;

/**
 * @author Artem Kozlov <ak@metaphacts.com>
 * @author Michael Schmidt <ms@metaphacts.com>
 */
@Singleton
@NoCache
@Path("data/rdf/utils")
public class ResourceUtilsEndpoint {
    @Inject
    private LabelService labelCache;

    @Inject
    private DescriptionService descriptionCache;

    @Inject
    private ThumbnailServiceRegistry thumbnailServiceRegistry;

    @Inject
    private TypeService typeService;

    @Inject
    private RepositoryManager repositoryManager;

    /**
     * Fetch a label for each provided IRI.
     * 
     * @param repositoryId      repository from which to read types. If not provided
     *                          the default repository is used.
     * @param preferredLanguage language tag (or comma-separated list of language
     *                          tags with decreasing order of preference) of the
     *                          preferred language(s) (optional). A language tag
     *                          consists of the language and optionally variant,
     *                          e.g. <code>de</code> or <code>de-CH</code>. See
     *                          <a href=
     *                          "https://tools.ietf.org/html/rfc4647">RFC4647</a>
     *                          for details.<br>
     *                          Examples: <code>en</code>,
     *                          <code>en,fr-CH,de,ru</code></li>
     * @param jp                JSON Parser (injected from the framework)
     * @return JSON object with one entry per IRI. Each entries value is a label
     *         string
     * @throws IOException
     * @throws RepositoryException
     */
    @POST
    @Operation(summary = "Returns the label for each provided IRI", responses = {
            @ApiResponse(description = "object with IRI-label pairs", content = @Content(mediaType = "application/json", schema = @Schema(implementation = Map.class))) })
    @Path("getLabelsForRdfValue")
    @Produces(APPLICATION_JSON)
    @Consumes(APPLICATION_JSON)
    public Response getLabelsForRdfValue(
        @QueryParam("repository") final Optional<String> repositoryId,
        @QueryParam("preferredLanguage") Optional<String> preferredLanguage,
        final JsonParser jp
    ) throws IOException, RepositoryException {
        Repository repo = repositoryManager.getRepository(repositoryId).orElse(repositoryManager.getDefault());
        StreamingOutput stream = new StreamingOutput() {
            @Override
            public void write(OutputStream os) throws IOException,
                    WebApplicationException {
                JsonFactory jsonFactory = new JsonFactory();
                try(JsonGenerator output = jsonFactory.createGenerator(os)) {
                    output.writeStartObject();

                    Map<IRI, String> iriToUriString = readResourceIris(jp);

                    Optional<String> normalizedLanguageTag = preferredLanguage
                        .flatMap(tag -> Optional.ofNullable(Literals.normalizeLanguageTag(tag)));

                    Map<IRI, Optional<Literal>> labelMap = labelCache.getLabels(
                        iriToUriString.keySet(), repo, normalizedLanguageTag.orElse(null));
                    // write final bulk
                    for (IRI iri : labelMap.keySet()) {
                        Optional<Literal> label = labelMap.get(iri);
                        output.writeStringField(
                            iriToUriString.get(iri),
                            LabelService.resolveLabelWithFallback(label, iri)
                        );
                    }

                    // clear temp data structures
                    output.writeEndObject();
                }
            }
        };
        return Response.ok(stream).build();
    }

    /**
     * Fetch a list of types for each provided IRI.
     * 
     * @param repositoryId repository from which to read types. If not provided the
     *                     default repository is used.
     * @param jp           JSON Parser (injected from the framework)
     * @return JSON object with one entry per IRI. Each entries value is a list of
     *         IRIs
     * @throws IOException
     * @throws RepositoryException
     */
    @POST
    @Operation(summary = "Returns the list of types for each provided IRI", responses = {
            @ApiResponse(description = "object with IRI-list-of-types pairs", content = @Content(mediaType = "application/json", schema = @Schema(implementation = Map.class))) })
    @Path("getTypesForRdfValue")
    @Produces(APPLICATION_JSON)
    @Consumes(APPLICATION_JSON)
    public Response getTypesForRdfValue(@QueryParam("repository") final Optional<String> repositoryId,
            final JsonParser jp) throws IOException, RepositoryException {
        Repository repo = repositoryManager.getRepository(repositoryId).orElse(repositoryManager.getDefault());
        StreamingOutput stream = new StreamingOutput() {
            @Override
            public void write(OutputStream os) throws IOException, WebApplicationException {
                JsonFactory jsonFactory = new JsonFactory();
                try (JsonGenerator output = jsonFactory.createGenerator(os)) {
                    output.writeStartObject();

                    Map<IRI, String> iriToUriString = readResourceIris(jp);

                    Map<IRI, Optional<Iterable<IRI>>> typesMap = typeService.getAllTypes(iriToUriString.keySet(), repo);
                    // write final bulk
                    for (IRI iri : typesMap.keySet()) {
                        Optional<Iterable<IRI>> types = typesMap.get(iri);
                        output.writeArrayFieldStart(iriToUriString.get(iri));
                        if (types.isPresent()) {
                            for (IRI typeIRI : types.get()) {
                                output.writeString(typeIRI.stringValue());
                            }
                        }
                        
                        output.writeEndArray();
                    }

                    // clear temp data structures
                    output.writeEndObject();
                }
            }
        };
        return Response.ok(stream).build();
    }

    /**
     * Fetch a description for each provided IRI.
     * 
     * @param repositoryId      repository from which to read types. If not provided
     *                          the default repository is used.
     * @param preferredLanguage language tag (or comma-separated list of language
     *                          tags with decreasing order of preference) of the
     *                          preferred language(s) (optional). A language tag
     *                          consists of the language and optionally variant,
     *                          e.g. <code>de</code> or <code>de-CH</code>. See
     *                          <a href=
     *                          "https://tools.ietf.org/html/rfc4647">RFC4647</a>
     *                          for details.<br>
     *                          Examples: <code>en</code>,
     *                          <code>en,fr-CH,de,ru</code></li>
     * @param jp                JSON Parser (injected from the framework)
     * @return JSON object with one entry per IRI. Each entries value is a label
     *         string
     * @throws IOException
     * @throws RepositoryException
     */
    @POST
    @Operation(summary = "Returns the description for each provided IRI", responses = {
            @ApiResponse(description = "object with IRI-description pairs", content = @Content(mediaType = "application/json", schema = @Schema(implementation = Map.class))) })
    @Path("getDescriptionForRdfValue")
    @Produces(APPLICATION_JSON)
    @Consumes(APPLICATION_JSON)
    public Response getDescriptionsForRdfValues(
        @QueryParam("repository") final Optional<String> repositoryId,
        @QueryParam("preferredLanguage") Optional<String> preferredLanguage,
        final JsonParser jp
    ) throws IOException, RepositoryException {
        Repository repo = repositoryManager.getRepository(repositoryId).orElse(repositoryManager.getDefault());
        StreamingOutput stream = new StreamingOutput() {
            @Override
            public void write(OutputStream os) throws IOException,
                    WebApplicationException {
                JsonFactory jsonFactory = new JsonFactory();
                try(JsonGenerator output = jsonFactory.createGenerator(os)) {
                    output.writeStartObject();

                    Map<IRI, String> iriToUriString = readResourceIris(jp);

                    Optional<String> normalizedLanguageTag = preferredLanguage
                            .flatMap(tag -> Optional.ofNullable(Literals.normalizeLanguageTag(tag)));

                    Map<IRI, Optional<Literal>> descriptionMap = descriptionCache.getDescriptions(
                        iriToUriString.keySet(), repo, normalizedLanguageTag.orElse(null));
                    // write final bulk
                    for (IRI iri : descriptionMap.keySet()) {
                        Literal description = descriptionMap.get(iri).orElse(null);
                        output.writeStringField(
                            iriToUriString.get(iri),
                            description == null ? null : description.stringValue()
                        );
                    }

                    // clear temp data structures
                    output.writeEndObject();
                }
            }
        };
        return Response.ok(stream).build();
    }

    /**
     * @return resource IRIs with original representation
     */
    private Map<IRI, String> readResourceIris(JsonParser input) throws IOException {
        ValueFactory vf = SimpleValueFactory.getInstance();
        Map<IRI, String> iriToUriString = new LinkedHashMap<>();
        while (input.nextToken() != JsonToken.END_ARRAY) {

            final String uriString = input.getText();
            final IRI iri = vf.createIRI(uriString);

            iriToUriString.put(iri, uriString);
        }
        return iriToUriString;
    }

    @POST
    @Path("thumbnails/{service}")
    @Produces(APPLICATION_JSON)
    @Consumes(APPLICATION_JSON)
    public Response getThumbnailURLs(
        @PathParam("service") String service, List<String> resources,
        @QueryParam("repository") Optional<String> repositoryId
    ) {
        return thumbnailServiceRegistry.get(service).map(thumbnailService -> {
            Repository repo = repositoryManager.getRepository(repositoryId).orElse(repositoryManager.getDefault());
            ValueFactory vf = SimpleValueFactory.getInstance();
            Map<IRI, String> resourceIRIs = resources.stream().collect(
                toMap(vf::createIRI, Function.identity()));

            Map<IRI, Optional<Value>> thumbnails = thumbnailService.getThumbnails(repo, resourceIRIs.keySet());

            StreamingOutput stream = output -> {
                try (JsonGenerator json = new JsonFactory().createGenerator(output)) {
                    json.writeStartObject();

                    for (IRI iri : resourceIRIs.keySet()) {
                        Optional<Value> thumbnail = thumbnails.get(iri);
                        json.writeStringField(
                            resourceIRIs.get(iri),
                            thumbnail.map(Value::stringValue).orElse(null));
                    }

                    json.writeEndObject();
                }
            };

            return Response.ok(stream);
        }).orElse(Response.status(Response.Status.NOT_FOUND)
            .entity(String.format("\"Thumbnail service '%s' not found.\"", service))
        ).build();
    }
}
