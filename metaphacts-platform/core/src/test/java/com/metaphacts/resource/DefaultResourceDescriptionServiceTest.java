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

import static org.eclipse.rdf4j.model.util.Values.iri;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicInteger;

import javax.inject.Inject;

import org.apache.logging.log4j.Level;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.repository.Repository;
import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;

import com.metaphacts.cache.CacheManager;
import com.metaphacts.cache.ResourceDescriptionCacheHolder;
import com.metaphacts.junit.AbstractRepositoryBackedIntegrationTest;
import com.metaphacts.junit.Log4jRule;
import com.metaphacts.junit.NamespaceRule;
import com.metaphacts.junit.PlatformStorageRule;
import com.metaphacts.junit.TestPlatformStorage;
import com.metaphacts.services.fields.FieldDefinitionGeneratorChain;
import com.metaphacts.services.storage.api.StoragePath;
import com.metaphacts.templates.TemplateUtil;

public class DefaultResourceDescriptionServiceTest extends AbstractRepositoryBackedIntegrationTest
        implements ResourcesTestData {
    @Inject
    @Rule
    public PlatformStorageRule platformStorageRule;

    @Inject
    @Rule
    public NamespaceRule namespaceRule;

    @Inject
    protected CacheManager cacheManager;

    @Inject
    protected FieldDefinitionGeneratorChain fieldDefinitionGeneratorChain;

    @Inject
    protected DescriptionRenderer descriptionRenderer;

    @Inject
    protected ResourceDescriptionCacheHolder labelService;

    @Inject
    protected DefaultModelService modelService;

    @Inject
    protected DefaultResourceDescriptionService descriptionService;

    @Rule
    public Log4jRule log4j = Log4jRule.create(Level.INFO);

    @Before
    public void before() throws Exception {
        // set up test template
        String descriptionTemplate = "[[[label]]] ([[[type]]]): [[occupation.0.value]] ([[date-formatYear dateOfBirth.0.value]])[[#if marriedTo]], married to [[marriedTo.0.value]][[/if]]";
        StoragePath descriptionTemplatePath = DescriptionTemplateByIriLoader
                .descriptionTemplatePathFromIri(iri(TemplateUtil.convertResourceToTemplateIdentifier(EXAMPLE_PERSON)));
        platformStorageRule.storeContent(descriptionTemplatePath, descriptionTemplate, TestPlatformStorage.STORAGE_ID);

        namespaceRule.set("ex", "http://example.org/");

        // load test data
        addStatementsFromResources(TEST_ONTOLOGY_FILE, TEST_DATA_FILE);
    }

    @Test
    public void testSimpleDescription() throws Exception {
        Repository repository = repositoryRule.getRepository();

        Optional<Literal> description = descriptionService.getDescription(ALICE, repository, "en");
        assertTrue("There should be a description for Alice", description.isPresent());
        assertThat(description.get().stringValue(),
                equalTo("Alice (en) (Person): Researcher (1980), married to Charlie (en)"));
    }

    @Test
    public void testCaching() {
        Repository repository = repositoryRule.getRepository();
        final ConcurrentMap<IRI, AtomicInteger> loadCounters = new ConcurrentHashMap<>();

        // initialize counters
        loadCounters.put(ALICE, new AtomicInteger());
        loadCounters.put(DONALD, new AtomicInteger());

        DefaultResourceDescriptionService resourceDescriptionService = new DefaultResourceDescriptionService(config,
                cacheManager, platformStorageRule.getPlatformStorage(), namespaceRule.getNamespaceRegistry(),
                fieldDefinitionGeneratorChain, descriptionRenderer, labelService, modelService) {
            @Override
            protected java.util.Optional<Literal> lookupDescription(Repository repository, IRI resourceIri,
                    java.util.List<String> preferredLanguages) {
                loadCounters.computeIfAbsent(resourceIri, t -> new AtomicInteger()).incrementAndGet();
                return super.lookupDescription(repository, resourceIri, preferredLanguages);
            }

            @Override
            protected java.util.Optional<ResourceDescription> lookupResourceDescription(Repository repository, com.metaphacts.cache.LiteralCacheKey cacheKey) {
                return super.lookupResourceDescription(repository, cacheKey);
            }
        };

        Optional<Literal> description;

        // here we test whether both positive results (description for Alice) as
        // well as negative results (no description for Donald) are cached and
        // whether invalidating the cache triggers another load

        // no type descriptions loaded yet
        assertEquals("description for Donald should not have been loaded yet", 0, loadCounters.get(DONALD).intValue());
        assertEquals("description for Alice should not have been loaded yet", 0,
                loadCounters.get(ALICE).intValue());

        // load type descriptions for first time
        description = resourceDescriptionService.getDescription(DONALD, repository, "de");
        assertFalse("There should be no description for Donald", description.isPresent());
        assertEquals("description for Donald should have been loaded once", 1, loadCounters.get(DONALD).intValue());

        description = resourceDescriptionService.getDescription(ALICE, repository, "de");
        assertTrue("There should be a description for Alice", description.isPresent());
        assertEquals("description for Alice should have been loaded once", 1,
                loadCounters.get(ALICE).intValue());
        assertThat(description.get().stringValue(),
                equalTo("Alice (de) (Person): Researcher (1980), married to Charlie (de)"));

        // load type descriptions for second time, should be cached
        description = resourceDescriptionService.getDescription(DONALD, repository, "de");
        assertFalse("There should be no description for Donald", description.isPresent());
        assertEquals("description for Donald should have been loaded once only", 1,
                loadCounters.get(DONALD).intValue());

        description = resourceDescriptionService.getDescription(ALICE, repository, "de");
        assertTrue("There should be a description for Alice", description.isPresent());
        assertEquals("description for Alice should have been loaded once only", 1,
                loadCounters.get(ALICE).intValue());

        // invalidate caches
        cacheManager.invalidateAll();

        // load type descriptions for third time
        description = resourceDescriptionService.getDescription(DONALD, repository, "de");
        assertFalse("There should be no description for Donald", description.isPresent());
        assertEquals("description for Donald should have been loaded once again", 2,
                loadCounters.get(DONALD).intValue());

        description = resourceDescriptionService.getDescription(ALICE, repository, "de");
        assertTrue("There should be a description for Alice", description.isPresent());
        assertEquals("description for Alice should have been loaded once again", 2,
                loadCounters.get(ALICE).intValue());

        // load type descriptions for fourth time, should be cached
        description = resourceDescriptionService.getDescription(DONALD, repository, "de");
        assertFalse("There should be no description for Donald", description.isPresent());
        assertEquals("description for Donald should have been loaded once only", 2,
                loadCounters.get(DONALD).intValue());

        description = resourceDescriptionService.getDescription(ALICE, repository, "de");
        assertTrue("There should be a description for Alice", description.isPresent());
        assertEquals("description for Alice should have been loaded once only", 2,
                loadCounters.get(ALICE).intValue());
    }
}
