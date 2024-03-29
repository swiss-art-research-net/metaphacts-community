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
package com.metaphacts.rest.providers;

import java.io.InputStream;

import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.Status;

import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.util.ModelBuilder;
import org.eclipse.rdf4j.model.util.Models;
import org.eclipse.rdf4j.model.vocabulary.FOAF;
import org.eclipse.rdf4j.rio.RDFFormat;
import org.eclipse.rdf4j.rio.Rio;
import org.glassfish.jersey.server.ResourceConfig;
import org.junit.Assert;
import org.junit.Test;

import com.metaphacts.junit.MetaphactsJerseyTest;


/**
 * @author Johannes Trame <jt@metaphacts.com>
 *
 */
public class Rdf4jModelTurtleMessageBodyWriterTest extends MetaphactsJerseyTest {
    private final static Model testModel = new ModelBuilder()
        .setNamespace("ex", "http://example.org/")
        .subject("ex:s")
        .add(FOAF.NAME, "Joe")
        .build();
    
    @Override
    protected void register(ResourceConfig resourceConfig) {
        resourceConfig
                .register(Rdf4jModelTurtleMessageBodyWriter.class)
                .register(TurleWriterEndpoint.class);
    }
    
    @Test 
    public void testTextTurtle() throws Exception{
        Response response = target("/turtletest").request().accept("text/turtle").get();
        Assert.assertEquals(Status.OK.getStatusCode(),response.getStatus());
        Assert.assertTrue(
                Models.isomorphic(
                        testModel , Rio.parse((InputStream)response.getEntity(),"", RDFFormat.TURTLE)
                )
        );
    }

    @Test 
    public void testUnkownAcceptHeader() throws Exception{
        Response response = target("/turtletest").request().accept("application/x-tutle").get();
        Assert.assertEquals(Status.NOT_ACCEPTABLE.getStatusCode(),response.getStatus());
    }

    @Path("/turtletest")
    public static class TurleWriterEndpoint {

        @GET
        @Path("")
        @Produces({"text/turtle","application/x-turtle"})
        public Model getMessage() {
            return testModel;
        }
    }
}