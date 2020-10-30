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

import java.util.Collections;
import java.util.List;

import javax.inject.Inject;
import javax.inject.Singleton;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.core.Response;

import org.apache.commons.lang3.StringUtils;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.shiro.authz.annotation.RequiresAuthentication;
import org.apache.shiro.authz.annotation.RequiresPermissions;

import org.eclipse.rdf4j.model.IRI;

import com.google.common.collect.Lists;

import com.metaphacts.cache.CacheManager;
import com.metaphacts.security.Permissions.CACHES;


/**
 * @author Johannes Trame <jt@metaphacts.com>
 */
@Path("cache")
@Singleton
public class CacheEndpoint {

    private static final Logger logger = LogManager.getLogger(CacheEndpoint.class);

    private CacheManager cacheManager;

    @Inject
    public CacheEndpoint(CacheManager cacheManager) {
        this.cacheManager = cacheManager;
    }

    @POST()
    @Path("/all/invalidate")
    @RequiresAuthentication
    @RequiresPermissions(CACHES.INVALIDATE_ALL)
    public Response invalidateCache() {
        try{
            logger.info("Cache invalidation has been triggered by a REST call.");
            List<String> l = cacheManager.invalidateAll();
            return Response.ok("The following caches have been invalidated: " + StringUtils.join(l, ",")).build();
        }catch(Exception e){
            logger.error("Cache invalidation has been faild: {}", e);
            return Response.serverError().entity(e.getMessage()).build();
        }
    }

    @POST()
    @Path("/all/invalidate/{resource}")
    @RequiresAuthentication
    @RequiresPermissions(CACHES.INVALIDATE_ALL)
    public Response invalidateCacheForResource(@PathParam("resource") IRI resource) {
        try {
            logger.debug("Cache invalidation for " + resource.stringValue()
              + " has been triggered by a REST call.");
            cacheManager.invalidateResources(Collections.singleton(resource));
            return Response.ok("Cache has been invalidated").build();
        } catch(Exception e) {
            logger.error("Cache invalidation has been faild: {}", e);
            return Response.serverError().entity(e.getMessage()).build();
        }
    }

}
