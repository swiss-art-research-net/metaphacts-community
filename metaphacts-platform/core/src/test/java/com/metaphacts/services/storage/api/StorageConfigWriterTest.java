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
package com.metaphacts.services.storage.api;

import java.io.File;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Optional;
import java.util.Set;

import javax.inject.Inject;

import org.apache.commons.configuration2.Configuration;
import org.apache.logging.log4j.Level;
import org.apache.shiro.realm.Realm;
import org.hamcrest.MatcherAssert;
import org.hamcrest.Matchers;
import org.jukito.UseModules;
import org.junit.Assert;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;
import org.junit.runner.RunWith;

import com.google.common.collect.Lists;
import com.google.common.collect.Sets;
import com.metaphacts.cache.CacheManager;
import com.metaphacts.config.ConfigurationUtil;
import com.metaphacts.junit.Log4jRule;
import com.metaphacts.junit.MetaphactsGuiceTestModule;
import com.metaphacts.junit.MetaphactsJukitoRunner;
import com.metaphacts.junit.MetaphactsShiroRule;
import com.metaphacts.junit.PlatformStorageRule;
import com.metaphacts.junit.TestPlatformStorage;
import com.metaphacts.security.MetaphactsSecurityManagerTest.TestAuthenticatingRealm;

@RunWith(MetaphactsJukitoRunner.class)
@UseModules(MetaphactsGuiceTestModule.class)
public class StorageConfigWriterTest {

    @Rule
    public Log4jRule log4j = Log4jRule.create(Level.INFO);

    @Inject
    private StorageRegistry storageRegistry;

    @Inject
    private PlatformStorage platformStorage;

    @Inject
    public com.metaphacts.config.Configuration configuration;

    @Inject
    private CacheManager cacheManager;

    @Inject
    @Rule
    public PlatformStorageRule platformStorageRule;


    @Rule
    public TemporaryFolder tempFolder = new TemporaryFolder();
    
    private TestAuthenticatingRealm testRealm = new TestAuthenticatingRealm();

    @Rule
    public MetaphactsShiroRule rule = new MetaphactsShiroRule(
            () -> Collections.<Realm>singletonList(testRealm),
            () -> configuration)
            .withCacheManager(() -> cacheManager)
            .withPlatformStorageRule(() -> platformStorageRule);


    @Test
    public void testNewConfig() throws Exception {

        File folder1 = tempFolder.newFolder("my-storage");

        Configuration configuration = ConfigurationUtil.createEmptyConfig();
        configuration.addProperty("my-storage.type", "nonVersionedFile");
        configuration.addProperty("my-storage.root", folder1.getCanonicalPath().toString());
        configuration.addProperty("my-storage.mutable", "true");

        StorageConfigWriter.mergeStorageConfig(configuration, platformStorageRule.getObjectStorage());

        StorageConfigLoader loader = new StorageConfigLoader(storageRegistry);
        LinkedHashMap<String, StorageConfig> foundStorages = loader.readDynamicStorageConfig(platformStorage,
                Lists.newArrayList());

        MatcherAssert.assertThat(foundStorages.keySet(), Matchers.containsInAnyOrder("my-storage"));
    }

    @Test
    public void testOverrideConfig() throws Exception {

        File folder1 = tempFolder.newFolder("my-storage");
        File folder2 = tempFolder.newFolder("another-storage");
        
        // define my-storage in storage1
        platformStorageRule.storeContent(ObjectKind.CONFIG.resolve("storage.prop"),
                "my-storage.type=nonVersionedFile\n" 
              + "my-storage.mutable=false\n" 
              + "my-storage.root=" + folder1.getCanonicalPath().toString() + "\n"
              + "another-storage.type=nonVersionedFile\n" 
              + "another-storage.mutable=false\n" 
              + "another-storage.root=" + folder2.getCanonicalPath().toString() + "\n",
                TestPlatformStorage.STORAGE_ID);
        

        Configuration configuration = ConfigurationUtil.createEmptyConfig();
        configuration.addProperty("my-storage.type", "nonVersionedFile");
        configuration.addProperty("my-storage.root", folder1.getCanonicalPath().toString());
        configuration.addProperty("my-storage.mutable", "true");

        StorageConfigWriter.mergeStorageConfig(configuration, platformStorageRule.getObjectStorage());

        StorageConfigLoader loader = new StorageConfigLoader(storageRegistry);
        LinkedHashMap<String, StorageConfig> foundStorages = loader.readDynamicStorageConfig(platformStorage,
                Lists.newArrayList());

        MatcherAssert.assertThat(foundStorages.keySet(), Matchers.containsInAnyOrder("my-storage", "another-storage"));
        // verify override
        Assert.assertEquals(true, foundStorages.get("my-storage").mutable);
    }

    @Test
    public void testCurrentConfig() throws Exception {
        
        File folder1 = tempFolder.newFolder("my-storage");
        

        // define my-storage in storage1
        platformStorageRule.storeContent(ObjectKind.CONFIG.resolve("storage.prop"),
                "my-storage.type=nonVersionedFile\n" 
              + "my-storage.mutable=false\n" 
              + "my-storage.root=" + folder1.getCanonicalPath().toString() + "\n",
                TestPlatformStorage.STORAGE_ID);
        
        Optional<Configuration> config = StorageConfigWriter
                .currentConfiguration(platformStorage.getStorage(TestPlatformStorage.STORAGE_ID));

        Set<String> keys = Sets.newHashSet();
        config.get().getKeys().forEachRemaining(key -> keys.add(key));
        MatcherAssert.assertThat(keys,
                Matchers.containsInAnyOrder("my-storage.type", "my-storage.mutable", "my-storage.root"));
        Assert.assertEquals("nonVersionedFile", config.get().getProperty("my-storage.type"));

    }

    @Test
    public void testWriteConfig() throws Exception {
        
        File folder1 = tempFolder.newFolder("my-storage");
        File folder2 = tempFolder.newFolder("another-storage");
        
        // define my-storage in storage1
        platformStorageRule.storeContent(ObjectKind.CONFIG.resolve("storage.prop"),
                "another-storage.type=nonVersionedFile\n" + "another-storage.mutable=false\n" + "another-storage.root="
                        + folder1.getCanonicalPath().toString() + "\n",
                TestPlatformStorage.STORAGE_ID);
        
        Configuration configuration = ConfigurationUtil.createEmptyConfig();
        configuration.addProperty("my-storage.type", "nonVersionedFile");
        configuration.addProperty("my-storage.root", folder2.getCanonicalPath().toString());

        StorageConfigWriter.writeStorageConfig(configuration,
                platformStorage.getStorage(TestPlatformStorage.STORAGE_ID));

        // check written config
        Configuration checkConfig = StorageConfigWriter
                .currentConfiguration(platformStorage.getStorage(TestPlatformStorage.STORAGE_ID)).get();

        Set<String> keys = Sets.newHashSet();
        checkConfig.getKeys().forEachRemaining(key -> keys.add(key));
        MatcherAssert.assertThat(keys,
                Matchers.containsInAnyOrder("my-storage.type", "my-storage.root"));
        Assert.assertEquals("nonVersionedFile", checkConfig.getProperty("my-storage.type"));
    }
}
