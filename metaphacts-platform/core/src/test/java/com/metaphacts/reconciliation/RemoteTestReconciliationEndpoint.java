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
package com.metaphacts.reconciliation;

import java.net.URI;
import java.util.Arrays;
import java.util.Map;
import java.util.concurrent.TimeoutException;

import javax.annotation.Nullable;
import javax.inject.Singleton;
import javax.ws.rs.Consumes;
import javax.ws.rs.FormParam;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaphacts.lookup.model.LookupEntityType;
import com.metaphacts.lookup.model.LookupQuery;
import com.metaphacts.lookup.model.LookupServiceManifest;

@Path("remote/reconciliation")
@Singleton
public class RemoteTestReconciliationEndpoint {

    private static String getRemoteManifest() {
        var manifest = new LookupServiceManifest(
            "mp-reconciliation",
            "http://www.metaphacts.com/ontologies/platform/reconciliation#",
            "http://www.metaphacts.com/ontologies/platform/reconciliation-schema#",
            Arrays.asList(
                new LookupEntityType("http://example.com/entity-type/car", "car"),
                new LookupEntityType("http://example.com/entity-type/human", "human")
            ),
            new LookupServiceManifest.BasicService(
            "http://localhost:10001/api/resource?uri={{id}}"
            ),
            new LookupServiceManifest.PreviewService(
                "http://localhost:10001/api/reconciliation/description?uri={{id}}",
                300,
                200
            ),
            new LookupServiceManifest.BasicService(
                "http://localhost:10001/api/remote/reconciliation/getLabelsForRdfValue"
            ),
            new LookupServiceManifest.BasicService(
                "http://localhost:10001/api/remote/reconciliation/getDescriptionForRdfValue"
            ),
            new LookupServiceManifest.BasicService(
                "http://localhost:10001/api/remote/reconciliation/getTypesForRdfValue"
            )
        );
        ObjectMapper mapper = new ObjectMapper();
        try {
            return mapper.writeValueAsString(manifest);
        } catch (JsonProcessingException e) {
            return "";
        }
    }

    public static final String LABEL_RESPONSE = "{\n" +
    "    \"http://my.custom.namespace/s2\": \"label s2 (no language tag)\"\n" +
    "}";

    public static final String DESCRIPTION_RESPONSE = "{\n" +
    "    \"http://my.custom.namespace/s2\": \"It's the test description for the test\"\n" +
    "}";

    public static final String TYPES_RESPONSE = "{\n" +
    "    \"http://my.custom.namespace/s2\": [ \"http://my.custom.namespace/ExampleEntity_remote\" ]\n" +
    "}";

    public final static String RESPONSE = "{" +
    "    \"q0\": {" +
    "        \"result\": [" +
    "            {" +
    "                \"id\": \"http://www.wikidata.org/entity/Q929\"," +
    "                \"name\": \"Central African Republic\"," +
    "                \"score\": 999.0," +
    "                \"match\": true," +
    "                \"type\": [" +
    "                    {" +
    "                        \"id\": \"http://www.wikidata.org/entity/Q6256\"," +
    "                        \"name\": \"country\"" +
    "                    }," +
    "                    {" +
    "                        \"id\": \"http://www.wikidata.org/entity/Q123480\"," +
    "                        \"name\": \"landlocked country\"" +
    "                    }," +
    "                    {" +
    "                        \"id\": \"http://www.wikidata.org/entity/Q3624078\"," +
    "                        \"name\": \"sovereign state\"" +
    "                    }" +
    "                ]" +
    "            }" +
    "        ]" +
    "    }" +
    "}";

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces({"application/javascript", MediaType.APPLICATION_JSON})
    public Response lookupBodyPart(Map<String, LookupQuery> queries) throws TimeoutException {
        return Response.ok().entity(RESPONSE).type(MediaType.APPLICATION_JSON).build();
    }

    @POST
    @Consumes(MediaType.APPLICATION_FORM_URLENCODED)
    @Produces({MediaType.APPLICATION_JSON, "application/javascript"})
    public Response lookupUrlEncodedFormData(@FormParam("queries") String queries) {
        return Response.ok().entity(RESPONSE).type(MediaType.APPLICATION_JSON).build();
    }

    @GET
    @Produces({"application/javascript", MediaType.APPLICATION_JSON})
    public Response lookupOrGetManifest(@QueryParam("queries") String stringQueries) {
        if (stringQueries == null) {
            return Response.ok().entity(getRemoteManifest()).type(MediaType.APPLICATION_JSON).build();
        }
        return Response.ok().entity(RESPONSE).type(MediaType.APPLICATION_JSON).build();
    }

    @POST
    @Path("getLabelsForRdfValue")
    @Produces({"application/javascript", MediaType.APPLICATION_JSON})
    public Response getLabelsForRdfValue(
        @QueryParam("repository") final @Nullable String repositoryId,
        @QueryParam("preferredLanguage") final @Nullable String preferredLanguage
    ) {
        return Response.ok().entity(LABEL_RESPONSE).type(MediaType.APPLICATION_JSON).build();
    }

    @POST
    @Path("getDescriptionForRdfValue")
    @Produces({"application/javascript", MediaType.APPLICATION_JSON})
    public Response getDescriptionsForRdfValues(
        @QueryParam("repository") final @Nullable String repositoryId,
        @QueryParam("preferredLanguage") final @Nullable String preferredLanguage
    ) {
        return Response.ok().entity(DESCRIPTION_RESPONSE).type(MediaType.APPLICATION_JSON).build();
    }

    @POST
    @Path("getTypesForRdfValue")
    @Produces({"application/javascript", MediaType.APPLICATION_JSON})
    public Response getTypesForRdfValues(
        @QueryParam("repository") final @Nullable String repositoryId
    ) {
        return Response.ok().entity(TYPES_RESPONSE).type(MediaType.APPLICATION_JSON).build();
    }
}
