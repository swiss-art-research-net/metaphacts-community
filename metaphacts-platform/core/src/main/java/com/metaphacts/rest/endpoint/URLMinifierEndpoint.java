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

import javax.inject.Inject;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.UriInfo;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.shiro.authz.annotation.RequiresPermissions;
import org.eclipse.rdf4j.repository.RepositoryException;

import com.metaphacts.rest.feature.CacheControl.NoCache;
import com.metaphacts.security.Permissions.SERVICES;
import com.metaphacts.services.URLMinifierService;

import io.swagger.v3.oas.annotations.Hidden;


/**
 * Endpoint for REST access to bimap of short link key and corresponding URLs
 * Used by client side to generate short link on demand
 * 
 * @author Denis Ostapenko
 */
@Path("url-minify")
@Hidden
public class URLMinifierEndpoint {
    private static final Logger logger = LogManager.getLogger(URLMinifierEndpoint.class);

    @Context
    UriInfo uri;

    @Inject
    private URLMinifierService urlMinifierService;

    @GET()
    @NoCache
    @Path("getShort")
    @Produces(MediaType.TEXT_PLAIN)
    @RequiresPermissions(SERVICES.URL_MINIFY)
    public String getShort(@QueryParam("url") String url) throws RepositoryException {
        String key = urlMinifierService.queryDBByURL(url);
        if (key == null) {
            while (true) {
                key = urlMinifierService.randomKey();
                if (urlMinifierService.queryDBByKey(key) == null) {
                    urlMinifierService.addKeyURL(key, url);
                    break;
                }
            }
        }
        return key;
    }
}
