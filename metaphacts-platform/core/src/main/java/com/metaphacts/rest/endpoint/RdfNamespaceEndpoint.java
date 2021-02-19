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

import static javax.ws.rs.core.MediaType.APPLICATION_JSON;
import static javax.ws.rs.core.MediaType.TEXT_PLAIN;

import java.io.IOException;
import java.net.URI;
import java.util.List;
import java.util.Map;

import javax.inject.Inject;
import javax.inject.Singleton;
import javax.ws.rs.Consumes;
import javax.ws.rs.DELETE;
import javax.ws.rs.GET;
import javax.ws.rs.InternalServerErrorException;
import javax.ws.rs.POST;
import javax.ws.rs.PUT;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.Status;
import javax.ws.rs.core.StreamingOutput;

import org.apache.shiro.authz.annotation.RequiresAuthentication;
import org.apache.shiro.authz.annotation.RequiresPermissions;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;

import com.fasterxml.jackson.core.JsonParser;
import com.metaphacts.config.NamespaceRecord;
import com.metaphacts.config.NamespaceRegistry;
import com.metaphacts.config.NamespaceRegistry.ProtectedNamespaceDeletionException;
import com.metaphacts.data.json.JsonUtil;
import com.metaphacts.rest.feature.CacheControl.NoCache;
import com.metaphacts.security.Permissions.NAMESPACES;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.parameters.RequestBody;


/**
 * @author Artem Kozlov <ak@metaphacts.com>
 * @author Johannes Trame <jt@metaphacts.com>
 */
@Singleton
@Path("data/rdf/namespace")
//@Tag(name = "RDF Namespace Endpoint", description = "Central registry of RDF Namespaces")
public class RdfNamespaceEndpoint {

    @Inject
    private NamespaceRegistry ns;
    
    @POST
    @Path("getFullUris")
    @Produces(APPLICATION_JSON)
    @Consumes(APPLICATION_JSON)
    public Response getFullUris(@RequestBody(content = { @Content(mediaType = "application/json", examples = {
            @ExampleObject(value = "[\"Help:Start\"]") }) }) final JsonParser jp) throws IOException {
        final ValueFactory vf = SimpleValueFactory.getInstance();
        final JsonUtil.JsonFieldProducer processor = (jGenerator, input) -> {
            try {
                jGenerator
                  .writeStringField(input, ns.resolveToIRI(input).map(iri -> iri.stringValue())
                  .orElse(vf.createIRI(ns.getDefaultNamespace(), input).stringValue()));
            } catch(IOException e) {
                throw new RuntimeException(e);
            }
        };
        final StreamingOutput stream = JsonUtil.processJsonMap(jp, processor);
        return Response.ok(stream).build();
    }

    /**
     * Takes array of URIs, returns array of corresponding prefixed URIs.
     * Set prefixed URI to null if it is not possible to create prefixed URI.)
     */
    @POST
    @Path("getPrefixedUris")
    @Produces(APPLICATION_JSON)
    @Consumes(APPLICATION_JSON)
    public Response getPrefixedUris(@RequestBody(content = {
            @Content(mediaType = "application/json", examples = {
                    @ExampleObject(value = "[\"http://help.metaphacts.com/resource/Start\"]")
            })}) final JsonParser jp) throws IOException {
        final ValueFactory vf = SimpleValueFactory.getInstance();
        final JsonUtil.JsonFieldProducer processor = (jGenerator, input) -> {
            try {
                jGenerator.writeStringField(input, ns.getPrefixedIRI(vf.createIRI(input)).orElse(null));
            } catch(IOException e) {
                throw new RuntimeException(e);
            }
        };
        final StreamingOutput stream = JsonUtil.processJsonMap(jp, processor);
        return Response.ok(stream).build();
    }
    
    @GET
    @Path("getRegisteredPrefixes")
    @NoCache
    @Produces(APPLICATION_JSON)
    @Operation(summary = "Get RDF Prefix Namespaces",
    description = "Get a list of all registered namespaces")
    public Map<String, String> getRegisteredPrefixes(){
        return ns.getPrefixMap();
    }

    @GET
    @Path("getRecords")
    @NoCache
    @Produces(APPLICATION_JSON)
    public List<NamespaceRecord> getRecords(){
        return ns.getRecords();
    }
    
    @PUT
    @Path("setPrefix/{prefix}")
    @Consumes(TEXT_PLAIN)
    @RequiresAuthentication
    @RequiresPermissions({NAMESPACES.CHANGE, NAMESPACES.CREATE})
    public Response updatePrefix(
        @PathParam("prefix") String prefix,
        @QueryParam("targetAppId") String targetAppId,
        String iriString
    ) throws InternalServerErrorException{
        try {
            IRI iri = SimpleValueFactory.getInstance().createIRI(iriString);
            ns.setPrefix(prefix, iri, targetAppId);
            return Response.created(URI.create(iriString)).build();
        } catch (ProtectedNamespaceDeletionException | IllegalArgumentException e) {
            return Response.status(Status.BAD_REQUEST)
                .entity(e.getMessage()).type("text/plain").build();
        } catch(Exception e) {
            return Response.status(Status.INTERNAL_SERVER_ERROR)
                .entity(e.getMessage()).type("text/plain").build();
        }
    }
    
    @DELETE
    @Path("deletePrefix/{prefix}")
    @RequiresAuthentication
    @RequiresPermissions(NAMESPACES.DELETE)
    public Response deletePrefix(
        @PathParam("prefix") String prefix,
        @QueryParam("targetAppId") String targetAppId
    ) throws InternalServerErrorException {
        try {
            boolean found = ns.deletePrefix(prefix, targetAppId);
            if (!found) {
                return Response.status(Status.NOT_FOUND).build();
            }
            return Response.ok().build();
        }catch(IllegalArgumentException e){
            return Response.status(Status.BAD_REQUEST).
                    entity(e.getMessage()).type("text/plain").build();
        }catch(Exception e){
            return Response.status(Status.INTERNAL_SERVER_ERROR).
            entity(e.getMessage()).type("text/plain").build();
        }
    }
}
