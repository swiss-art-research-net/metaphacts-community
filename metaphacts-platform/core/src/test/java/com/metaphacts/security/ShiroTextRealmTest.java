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
package com.metaphacts.security;

import java.util.List;
import java.util.Map;

import javax.inject.Inject;

import org.apache.commons.io.IOUtils;
import org.apache.logging.log4j.Level;
import org.apache.shiro.SecurityUtils;
import org.apache.shiro.authc.credential.SimpleCredentialsMatcher;
import org.hamcrest.Matchers;
import org.junit.Assert;
import org.junit.Rule;
import org.junit.Test;

import com.github.jsonldjava.shaded.com.google.common.collect.Maps;
import com.google.common.collect.Lists;
import com.metaphacts.cache.CacheManager;
import com.metaphacts.config.Configuration;
import com.metaphacts.config.UnknownConfigurationException;
import com.metaphacts.junit.AbstractIntegrationTest;
import com.metaphacts.junit.Log4jRule;
import com.metaphacts.junit.MetaphactsShiroRule;
import com.metaphacts.junit.PlatformStorageRule;
import com.metaphacts.services.storage.api.ObjectKind;
import com.metaphacts.services.storage.api.PlatformStorage;
import com.metaphacts.services.storage.api.StoragePath;

public class ShiroTextRealmTest extends AbstractIntegrationTest {

    @Inject
    public Configuration configuration;

    @Inject
    @Rule
    public PlatformStorageRule platformStorageRule;

    @Inject
    private CacheManager cacheManager;

    @Rule
    public Log4jRule log4j = Log4jRule.create(Level.DEBUG);
    
    
    @Rule
    public MetaphactsShiroRule rule = new MetaphactsShiroRule(
            () -> Lists.newArrayList(
                    new ShiroTextRealm(configuration, new SimpleCredentialsMatcher())),
            () -> configuration)
                    .withCacheManager(() -> cacheManager)
                    .withPlatformStorageRule(() -> platformStorageRule)
                    .withPlatformRole("admin", Lists.newArrayList("my:permission:*"))
                    .withInitalizer(rule -> {

                        try {
                            configuration.getEnvironmentConfig().setParameter("securityConfigStorageId",
                                    Lists.newArrayList(PlatformStorage.DEVELOPMENT_RUNTIME_STORAGE_KEY),
                                    PlatformStorage.DEVELOPMENT_RUNTIME_STORAGE_KEY);
                        } catch (UnknownConfigurationException e) {
                            throw new IllegalStateException(e);
                        }
                        // create shiro.ini in runtime storage
                        StringBuilder sb = new StringBuilder();
                        sb.append("[users]\n");
                        sb.append("user = user, admin");
                        platformStorageRule.storeContent(ObjectKind.CONFIG.resolve("shiro.ini"), sb.toString(),
                                PlatformStorage.DEVELOPMENT_RUNTIME_STORAGE_KEY);

                        // runtime storage
                        Map<String, List<String>> runtimeRoles = Maps.newHashMap();
                        runtimeRoles.put("runtime-admin", Lists.newArrayList("my:runtime:admin"));
                        rule.storeRoles(runtimeRoles, "runtime");
                    });
    
    @Test
    public void testAddAccount() throws Exception {

        final MetaphactsSecurityManager securityManager = (MetaphactsSecurityManager) SecurityUtils
                .getSecurityManager();
        AccountManager accountManager = securityManager.getAccountManager();

        accountManager.addAccount("test", "test", "admin", "runtime-admin");

        Assert.assertTrue(accountManager.accountExists("test"));

        StoragePath path = ObjectKind.CONFIG.resolve("shiro.ini");
        String content = IOUtils
                .toString(platformStorageRule.getObjectStorage(PlatformStorage.DEVELOPMENT_RUNTIME_STORAGE_KEY)
                        .getObject(path, null).get().getLocation().readContent(), "UTF-8");

        Assert.assertThat(content, Matchers.containsString("test=test,admin,runtime-admin"));

    }
}
