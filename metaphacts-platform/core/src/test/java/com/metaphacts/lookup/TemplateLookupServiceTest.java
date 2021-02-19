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
package com.metaphacts.lookup;

import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;
import java.util.stream.Collectors;

import org.apache.logging.log4j.Level;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Statement;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.model.vocabulary.RDF;
import org.eclipse.rdf4j.repository.RepositoryConnection;
import org.eclipse.rdf4j.sail.lucene.LuceneSail;
import org.eclipse.rdf4j.sail.lucene.config.LuceneSailConfig;
import org.eclipse.rdf4j.sail.memory.config.MemoryStoreConfig;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;

import com.google.inject.Inject;
import com.google.inject.Injector;
import com.metaphacts.config.NamespaceRegistry;
import com.metaphacts.junit.AbstractIntegrationTest;
import com.metaphacts.junit.Log4jRule;
import com.metaphacts.junit.PlatformStorageRule;
import com.metaphacts.junit.RepositoryRule;
import com.metaphacts.lookup.api.LookupProcessingException;
import com.metaphacts.lookup.impl.RepositoryBasedLookupConfig;
import com.metaphacts.lookup.impl.TemplateLookupService;
import com.metaphacts.lookup.impl.TemplateLookupServiceFactory;
import com.metaphacts.lookup.model.LookupCandidate;
import com.metaphacts.lookup.model.LookupQuery;
import com.metaphacts.lookup.model.LookupRequest;
import com.metaphacts.lookup.model.LookupResponse;
import com.metaphacts.repository.RepositoryManager;
import com.metaphacts.templates.index.TemplateIndexManager;
import com.metaphacts.templates.index.TemplateIndexManager.TemplateIndexVocabulary;

@SuppressWarnings("unchecked")
public class TemplateLookupServiceTest extends AbstractIntegrationTest {

    private static final ValueFactory vf = SimpleValueFactory.getInstance();

    @Rule
    public Log4jRule log4j = Log4jRule.create(Level.DEBUG);

    @Inject
    private TemplateIndexManager templateIndexManager;

    @Inject
    private RepositoryManager repositoryManager;

    @Inject
    @Rule
    public PlatformStorageRule platformStorageRule;

    @Inject
    public RepositoryRule repoRule;

    @Inject
    public Injector injector;

    private TemplateLookupService templateLookup;

    @Before
    public void setupTemplateLookupService() throws Exception {

        RepositoryBasedLookupConfig config = new RepositoryBasedLookupConfig(TemplateLookupServiceFactory.LOOKUP_TYPE);
        config.setTargetRepository(TemplateIndexManager.METADATA_REPOSITORY_ID);
        templateLookup = new TemplateLookupService(config);
        injector.injectMembers(templateLookup);
    }

    @Before
    public void setupLuceneSail() throws Exception {

        LuceneSailConfig implConfig = new LuceneSailConfig(new MemoryStoreConfig());
        implConfig.setParameter(LuceneSail.LUCENE_RAMDIR_KEY, "true");
        implConfig.setIndexDir("luceneIndex"); // will not be used, but is required to be set by current API
        repoRule.addRepository(TemplateIndexManager.METADATA_REPOSITORY_ID, implConfig);
    }


    @Test
    public void testSimple() throws Exception {

        platformStorageRule.storeNewTemplateRevision(iri("w"), "Walldorf is a nice city.");

        templateIndexManager.reindex();

        assertCheckAllInOrder(lookup("Walldorf"), ID_CHECK(iri("w")));
    }

    @Test
    public void testPrefixMatch() throws Exception {

        platformStorageRule.storeNewTemplateRevision(iri("w"), "Walldorf is a nice city.");

        templateIndexManager.reindex();

        assertCheckAllInOrder(lookup("Wall"), ID_CHECK(iri("w")));
    }

    @Test
    public void testLookupByType() throws Exception {

        // Note: resources in the help namespace are types as help page
        IRI w = vf.createIRI(NamespaceRegistry.DFLT_HELP_NAMESPACE, "w");
        platformStorageRule.storeNewTemplateRevision(w, "Walldorf is a nice city.");
        platformStorageRule.storeNewTemplateRevision(iri("w2"), "Another document about Walldorf.");

        templateIndexManager.reindex();

        List<LookupCandidate> result = lookup("Walldorf", TemplateIndexVocabulary.HELP_PAGE);
        assertCheckAllInOrder(result, ID_CHECK(w));
        assertCheckAllInOrder(result,
                TYPE_CONTAINS_CHECK(TemplateIndexVocabulary.HELP_PAGE, TemplateIndexVocabulary.PAGE));
    }

    @Test
    public void testResultTypes() throws Exception {

        // Note: resources in the help namespace are types as help page
        IRI w = vf.createIRI(NamespaceRegistry.DFLT_HELP_NAMESPACE, "w");
        platformStorageRule.storeNewTemplateRevision(w, "Walldorf is a nice city.");
        platformStorageRule.storeNewTemplateRevision(iri("w2"), "Another document about Walldorf");
        // also explicitly for this classify w2 as help page
        addData(vf.createStatement(iri("w2"), RDF.TYPE, TemplateIndexVocabulary.HELP_PAGE));

        templateIndexManager.reindex();

        List<LookupCandidate> result = lookup("Walldorf");
        assertCheckAllInOrder(result, ID_CHECK(w), ID_CHECK(iri("w2")));
        assertCheckAllInOrder(result,
                TYPE_CONTAINS_CHECK(TemplateIndexVocabulary.HELP_PAGE, TemplateIndexVocabulary.PAGE),
                TYPE_CONTAINS_CHECK(TemplateIndexVocabulary.HELP_PAGE, TemplateIndexVocabulary.PAGE));
    }

    protected IRI iri(String localName) {
        return vf.createIRI("http://example.org/", localName);
    }

    protected List<LookupCandidate> lookup(String query) throws LookupProcessingException {
        return lookup(query, null);
    }

    protected List<LookupCandidate> lookup(String query, IRI type) throws LookupProcessingException {

        LookupQuery q = new LookupQuery();
        q.setQuery(query);
        if (type != null) {
            q.setType(type.stringValue());
        }
        LookupResponse resp = templateLookup.lookup(new LookupRequest("1", q));
        return resp.getResult();
    }

    protected void addData(Statement... stmts) {
        try (RepositoryConnection conn = repositoryManager.getRepository(TemplateIndexManager.METADATA_REPOSITORY_ID)
                .getConnection()) {
            conn.add(Arrays.asList(stmts));
        }
    }


    protected void assertCheckAllInOrder(List<LookupCandidate> result, Consumer<LookupCandidate>... checkFunction) {
        Assert.assertTrue("Expected number of candidates does not match actual number of candiates",
                result.size() == checkFunction.length);
        AtomicInteger index = new AtomicInteger(0);
        result.forEach(lc -> {
            checkFunction[index.getAndIncrement()].accept(lc);
        });
    }

    static Consumer<LookupCandidate> ID_CHECK(IRI iri) {
        return (lc) -> {
            Assert.assertEquals(iri.stringValue(), lc.getId());
        };
    }

    static Consumer<LookupCandidate> TYPE_CONTAINS_CHECK(IRI... type) {
        return (lc) -> {
            Set<String> actual = lc.getTypes().stream().map(let -> let.getId()).collect(Collectors.toSet());
            Set<String> expected = Arrays.asList(type).stream().map(i -> i.stringValue()).collect(Collectors.toSet());
            Assert.assertEquals(expected, actual);
        };
    }
}
