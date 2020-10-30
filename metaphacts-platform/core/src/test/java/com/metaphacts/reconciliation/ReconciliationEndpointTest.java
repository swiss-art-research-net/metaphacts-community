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
package com.metaphacts.reconciliation;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import java.io.UnsupportedEncodingException;
import java.net.URI;
import java.util.Collections;
import java.util.Map;

import javax.servlet.http.HttpServletResponse;
import javax.ws.rs.HttpMethod;
import javax.ws.rs.client.Entity;
import javax.ws.rs.core.Form;
import javax.ws.rs.core.GenericType;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;

import com.metaphacts.ui.templates.ST;
import org.apache.shiro.SecurityUtils;
import org.apache.shiro.authc.UsernamePasswordToken;
import org.apache.shiro.authz.permission.WildcardPermission;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.model.impl.TreeModel;
import org.eclipse.rdf4j.model.vocabulary.FOAF;
import org.eclipse.rdf4j.model.vocabulary.RDF;
import org.eclipse.rdf4j.model.vocabulary.RDFS;
import org.eclipse.rdf4j.repository.RepositoryConnection;
import org.glassfish.grizzly.http.server.HttpServer;
import org.glassfish.jersey.grizzly2.httpserver.GrizzlyHttpServerFactory;
import org.glassfish.jersey.media.multipart.MultiPartFeature;
import org.glassfish.jersey.server.ResourceConfig;
import org.junit.*;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.common.collect.Lists;
import com.google.common.net.UrlEscapers;
import com.google.inject.Inject;
import com.metaphacts.cache.CacheManager;
import com.metaphacts.config.Configuration;
import com.metaphacts.junit.MetaphactsJerseyTest;
import com.metaphacts.junit.MetaphactsShiroRule;
import com.metaphacts.junit.PlatformStorageRule;
import com.metaphacts.junit.TestPlatformStorage;
import com.metaphacts.lookup.impl.GenericSparqlLookupServiceFactory;
import com.metaphacts.lookup.impl.NoopLookupServiceFactory;
import com.metaphacts.lookup.impl.RemoteLookupConfig;
import com.metaphacts.lookup.impl.RemoteLookupConfig.QueryMethod;
import com.metaphacts.lookup.impl.SparqlQueryLookupConfig;
import com.metaphacts.lookup.model.LookupDataset;
import com.metaphacts.lookup.model.LookupResponse;
import com.metaphacts.lookup.spi.LookupServiceConfig;
import com.metaphacts.repository.RepositoryManager;
import com.metaphacts.rest.endpoint.ReconciliationEndpoint;
import com.metaphacts.security.MetaphactsSecurityTestUtils;
import com.metaphacts.security.Permissions;

public class ReconciliationEndpointTest extends MetaphactsJerseyTest {
    static final ValueFactory vf = SimpleValueFactory.getInstance();
    static final String ENDPOINT_URL = "/reconciliation";
    static final String DESCRIPTION_ENDPOINT_URL = ENDPOINT_URL + "/description";
    static final String REMOTE_ENDPOINT_PATH = "remote/reconciliation";
    static final String REMOTE_BASE_URI = "http://localhost:10001/api/";
    
    static final String LOOKUP_REPOSITORY_1 = "my-lookup-1";
    static final String LOOKUP_REPOSITORY_2 = "my-lookup-2";
    
    static HttpServer server;

    private static final IRI ALICE_1 = vf.createIRI("http://www.metaphacts.com/Alice1");
    private static final IRI ALICE_2 = vf.createIRI("http://www.metaphacts.com/Alice2");
    private static final IRI ALICE_3 = vf.createIRI("http://www.metaphacts.com/Alice3");
    private static final IRI ALICE_4 = vf.createIRI("http://www.metaphacts.com/Alice4");
    private static final Literal ALICE_NAME_1 = vf.createLiteral("Alice");
    private static final Literal ALICE_NAME_2 = vf.createLiteral("Alice from");
    private static final Literal ALICE_NAME_3 = vf.createLiteral("Alice from Wonderland");
    private static final Literal ALICE_NAME_4 = vf.createLiteral("Alice from Mirrorland");
    private static final Literal AGE_1 = vf.createLiteral(18);
    private static final Literal AGE_2 = vf.createLiteral(20);
    private static final Literal ALICE_COMMENT_1 = vf.createLiteral("Alice is the character of the book \"Alice in Wonderland\"");
    private static final Literal ALICE_COMMENT_2 = vf.createLiteral("Alice is a real person");
    private static final String DESCRIPTION_1 = "<div>\n    <h2>Alice</h2>\n    <p>Alice is the character of the book &quot;Alice in Wonderland&quot;</p>\n</div>";
    private static final String DESCRIPTION_2 = "<div>\n    <h2>Alice from</h2>\n    <p>Alice is a real person</p>\n</div>";
    private static final String DESCRIPTION_3 = "<div>\n    <h2>Alice from Wonderland</h2>\n    <p></p>\n</div>";
    private static final String DESCRIPTION_4 = "<div>\n    <h2>Alice from Mirrorland</h2>\n    <p></p>\n</div>";
    private static final LookupDataset TEST_DATASET =
            new LookupDataset("http://example.com/testDataset", "Test Dataset");

    @BeforeClass
    public static void beforeClass() {
        // TODO move this to a re-usable base class which properly takes care for
        // finding a suitable free port (e.g. relevant for parallel execution of tests)
        // Ideally this also has a retry mechanism with a given number of attempts
        final ResourceConfig rc = new ResourceConfig(RemoteTestReconciliationEndpoint.class);
        server = GrizzlyHttpServerFactory.createHttpServer(URI.create(REMOTE_BASE_URI), rc);
    }

    @AfterClass
    public static void afterClass() {
        server.shutdown();
    }

    @Override
    protected void register(ResourceConfig resourceConfig) {
        resourceConfig.register(MultiPartFeature.class);
        resourceConfig.register(ReconciliationEndpoint.class);
    }
    
    @Inject
    protected Configuration config;

    @Inject
    private CacheManager cacheManager;

    @Inject
    @Rule
    public PlatformStorageRule platformStorageRule;

    @Rule
    public MetaphactsShiroRule rule = new MetaphactsShiroRule(() ->
        Lists.newArrayList(
            MetaphactsSecurityTestUtils.loadRealm(
                "classpath:com/metaphacts/security/shiro-legacy.ini")
            ),
            () -> config
        ).withCacheManager(() -> cacheManager
        ).withPlatformStorageRule(() -> platformStorageRule)
        .withPlatformRole("admin", Lists.newArrayList("reconciliation:manifest:read"));
    
    @Before
    public void setUpTest() throws Exception {
        platformStorageRule.storeContentFromResource(
            ST.objectIdForTemplate(ST.TEMPLATES.ENTITY_DESCRIPTION),
            ReconciliationEndpointTest.class,
            "entity-description.hbs"
        );

        SparqlQueryLookupConfig config = new GenericSparqlLookupServiceFactory().getConfig();
        config.setDatasetId(vf.createIRI(TEST_DATASET.getId()));
        config.setDatasetLabel(TEST_DATASET.getName());
        config.setTargetRepository(RepositoryManager.DEFAULT_REPOSITORY_ID);
        setupLookupService(LOOKUP_REPOSITORY_1, config);

        Model model = new TreeModel();
        model.addAll(Lists.newArrayList(
            vf.createStatement(ALICE_1, RDFS.LABEL, ALICE_NAME_1),
            vf.createStatement(ALICE_1, RDF.TYPE, FOAF.AGENT),
            vf.createStatement(ALICE_1, FOAF.AGE, AGE_1),
            vf.createStatement(ALICE_1, RDFS.COMMENT, ALICE_COMMENT_1),

            vf.createStatement(ALICE_2, RDFS.LABEL, ALICE_NAME_2),
            vf.createStatement(ALICE_2, RDF.TYPE, FOAF.AGENT),
            vf.createStatement(ALICE_2, FOAF.AGE, AGE_1),
            vf.createStatement(ALICE_2, RDFS.COMMENT, ALICE_COMMENT_2),

            vf.createStatement(ALICE_3, RDFS.LABEL, ALICE_NAME_3),
            vf.createStatement(ALICE_3, RDF.TYPE, FOAF.AGENT),
            vf.createStatement(ALICE_3, FOAF.AGE, AGE_2),
            vf.createStatement(ALICE_3, FOAF.KNOWS, ALICE_4),

            vf.createStatement(ALICE_4, RDFS.LABEL, ALICE_NAME_4),
            vf.createStatement(ALICE_4, RDF.TYPE, FOAF.AGENT),
            vf.createStatement(ALICE_4, FOAF.AGE, AGE_2),
            vf.createStatement(ALICE_4, FOAF.KNOWS, ALICE_3)
        ));
        try (RepositoryConnection con = repositoryRule.getRepository().getConnection()) {
            con.add(model, vf.createIRI("http://www.metaphacts.com/test/graph"));
        }
    }

    @Test
    public void descriptionEndpointTest() throws Exception {
        Response response1 = this.requestDescription(ALICE_1);
        Assert.assertEquals(DESCRIPTION_1, response1.readEntity(String.class));
        Response response2 = this.requestDescription(ALICE_2);
        Assert.assertEquals(DESCRIPTION_2, response2.readEntity(String.class));
        Response response3 = this.requestDescription(ALICE_3);
        Assert.assertEquals(DESCRIPTION_3, response3.readEntity(String.class));
        Response response4 = this.requestDescription(ALICE_4);
        Assert.assertEquals(DESCRIPTION_4, response4.readEntity(String.class));
    }

    @Test
    public void queryManifestTest() throws Exception {
        SecurityUtils.getSubject().login(new UsernamePasswordToken("legacy-admin", "password"));
        SecurityUtils.getSubject()
                .isPermitted(new WildcardPermission(Permissions.RECONCILIATION_SERVICE.READ_MANIFEST));
        Response response = this.sendManifestQuery();
        String manifest = response.readEntity(String.class);
        assertEquals(getManifest(), manifest);
    }

    @Test
    public void singlePostQueryTest() throws Exception {
        this.sendSingleQuery(QueryMethod.postRawJson);
        this.sendSingleQuery(QueryMethod.postDataForm);
        this.sendSingleQuery(QueryMethod.postUrlEncodedForm);
    }

    @Test
    public void singleGetQueryTest() throws Exception {
        this.sendSingleQuery(QueryMethod.get);
    }

    @Test
    public void multiplePostQueryTest() throws Exception {
        this.sendMultipleQuery(QueryMethod.postRawJson);
        this.sendMultipleQuery(QueryMethod.postDataForm);
        this.sendMultipleQuery(QueryMethod.postUrlEncodedForm);
    }

    @Test
    public void multipleGetQueryTest() throws Exception {
        this.sendMultipleQuery(QueryMethod.get);
    }

    @Test
    public void invalidPostQueryTest() throws Exception {
        this.sendInvalidQuery(QueryMethod.postRawJson);
        this.sendInvalidQuery(QueryMethod.postDataForm);
        this.sendInvalidQuery(QueryMethod.postUrlEncodedForm);
    }

    @Test
    public void invalidGetQueryTest() throws Exception {
        this.sendInvalidQuery(QueryMethod.get);
    }

    @Test
    public void jsonpPostQueryTest() throws Exception {
        this.sendSingleJsonpQuery(QueryMethod.postRawJson);
        this.sendSingleJsonpQuery(QueryMethod.postDataForm);
        this.sendSingleJsonpQuery(QueryMethod.postUrlEncodedForm);
    }

    @Test
    public void jsonpGetQueryTest() throws Exception {
        this.sendSingleJsonpQuery(QueryMethod.get);
    }

    @Test
    public void anotherReconciliationManagerTest() throws Exception {
        setupLookupService(LOOKUP_REPOSITORY_2, NoopLookupServiceFactory.LOOKUP_TYPE);
        Response response = this.sendReconciliationQuery(QueryMethod.postRawJson, SINGLE_QUERY, true);
        assertEquals(HttpServletResponse.SC_INTERNAL_SERVER_ERROR, response.getStatus());
    }

    @Test
    public void remoteReconciliationEndpointTest() throws Exception {
        this.sendRemoteRequest(QueryMethod.get);
        this.sendRemoteRequest(QueryMethod.postRawJson);
        this.sendRemoteRequest(QueryMethod.postDataForm);
        this.sendRemoteRequest(QueryMethod.postUrlEncodedForm);
        this.sendRemoteManifestRequest();
    }

    private Response requestDescription(IRI uri) {
        Response response = target(DESCRIPTION_ENDPOINT_URL)
            .queryParam("uri", UrlEscapers.urlFragmentEscaper().escape(uri.stringValue()))
            .request().header("Accept", MediaType.TEXT_HTML).build(HttpMethod.GET).invoke();
        return response;
    }

    private void sendRemoteRequest(QueryMethod method) throws Exception {
        this.configureRemoteEndpoint(method);
        Response reconciliationResponse = this.sendReconciliationQuery(QueryMethod.get, SINGLE_QUERY, false);
        assertEquals(REMOTE_RESPONSE, reconciliationResponse.readEntity(String.class));
    }

    private void sendRemoteManifestRequest() throws Exception {
        this.configureRemoteEndpoint(null);
        Response manifestResponse = this.sendManifestQuery();
        String manifest = manifestResponse.readEntity(String.class);
        assertEquals(getRemoteManifest(), manifest);
    }

    private void configureRemoteEndpoint(QueryMethod method) throws Exception {
        SecurityUtils.getSubject().login(new UsernamePasswordToken("legacy-admin", "password"));
        SecurityUtils.getSubject()
                .isPermitted(new WildcardPermission(Permissions.RECONCILIATION_SERVICE.READ_MANIFEST));
        
        RemoteLookupConfig config = new RemoteLookupConfig();
        config.setRemoteServiceUrl(REMOTE_BASE_URI + REMOTE_ENDPOINT_PATH);
        if (method != null) {
            config.setQueryMethod(method);
        }
        setupLookupService(LOOKUP_REPOSITORY_2, config);
    }

    private Response sendManifestQuery() throws UnsupportedEncodingException, JsonProcessingException {
        Response response = target(ENDPOINT_URL)
            .request()
            .header("Accept", MediaType.APPLICATION_JSON)
            .build(HttpMethod.GET)
            .invoke();
        return response;
    }

    private void sendSingleQuery(QueryMethod method) throws UnsupportedEncodingException, JsonProcessingException {
        Response response = this.sendReconciliationQuery(method, SINGLE_QUERY, false);

        assertEquals(HttpServletResponse.SC_OK, response.getStatus());

        Map<String, LookupResponse> responseMap = this.getResponseAsMap(response);
        assertEquals(responseMap.size(), 1);

        LookupResponse recResp = responseMap.get(QUERY_1_ID);
        assertNotNull(recResp);
        assertEquals(2, recResp.getResult().size());
        assertEquals(ALICE_1.stringValue(), recResp.getResult().get(0).getId());
        assertEquals(TEST_DATASET.getId(), recResp.getResult().get(0).getDataset().getId());
        assertEquals(TEST_DATASET.getName(), recResp.getResult().get(0).getDataset().getName());
        assertEquals(ALICE_2.stringValue(), recResp.getResult().get(1).getId());
        assertEquals(TEST_DATASET.getId(), recResp.getResult().get(1).getDataset().getId());
        assertEquals(TEST_DATASET.getName(), recResp.getResult().get(1).getDataset().getName());
    }

    private void sendMultipleQuery(QueryMethod method) throws UnsupportedEncodingException {
        Response response = this.sendReconciliationQuery(method, MULTIPLE_QUERY, false);

        assertEquals(HttpServletResponse.SC_OK, response.getStatus());

        Map<String, LookupResponse> responseMap = response.readEntity(new GenericType<Map<String, LookupResponse>>() {});
        assertEquals(2, responseMap.size());

        LookupResponse recResp1 = responseMap.get(QUERY_1_ID);
        LookupResponse recResp2 = responseMap.get(QUERY_2_ID);
        assertNotNull(recResp1);
        assertNotNull(recResp2);
        assertEquals(2, recResp1.getResult().size());
        assertEquals(ALICE_1.stringValue(), recResp1.getResult().get(0).getId());
        assertEquals(ALICE_2.stringValue(), recResp1.getResult().get(1).getId());
        assertEquals(2, recResp2.getResult().size());
        assertEquals(ALICE_3.stringValue(), recResp2.getResult().get(0).getId());
    }

    private void sendInvalidQuery(QueryMethod method) throws UnsupportedEncodingException {
        Response response = this.sendReconciliationQuery(method, INVALID_QUERY, false);
        assertEquals(HttpServletResponse.SC_BAD_REQUEST, response.getStatus());
    }

    private void sendSingleJsonpQuery(QueryMethod method) throws UnsupportedEncodingException {
        Response response = this.sendReconciliationQuery(method, SINGLE_QUERY, true);
        assertEquals(HttpServletResponse.SC_OK, response.getStatus());
        String responseBody = response.readEntity(String.class);
        assertTrue(responseBody.startsWith("callback("));
        assertTrue(responseBody.endsWith(")"));
    }

    private Response sendReconciliationQuery(QueryMethod method, String query, boolean useJsonp) throws UnsupportedEncodingException {
        if (method.equals(QueryMethod.get)) {
            return target(ENDPOINT_URL)
                .queryParam("queries", UrlEscapers.urlFragmentEscaper().escape(query))
                .request()
                .header("Accept", useJsonp ? "application/javascript" : MediaType.APPLICATION_JSON)
                .build(HttpMethod.GET)
                .invoke();
        } else if (method.equals(QueryMethod.postDataForm)) {
            final Form form = new Form();
            form.param("queries", query);
            return target(ENDPOINT_URL)
                .request()
                .header("Accept", useJsonp ? "application/javascript" : MediaType.APPLICATION_JSON)
                .build(HttpMethod.POST, Entity.form(form))
                .invoke();
        } else if (method.equals(QueryMethod.postUrlEncodedForm)) {
            final Form form = new Form();
            form.param("queries", query);
            return target(ENDPOINT_URL)
                .request()
                .header("Accept", useJsonp ? "application/javascript" : MediaType.APPLICATION_JSON)
                .build(HttpMethod.POST, Entity.entity(form, MediaType.APPLICATION_FORM_URLENCODED_TYPE))
                .invoke();
        } else if (method.equals(QueryMethod.postRawJson)) {
            return target(ENDPOINT_URL)
                .request()
                .header("Accept", useJsonp ? "application/javascript" : MediaType.APPLICATION_JSON)
                .build(HttpMethod.POST, Entity.entity(query, MediaType.APPLICATION_JSON))
                .invoke();
        } else {
            throw new IllegalArgumentException("Only GET and POST http methods are supported.");
        }
    }

    private static final String QUERY_1_ID = "q0";
    private static final String SUB_QUERY_1 =
        "\"" + QUERY_1_ID + "\": {\n" +
            "\"query\": \"Alice\",\n" +
            "\"limit\": \"3\",\n" +
            "\"type_strict\": \"all\",\n" +
            "\"type\": \"http://xmlns.com/foaf/0.1/Agent\",\n" +
            "\"properties\": [{\n" +
                "\"pid\": \"http://xmlns.com/foaf/0.1/age\",\n" +
                "\"v\": \"18\"\n" +
            "}]\n" +
        "}";

    private static final String QUERY_2_ID = "q1";
    private static final String SUB_QUERY_2 =
        "\"" + QUERY_2_ID + "\": {\n" +
            "\"query\": \"Alice from\",\n" +
            "\"limit\": \"3\",\n" +
            "\"type_strict\": \"should\",\n" +
            "\"type\": \"http://xmlns.com/foaf/0.1/Agent\",\n" +
            "\"properties\": [{\n" +
                "\"pid\": \"http://xmlns.com/foaf/0.1/age\",\n" +
                "\"v\": \"20\"\n" +
            "}]\n" +
        "}";

    private static final String SINGLE_QUERY = "{\n" +
        SUB_QUERY_1 + "\n" +
    "}";

    private static final String MULTIPLE_QUERY = "{\n" +
        SUB_QUERY_1 + "\n," +
        SUB_QUERY_2 + "\n" +
    "}";

    private static final String INVALID_QUERY = "{\n" +
        "\"" + QUERY_1_ID + "\": {\n" +
            "\"limit\": \"3\",\n" +
            "\"type_strict\": \"all\",\n" +
            "\"type\": \"http://xmlns.com/foaf/0.1/Agent\",\n" +
        "}\n" +
    "}";

    private String getManifest() {
        return "{" +
            "\"name\":\"mp-reconciliation\"," +
            "\"identifierSpace\":\"http://www.metaphacts.com/ontologies/platform/reconciliation#\"," +
            "\"schemaSpace\":\"http://www.metaphacts.com/ontologies/platform/reconciliation-schema#\"," +
            "\"defaultTypes\":[" +
                "{" +
                    "\"id\":\"http://xmlns.com/foaf/0.1/Agent\"," +
                    "\"name\":\"Agent\"" +
                "}" +
            "]," +
            "\"preview\":{" +
                "\"url\":\"" + target().getUri().toString() + "reconciliation/description?uri={{id}}\"," +
                "\"width\":300," +
                "\"height\":200" +
            "}," +
            "\"view\":{" +
                "\"url\":\"" + target().getUri().toString() + "resource?uri={{id}}\"" +
            "}" +
        "}";
    }

    private  String getRemoteManifest() {
        return "{" +
            "\"name\":\"mp-reconciliation\"," +
            "\"identifierSpace\":\"http://www.metaphacts.com/ontologies/platform/reconciliation#\"," +
            "\"schemaSpace\":\"http://www.metaphacts.com/ontologies/platform/reconciliation-schema#\"," +
            "\"defaultTypes\":[{" +
                "\"id\":\"http://example.com/entity-type/car\"," +
                "\"name\":\"car\"" +
            "},{" +
                "\"id\":\"http://example.com/entity-type/human\"," +
                "\"name\":\"human\"" +
            "}]," +
            "\"preview\":{" +
                "\"url\":\"" + target().getUri().toString() + "reconciliation/description?uri={{id}}\"," +
                "\"width\":300," +
                "\"height\":200" +
            "}," +
            "\"view\":{" +
                "\"url\":\"" + target().getUri().toString() + "resource?uri={{id}}\"" +
            "}" +
        "}";
    }

    private static final String REMOTE_RESPONSE = "{" +
        "\"q0\":{" +
            "\"result\":[{" +
                "\"id\":\"http://www.wikidata.org/entity/Q929\"," +
                "\"name\":\"Central African Republic\"," +
                "\"score\":999.0," +
                "\"match\":true," +
                "\"type\":[{" +
                    "\"id\":\"http://www.wikidata.org/entity/Q6256\"," +
                    "\"name\":\"country\"" +
                "},{" +
                    "\"id\":\"http://www.wikidata.org/entity/Q123480\"," +
                    "\"name\":\"landlocked country\"" +
                "},{" +
                    "\"id\":\"http://www.wikidata.org/entity/Q3624078\"," +
                    "\"name\":\"sovereign state\"" +
                "}]" +
            "}]" +
        "}" +
    "}";

    private Map<String, LookupResponse> getResponseAsMap(Response response) throws JsonProcessingException {
        String stringResult = response.readEntity(String.class);
        ObjectMapper mapper = new ObjectMapper();
        return mapper.readValue(stringResult, new TypeReference<Map<String, LookupResponse>>() {});
    }
    
    protected void setupLookupService(String repositoryId, LookupServiceConfig lookupConfig) throws Exception {
        if (repositoryRule.getRepositoryManager().getInitializedRepositoryIds().contains(repositoryId)) {
            repositoryRule.getRepositoryManager().deleteRepositoryConfig(repositoryId);
        }
        repositoryRule.addRepoWithLookupConfig(repositoryId, lookupConfig);
        this.config.getLookupConfig().setParameter(
            "experimental.defaultLookupServiceName",
            Collections.singletonList(repositoryId),
            TestPlatformStorage.STORAGE_ID
        );
    }
    
    protected void setupLookupService(String repositoryId, String lookupType) throws Exception {
        if (repositoryRule.getRepositoryManager().getInitializedRepositoryIds().contains(repositoryId)) {
            repositoryRule.getRepositoryManager().deleteRepositoryConfig(repositoryId);
        }
        repositoryRule.addRepoWithLookupConfig(repositoryId, lookupType);
        this.config.getLookupConfig().setParameter(
            "experimental.defaultLookupServiceName",
            Collections.singletonList(repositoryId),
            TestPlatformStorage.STORAGE_ID
        );
    }
}
