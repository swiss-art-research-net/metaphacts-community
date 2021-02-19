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

import static org.junit.Assert.assertEquals;

import javax.inject.Singleton;
import javax.ws.rs.ForbiddenException;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.Status;
import javax.ws.rs.ext.ExceptionMapper;
import javax.ws.rs.ext.Provider;

import org.apache.shiro.authz.annotation.RequiresAuthentication;
import org.apache.shiro.authz.annotation.RequiresPermissions;
import org.glassfish.jersey.server.ResourceConfig;
import org.junit.Test;
import org.pf4j.Extension;

import com.metaphacts.junit.MetaphactsJerseyTest;
import com.metaphacts.plugin.extension.RestExtension;
import com.metaphacts.rest.DefaultExceptionMapper;
import com.metaphacts.rest.ForbiddenExceptionMapper;
import com.metaphacts.rest.feature.CacheControl.NoCache;
import com.metaphacts.security.Permissions.LOGS;

/**
 * Tests for REST applications, specifically error handling.
 * 
 * @author Wolfgang Schell <ws@metaphacts.com>author
 *
 */
public class RestApplicationTest extends MetaphactsJerseyTest {

    @Test
    public void testForbidden() {
        Response resp = target("error-test/forbidden").queryParam("name", "world").request().get();
        assertStatus(resp, Status.FORBIDDEN);
    }
    
    @Test
    public void testException() {
        Response resp = target("error-test/exception").queryParam("name", "world").request().get();
        assertStatus(resp, Status.INTERNAL_SERVER_ERROR);
    }
    
    @Test
    public void testRuntimeException() {
        Response resp = target("error-test/runtime-exception").queryParam("name", "world").request().get();
        assertStatus(resp, Status.INTERNAL_SERVER_ERROR);
    }
    
    @Test
    public void testError() {
        Response resp = target("error-test/error").queryParam("name", "world").request().get();
        assertStatus(resp, Status.INTERNAL_SERVER_ERROR);
    }
    
    @Test
    public void testGenericExceptionWithDefaultHandler() {
        Response resp = target("error-test/generic-exception").queryParam("name", "world").request().get();
        assertStatus(resp, Status.INTERNAL_SERVER_ERROR);
    }
    
    @Test
    public void testCustomExceptionWithCustomHandler() {
        // ensure that a handler for a more specific error is used in preference to the default handler
        Response resp = target("error-test/custom-exception").queryParam("name", "world").request().get();
        assertEquals(MyCustomExceptionMapper.STATUS, resp.getStatusInfo());
        assertEquals(MyCustomExceptionMapper.MESSAGE, resp.readEntity(String.class));
    }
    
    @Test
    public void testNotFoundException() {
        // this should not return an internal server error but another status
        Response resp = target("error-test/does-not-exist").queryParam("name", "world").request().get();
        assertEquals(Status.NOT_FOUND, resp.getStatusInfo());
    }

    protected void assertStatus(Response resp, Status status) {
        assertEquals(status, resp.getStatusInfo());
        assertEquals(status.getReasonPhrase(), resp.readEntity(String.class));
    }

    @Override
    protected void register(ResourceConfig resourceConfig) {
        resourceConfig.register(ErrorEndpoint.class);
        resourceConfig.register(DefaultExceptionMapper.class);
        resourceConfig.register(ForbiddenExceptionMapper.class);
        resourceConfig.register(MyCustomExceptionMapper.class);
    }

    
    @Singleton
    @Path("error-test")
    @Extension  // note: this requires the fully-qualified class name in META-INF/extensions.idx
    public static class ErrorEndpoint implements RestExtension {
        
        @GET()
        @Path("forbidden")
        @NoCache
        @RequiresAuthentication
        @Produces(MediaType.APPLICATION_JSON)
        @RequiresPermissions(LOGS.PREFIX_READ)
        public Response forbidden() {
            throw new ForbiddenException("You shall not pass!");
        }
        
        @GET()
        @Path("exception")
        @NoCache
        @RequiresAuthentication
        @Produces(MediaType.APPLICATION_JSON)
        @RequiresPermissions(LOGS.PREFIX_READ)
        public Response exception() throws Exception {
            throw new Exception("Exception: Dummy error!");
        }
        
        @GET()
        @Path("runtime-exception")
        @NoCache
        @RequiresAuthentication
        @Produces(MediaType.APPLICATION_JSON)
        @RequiresPermissions(LOGS.PREFIX_READ)
        public Response runtimeException() {
            throw new RuntimeException("RuntimeException: Dummy error!");
        }
        
        @GET()
        @Path("generic-exception")
        @NoCache
        @RequiresAuthentication
        @Produces(MediaType.APPLICATION_JSON)
        @RequiresPermissions(LOGS.PREFIX_READ)
        public Response genericException() throws Exception {
            throw new MyOtherException("Generic error!");
        }
        
        @GET()
        @Path("custom-exception")
        @NoCache
        @RequiresAuthentication
        @Produces(MediaType.APPLICATION_JSON)
        @RequiresPermissions(LOGS.PREFIX_READ)
        public Response customException() throws Exception {
            throw new MyCustomException("Custom error!");
        }
        
        @GET()
        @Path("error")
        @NoCache
        @RequiresAuthentication
        @Produces(MediaType.APPLICATION_JSON)
        @RequiresPermissions(LOGS.PREFIX_READ)
        public Response error() {
            throw new Error("Dummy error!");
        }
    }
    
    @Provider
    public static class MyCustomExceptionMapper implements ExceptionMapper<MyCustomException> {
        public static final String MESSAGE = "Custom message";
        public static final Status STATUS = Status.OK;

        @Override
        public Response toResponse(MyCustomException exception) {
            return Response.status(STATUS)
                                .entity(MESSAGE).build();
        }
    }
    
    static class MyCustomException extends Exception {
        private static final long serialVersionUID = 1L;

        public MyCustomException(String message) {
            super(message);
        }
    }
    
    static class MyOtherException extends Exception {
        private static final long serialVersionUID = 1L;

        public MyOtherException(String message) {
            super(message);
        }
    }
}
