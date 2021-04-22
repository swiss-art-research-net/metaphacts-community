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

import static org.eclipse.rdf4j.model.util.Values.iri;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

import javax.inject.Inject;

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.model.Value;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.model.vocabulary.FOAF;
import org.eclipse.rdf4j.model.vocabulary.RDF;
import org.eclipse.rdf4j.model.vocabulary.RDFS;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;

import com.google.common.collect.Lists;
import com.metaphacts.cache.CacheManager;
import com.metaphacts.junit.AbstractRepositoryBackedIntegrationTest;
import com.metaphacts.lookup.impl.AbstractLookupService;
import com.metaphacts.lookup.impl.CommonLookupConfig;
import com.metaphacts.lookup.impl.GenericSparqlLookupServiceFactory;
import com.metaphacts.lookup.impl.LookupScoreOptions;
import com.metaphacts.lookup.model.LookupCandidate;
import com.metaphacts.lookup.model.LookupDataProperty;
import com.metaphacts.lookup.model.LookupDataset;
import com.metaphacts.lookup.model.LookupEntityType;
import com.metaphacts.lookup.model.LookupObjectProperty;
import com.metaphacts.lookup.model.LookupObjectPropertyLink;
import com.metaphacts.lookup.model.LookupProperty;
import com.metaphacts.lookup.model.LookupPropertyStrictType;
import com.metaphacts.lookup.model.LookupQuery;
import com.metaphacts.lookup.model.LookupRequest;
import com.metaphacts.lookup.model.LookupResponse;
import com.metaphacts.lookup.util.LookupSparqlQueryBuilder;
import com.metaphacts.util.ReflectionUtil;

public class LookupServiceTest extends AbstractRepositoryBackedIntegrationTest {
    private static final int UNIQUE_TOKEN_LENGTH = 32;
    private static final ValueFactory vf = SimpleValueFactory.getInstance();
    private static final IRI ALICE_1 = vf.createIRI("http://www.metaphacts.com/Alice1");
    private static final IRI ALICE_2 = vf.createIRI("http://www.metaphacts.com/Alice2");
    private static final IRI ALICE_3 = vf.createIRI("http://www.metaphacts.com/Alice3");
    private static final IRI ALICE_4 = vf.createIRI("http://www.metaphacts.com/Alice4");
    private static final IRI MONA_LISA = vf.createIRI("http://www.wikidata.org/entity/Q12418");
    private static final IRI PAINTING = vf.createIRI("http://www.wikidata.org/entity/Q3305213");
    private static final Literal ALICE_NAME_1 = vf.createLiteral("Alice");
    private static final Literal ALICE_NAME_2 = vf.createLiteral("Alice from");
    private static final Literal ALICE_NAME_3 = vf.createLiteral("Alice from Wonderland");
    private static final Literal ALICE_NAME_4 = vf.createLiteral("Alice from Mirrorland");
    private static final Literal PAINTING_NAME = vf.createLiteral("painting");
    private static final Literal AGE = vf.createLiteral(18);

    @Inject
    protected LookupServiceManager lookupServiceManager;

    @Inject
    protected CacheManager cacheManager;

    int queryCounter = 0;

    private static final String REFERENCE_REGEX_QUERY = "SELECT\n" +
        "?candidate\n" +
        "(GROUP_CONCAT(DISTINCT STR(?type) ; separator=\",\") as ?types)\n" +
        "(MAX(?score_private) as ?score)\n" +
    "WHERE {\n" +
        "?candidate a ?__type__.\n" +
        "?candidate a ?type.\n" +
        "?candidate ?keyProp ?key.\n" +
        "FILTER ISLITERAL(?key)\n" +
        "BIND(IF(STRLEN(?key) > STRLEN(?__token__),STRLEN(?__token__) - STRLEN(?key),IF(STRLEN(?key) < STRLEN(?__token__),STRLEN(?key) - STRLEN(?__token__),\"0\"))  as ?score_private)\n" +
        "FILTER REGEX(LCASE(STR(?key)), LCASE(?__token__), \"i\").\n" +
        "{\n" +
            "?candidate ?__property__0 ?value0.FILTER ISLITERAL(?value0)\n" +
            "FILTER (STR(?value0) = STR(?__literal__0))\n" +
        "}\n" +
    "} GROUP BY ?candidate ORDER BY DESC(?score) LIMIT 4";

    private static final String REFERENCE_BLAZEGRAPH_QUERY = "SELECT\n" +
        "?candidate\n" +
        "(GROUP_CONCAT(DISTINCT STR(?type) ; separator=\",\") as ?types)\n" +
        "(MAX(?score_private) as ?score)\n" +
    "WHERE {\n" +
        "?candidate a ?__type__.\n" +
        "?candidate a ?type.\n" +
        "?candidate ?keyProp ?key.\n" +
        "FILTER ISLITERAL(?key)\n" +
        "SERVICE <http://www.bigdata.com/rdf/search#search> {\n" +
            "?key <http://www.bigdata.com/rdf/search#search> ?__token__;\n" +
            "<http://www.bigdata.com/rdf/search#relevance> ?score_private ;\n" +
            "<http://www.bigdata.com/rdf/search#minRelevance> \"0.1\";\n" +
            "<http://www.bigdata.com/rdf/search#matchAllTerms> \"true\".\n" +
        "}\n" +
        "{\n" +
            "?candidate ?__property__0 ?__object__0.\n" +
        "} UNION {\n" +
            "?candidate ?__property__1 ?value1.FILTER ISLITERAL(?value1)\n" +
            "FILTER (STR(?value1) = STR(?__literal__1))\n" +
        "}\n" +
    "} GROUP BY ?candidate ORDER BY DESC(?score) LIMIT 2";

    @Before
    public void setUp() throws Exception {
        this.addStatements(Lists.newArrayList(
            vf.createStatement(ALICE_1, RDFS.LABEL, ALICE_NAME_1),
            vf.createStatement(ALICE_1, RDF.TYPE, FOAF.AGENT),
            vf.createStatement(ALICE_1, FOAF.AGE, AGE),

            vf.createStatement(ALICE_2, RDFS.LABEL, ALICE_NAME_2),
            vf.createStatement(ALICE_2, RDF.TYPE, FOAF.AGENT),
            vf.createStatement(ALICE_2, FOAF.AGE, AGE),

            vf.createStatement(ALICE_3, RDFS.LABEL, ALICE_NAME_3),
            vf.createStatement(ALICE_3, RDF.TYPE, FOAF.AGENT),
            vf.createStatement(ALICE_3, FOAF.AGE, AGE),
            vf.createStatement(ALICE_3, FOAF.KNOWS, ALICE_4),

            vf.createStatement(ALICE_4, RDFS.LABEL, ALICE_NAME_4),
            vf.createStatement(ALICE_4, RDF.TYPE, FOAF.AGENT),
            vf.createStatement(ALICE_4, FOAF.AGE, AGE),
            vf.createStatement(ALICE_4, FOAF.KNOWS, ALICE_3),
            
            vf.createStatement(MONA_LISA, RDF.TYPE, PAINTING),
            vf.createStatement(PAINTING, RDFS.LABEL, PAINTING_NAME)
        ));
        queryCounter = 0;
    }

    @Test
    public void testLookUpService() throws Exception {
        repositoryRule.addRepoWithLookupConfig("dummy-repo", GenericSparqlLookupServiceFactory.LOOKUP_TYPE);
        Optional<LookupService> lookupService = lookupServiceManager.getDefaultLookupService();

        LookupRequest request = new LookupRequest(
            "test-query", new LookupQuery(
            "Alice", 3, FOAF.AGENT.stringValue(), null, null, null)
        );

        LookupResponse response = lookupService.get().lookup(request);
        Assert.assertTrue(response.getResult().size() == 3);
        LookupCandidate candidate1 = response.getResult().get(0);
        Assert.assertTrue(candidate1.getId().equals(ALICE_1.stringValue()));
        Assert.assertTrue(candidate1.getName().equals(ALICE_NAME_1.stringValue()));

        LookupCandidate candidate2 = response.getResult().get(1);
        Assert.assertTrue(candidate2.getId().equals(ALICE_2.stringValue()));
        Assert.assertTrue(candidate2.getName().equals(ALICE_NAME_2.stringValue()));

        LookupCandidate candidate3 = response.getResult().get(2);
        Assert.assertTrue(candidate3.getId().equals(ALICE_3.stringValue()));
        Assert.assertTrue(candidate3.getName().equals(ALICE_NAME_3.stringValue()));
    }

    @Test
    public void testRegexQueryBuilder() {
        int BINDINGS_NUMBER = 5;
        List<LookupProperty<?>> properties = new LinkedList<>();
        properties.add(new LookupDataProperty(FOAF.AGE.stringValue(), "18"));

        LookupQuery query = new LookupQuery(
            "Alice",
            4,
            FOAF.AGENT.stringValue(),
            LookupPropertyStrictType.all,
            properties, null);
        LookupSparqlQueryBuilder.QueryPart parsedQuery = LookupSparqlQueryBuilder.parseRegexQuery(query);
        Map<String, Value> bindings = parsedQuery.getBindings();
        assertEquals(bindings.size(), BINDINGS_NUMBER);

        String stringQuery = clearOutUUIDs(parsedQuery.getAsString(), bindings);
        assertEquals(stringQuery, REFERENCE_REGEX_QUERY);
        assertEquals(stringQuery.endsWith("LIMIT 4"), true);
    }

    @Test
    public void testBlazegraphFtsQueryBuilder() {
        int BINDINGS_NUMBER = 7;
        List<LookupProperty<?>> properties = new LinkedList<>();
        properties.add(new LookupObjectProperty(FOAF.KNOWS.stringValue(), new LookupObjectPropertyLink(ALICE_4.stringValue())));
        properties.add(new LookupDataProperty(FOAF.AGE.stringValue(), "18"));

        LookupQuery query = new LookupQuery(
            "Alice",
            2,
            FOAF.AGENT.stringValue(),
            LookupPropertyStrictType.should,
            properties, null);
        LookupSparqlQueryBuilder.QueryPart parsedQuery = LookupSparqlQueryBuilder.parseQueryForBlazegraph(query);

        Map<String, Value> bindings = parsedQuery.getBindings();
        assertEquals(BINDINGS_NUMBER, bindings.size());

        String stringQuery = clearOutUUIDs(parsedQuery.getAsString(), bindings);

        assertEquals(stringQuery, REFERENCE_BLAZEGRAPH_QUERY);
        assertEquals(stringQuery.endsWith("LIMIT 2"), true);
    }

    @Test
    public void testLookupServiceCache()  throws Exception {
        // setup another repository with specific lookup results
        AtomicInteger callCounter = new AtomicInteger();
        String repositoryId = "my-repo";
        CommonLookupConfig config = new CommonLookupConfig();
        Optional<LookupService> lookupService = setupMockLookupService(callCounter, repositoryId, config);

        LookupQuery query = new LookupQuery("Alice", 3, FOAF.AGENT.stringValue(), null, null, null);

        // no lookup calls have been performed yet
        assertEquals(0, callCounter.get());

        LookupResponse response = lookupService.get().lookup(new LookupRequest(queryId(), query));

        // one lookup call has been performed
        assertEquals(1, callCounter.get());

        assertEquals(5, response.getResult().size());
        LookupCandidate candidate1 = response.getResult().get(0);
        assertTrue(candidate1.getId().equals("Candidate0"));
        assertTrue(candidate1.getName().equals("Candidate0"));

        // do another call with same search term
        LookupResponse cachedResponse = lookupService.get().lookup(new LookupRequest(queryId(), query));
        // no additional lookup calls have been performed
        assertEquals(1, callCounter.get());
        assertEquals(5, cachedResponse.getResult().size());
        assertEquals(cachedResponse.getResult().size(), response.getResult().size());
        assertEquals(cachedResponse.getResult(), response.getResult());

        cacheManager.invalidateAll();

        // do another call with same search term
        LookupResponse freshResponse = lookupService.get().lookup(new LookupRequest(queryId(), query));
        // another lookup call has been performed
        assertEquals(2, callCounter.get());
        assertEquals(5, freshResponse.getResult().size());
    }

    @Test
    public void testLookupServiceCache_CacheDisabled()  throws Exception {
        // setup another repository with specific lookup results
        AtomicInteger callCounter = new AtomicInteger();
        String repositoryId = "my-repo";
        CommonLookupConfig config = new CommonLookupConfig();
        config.setLookupCacheConfig(AbstractLookupService.CACHE_SPEC_NOCACHE);
        Optional<LookupService> lookupServiceRef = setupMockLookupService(callCounter, repositoryId, config);
        LookupService lookupService = lookupServiceRef.get();

        assertNull("Cache should not exist", ReflectionUtil.getFieldValue(lookupService, "cache"));

        LookupQuery query = new LookupQuery("Alice", 3, FOAF.AGENT.stringValue(), null, null, null);

        // no lookup calls have been performed yet
        assertEquals(0, callCounter.get());

        // do first lookup call
        lookupService.lookup(new LookupRequest(queryId(), query));
        // one lookup call has been performed
        assertEquals(1, callCounter.get());

        // do another call with same search term
        lookupService.lookup(new LookupRequest(queryId(), query));
        // another lookup call has been performed
        assertEquals(2, callCounter.get());

        // do another call with same search term
        lookupService.lookup(new LookupRequest(queryId(), query));
        // another lookup call has been performed
        assertEquals(3, callCounter.get());

        // cache invalidation shouldn't make a difference
        cacheManager.invalidateAll();

        // do another call with same search term
        lookupService.lookup(new LookupRequest(queryId(), query));
        // another lookup call has been performed
        assertEquals(4, callCounter.get());
    }

    @Test
    public void testLookupServiceCache_CacheSize()  throws Exception {
        // setup another repository with specific lookup results
        AtomicInteger callCounter = new AtomicInteger();
        String repositoryId = "my-repo";
        CommonLookupConfig config = new CommonLookupConfig();
        config.setLookupCacheConfig("maximumSize=3");
        Optional<LookupService> lookupService = setupMockLookupService(callCounter, repositoryId, config);

        LookupQuery query1 = new LookupQuery("Alice", 3, FOAF.AGENT.stringValue(), null, null, null);
        LookupQuery query2 = new LookupQuery("Bob", 3, FOAF.AGENT.stringValue(), null, null, null, null);
        LookupQuery query3 = new LookupQuery("Charlie", 3, FOAF.AGENT.stringValue(), null, null, null);
        LookupQuery query4 = new LookupQuery("Dylan", 3, FOAF.AGENT.stringValue(), null, null, null);

        // no lookup calls have been performed yet
        assertEquals(0, callCounter.get());

        // do first lookup call
        lookupService.get().lookup(new LookupRequest(queryId(), query1));
        // one lookup call has been performed
        assertEquals(1, callCounter.get());

        // do another call with another search term
        lookupService.get().lookup(new LookupRequest(queryId(), query2));
        // another lookup call has been performed
        assertEquals(2, callCounter.get());

        // do another call with another search term
        lookupService.get().lookup(new LookupRequest(queryId(), query3));
        // another lookup call has been performed
        assertEquals(3, callCounter.get());

        // multiple calls with cached terms
        lookupService.get().lookup(new LookupRequest(queryId(), query1));
        lookupService.get().lookup(new LookupRequest(queryId(), query1));
        lookupService.get().lookup(new LookupRequest(queryId(), query2));
        lookupService.get().lookup(new LookupRequest(queryId(), query2));
        lookupService.get().lookup(new LookupRequest(queryId(), query3));
        lookupService.get().lookup(new LookupRequest(queryId(), query3));

        // no additional lookup calls have been performed
        assertEquals(3, callCounter.get());

        // do another call with another search term
        lookupService.get().lookup(new LookupRequest(queryId(), query4));
        // another lookup call has been performed
        assertEquals(4, callCounter.get());

        lookupService.get().lookup(new LookupRequest(queryId(), query4));
        assertEquals(4, callCounter.get());

        // do another call with first search term (should be evicted)
        // Note: this depends on the assumption that the first added is also the first to be evicted!
        lookupService.get().lookup(new LookupRequest(queryId(), query1));
        assertEquals(5, callCounter.get());
    }

    @Test
    public void testLookupServiceCache_DifferentKeys()  throws Exception {
        // setup another repository with specific lookup results
        AtomicInteger callCounter = new AtomicInteger();
        String repositoryId = "my-repo";
        CommonLookupConfig config = new CommonLookupConfig();
        Optional<LookupService> lookupService = setupMockLookupService(callCounter, repositoryId, config);

        LookupQuery query1 = new LookupQuery("Alice", 3, FOAF.AGENT.stringValue(), null, null, null);
        LookupQuery query2 = new LookupQuery("Bob", 3, FOAF.AGENT.stringValue(), null, null, null);

        // no lookup calls have been performed yet
        assertEquals(0, callCounter.get());

        // do first lookup call
        lookupService.get().lookup(new LookupRequest(queryId(), query1));
        // one lookup call has been performed
        assertEquals(1, callCounter.get());

        // do another call with same search term
        lookupService.get().lookup(new LookupRequest(queryId(), query1));
        // no additional lookup calls have been performed
        assertEquals(1, callCounter.get());

        // do another call with another search term
        lookupService.get().lookup(new LookupRequest(queryId(), query2));
        // another lookup call has been performed
        assertEquals(2, callCounter.get());

        // do another call with same search term
        lookupService.get().lookup(new LookupRequest(queryId(), query1));
        // no additional lookup calls have been performed
        assertEquals(2, callCounter.get());

        // do another call with same search term
        lookupService.get().lookup(new LookupRequest(queryId(), query2));
        // no additional lookup calls have been performed
        assertEquals(2, callCounter.get());

        // cache invalidation
        cacheManager.invalidateAll();

        // do another call with same search term
        lookupService.get().lookup(new LookupRequest(queryId(), query1));
        // another lookup call has been performed
        assertEquals(3, callCounter.get());

        // do another call with same search term
        lookupService.get().lookup(new LookupRequest(queryId(), query2));
        // another lookup call has been performed
        assertEquals(4, callCounter.get());

        // do another call with same search term
        lookupService.get().lookup(new LookupRequest(queryId(), query1));
        // no additional lookup calls have been performed
        assertEquals(4, callCounter.get());

        // do another call with same search term
        lookupService.get().lookup(new LookupRequest(queryId(), query2));
        // no additional lookup calls have been performed
        assertEquals(4, callCounter.get());
}

    @Test
    public void testLookupServiceCache_CacheKeyGeneration()  throws Exception {
        String repositoryId = "my-repo";
        repositoryRule.addRepoWithLookupService(repositoryId, new CacheKeyCreatingLookupService(new CommonLookupConfig()));
        CacheKeyCreatingLookupService lookupService = (CacheKeyCreatingLookupService) lookupServiceManager.getLookupServiceByName(repositoryId).get();
        String queryId = queryId();
        assertEquals("Alice--" + FOAF.AGENT.stringValue() + "--3",
                lookupService.createCacheKey(new LookupRequest(queryId,
                        new LookupQuery("Alice", 3, FOAF.AGENT.stringValue(), null, null, null))));
        assertEquals("Alice--" + FOAF.AGENT.stringValue() + "--5",
                lookupService.createCacheKey(new LookupRequest(queryId,
                        new LookupQuery("Alice", 5, FOAF.AGENT.stringValue(), null, null, null))));
        assertEquals("Alice--" + FOAF.AGENT.stringValue() + "--3--should",
                lookupService.createCacheKey(new LookupRequest(queryId,
                        new LookupQuery("Alice", 3, FOAF.AGENT.stringValue(), LookupPropertyStrictType.should, null, null))));
        // test with properties ("natural" order)
        assertEquals("Alice--" + FOAF.AGENT.stringValue() + "--3--should--param1=value1--param2=" + FOAF.AGENT.stringValue(),
                lookupService.createCacheKey(new LookupRequest(queryId,
                        new LookupQuery("Alice", 3, FOAF.AGENT.stringValue(), LookupPropertyStrictType.should,
                                Lists.newArrayList(new LookupDataProperty("param1", "value1"),
                                        new LookupObjectProperty("param2", new LookupObjectPropertyLink(FOAF.AGENT.stringValue()))), null))));
        // test with properties (reversed order)
        assertEquals("Alice--" + FOAF.AGENT.stringValue() + "--3--should--param1=value1--param2=" + FOAF.AGENT.stringValue(),
                lookupService.createCacheKey(new LookupRequest(queryId,
                        new LookupQuery("Alice", 3, FOAF.AGENT.stringValue(), LookupPropertyStrictType.should,
                                Lists.newArrayList(new LookupObjectProperty("param2", new LookupObjectPropertyLink(FOAF.AGENT.stringValue())),
                                        new LookupDataProperty("param1", "value1")), null))));
    }

    @Test
    public void testLookupServiceScoreBoosting_noBoosting()  throws Exception {
        // setup another repository with specific lookup results
        AtomicInteger callCounter = new AtomicInteger();
        String repositoryId = "my-repo";
        CommonLookupConfig config = new CommonLookupConfig();
        // use default cache options
        LookupScoreOptions scoreOptions = null;
        config.setLookupScoreOptions(scoreOptions);
        Optional<LookupService> lookupServiceRef = setupMockLookupService(callCounter, repositoryId, config);
        LookupService lookupService = lookupServiceRef.get();

        LookupQuery query = new LookupQuery("Alice", 3, FOAF.AGENT.stringValue(), null, null, null);

        // do first lookup call
        List<LookupCandidate> candidates;
        candidates = lookupService.lookup(new LookupRequest(queryId(), query)).getResult();
        // one lookup call has been performed
        assertEquals(5, candidates.size());
        assertEquals(0.8, candidates.get(0).getScore(), 0.01);

        // do another call with same search term, score (coming from cache) should not have adjusted again
        candidates = lookupService.lookup(new LookupRequest(queryId(), query)).getResult();
        // one lookup call has been performed
        assertEquals(5, candidates.size());
        assertEquals(0.8, candidates.get(0).getScore(), 0.01);
    }

    @Test
    public void testLookupServiceScoreBoosting_simpleBoosting()  throws Exception {
        // setup another repository with specific lookup results
        AtomicInteger callCounter = new AtomicInteger();
        String repositoryId = "my-repo";
        CommonLookupConfig config = new CommonLookupConfig();
        // use default cache options
        LookupScoreOptions scoreOptions = new LookupScoreOptions(2.0, -10.0);
        config.setLookupScoreOptions(scoreOptions);
        Optional<LookupService> lookupServiceRef = setupMockLookupService(callCounter, repositoryId, config);
        LookupService lookupService = lookupServiceRef.get();

        LookupQuery query = new LookupQuery("Alice", 3, FOAF.AGENT.stringValue(), null, null, null);

        // do first lookup call
        List<LookupCandidate> candidates;
        candidates = lookupService.lookup(new LookupRequest(queryId(), query)).getResult();
        // one lookup call has been performed
        assertEquals(1, callCounter.get());
        assertEquals(5, candidates.size());
        assertEquals(-8.4, candidates.get(0).getScore(), 0.01);

        // do another call with same search term, score (coming from cache) should not have adjusted again
        candidates = lookupService.lookup(new LookupRequest(queryId(), query)).getResult();
        // no additional lookup calls have been performed
        assertEquals(1, callCounter.get());
        assertEquals(5, candidates.size());
        assertEquals(-8.4, candidates.get(0).getScore(), 0.01);
    }

    static class CacheKeyCreatingLookupService extends AbstractLookupService<CommonLookupConfig> {
        protected CacheKeyCreatingLookupService(CommonLookupConfig config) {
            super(config);
        }
        @Override
        protected LookupResponse doLookup(LookupRequest request) throws LookupProcessingException {
            return new LookupResponse(request.getQueryId(), Collections.emptyList());
        }
        @Override
        public String createCacheKey(LookupRequest request) {
            return super.createCacheKey(request);
        }
    };

    protected String queryId() {
        return "q" + queryCounter++;
    }

    protected Optional<LookupService> setupMockLookupService(AtomicInteger callCounter, String repositoryId,
            CommonLookupConfig config) {
        repositoryRule.addRepoWithLookupService(repositoryId, new AbstractLookupService<CommonLookupConfig>(config) {
            @Override
            protected LookupResponse doLookup(LookupRequest request) throws LookupProcessingException {
                callCounter.incrementAndGet();

                List<LookupCandidate> candidates = new ArrayList<>();

                int c=0;
                String name = "Candidate" + c++;
                candidates.add(new LookupCandidate(name, name, null, 0.8, true, null, name + " description"));
                name = "Candidate" + c++;
                candidates.add(new LookupCandidate(name, name, Collections.singletonList(new LookupEntityType("http://xmlns.com/foaf/0.1/Person", null)), 0.8, true, null, name + " description"));
                name = "Candidate" + c++;
                candidates.add(new LookupCandidate(name, name, Collections.singletonList(new LookupEntityType("Person", null)), 0.8, true, null, name + " description"));
                name = "Candidate" + c++;
                candidates.add(new LookupCandidate(name, name, null, 0.8, true, new LookupDataset("http://example.com/mydataset", "MyDataSet"), name + " description"));
                name = "Candidate" + c++;
                candidates.add(new LookupCandidate(name, name, null, 0.8, true, new LookupDataset("mydataset", "MyDataSet"), name + " description"));

                return new LookupResponse(request.getQueryId(), candidates);
            }
        });

        Optional<LookupService> lookupService = lookupServiceManager.getLookupServiceByName(repositoryId);
        return lookupService;
    }

    private String clearOutUUIDs(String query, Map<String, Value> bindings) {
        int counter = 0;
        Set<String> processedTokens = new LinkedHashSet<>();
        for (String key : bindings.keySet()) {
            boolean variableHasUUIDPostfix = key.length() > UNIQUE_TOKEN_LENGTH;
            if (variableHasUUIDPostfix) {
                String token = key.substring(key.length() - UNIQUE_TOKEN_LENGTH);
                if (!processedTokens.contains((token))) {
                    processedTokens.add(token);
                    query = query.replaceAll(token, Integer.toString(counter++));
                }
            }
        }
        return query;
    }

    @Test
    public void testEntityTypesRequest() throws Exception {
        repositoryRule.addRepoWithLookupConfig("dummy-repo", GenericSparqlLookupServiceFactory.LOOKUP_TYPE);
        Optional<LookupService> lookupService = lookupServiceManager.getDefaultLookupService();

        List<LookupEntityType> types = lookupService.get().getAvailableEntityTypes();
        assertEquals(2, types.size());
        
        List<IRI> typeIds = types.stream().map(type -> iri(type.getId())).collect(Collectors.toList());
        List<String> typeNames = types.stream().map(type -> type.getName()).collect(Collectors.toList());
        assertThat(typeIds, containsInAnyOrder(FOAF.AGENT, PAINTING));
        assertThat(typeNames, containsInAnyOrder("Agent", PAINTING_NAME.stringValue()));
    }
}
