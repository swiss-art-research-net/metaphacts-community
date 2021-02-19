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

import javax.inject.Singleton;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.MediaType;

import org.apache.shiro.SecurityUtils;
import org.apache.shiro.authz.annotation.RequiresAuthentication;

import com.metaphacts.data.rdf.container.UserSetRootContainer;

import io.swagger.v3.oas.annotations.Hidden;

/**
 * REST methods for querying {@link com.metaphacts.data.rdf.container.SetRootContainer user set container}
 * and default {@link com.metaphacts.data.rdf.container.SetContainer set} IRIs for current or other user.
 *
 * @see com.metaphacts.templates.helper.SetManagementHelperSource
 * 
 * @author Alexey Morozov
 */
@Path("sets")
@Singleton
public class SetManagementEndpoint {
    @GET
    @Path("getUserSetRootContainerIri")
    @RequiresAuthentication
    @Produces(MediaType.TEXT_PLAIN)
    @Hidden
    public String getUserSetRootContainerIri(@QueryParam("username") String otherUsername) {
        String username = otherUsername == null ? getCurrentUsername() : otherUsername;
        return UserSetRootContainer.setContainerIriForUser(username);
    }

    @GET
    @Path("getUserDefaultSetIri")
    @RequiresAuthentication
    @Produces(MediaType.TEXT_PLAIN)
    public String getUserDefaultSetIri(@QueryParam("username") String otherUsername) {
        String username = otherUsername == null ? getCurrentUsername() : otherUsername;
        return UserSetRootContainer.defaultSetIriForUser(username);
    }

    private String getCurrentUsername() {
        return SecurityUtils.getSubject().getPrincipal().toString();
    }
}
