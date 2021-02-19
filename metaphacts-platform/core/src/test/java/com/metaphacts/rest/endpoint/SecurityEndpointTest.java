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

import java.util.List;
import java.util.Map;
import java.util.Set;

import javax.inject.Inject;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.Status;

import org.glassfish.jersey.server.ResourceConfig;
import org.junit.Assert;
import org.junit.Rule;
import org.junit.Test;

import com.github.jsonldjava.shaded.com.google.common.collect.Maps;
import com.github.jsonldjava.shaded.com.google.common.collect.Sets;
import com.github.sdorra.shiro.SubjectAware;
import com.google.common.collect.Lists;
import com.metaphacts.cache.CacheManager;
import com.metaphacts.config.Configuration;
import com.metaphacts.junit.MetaphactsJerseyTest;
import com.metaphacts.junit.MetaphactsShiroRule;
import com.metaphacts.junit.PlatformStorageRule;

public class SecurityEndpointTest extends MetaphactsJerseyTest {

    private final String templatePermissionShiroFile = "classpath:com/metaphacts/security/shiro-security-endpoint.ini";

    @Inject
    public Configuration configuration;

    @Inject
    @Rule
    public PlatformStorageRule platformStorageRule;

    @Inject
    private CacheManager cacheManager;

    @Rule
    public MetaphactsShiroRule rule = new MetaphactsShiroRule(() -> configuration).withCacheManager(() -> cacheManager)
            .withPlatformStorageRule(() -> platformStorageRule)
            .withPlatformRole("admin", Lists.newArrayList("my:permission:*")).withInitalizer(rule -> {

                // runtime storage
                Map<String, List<String>> runtimeRoles = Maps.newHashMap();
                runtimeRoles.put("otherRole", Lists.newArrayList("my:runtime:permission"));
                rule.storeRoles(runtimeRoles, "runtime");
            });

    @Override
    protected void register(ResourceConfig resourceConfig) {
        resourceConfig.register(SecurityEndpoint.class);
    }

    @SuppressWarnings("unchecked")
    @Test
    @SubjectAware(username = "admin", password = "admin", configuration = templatePermissionShiroFile)
    public void testGetCurrentUser() throws Exception {

        Response resp = target("security/user").request().get();
        Assert.assertEquals(Status.OK, resp.getStatusInfo());
        Map<String, Object> userData = resp.readEntity(Map.class);
        Assert.assertEquals("admin", userData.get("principal"));
        Assert.assertEquals("http://www.metaphacts.com/resource/user/admin", userData.get("userURI"));
        Assert.assertEquals(true, userData.get("isAuthenticated"));
        Assert.assertEquals(false, userData.get("isAnonymous"));
    }

    @Test
    @SubjectAware(username = "admin", password = "admin", configuration = templatePermissionShiroFile)
    public void testGetPersonalRoles() throws Exception {

        Response resp = target("security/getPersonalRoles").request().get();
        Assert.assertEquals(Status.OK, resp.getStatusInfo());
        Assert.assertEquals(Sets.newHashSet("admin", "otherRole"), resp.readEntity(Set.class));
    }

    @Test
    @SubjectAware(username = "admin", password = "admin", configuration = templatePermissionShiroFile)
    public void testHasPermission() throws Exception {

        // TODO
        Response resp = target("security/getPersonalRoles").request().get();
        Assert.assertEquals(Status.OK, resp.getStatusInfo());
        Assert.assertEquals(Sets.newHashSet("admin", "otherRole"), resp.readEntity(Set.class));
    }

}
