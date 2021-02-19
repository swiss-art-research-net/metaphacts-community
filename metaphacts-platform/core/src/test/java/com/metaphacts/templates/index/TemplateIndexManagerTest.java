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
package com.metaphacts.templates.index;

import java.util.List;
import java.util.stream.Collectors;

import javax.inject.Inject;

import org.apache.commons.io.IOUtils;
import org.apache.logging.log4j.Level;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.Value;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.model.util.Models;
import org.eclipse.rdf4j.model.vocabulary.RDF;
import org.eclipse.rdf4j.model.vocabulary.RDFS;
import org.eclipse.rdf4j.query.BindingSet;
import org.eclipse.rdf4j.query.QueryResults;
import org.eclipse.rdf4j.query.TupleQuery;
import org.eclipse.rdf4j.repository.Repository;
import org.eclipse.rdf4j.repository.RepositoryConnection;
import org.eclipse.rdf4j.sail.lucene.LuceneSail;
import org.eclipse.rdf4j.sail.lucene.config.LuceneSailConfig;
import org.eclipse.rdf4j.sail.memory.config.MemoryStoreConfig;
import org.hamcrest.MatcherAssert;
import org.hamcrest.Matchers;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Ignore;
import org.junit.Rule;
import org.junit.Test;

import com.google.common.base.Charsets;
import com.google.common.collect.Sets;
import com.metaphacts.junit.AbstractIntegrationTest;
import com.metaphacts.junit.Log4jRule;
import com.metaphacts.junit.PlatformStorageRule;
import com.metaphacts.junit.RepositoryRule;
import com.metaphacts.repository.RepositoryManager;
import com.metaphacts.templates.index.TemplateIndexManager.TemplateIndexVocabulary;

public class TemplateIndexManagerTest extends AbstractIntegrationTest {

    private static final ValueFactory vf = SimpleValueFactory.getInstance();

    @Rule
    public Log4jRule log4j = Log4jRule.create(Level.INFO);

    @Inject
    private TemplateIndexManager templateIndexManager;

    @Inject
    private RepositoryManager repositoryManager;

    @Inject
    @Rule
    public PlatformStorageRule platformStorageRule;

    @Inject
    public RepositoryRule repoRule;

    @Before
    public void before() throws Exception {

        LuceneSailConfig implConfig = new LuceneSailConfig(new MemoryStoreConfig());
        implConfig.setParameter(LuceneSail.LUCENE_RAMDIR_KEY, "true");
        implConfig.setIndexDir("luceneIndex"); // will not be used, but is required to be set by current API
        repoRule.addRepository(TemplateIndexManager.METADATA_REPOSITORY_ID, implConfig);
    }

    @Test
    public void testSimple() throws Exception {

        platformStorageRule.storeNewTemplateRevision(iri("w"), "Walldorf is a nice city.");

        templateIndexManager.reindex();

        assertContainsAll(search("Walldorf"), iri("w"));
    }


    @Test
    public void testMultiMatch() throws Exception {

        platformStorageRule.storeNewTemplateRevision(iri("w1"), "Walldorf is a nice city.");
        platformStorageRule.storeNewTemplateRevision(iri("w2"), "This page is about Walldorf");

        templateIndexManager.reindex();

        assertContainsAll(search("Walldorf"), iri("w1"), iri("w2"));
        assertContainsAll(search("page"), iri("w2"));
        assertContainsAll(search("Wall*"), iri("w1"), iri("w2"));
    }

    @Test
    public void testUpdate() throws Exception {

        platformStorageRule.storeNewTemplateRevision(iri("s"), "The first revision is about Walldorf.");

        templateIndexManager.reindex();

        assertContainsAll(search("Walldorf"), iri("s"));

        // add another revision with other text
        platformStorageRule.storeNewTemplateRevision(iri("s"), "The first revision is about Heidelberg.");

        templateIndexManager.reindex();

        MatcherAssert.assertThat(search("Walldorf"), Matchers.empty());
        assertContainsAll(search("Heidelberg"), iri("s"));
    }

    @Test
    public void testSimple_LocalNameResource() throws Exception {

        platformStorageRule.storeNewTemplateRevision(iri("walldorf"), "The page");
        platformStorageRule.storeNewTemplateRevision(iri("HeidelbergCity"), "The page");

        templateIndexManager.reindex();

        assertContainsAll(search("Walldorf"), iri("walldorf"));
        assertContainsAll(search("Heidelberg*"), iri("HeidelbergCity"));
        assertContainsAll(search("Heidelberg"), iri("HeidelbergCity"));
    }

    @Test
    public void testLabel() throws Exception {

        platformStorageRule.storeNewTemplateRevision(iri("w"), "<h1>Walldorf <b>City</b></h1><p>The page</p>");
        platformStorageRule.storeNewTemplateRevision(iri("HeidelbergCity"), "The page");
        platformStorageRule.storeNewTemplateRevision(iri("o"), "<h1>with & character</h1>");

        templateIndexManager.reindex();

        Repository repo = repositoryManager.getRepository(TemplateIndexManager.METADATA_REPOSITORY_ID);
        try (RepositoryConnection conn = repo.getConnection()) {
            Model labels = QueryResults.asModel(conn.getStatements(null, RDFS.LABEL, null));
            Assert.assertEquals(3, labels.size());
            Assert.assertEquals("Walldorf City", Models.objectString(labels.filter(iri("w"), RDFS.LABEL, null)).get());
            Assert.assertEquals("Heidelberg City",
                    Models.objectString(labels.filter(iri("HeidelbergCity"), RDFS.LABEL, null)).get());
            Assert.assertEquals("with & character",
                    Models.objectString(labels.filter(iri("o"), RDFS.LABEL, null)).get());
        }
    }

    @Test
    public void testStripHtmlSimple() throws Exception {

        platformStorageRule.storeNewTemplateRevision(iri("s"),
                "<div class='ignore'>The content is about <b>Walldorf</b></div>");

        templateIndexManager.reindex();

        assertContainsAll(search("Walldorf"), iri("s"));

        MatcherAssert.assertThat(search("ignore"), Matchers.empty());
    }

    @Test
    public void testStripHtml_onlyContentOfPageContainer() throws Exception {

        platformStorageRule.storeNewTemplateRevision(iri("s"),
                "ignore <div class='page'>The content is about <b>Walldorf</b></div>");

        templateIndexManager.reindex();

        assertContainsAll(search("Walldorf"), iri("s"));

        MatcherAssert.assertThat(search("ignore"), Matchers.empty());
    }

    @Test
    public void testStripHtmlWithMarkup() throws Exception {

        String semanticSearchContent = IOUtils.resourceToString("/com/metaphacts/templates/index/search.html",
                Charsets.UTF_8);
        platformStorageRule.storeNewTemplateRevision(iri("s"),
                semanticSearchContent);

        templateIndexManager.reindex();

        assertContainsAll(search("Profile"), iri("s"));
        MatcherAssert.assertThat(search("anchor"), Matchers.empty());
    }

    @Test
    public void testHandleBarsHelperFunction() throws Exception {

        platformStorageRule.storeNewTemplateRevision(iri("s"),
                "<div>The content is about <b>Walldorf</b> [[resolvePrefix \"Help:SemanticQuery\"]]</div>");

        templateIndexManager.reindex();

        assertContainsAll(search("Walldorf"), iri("s"));
        assertContainsAll(search("http://help.metaphacts.com*"), iri("s"));
    }

    @Test
    @Ignore // in GuiceServletConfig we wrap the call explicitly in System user context,
            // test is available for DEBUG purposes
    public void testAccessToSecurityManager() throws Exception {

        // Note: the below is an example that requires a security manager for a
        // permission check. We however deactivate this test as it is too complex in the
        // test setup to do all the required wrapping
        platformStorageRule.storeNewTemplateRevision(iri("s"),
                " [[#if (ask \"ASK {?a ?b ?c}\") ]] true [[else]]false [[/if]]");

        templateIndexManager.reindex();

        // currently fails, set log level to TRACE to see actual error

        assertContainsAll(search("Walldorf"), iri("s"));
        assertContainsAll(search("http://help.metaphacts.com*"), iri("s"));
    }

    @Test
    public void testResilenceForHandlebarsPartialIncludes() throws Exception {

        // partial include does not exist, page is not indexed at all

        platformStorageRule.storeNewTemplateRevision(iri("s"),
                "<div>The content is about <b>Walldorf</b> [[> Help:SemanticSearchInclude ]]</div>");

        templateIndexManager.reindex();

        MatcherAssert.assertThat(search("Walldorf"), Matchers.empty());
    }

    @Test
    public void testAdditionalMetadata() throws Exception {

        platformStorageRule.storeNewTemplateRevision(iri("s"),
                "<div><b>Walldorf</b> <mp-code-example>the example</mp-code-example></div>");

        templateIndexManager.reindex();

        assertContainsAll(search("Walldorf"), iri("s"));
        Assert.assertEquals("1", getObject(iri("s"), TemplateIndexVocabulary.numberOfExamples).stringValue());
    }

    @Test
    public void testHasIncludes() throws Exception {

        platformStorageRule.storeNewTemplateRevision(iri("s"),
                "<div><b>Walldorf</b> [[> http://example.org/include1 ]]</div>");

        platformStorageRule.storeNewTemplateRevision(iri("include1"), "include");

        templateIndexManager.reindex();

        assertContainsAll(search("Walldorf"), iri("s"));
        Assert.assertEquals("http://example.org/include1",
                getObject(iri("s"), TemplateIndexVocabulary.HAS_INCLUDE).stringValue());

    }

    @Test
    public void testRefineSpecializedTypes() throws Exception {

        IRI helpPage = vf.createIRI(ns.get().getHelpNamespace(), "SomeHelpPage");
        IRI someInclude = vf.createIRI(ns.get().getHelpNamespace(), "SomeInclude");
        
        platformStorageRule.storeNewTemplateRevision(helpPage,
                "<div><b>The Help Page</b> [[> Help:SomeInclude ]]</div>");

        platformStorageRule.storeNewTemplateRevision(someInclude, 
                "some help include");

        templateIndexManager.reindex();
        
        Model m = getModel(someInclude, null, null);
        Assert.assertEquals(Sets.newHashSet(TemplateIndexVocabulary.INCLUDE_PAGE, TemplateIndexVocabulary.PAGE),
                m.filter(null, RDF.TYPE, null).objects());

        Model m2 = getModel(helpPage, null, null);
        Assert.assertEquals(Sets.newHashSet(TemplateIndexVocabulary.PAGE, TemplateIndexVocabulary.HELP_PAGE),
                m2.filter(null, RDF.TYPE, null).objects());
    }
    
    @Test
    public void testComponentNamesInExample() throws Exception {

        platformStorageRule.storeNewTemplateRevision(iri("s"),
                "<div><b>Walldorf</b> \n" + 
                        "The semantic query component is the most powerful and flexible component to query and render SPARQL SELECT query results.\n"
                        +

                "<div class=\"documentation__example__demo\" id='demo2'><mp-code-example>\n" + 
                "<![CDATA[\n"+
                "<semantic-query \n" + 
                "  query='\n" + 
                "    SELECT ?person ?name WHERE {                    \n" + 
                "      VALUES (?person ?name) { (:alice \"Alice\") }\n" + 
                "    }\n" + 
                "  '\n" + 
                "></semantic-query>\n" + 
                "]]>\n" + 
                " </mp-code-example></div></div>");
        

        templateIndexManager.reindex();

        assertContainsAll(search("Walldorf"), iri("s"));
        Assert.assertEquals("1", getObject(iri("s"), TemplateIndexVocabulary.numberOfExamples).stringValue());
        assertContainsAll(search("semantic-query"), iri("s"));
    }

    @Test
    public void testComponentNamesInExample2() throws Exception {

        String semanticSearchContent = IOUtils.resourceToString("/com/metaphacts/templates/index/component.html",
                Charsets.UTF_8);
        platformStorageRule.storeNewTemplateRevision(iri("s"), semanticSearchContent);

        templateIndexManager.reindex();

        Assert.assertEquals("1", getObject(iri("s"), TemplateIndexVocabulary.numberOfExamples).stringValue());
        assertContainsAll(search("\"semantic-query\""), iri("s"));
    }

    @Test
    public void testSystemConfigurationIndexing() throws Exception {

        platformStorageRule.storeNewTemplateRevision(SystemConfigurationMetadataProvider.SYSTEM_CONFIGURATION_PAGE_IRI,
                "System configuration help page");
        
        platformStorageRule.storeNewTemplateRevision(iri("s"), "other page");

        templateIndexManager.reindex();

        Model m = getModel(SystemConfigurationMetadataProvider.SYSTEM_CONFIGURATION_PAGE_IRI,
                TemplateIndexVocabulary.SPECIAL_CONTENT, null);
        Assert.assertTrue(m.size() > 10);

        Model m2 = getModel(iri("s"), TemplateIndexVocabulary.SPECIAL_CONTENT, null);
        Assert.assertTrue(m2.isEmpty());
        
        assertContainsAll(search("securityConfigStorageId"),
                SystemConfigurationMetadataProvider.SYSTEM_CONFIGURATION_PAGE_IRI);
    }


    protected IRI iri(String localName) {
        return vf.createIRI("http://example.org/", localName);
    }

    protected List<BindingSet> search(String term) {

        Repository repo = repositoryManager.getRepository(TemplateIndexManager.METADATA_REPOSITORY_ID);
        try (RepositoryConnection conn = repo.getConnection()) {
            // lucenesail.reindex();
            String qry = "PREFIX search: <http://www.openrdf.org/contrib/lucenesail#> " + "SELECT ?subj ?text "
                    + "WHERE { ?subj search:matches [" + " search:query ?term ; " + " search:snippet ?text ] } ";

            TupleQuery tq = conn.prepareTupleQuery(qry);

            tq.setBinding("term", vf.createLiteral(term));

            return QueryResults.asList(tq.evaluate());
        }
    }

    protected void assertContainsAll(List<BindingSet> searchResult, IRI... iris) {
        MatcherAssert.assertThat(searchResult.stream().map(b -> b.getValue("subj")).collect(Collectors.toList()),
                Matchers.containsInAnyOrder(iris));

    }

    protected Value getObject(IRI subj, IRI prop) {
        Model m = getModel(subj, prop, null);
        Assert.assertEquals(1, m.size());
        return m.objects().iterator().next();
    }

    protected Model getModel(IRI subj, IRI prop, Value obj) {
        Repository repo = repositoryManager.getRepository(TemplateIndexManager.METADATA_REPOSITORY_ID);
        try (RepositoryConnection conn = repo.getConnection()) {
            return QueryResults.asModel(conn.getStatements(subj, prop, null));
        }
    }
}
