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
package com.metaphacts.lookup.api;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;

import java.util.Map;
import java.util.Optional;

import javax.inject.Inject;

import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;

import com.metaphacts.config.Configuration;
import com.metaphacts.junit.AbstractRepositoryBackedIntegrationTest;
import com.metaphacts.junit.Log4jRule;
import com.metaphacts.junit.RepositoryRule;
import com.metaphacts.lookup.impl.RegexLookupService;
import com.metaphacts.lookup.impl.RegexLookupServiceFactory;
import com.metaphacts.lookup.spi.LookupServiceConfig;
import com.metaphacts.repository.RepositoryManager;

public class LookupServiceManagerTest extends AbstractRepositoryBackedIntegrationTest {
    public static final String REPO_ONE = "one";
    public static final String REPO_TWO = "two";
    
    @Inject
    protected LookupServiceManager lookupServiceManager;
    
    @Rule
    public Log4jRule log4j = Log4jRule.create();

    @Inject
    public RepositoryRule repoRule;
    
    @Inject
    protected Configuration config;

    public RepositoryManager repoManager;
    
    @Before
    public void setup() throws Exception {
        repoManager = repoRule.getRepositoryManager();
    }
    
    @Test
    public void lookupServiceForNamedRepo() throws Exception {
        RegexLookupServiceFactory factory = new RegexLookupServiceFactory();
        LookupServiceConfig lookupServiceConfig = factory.getConfig();
        repoRule.addRepoWithLookupConfig(REPO_ONE, lookupServiceConfig);
        
        LookupService lookupService = null;
        String defaultRepositoryId = RepositoryManager.DEFAULT_REPOSITORY_ID;
        
        Optional<LookupService> defaultLookupService = lookupServiceManager.getDefaultLookupService();
        assertTrue(defaultLookupService.isPresent());
        assertSame(lookupServiceManager.getLookupServiceByName(defaultRepositoryId).get(), defaultLookupService.get());
        
        Map<String, LookupService> lookupServices = lookupServiceManager.getLookupServices();
        assertEquals("Two LookupServices should exist: for 'default' repo and repo '" + REPO_ONE + "'", 2, lookupServices.size());
        
        lookupService = lookupServices.get(defaultRepositoryId);
        assertEquals(RegexLookupService.class, lookupService.getClass());
        
        lookupService = lookupServices.get(REPO_ONE);
        assertEquals(RegexLookupService.class, lookupService.getClass());
    }
}
