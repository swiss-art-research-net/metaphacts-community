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
import java.util.LinkedHashMap;

import javax.inject.Inject;

import org.apache.logging.log4j.Level;
import org.hamcrest.MatcherAssert;
import org.hamcrest.Matchers;
import org.jukito.UseModules;
import org.junit.Assert;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;
import org.junit.runner.RunWith;

import com.google.common.collect.Lists;
import com.metaphacts.junit.Log4jRule;
import com.metaphacts.junit.MetaphactsGuiceTestModule;
import com.metaphacts.junit.MetaphactsJukitoRunner;
import com.metaphacts.junit.PlatformStorageRule;


@RunWith(MetaphactsJukitoRunner.class)
@UseModules(MetaphactsGuiceTestModule.class)
public class StorageConfigLoaderTest {

    @Rule
    public Log4jRule log4j = Log4jRule.create(Level.INFO);

    @Inject
    private StorageRegistry storageRegistry;

    @Inject
    private PlatformStorage platformStorage;

    @Inject
    @Rule
    public PlatformStorageRule platformStorageRule;

    @Rule
    public TemporaryFolder tempFolder = new TemporaryFolder();

    @Test
    public void test_dynamicStorageConfig() throws Exception {

        File folder1 = tempFolder.newFolder("my-storage");
        File folder2 = tempFolder.newFolder("another-storage");
        
        platformStorageRule.getPlatformStorage().addStorage("storage1");
        platformStorageRule.getPlatformStorage().addStorage("storage2");
        platformStorageRule.getPlatformStorage().addStorage("dynamic-storage");

        // define my-storage in storage1
        platformStorageRule.storeContent(ObjectKind.CONFIG.resolve("storage.prop"),
                "my-storage.type=nonVersionedFile\n" 
              + "my-storage.mutable=false\n" 
              + "my-storage.root=" + folder1.getCanonicalPath().toString() + "\n"
              + "another-storage.mutable=false",   // test override order
                "storage1");
        
        // define another-storage in storage2
        platformStorageRule.storeContent(ObjectKind.CONFIG.resolve("storage.prop"),
                "another-storage.type=nonVersionedFile\n" 
              + "another-storage.mutable=true\n" 
              + "another-storage.root=" + folder2.getCanonicalPath().toString(),
                "storage2");
        
        // define third-storage in dynamic-storage => should be ignored
        platformStorageRule.storeContent(ObjectKind.CONFIG.resolve("storage.prop"),
                "third-storage.type=nonVersionedFile\n" 
              + "third-storage.mutable=true\n" 
              + "third-storage.root=" + folder1.getCanonicalPath().toString(),
                "dynamic-storage");

        StorageConfigLoader loader = new StorageConfigLoader(storageRegistry);
        LinkedHashMap<String, StorageConfig> foundStorages = loader.readDynamicStorageConfig(platformStorage,
                Lists.newArrayList("dynamic-storage"));

        MatcherAssert.assertThat(foundStorages.keySet(), Matchers.containsInAnyOrder("my-storage", "another-storage"));
        
        // verify property
        Assert.assertEquals("nonVersionedFile", foundStorages.get("my-storage").getStorageType());

        // verify override
        Assert.assertEquals(false, foundStorages.get("another-storage").mutable);
        
    }
}
