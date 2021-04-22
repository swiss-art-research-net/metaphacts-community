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
import org.eclipse.rdf4j.model.vocabulary.FOAF;
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
import com.metaphacts.services.fields.FieldDefinitionGeneratorChain;
import com.metaphacts.services.storage.api.ObjectKind;
import com.metaphacts.templates.PageViewConfigSettings;

public class DefaultModelServiceTest extends AbstractRepositoryBackedIntegrationTest implements ResourcesTestData {
    @Inject
    @Rule
    public PlatformStorageRule platformStorageRule;

    @Inject
    @Rule
    public NamespaceRule namespaceRule;

    @Inject
    protected CacheManager cacheManager;

    @Inject
    protected TypeService typeService;

    @Inject
    protected TypePropertyProvider propertyProvider;

    @Inject
    protected FieldDefinitionGeneratorChain fieldDefinitionGeneratorChain;

    @Inject
    protected ResourceDescriptionCacheHolder labelService;

    @Inject
    protected DefaultModelService modelService;

    @Rule
    public Log4jRule log4j = Log4jRule.create(Level.INFO);

    @Before
    public void before() throws Exception {
        platformStorageRule.storeContentFromResource(ObjectKind.CONFIG.resolve(PageViewConfigSettings.CONFIG_FILE_NAME),
                "/com/metaphacts/templates/pageViewConfig.ini");

        namespaceRule.set("ex", "http://example.org/");

        // load test data
        addStatementsFromResources(TEST_ONTOLOGY_FILE, TEST_DATA_FILE);
    }

    @Test
    public void testTypeDescription() throws Exception {
        Repository repository = repositoryRule.getRepository();
        Iterable<IRI> types = modelService.getInstanceTypes(repository, ALICE);
        assertThat(types, containsInAnyOrder(EXAMPLE_PERSON));

        Optional<TypeDescription> typeDescriptionHolder = modelService.getTypeDescription(repository, EXAMPLE_PERSON);
        assertTrue(typeDescriptionHolder.isPresent());
        TypeDescription typeDescription = typeDescriptionHolder.get();
        assertThat(typeDescription.getTypeIRI(), equalTo(EXAMPLE_PERSON));
    }

    @Test
    public void testCaching() {
        Repository repository = repositoryRule.getRepository();
        final ConcurrentMap<IRI, AtomicInteger> loadCounters = new ConcurrentHashMap<>();

        // initialize counters
        loadCounters.put(EXAMPLE_PERSON, new AtomicInteger());
        loadCounters.put(FOAF.AGENT, new AtomicInteger());

        DefaultModelService modelService = new DefaultModelService(cacheManager, typeService, propertyProvider,
                fieldDefinitionGeneratorChain, labelService) {
            @Override
            protected java.util.Optional<TypeDescription> lookupTypeDescription(Repository repository, IRI typeIRI) {
                loadCounters.computeIfAbsent(typeIRI, t -> new AtomicInteger()).incrementAndGet();
                return super.lookupTypeDescription(repository, typeIRI);
            }
        };

        Optional<TypeDescription> typeDescription;

        // here we test whether both positive results (TypeDescription for ex:Person) as
        // well as negative results (no TypeDescription for foaf:Agent) are cached and
        // whether invalidating the cache triggers another load

        // no type descriptions loaded yet
        assertEquals("TypeDescription for foaf:Agent should not have been loaded yet", 0,
                loadCounters.get(FOAF.AGENT).intValue());
        assertEquals("TypeDescription for ex:Person should not have been loaded yet", 0,
                loadCounters.get(EXAMPLE_PERSON).intValue());

        // load type descriptions for first time
        typeDescription = modelService.getTypeDescription(repository, FOAF.AGENT);
        assertFalse("There should be no TypeDescription for foaf:Agent", typeDescription.isPresent());
        assertEquals("TypeDescription for foaf:Agent should have been loaded once", 1,
                loadCounters.get(FOAF.AGENT).intValue());

        typeDescription = modelService.getTypeDescription(repository, EXAMPLE_PERSON);
        assertTrue("There should be a TypeDescription for ex:Person", typeDescription.isPresent());
        assertEquals("TypeDescription for ex:Person should have been loaded once", 1,
                loadCounters.get(EXAMPLE_PERSON).intValue());

        // load type descriptions for second time, should be cached
        typeDescription = modelService.getTypeDescription(repository, FOAF.AGENT);
        assertFalse("There should be no TypeDescription for foaf:Agent", typeDescription.isPresent());
        assertEquals("TypeDescription for foaf:Agent should have been loaded once only", 1,
                loadCounters.get(FOAF.AGENT).intValue());

        typeDescription = modelService.getTypeDescription(repository, EXAMPLE_PERSON);
        assertTrue("There should be a TypeDescription for ex:Person", typeDescription.isPresent());
        assertEquals("TypeDescription for ex:Person should have been loaded once only", 1,
                loadCounters.get(EXAMPLE_PERSON).intValue());

        // invalidate caches
        cacheManager.invalidateAll();

        // load type descriptions for third time
        typeDescription = modelService.getTypeDescription(repository, FOAF.AGENT);
        assertFalse("There should be no TypeDescription for foaf:Agent", typeDescription.isPresent());
        assertEquals("TypeDescription for foaf:Agent should have been loaded once again", 2,
                loadCounters.get(FOAF.AGENT).intValue());

        typeDescription = modelService.getTypeDescription(repository, EXAMPLE_PERSON);
        assertTrue("There should be a TypeDescription for ex:Person", typeDescription.isPresent());
        assertEquals("TypeDescription for ex:Person should have been loaded once again", 2,
                loadCounters.get(EXAMPLE_PERSON).intValue());

        // load type descriptions for fourth time, should be cached
        typeDescription = modelService.getTypeDescription(repository, FOAF.AGENT);
        assertFalse("There should be no TypeDescription for foaf:Agent", typeDescription.isPresent());
        assertEquals("TypeDescription for foaf:Agent should have been loaded once only", 2,
                loadCounters.get(FOAF.AGENT).intValue());

        typeDescription = modelService.getTypeDescription(repository, EXAMPLE_PERSON);
        assertTrue("There should be a TypeDescription for ex:Person", typeDescription.isPresent());
        assertEquals("TypeDescription for ex:Person should have been loaded once only", 2,
                loadCounters.get(EXAMPLE_PERSON).intValue());
    }

}
