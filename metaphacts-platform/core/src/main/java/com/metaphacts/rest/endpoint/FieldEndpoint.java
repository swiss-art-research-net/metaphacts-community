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
package com.metaphacts.rest.endpoint;

import java.util.ArrayList;
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
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;

import com.metaphacts.services.fields.FieldDefinition;
import com.metaphacts.services.fields.FieldDefinitionGeneratorChain;

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
    private FieldDefinitionGeneratorChain generators;

    @POST()
    @Path("definitions")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @RequiresAuthentication
    public Response postForFields(Map<String, List<String>> body) {
        try {
            List<IRI> fields = body == null ? new ArrayList<>() : asIRIs(body.get("fields"));
            logger.trace("POST request for field definitions {}", fields);

            return handleFieldDefinitionsRequest(fields);
        } catch (IllegalArgumentException e) {
            return Response.status(Status.BAD_REQUEST).entity(e.getMessage()).build();
        }
    }

    private Response handleFieldDefinitionsRequest(List<IRI> fields) {
        Map<IRI, FieldDefinition> result = generators.handleAll(fields);

        Stream<FieldDefinition> fieldDefStream;
        if (fields.isEmpty()) {
            fieldDefStream = result.values().stream();
        } else {
            fieldDefStream = fields.stream().map(result::get).filter(Objects::nonNull);
        }
        List<Map<String, Object>> json = fieldDefStream
                .map(FieldDefinition::toJson)
                .collect(Collectors.toList());
        return Response.ok(json).build();
    }

    private List<IRI> asIRIs(List<String> input) throws IllegalArgumentException {
        if (input == null) {
            return new ArrayList<IRI>();
        }
        final ValueFactory vf = SimpleValueFactory.getInstance();
        return input.stream().map(s -> vf.createIRI(s)).collect(Collectors.toList());
    }

}
