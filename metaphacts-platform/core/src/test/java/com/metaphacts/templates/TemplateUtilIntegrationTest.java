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
package com.metaphacts.templates;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Optional;

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Resource;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.model.vocabulary.FOAF;
import org.eclipse.rdf4j.model.vocabulary.RDF;
import org.eclipse.rdf4j.model.vocabulary.SKOS;
import org.hamcrest.MatcherAssert;
import org.hamcrest.collection.IsIterableContainingInAnyOrder;
import org.hamcrest.collection.IsIterableContainingInOrder;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;

import com.github.jknack.handlebars.io.TemplateLoader;
import com.google.common.collect.Lists;
import com.google.common.collect.Sets;
import com.google.inject.Inject;
import com.metaphacts.cache.CacheManager;
import com.metaphacts.cache.LabelService;
import com.metaphacts.cache.QueryTemplateCache;
import com.metaphacts.cache.TemplateIncludeCache;
import com.metaphacts.config.Configuration;
import com.metaphacts.config.NamespaceRegistry;
import com.metaphacts.config.UnknownConfigurationException;
import com.metaphacts.junit.AbstractRepositoryBackedIntegrationTest;
import com.metaphacts.junit.NamespaceRule;
import com.metaphacts.junit.PlatformStorageRule;
import com.metaphacts.junit.TestPlatformStorage;
import com.metaphacts.repository.RepositoryManager;
import com.metaphacts.services.fields.FieldDefinitionGeneratorChain;
import com.metaphacts.services.fields.FieldsBasedSearch;
import com.metaphacts.services.storage.api.PlatformStorage;

/**
 * @author Johannes Trame <jt@metaphacts.com>
 *
 */

public class TemplateUtilIntegrationTest extends AbstractRepositoryBackedIntegrationTest {
    @Inject
    private  TemplateIncludeCache includeCache;

    @Inject
    @Rule
    public NamespaceRule namespaceRule;

    @Inject
    @Rule
    public PlatformStorageRule platformStorageRule;

    @Inject
    private LabelService labelCache;
    
    @Inject
    private QueryTemplateCache queryTemplateCache;
    
    @Inject
    private FieldDefinitionGeneratorChain fieldDefinitionGeneratorChain;

    @Inject
    private CacheManager cacheManager;
    
    @Inject
    private Configuration config;

    private MetaphactsHandlebars handlebars;

    private final ValueFactory vf = SimpleValueFactory.getInstance();

    @Before
    public void setup() throws Exception {
        NamespaceRegistry ns = namespaceRule.getNamespaceRegistry();
        PlatformStorage platformStorage = platformStorageRule.getPlatformStorage();
        TemplateLoader loader = new TemplateByIriLoader(platformStorage, ns);
        RepositoryManager repositoryManager = repositoryRule.getRepositoryManager();
        
        this.handlebars = new MetaphactsHandlebars(
            loader,
            new HandlebarsHelperRegistry(
                config,
                platformStorage,
                cacheManager,
                repositoryManager,
                fieldDefinitionGeneratorChain,
                new FieldsBasedSearch(ns, repositoryManager, labelCache),
                queryTemplateCache,
                labelCache
            )
        );
        cacheManager.deregisterAllCaches();
    }


    @Test
    public void getTemplateSourceTest() throws Exception{
        String content = "This is the person template";
        storeNewRevision(FOAF.PERSON, content);

        assertEquals(content, TemplateUtil.getTemplateSource(this.handlebars.getLoader(), FOAF.PERSON.stringValue())
                .get().content(StandardCharsets.UTF_8));

        assertFalse(TemplateUtil.getTemplateSource(this.handlebars.getLoader(), FOAF.AGENT.stringValue()).isPresent());
    }


    @Test
    public void findFirstExistingTemplateTest() throws Exception{
        storeNewRevision(FOAF.PERSON, "This is the person template");
        storeNewRevision(FOAF.AGENT, "This is the agent template");
        LinkedHashSet<String> set = Sets.newLinkedHashSet();
        set.add(RDF.TYPE.stringValue());
        set.add(FOAF.PERSON.stringValue());
        set.add(FOAF.AGENT.stringValue());
        assertEquals(
                FOAF.PERSON.stringValue(),
                TemplateUtil.findFirstExistingTemplate(this.handlebars.getLoader(), set).get()
        );

        set =Sets.newLinkedHashSet();
        set.add(RDF.TYPE.stringValue());
        set.add(FOAF.AGENT.stringValue());
        set.add(FOAF.PERSON.stringValue());
        assertEquals(
                FOAF.AGENT.stringValue(),
                TemplateUtil.findFirstExistingTemplate(this.handlebars.getLoader(), set).get()
        );

        assertFalse(TemplateUtil.findFirstExistingTemplate(this.handlebars.getLoader(), Sets.<String>newLinkedHashSet()).isPresent());
    }

    @Test
    public void compileAndReturnFirstExistingTemplateTest() throws Exception{

        storeNewRevision(FOAF.PERSON, "This is the person template");
        storeNewRevision(FOAF.AGENT, "This is the agent template");
        LinkedHashSet<String> set = Sets.newLinkedHashSet();
        set.add(RDF.TYPE.stringValue());
        set.add(FOAF.PERSON.stringValue());
        set.add(FOAF.AGENT.stringValue());
        assertEquals(
                "This is the person template",
                TemplateUtil.compileAndReturnFirstExistingTemplate(context(FOAF.PERSON),set, this.handlebars).get()
                );

        set =Sets.newLinkedHashSet();
        set.add(RDF.TYPE.stringValue());
        set.add(FOAF.AGENT.stringValue());
        set.add(FOAF.PERSON.stringValue());
        assertEquals(
                "This is the agent template",
                TemplateUtil.compileAndReturnFirstExistingTemplate(context(FOAF.AGENT),set, this.handlebars).get()
                );

        assertFalse( TemplateUtil.compileAndReturnFirstExistingTemplate(context(FOAF.AGENT),Sets.<String>newLinkedHashSet(), this.handlebars).isPresent());
    }

    @Test
    public void getRdfTemplateIncludeIdentifiersTest() throws Exception{
        //TODO make sure that the standard query is used and not inference with getRdfTemplateIncludeIdentifiersOrderTest
        // should be done with proper JUnit configuration rule
        config.getUiConfig().setParameter(
            "templateIncludeQuery",
            Collections.singletonList("SELECT ?type WHERE { ?? a ?type }"),
            TestPlatformStorage.STORAGE_ID
        );

        IRI joe = vf.createIRI("http://www.metaphacts.com/joe");
        this.addStatements(Lists.newArrayList(
           vf.createStatement(joe, RDF.TYPE, FOAF.PERSON),
           vf.createStatement(joe, RDF.TYPE, FOAF.AGENT)
        ));
        LinkedHashSet<String> set = Sets.newLinkedHashSet();
        set.add("Template:"+FOAF.PERSON.stringValue());
        set.add("Template:"+FOAF.AGENT.stringValue());
        MatcherAssert.assertThat(
                set,
                IsIterableContainingInAnyOrder.containsInAnyOrder(TemplateUtil
                        .getRdfTemplateIncludeIdentifiers(joe, context(joe), includeCache).toArray())
                );
    }

    public void getRdfTemplateIncludeIdentifiersOrderTest() throws UnknownConfigurationException {
        config.getUiConfig().setParameter(
            "templateIncludeQuery",
            Collections.singletonList(
                "SELECT ?type WHERE { VALUES(?type) {"
                + "(<" + FOAF.PERSON.stringValue() + ">) "
                + "(<" + FOAF.AGENT.stringValue() + ">)  "
                + "(<" + SKOS.CONCEPT.stringValue() + ">)} }"
            ),
            TestPlatformStorage.STORAGE_ID
        );
        LinkedHashSet<Resource> includes = includeCache.getTypesForIncludeScheme(repositoryRule.getRepository(), vf.createIRI("http://www.metaphacts.com/anyIRI"), Optional.of(namespaceRule.getNamespaceRegistry()));
        MatcherAssert.assertThat(
                Lists.newArrayList(FOAF.PERSON, FOAF.AGENT, SKOS.CONCEPT),
                IsIterableContainingInOrder.contains(includes.toArray())
        );
        IRI joe = vf.createIRI("http://www.metaphacts.com/joe");

        LinkedHashSet<String> set = Sets.newLinkedHashSet();
        set.add("Template:"+FOAF.PERSON.stringValue());
        set.add("Template:"+FOAF.AGENT.stringValue());
        set.add("Template:"+SKOS.CONCEPT.stringValue());
        MatcherAssert.assertThat(
                set,
                IsIterableContainingInOrder.contains(
                        TemplateUtil.getRdfTemplateIncludeIdentifiers(joe, context(joe), includeCache)
                                .toArray())
                );
    }

    @Test
    public void getPageDifferentFromContextValue() throws Exception{
        IRI page = vf.createIRI("http://www.metaphacts.com/testpage123");
        IRI joe = vf.createIRI("http://www.metaphacts.com/joe");

        storeNewRevision(page, "This the page testpage123, but the context is: [[this]]");
        assertEquals(
            "This the page testpage123, but the context is: http://www.metaphacts.com/joe",
            com.metaphacts.rest.endpoint.TemplateEndpoint.RenderedTemplate
                        .getCompiledHtml(page, context(joe), handlebars, includeCache)
        );
    }

    private TemplateContext context(IRI iri){
        TemplateContext context = new TemplateContext(
            iri, this.repositoryRule.getRepository(), null, null);
        context.setNamespaceRegistry(namespaceRule.getNamespaceRegistry());
        Assert.assertTrue(context.getNamespaceRegistry().isPresent());
        return context;
    }

    private void storeNewRevision(IRI templateIri, String content) throws IOException {
        byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
        platformStorageRule.getObjectStorage().appendObject(
            TemplateByIriLoader.templatePathFromIri(templateIri),
            platformStorageRule.getPlatformStorage().getDefaultMetadata(),
            new ByteArrayInputStream(bytes),
            bytes.length
        );
    }
}
