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

import static org.eclipse.rdf4j.model.util.Values.iri;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import javax.inject.Inject;
import javax.inject.Singleton;
import javax.ws.rs.Consumes;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.Status;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.shiro.authz.annotation.RequiresAuthentication;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.model.util.Values;
import org.eclipse.rdf4j.model.vocabulary.RDF;
import org.eclipse.rdf4j.model.vocabulary.XSD;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.google.common.collect.Sets;
import com.metaphacts.cache.LabelService;
import com.metaphacts.repository.RepositoryManager;
import com.metaphacts.resource.ModelService;
import com.metaphacts.resource.TypeDescription;
import com.metaphacts.services.fields.FieldDefinition;
import com.metaphacts.services.fields.FieldDefinitionGeneratorChain;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;

/**
 * Endpoint for retrieval of {@link FieldDefinition}s
 * 
 * Usage:
 * <ul>
 * <li><code>POST /rest/fields/definitions</code> with a JSON body of the form
 * <code>{ "fields": [ "iri1", "iri2" ] }</code> retrieves field definitions for the given identifiers.</li>
 * </ul>
 * 
 * @author Jeen Broekstra <jb@metaphacts.com>
 *
 */
@Path("fields")
@Singleton
public class FieldEndpoint {

    private static final Logger logger = LogManager.getLogger(FieldEndpoint.class);

    @Inject
    private ModelService modelService;

    @Inject
    private FieldDefinitionGeneratorChain generators;

    @Inject
    private RepositoryManager repositoryManager;

    @Inject
    private LabelService labelService;

    private static class FieldDefinitionRequest {
        @Schema(
                description = "The fully qualified IRI of the class for which to retrieve field definitions.",
                nullable = true, example = "http://xmlns.com/foaf/0.1/Person")
        @JsonProperty("class")
        private String classIRI;

        @Schema(
                description = "The fully qualified IRI of the subject instance for which to retrieve field definitions. Ignored if a class is also specified.",
                nullable = true, example = "http://example.org/resource1")
        @JsonProperty("subject")
        private String subjectIRI;

        @ArraySchema(
                schema = @Schema(
                        description = "fully qualifieds IRI identifying a field for which to retrieve definitions. "
                                + "This overrides the default set of field definitions that would be retrieved for either class or subject. "
                                + "Field definitions will be returned in the order specified here.",
                        example = "http://example.org/field1"))
        @JsonProperty("fields")
        private List<String> fieldIRIs = new ArrayList<>();
    }

    @POST()
    @Path("definitions")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @RequiresAuthentication
    @Operation(
            summary = "Retrieve field definitions for a given class, subject instance, or list of field IRIs. All filter parameters are optional.")
    @ApiResponse(
            responseCode = "200",
            description = "An array of field definitions. If the request included an array of fields, the corresponding definitions will returned in the same order. ",
            content = @Content(
                    mediaType = "application/json",
                    array = @ArraySchema(schema = @Schema(implementation = FieldDefinition.class))))
    public Response postForFields(
            @RequestBody(
                    description = "A filter specification on the field definitions to be provided. All parameters are optional. ",
                    required = false,
                    content = @Content(
                            schema = @Schema(
                                    implementation = FieldDefinitionRequest.class))) FieldDefinitionRequest payload) {

        List<IRI> fields = new ArrayList<>();
        TypeDescription typeDescription = null;
        boolean applySorting = false;
        try {
            if (payload != null) {

                fields = payload.fieldIRIs.stream().map(Values::iri).collect(Collectors.toList());
                if (payload.classIRI != null) {
                    logger.trace("POST request for field definitions of class {}", payload.classIRI);
                    typeDescription = modelService.getTypeDescription(
                            repositoryManager.getDefault(),
                            iri(payload.classIRI))
                            .orElseThrow(() -> new IllegalArgumentException(
                                    "no type definition found for class " + payload.classIRI));
                } else if (payload.subjectIRI != null) {
                    logger.trace("POST request for field definitions of subject {}", payload.subjectIRI);
                    typeDescription = modelService.getTypeDescriptionForInstance(repositoryManager.getDefault(),
                            iri(payload.subjectIRI))
                            .orElseThrow(() -> new IllegalArgumentException(
                                    "no type definition found for subject " + payload.subjectIRI));
                }
                if (fields.isEmpty()) {
                    // no field IRIs in the request, use either class or subject to find relevant fields
                    if (typeDescription != null) {
                        fields = typeDescription.getProperties().stream()
                                .map(property -> property.getPropertyIRI())
                                .collect(Collectors.toList());
                        // only apply sorting if the order is not predetermined by user input
                        applySorting = true;
                    }
                }
            }
            logger.trace("POST request for field definitions {}", fields);
            Map<IRI, FieldDefinition> result = generators.handleAll(fields);

            Stream<FieldDefinition> fieldDefStream;
            if (fields.isEmpty()) {
                logger.trace("no fields specified in request, will retrieve all possible field definitions");
                fieldDefStream = result.values().stream();
            } else {
                fieldDefStream = fields.stream().map(result::get).filter(Objects::nonNull);
            }
            if (applySorting) {
                fieldDefStream = fieldDefStream.sorted(new FieldDefinitionSorter()).distinct();
            }
            List<FieldDefinition> fieldDefinitions = fieldDefStream.collect(Collectors.toList());
            if (typeDescription != null) {
                // inject "hidden" field definition for rdf:type, setting default value to the expected class
                final IRI typeIRI = typeDescription.getTypeIRI();
                generators.handle(RDF.TYPE).ifPresent(tfd -> {
                    tfd.setDefaultValues(Sets.newHashSet(typeIRI));
                    fieldDefinitions.add(tfd);
                });
            }

            List<Map<String, Object>> json = fieldDefinitions.stream().map(FieldDefinition::toJson)
                    .collect(Collectors.toList());
            return Response.ok(json).build();
        } catch (IllegalArgumentException e) {
            return Response.status(Status.BAD_REQUEST).type(MediaType.TEXT_PLAIN_TYPE).entity(e.getMessage()).build();
        }
    }

    /**
     * Sorts field definitions in a sensible default ordering, preferring string-typed fields over untyped or URI-typed
     * fields, ordering by lexical value of the field definition IRI local name as tie breaker.
     */
    class FieldDefinitionSorter implements Comparator<FieldDefinition> {
        @Override
        public int compare(FieldDefinition fd1, FieldDefinition fd2) {
            if (fd1 == fd2) {
                return 0;
            }

            IRI xsd1 = fd1.getXsdDatatype(), xsd2 = fd2.getXsdDatatype();
            if (xsd1 == null) {
                if (XSD.STRING.equals(xsd2)) {
                    return 1;
                }
                
                String label1 = labelService.getLabel(fd1.getIri(), repositoryManager.getDefault(), "en")
                        .map(Literal::getLabel).orElse(fd1.getIri().getLocalName());
                String label2 = labelService.getLabel(fd2.getIri(), repositoryManager.getDefault(), "en")
                        .map(Literal::getLabel).orElse(fd2.getIri().getLocalName());
                int localNameCompare = label1.compareTo(label2);
                if (localNameCompare == 0) {
                    return fd1.getIri().stringValue().compareTo(fd2.getIri().stringValue());
                }
                return localNameCompare;
            }
            if (xsd2 == null) {
                if (XSD.STRING.equals(xsd1)) {
                    return -1;
                }
                String label1 = labelService.getLabel(fd1.getIri(), repositoryManager.getDefault(), "en")
                        .map(Literal::getLabel).orElse(fd1.getIri().getLocalName());
                String label2 = labelService.getLabel(fd2.getIri(), repositoryManager.getDefault(), "en")
                        .map(Literal::getLabel).orElse(fd2.getIri().getLocalName());
                int localNameCompare = label1.compareTo(label2);
                if (localNameCompare == 0) {
                    return fd1.getIri().stringValue().compareTo(fd2.getIri().stringValue());
                }
                return localNameCompare;
            }

            if (xsd1.equals(xsd2)) {
                // same datatype, sort by label
                String label1 = labelService.getLabel(fd1.getIri(), repositoryManager.getDefault(), "en")
                        .map(Literal::getLabel).orElse(fd1.getIri().getLocalName());
                String label2 = labelService.getLabel(fd2.getIri(), repositoryManager.getDefault(), "en")
                        .map(Literal::getLabel).orElse(fd2.getIri().getLocalName());
                int localNameCompare = label1.compareTo(label2);
                if (localNameCompare == 0) {
                    return fd1.getIri().stringValue().compareTo(fd2.getIri().stringValue());
                }
                return localNameCompare;
            }

            if (xsd1.equals(XSD.STRING) || xsd2.equals(XSD.ANYURI)) {
                // order string-typed fields first and fields for relations last
                return -1;
            }
            if (xsd1.equals(XSD.ANYURI) || xsd2.equals(XSD.STRING)) {
                // order string-typed fields first and fields for relations last
                return 1;
            }

            // everything else sort by lexical value of the datatype
            return xsd1.stringValue().compareTo(xsd2.stringValue());
        }

    }
}