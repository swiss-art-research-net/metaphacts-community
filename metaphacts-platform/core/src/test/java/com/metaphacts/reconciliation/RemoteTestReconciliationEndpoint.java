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
package com.metaphacts.reconciliation;

import java.util.Map;
import java.util.concurrent.TimeoutException;

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

import com.metaphacts.lookup.model.LookupQuery;

@Path("remote/reconciliation")
@Singleton
public class RemoteTestReconciliationEndpoint {
    public final static String MANIFEST = "{" +
    "   \"identifierSpace\": \"http://www.metaphacts.com/ontologies/platform#remote-reconciliation\"," +
    "   \"name\": \"mp-reconciliation\"," +
    "   \"defaultTypes\": [{\n" +
    "      \"id\": \"http://example.com/entity-type/car\"," +
    "      \"name\": \"car\"" +
    "   }," +
    "   {" +
    "      \"id\": \"http://example.com/entity-type/human\"," +
    "      \"name\": \"human\"" +
    "   }]," +
    "   \"schemaSpace\": \"http://www.metaphacts.com/ontologies/platform#remote-reconciliation-schema\"" +
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
            return Response.ok().entity(MANIFEST).type(MediaType.APPLICATION_JSON).build();
        }
        return Response.ok().entity(RESPONSE).type(MediaType.APPLICATION_JSON).build();
    }
}
