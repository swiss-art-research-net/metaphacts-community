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

import java.io.File;
import java.util.Collections;

import javax.inject.Inject;
import javax.ws.rs.client.Entity;
import javax.ws.rs.core.Form;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;

import org.apache.commons.configuration2.Configuration;
import org.apache.logging.log4j.Level;
import org.apache.shiro.realm.Realm;
import org.glassfish.jersey.server.ResourceConfig;
import org.junit.Assert;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

import com.metaphacts.cache.CacheManager;
import com.metaphacts.junit.Log4jRule;
import com.metaphacts.junit.MetaphactsJerseyTest;
import com.metaphacts.junit.MetaphactsShiroRule;
import com.metaphacts.junit.PlatformStorageRule;
import com.metaphacts.junit.RepositoryRule;
import com.metaphacts.security.MetaphactsSecurityManagerTest.TestAuthenticatingRealm;
import com.metaphacts.services.storage.api.PlatformStorage;
import com.metaphacts.services.storage.api.StorageConfigWriter;

public class StorageAdminEndpointTest extends MetaphactsJerseyTest {

    @Rule
    public Log4jRule log4j = Log4jRule.create(Level.INFO);

    @Rule
    public TemporaryFolder tempFolder = new TemporaryFolder();

    @Inject
    @Rule
    public PlatformStorageRule platformStorageRule;

    @Inject
    private PlatformStorage platformStorage;

    @Inject
    public com.metaphacts.config.Configuration configuration;


    @Inject
    private CacheManager cacheManager;

    @Inject
    @Rule
    public RepositoryRule repositoryRule;


    private TestAuthenticatingRealm testRealm = new TestAuthenticatingRealm();

    @Rule
    public MetaphactsShiroRule rule = new MetaphactsShiroRule(() -> Collections.<Realm>singletonList(testRealm),
            () -> configuration).withCacheManager(() -> cacheManager)
                    .withPlatformStorageRule(() -> platformStorageRule);

    @Override
    protected void register(ResourceConfig resourceConfig) {
        resourceConfig.register(StorageAdminEndpoint.class);
    }

    @Test
    public void testSimpleCreate_POST() throws Exception {

        File folder = tempFolder.newFolder("my-storage");

        Form form = new Form()
                .param("name", "my-storage")
                .param("type", "nonVersionedFile")
                .param("root", folder.getAbsolutePath().toString());

        Response resp = target("admin/storage/addStorage").request().post(Entity.form(form));

        Assert.assertEquals(200, resp.getStatus());

        Configuration storageConfig = StorageConfigWriter
                .currentConfiguration(platformStorage.getStorage(PlatformStorage.DEVELOPMENT_RUNTIME_STORAGE_KEY))
                .get();

        Assert.assertEquals("nonVersionedFile", storageConfig.getProperty("my-storage.type"));
    }
    
    @Test
    public void testSimpleCreate_MissingName_POST() throws Exception {

        File folder = tempFolder.newFolder("my-storage");

        Form form = new Form()
                .param("type", "nonVersionedFile")
                .param("root", folder.getAbsolutePath().toString());

        Response resp = target("admin/storage/addStorage").request().post(Entity.form(form));
        
        Assert.assertEquals(400, resp.getStatus());
        Assert.assertEquals(
                "Missing form param 'name'",
                resp.readEntity(String.class));
    }
    
    @Test
    public void testSimpleCreate_MissingType_POST() throws Exception {

        File folder = tempFolder.newFolder("my-storage");

        Form form = new Form()
                .param("name", "my-storage")
                .param("root", folder.getAbsolutePath().toString());

        Response resp = target("admin/storage/addStorage").request().post(Entity.form(form));
        
        Assert.assertEquals(400, resp.getStatus());
        Assert.assertEquals(
                "Missing form param 'type'",
                resp.readEntity(String.class));
    }

    @Test
    public void testSimpleCreate_PUT() throws Exception {

        File folder = tempFolder.newFolder("my-storage");

        String jsonConfig = "{ \"my-storage\": { \"type\": \"nonVersionedFile\", \"root\": \""
                + folder.getAbsolutePath().toString() + "\"} }";

        Entity<String> entity = Entity.entity(jsonConfig, MediaType.APPLICATION_JSON_TYPE);
        Response resp = target("admin/storage/addStorage").request().put(entity);

        Assert.assertEquals(200, resp.getStatus());

        Configuration storageConfig = StorageConfigWriter
                .currentConfiguration(platformStorage.getStorage(PlatformStorage.DEVELOPMENT_RUNTIME_STORAGE_KEY))
                .get();

        Assert.assertEquals("nonVersionedFile", storageConfig.getProperty("my-storage.type"));
    }

    @Test
    public void testSimple_ValidationError_AlreadyExists_PUT() throws Exception {

        File folder = tempFolder.newFolder("my-storage");
        platformStorageRule.getPlatformStorage().addStorage("my-storage");

        String jsonConfig = "{ \"my-storage\": { \"type\": \"nonVersionedFile\", \"root\": \""
                + folder.getAbsolutePath().toString() + "\"} }";

        Entity<String> entity = Entity.entity(jsonConfig, MediaType.APPLICATION_JSON_TYPE);
        Response resp = target("admin/storage/addStorage").request().put(entity);

        Assert.assertEquals(400, resp.getStatus());
        Assert.assertEquals(
                "Storage 'my-storage' is already defined and cannot be added.",
                resp.readEntity(String.class));
    }

    @Test
    public void testSimple_ValidationError_RootNotExist_PUT() throws Exception {

        String jsonConfig = "{ \"my-storage\": { \"type\": \"nonVersionedFile\", \"root\": \"/path/to/root\"} }";

        Entity<String> entity = Entity.entity(jsonConfig, MediaType.APPLICATION_JSON_TYPE);
        Response resp = target("admin/storage/addStorage").request().put(entity);

        Assert.assertEquals(400, resp.getStatus());
        Assert.assertEquals(
                "Failed to validate configuration: Invalid configuration for storage ID 'my-storage'. Details: 'root' path does not exists or not a permitted directory: '/path/to/root'",
                resp.readEntity(String.class));
    }

    @Test
    public void testSimple_ValidationError_MissingType_PUT() throws Exception {

        String jsonConfig = "{ \"my-storage\": \"Something\" }";

        Entity<String> entity = Entity.entity(jsonConfig, MediaType.APPLICATION_JSON_TYPE);
        Response resp = target("admin/storage/addStorage").request().put(entity);

        Assert.assertEquals(400, resp.getStatus());
        Assert.assertEquals(
                "Failed to validate configuration: Missing property 'type' for storage 'my-storage'",
                resp.readEntity(String.class));
    }

}
