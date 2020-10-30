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
package com.metaphacts.rest.providers;
import javax.servlet.http.HttpServletResponse;
import javax.ws.rs.DefaultValue;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.Application;
import javax.ws.rs.core.Response;

import org.eclipse.rdf4j.model.IRI;
import org.glassfish.jersey.server.ResourceConfig;
import org.glassfish.jersey.test.JerseyTest;
import org.glassfish.jersey.test.JerseyTestNg;
import org.hamcrest.Matchers;
import org.junit.Assert;
import org.junit.Test;


/**
 * @author Johannes Trame <jt@metaphacts.com>
 *
 */
public class IriParamProviderTest extends JerseyTestNg.ContainerPerClassTest {
    
    @Override
    protected Application configure() {
        return new ResourceConfig()
                .register(IriParamProvider.class)
                .register(IriTestEndpoint.class);
    }
    
    @Test
    public void shouldReturnSameIriAsRequested() {
        String response = target("/iri/iri").queryParam("iri", "http://metaphacts.com/testIRI").request().get(String.class);
        Assert.assertEquals(response, "http://metaphacts.com/testIRI");
    }
    
    @Test
    public void shouldReturnNoIriForNull() {
        String response = target("/iri/null-iri").request().get(String.class);
        Assert.assertEquals(response, "No IRI");
    }
    
    @Test
    public void shouldReturnNoIri() {
        String response = target("/iri/null-iri").queryParam("iri", "http://metaphacts.com/testIRI").request().get(String.class);
        Assert.assertEquals(response, "Should not happen");
    }
    
    @Test
    public void shouldReturnDefaultIri() {
        String response = target("/iri/default-iri").request().get(String.class);
        Assert.assertEquals(response, "http://metaphacts.com/defaultIRI");
    }

    @Test
    public void shouldReturnNotDefaultIri() {
        String response = target("/iri/default-iri").queryParam("iri", "http://metaphacts.com/testIRI").request().get(String.class);
        Assert.assertEquals(response, "http://metaphacts.com/testIRI");
    }

    @Test
    public void notAnAbsoluteUri() {
        Response response = target("/iri/default-iri")
            .queryParam("iri", "not valid")
            .request().get();
        Assert.assertEquals(HttpServletResponse.SC_BAD_REQUEST, response.getStatus());
        Assert.assertEquals(
            "IRI \"not valid\" is not an absolute IRI.",
            response.readEntity(String.class)
        );
    }

    @Test
    public void nonValidURI() {
        Response response = target("/iri/default-iri")
            .queryParam("iri", "http://this:is:not:valid.com/abc")
            .request().get();
        Assert.assertEquals(HttpServletResponse.SC_BAD_REQUEST, response.getStatus());
        Assert.assertThat(
            response.readEntity(String.class),
            Matchers.containsString("absolute or empty path expected")
        );
    }

    @Path("/iri")
    public static class IriTestEndpoint {

        @GET
        @Path("/iri")
        public String getMessage(@QueryParam("iri") IRI iri) {
            return iri.stringValue();
        }
        
        @GET
        @Path("/null-iri")
        public String getNoString(@QueryParam("iri") IRI iri) {
            if(iri==null){
                return "No IRI";
            }
            return "Should not happen";
        }
        
        @GET
        @Path("/default-iri")
        public String getDefaultString(@DefaultValue("http://metaphacts.com/defaultIRI") @QueryParam("iri") IRI iri) {
            return iri.toString();
        }
    }

}