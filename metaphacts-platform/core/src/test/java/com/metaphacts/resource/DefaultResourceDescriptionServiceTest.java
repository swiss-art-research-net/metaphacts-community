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
package com.metaphacts.resource;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.equalTo;
import static org.junit.Assert.assertTrue;

import java.util.Optional;

import javax.inject.Inject;

import org.apache.logging.log4j.Level;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.vocabulary.FOAF;
import org.eclipse.rdf4j.repository.Repository;
import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;

import com.github.sdorra.shiro.ShiroRule;
import com.github.sdorra.shiro.SubjectAware;
import com.metaphacts.cache.CacheManager;
import com.metaphacts.config.Configuration;
import com.metaphacts.junit.AbstractRepositoryBackedIntegrationTest;
import com.metaphacts.junit.Log4jRule;
import com.metaphacts.junit.MetaphactsShiroRule;
import com.metaphacts.junit.NamespaceRule;
import com.metaphacts.junit.PlatformStorageRule;
import com.metaphacts.junit.RepositoryRule;
import com.metaphacts.services.storage.api.ObjectKind;
import com.metaphacts.templates.PageViewConfigManager;
import com.metaphacts.templates.PageViewConfigSettings;

public class DefaultResourceDescriptionServiceTest extends AbstractRepositoryBackedIntegrationTest
        implements ResourcesTestData {
    private final String templatePermissionShiroFile = "classpath:com/metaphacts/security/shiro-templates-rights.ini";

    @Rule
    public ShiroRule shiroRule = new ShiroRule();

    @Inject
    public Configuration configuration;

    @Inject
    @Rule
    public PlatformStorageRule platformStorageRule;

    @Inject
    @Rule
    public NamespaceRule namespaceRule;

    @Inject
    protected CacheManager cacheManager;

    @Inject
    protected PageViewConfigSettings pageRenderConfig;

    @Inject
    protected PageViewConfigManager pageViewConfigManager;

    @Inject
    protected DefaultResourceDescriptionService descriptionService;

    @Rule
    public Log4jRule log4j = Log4jRule.create(Level.INFO);

    @Inject
    @Rule
    public RepositoryRule repositoryRule;

    @Before
    public void before() throws Exception {

        platformStorageRule.storeContentFromResource(ObjectKind.CONFIG.resolve(PageViewConfigSettings.CONFIG_FILE_NAME),
                "/com/metaphacts/templates/pageViewConfig.ini");

        pageRenderConfig.reloadConfiguration();

        namespaceRule.set("ex", "http://example.org/");

        // load test data
        addStatementsFromResources(TEST_ONTOLOGY_FILE, TEST_DATA_FILE);
    }

    @Rule
    public MetaphactsShiroRule rule = new MetaphactsShiroRule(() -> configuration).withCacheManager(() -> cacheManager)
            .withPlatformStorageRule(() -> platformStorageRule);

    @Test
    @SubjectAware(username = "admin", password = "admin", configuration = templatePermissionShiroFile)
    public void testBasicInstanceType() throws Exception {
        Repository repository = repositoryRule.getRepository();
        Iterable<IRI> types = descriptionService.getInstanceTypes(repository, ALICE);
        assertThat(types, containsInAnyOrder(EXAMPLE_PERSON));

        types = descriptionService.getInstanceTypes(repository, BOB);
        assertThat(types, containsInAnyOrder(FOAF.PERSON, EXAMPLE_PERSON));
    }

    @Test
    @SubjectAware(username = "admin", password = "admin", configuration = templatePermissionShiroFile)
    public void testTypeDescription() throws Exception {
        Repository repository = repositoryRule.getRepository();
        Iterable<IRI> types = descriptionService.getInstanceTypes(repository, ALICE);
        assertThat(types, containsInAnyOrder(EXAMPLE_PERSON));

        Optional<TypeDescription> typeDescriptionHolder = descriptionService.getTypeDescription(repository,
                EXAMPLE_PERSON);
        assertTrue(typeDescriptionHolder.isPresent());
        TypeDescription typeDescription = typeDescriptionHolder.get();
        assertThat(typeDescription.getTypeIRI(), equalTo(EXAMPLE_PERSON));
    }

    @Test
    @SubjectAware(username = "admin", password = "admin", configuration = templatePermissionShiroFile)
    public void testBasicDescriptionProperties() throws Exception {
        // TODO implement
    }

    // TODO cover more cases

    @Test
    @SubjectAware(username = "admin", password = "admin", configuration = templatePermissionShiroFile)
    public void dummyTest() {
        // override this method so we can provide a subject and password
        // otherwise we'll get an exception
        super.dummyTest();
    }
}
