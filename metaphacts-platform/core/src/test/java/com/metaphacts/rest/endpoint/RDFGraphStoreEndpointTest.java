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
package com.metaphacts.rest.endpoint;

import static org.eclipse.rdf4j.model.util.Values.iri;
import static org.eclipse.rdf4j.model.util.Values.literal;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.mockito.Mockito.when;

import java.io.InputStream;
import java.util.Arrays;
import java.util.Collections;

import javax.inject.Inject;
import javax.ws.rs.client.Entity;
import javax.ws.rs.core.HttpHeaders;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.Status;

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.Namespace;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.model.vocabulary.DCTERMS;
import org.eclipse.rdf4j.model.vocabulary.FOAF;
import org.eclipse.rdf4j.model.vocabulary.RDF;
import org.eclipse.rdf4j.model.vocabulary.RDF4J;
import org.eclipse.rdf4j.model.vocabulary.RDFS;
import org.eclipse.rdf4j.model.vocabulary.XSD;
import org.eclipse.rdf4j.repository.RepositoryConnection;
import org.eclipse.rdf4j.rio.RDFFormat;
import org.eclipse.rdf4j.rio.Rio;
import org.glassfish.jersey.server.ResourceConfig;
import org.hamcrest.Matchers;
import org.junit.Before;
import org.junit.Ignore;
import org.junit.Rule;
import org.junit.Test;

import com.github.sdorra.shiro.SubjectAware;
import com.metaphacts.cache.CacheManager;
import com.metaphacts.config.Configuration;
import com.metaphacts.junit.MetaphactsJerseyTest;
import com.metaphacts.junit.MetaphactsShiroRule;
import com.metaphacts.junit.NamespaceRule;
import com.metaphacts.junit.PlatformStorageRule;

public class RDFGraphStoreEndpointTest extends MetaphactsJerseyTest {
    private final String repositoryPermissionShiroFile = "classpath:com/metaphacts/security/shiro-repositories-rights.ini";

    private final ValueFactory vf = SimpleValueFactory.getInstance();

    private final IRI context = vf.createIRI("http://metaphacts.com/test/context");
    private final IRI othercontext = vf.createIRI("http://metaphacts.com/test/othercontext");

    @Inject
    @Rule
    public PlatformStorageRule storage;

    @Inject
    @Rule
    public NamespaceRule namespaceRule;

    @Inject
    public Configuration configuration;

    @Inject
    protected CacheManager cacheManager;

    @Override
    protected void register(ResourceConfig resourceConfig) {
        resourceConfig.register(RDFGraphStoreEndpoint.class);
    }

    @Before
    public void setUp() throws Exception {
        super.setUp();

        // add some example data to the default repository
        try (RepositoryConnection conn = repositoryRule.getRepository().getConnection()) {
            conn.add(this.getClass().getResourceAsStream("dummyData.ttl"), "", RDFFormat.TURTLE, context);
        }
    }

    @Rule
    public MetaphactsShiroRule rule = new MetaphactsShiroRule(() -> configuration).withCacheManager(() -> cacheManager)
            .withPlatformStorageRule(() -> storage);

    @Test
    @SubjectAware(username = "user1", password = "user1", configuration = repositoryPermissionShiroFile)
    public void testWriteGraph_UserHasAllPermissions() throws Exception {
        IRI person = iri("http://example.org/person1");
        String name = "Person1";

        // ensure there is no label for this entity
        try (RepositoryConnection conn = repositoryRule.getRepository().getConnection()) {
            assertFalse(conn.hasStatement(person, RDFS.LABEL, null, false));
        }

        String turtleData = "<" + person.stringValue() + "> <" + RDFS.LABEL + "> \"" + name + "\" .";
        String turtleType = RDFFormat.TURTLE.getDefaultMIMEType();

        when(req.getHeader(HttpHeaders.CONTENT_TYPE)).thenReturn(turtleType);

        Response response = target("").queryParam("graph", othercontext).request()
                .post(Entity.entity(turtleData, turtleType));
        assertThat(response.getStatusInfo(), Matchers.equalTo(Status.CREATED));

        try (RepositoryConnection conn = repositoryRule.getRepository().getConnection()) {
            assertTrue(conn.hasStatement(person, RDFS.LABEL, literal(name), false));
        }
    }

    @Test
    @SubjectAware(username = "user2", password = "user2", configuration = repositoryPermissionShiroFile)
    public void testWriteGraph_UserHasWritePermissionsForSingleGraph() throws Exception {
        IRI person = iri("http://example.org/person1");
        String name = "Person1";

        // ensure there is no label for this entity
        try (RepositoryConnection conn = repositoryRule.getRepository().getConnection()) {
            assertFalse(conn.hasStatement(person, RDFS.LABEL, null, false));
        }

        String turtleData = "<" + person.stringValue() + "> <" + RDFS.LABEL + "> \"" + name + "\" .";
        String turtleType = RDFFormat.TURTLE.getDefaultMIMEType();

        when(req.getHeader(HttpHeaders.CONTENT_TYPE)).thenReturn(turtleType);

        // this should fail as we do not have write permissions on that graph
        Response response = target("").queryParam("graph", context).request()
                .post(Entity.entity(turtleData, turtleType));
        assertThat(response.getStatusInfo(), Matchers.equalTo(Status.FORBIDDEN));
        
        // ensure there is no label for this entity
        try (RepositoryConnection conn = repositoryRule.getRepository().getConnection()) {
            assertFalse(conn.hasStatement(person, RDFS.LABEL, null, false));
        }

        // this should work
        response = target("").queryParam("graph", othercontext).request().post(Entity.entity(turtleData, turtleType));
        assertThat(response.getStatusInfo(), Matchers.equalTo(Status.CREATED));

        try (RepositoryConnection conn = repositoryRule.getRepository().getConnection()) {
            assertTrue(conn.hasStatement(person, RDFS.LABEL, literal(name), false));
        }
    }
    
    @Test
    @SubjectAware(username = "user3", password = "user3", configuration = repositoryPermissionShiroFile)
    public void testWriteGraph_UserHasReadPermissionsForSingleGraph() throws Exception {
        IRI person = iri("http://example.org/person1");
        String name = "Person1";

        String turtleData = "<" + person.stringValue() + "> <" + RDFS.LABEL + "> \"" + name + "\" .";
        String turtleType = RDFFormat.TURTLE.getDefaultMIMEType();

        when(req.getHeader(HttpHeaders.CONTENT_TYPE)).thenReturn(turtleType);

        // this should fail as we do not have write permissions on that graph
        Response response = target("").queryParam("graph", othercontext).request()
                .post(Entity.entity(turtleData, turtleType));
        assertThat(response.getStatusInfo(), Matchers.equalTo(Status.FORBIDDEN));
        
        // write data to create the desired graph
        try (RepositoryConnection conn = repositoryRule.getRepository().getConnection()) {
            conn.add(person, RDFS.LABEL, literal(name), othercontext);
        }

        when(req.getHeaders("Accept"))
                .thenReturn(Collections.enumeration(Arrays.asList(RDFFormat.TURTLE.getDefaultMIMEType())));

        // reading should be possible
        response = target("").queryParam("graph", othercontext).request().get();
        assertThat(response.getStatusInfo(), Matchers.equalTo(Status.OK));

        Model data = Rio.parse((InputStream) response.getEntity(), "", RDFFormat.TURTLE);
        // verify expected data was sent
        assertTrue(data.contains(person, RDFS.LABEL, literal(name)));

        when(req.getHeaders("Accept"))
                .thenReturn(Collections.enumeration(Arrays.asList(RDFFormat.TURTLE.getDefaultMIMEType())));

        // this should fail again as we do not have read permissions on that graph
        response = target("").queryParam("graph", context).request().get();
        assertThat(response.getStatusInfo(), Matchers.equalTo(Status.FORBIDDEN));
    }

    @Test
    @Ignore // TODO currently regex is not supported. Might be added later
    @SubjectAware(username = "user4", password = "user4", configuration = repositoryPermissionShiroFile)
    public void testGetGraph_RegexPermission() throws Exception {

        // regex permission on http://metaphacts.com/test/.*

        String turtleType = RDFFormat.TURTLE.getDefaultMIMEType();

        when(req.getHeader(HttpHeaders.CONTENT_TYPE)).thenReturn(turtleType);

        Response response;

        // reading should be possible
        response = target("").queryParam("graph", othercontext).request().get();
        assertThat(response.getStatusInfo(), Matchers.equalTo(Status.OK));
    }

    @Test
    @SubjectAware(username = "admin", password = "admin", configuration = repositoryPermissionShiroFile)
    public void testGetGraph_Turtle() throws Exception {
        namespaceRule.set(RDFS.PREFIX, RDFS.NAMESPACE);
        namespaceRule.set(FOAF.PREFIX, FOAF.NAMESPACE);
        namespaceRule.set(DCTERMS.PREFIX, DCTERMS.NAMESPACE);
        namespaceRule.set(XSD.PREFIX, XSD.NAMESPACE);
        namespaceRule.set("wd", "http://www.wikidata.org/entity/");
        namespaceRule.set("schema", "http://schema.org/");

        when(req.getHeaders("Accept"))
                .thenReturn(Collections.enumeration(Arrays.asList(RDFFormat.TURTLE.getDefaultMIMEType())));

        Response response = target("").queryParam("graph", context).request().get();
        assertThat(response.getStatusInfo(), Matchers.equalTo(Status.OK));

        Model data = Rio.parse((InputStream) response.getEntity(), "", RDFFormat.TURTLE);

        // verify expected data was sent
        assertTrue(data.contains(null, RDF.TYPE, FOAF.PERSON));

        // verify namespace definitions were used in response document
        assertEquals(FOAF.NAMESPACE, data.getNamespace(FOAF.PREFIX).map(Namespace::getName).orElse(null));
        assertEquals(DCTERMS.NAMESPACE, data.getNamespace(DCTERMS.PREFIX).map(Namespace::getName).orElse(null));
        assertEquals(XSD.NAMESPACE, data.getNamespace(XSD.PREFIX).map(Namespace::getName).orElse(null));
    }

    @Test
    @SubjectAware(username = "admin", password = "admin", configuration = repositoryPermissionShiroFile)
    public void testGetGraph_NQuads() throws Exception {
        when(req.getHeaders("Accept"))
                .thenReturn(Collections.enumeration(Arrays.asList(RDFFormat.NQUADS.getDefaultMIMEType())));

        Response response = target("").queryParam("graph", context).request().get();
        assertThat(response.getStatusInfo(), Matchers.equalTo(Status.OK));

        Model data = Rio.parse((InputStream) response.getEntity(), "", RDFFormat.NQUADS);

        // verify data is transferred with the correct named graph info
        assertTrue(data.contains(null, RDF.TYPE, FOAF.PERSON, context));
    }

    @Test
    @SubjectAware(username = "admin", password = "admin", configuration = repositoryPermissionShiroFile)
    public void testGetGraph_Default() throws Exception {
        // add some example data to the default graph in the default repository
        try (RepositoryConnection conn = repositoryRule.getRepository().getConnection()) {
            conn.add(this.getClass().getResourceAsStream("dummyData2.ttl"), "", RDFFormat.TURTLE);
        }

        when(req.getHeaders("Accept"))
                .thenReturn(Collections.enumeration(Arrays.asList(RDFFormat.NQUADS.getDefaultMIMEType())));

        Response response = target("").queryParam("graph", RDF4J.NIL).request().get();
        assertThat(response.getStatusInfo(), Matchers.equalTo(Status.OK));

        Model data = Rio.parse((InputStream) response.getEntity(), "", RDFFormat.NQUADS);

        assertTrue(data.contains(null, RDFS.LABEL, vf.createLiteral("Alfred Nobel")));
        assertFalse(data.contains(null, RDFS.LABEL, vf.createLiteral("Bob")));
    }

    @Test
    @SubjectAware(username = "admin", password = "admin", configuration = repositoryPermissionShiroFile)
    public void testDeleteGraph_Default() throws Exception {
        // add some example data to the default graph in the default repository
        try (RepositoryConnection conn = repositoryRule.getRepository().getConnection()) {
            conn.add(this.getClass().getResourceAsStream("dummyData2.ttl"), "", RDFFormat.TURTLE);
        }

        Response response = target("").queryParam("graph", RDF4J.NIL).request().delete();
        assertThat(response.getStatusInfo(), Matchers.equalTo(Status.OK));

        try (RepositoryConnection conn = repositoryRule.getRepository().getConnection()) {
            assertFalse(conn.hasStatement(null, RDFS.LABEL, vf.createLiteral("Alfred Nobel"), true));
            assertTrue(conn.hasStatement(null, RDFS.LABEL, vf.createLiteral("Bob"), true));
        }
    }

    @Test
    @SubjectAware(username = "admin", password = "admin", configuration = repositoryPermissionShiroFile)
    public void testDeleteGraph() throws Exception {
        // add some example data to the default graph in the default repository
        try (RepositoryConnection conn = repositoryRule.getRepository().getConnection()) {
            conn.add(this.getClass().getResourceAsStream("dummyData2.ttl"), "", RDFFormat.TURTLE);
        }

        when(req.getHeaders("Accept"))
                .thenReturn(Collections.enumeration(Arrays.asList(RDFFormat.NQUADS.getDefaultMIMEType())));

        Response response = target("").queryParam("graph", context).request().delete();
        assertThat(response.getStatusInfo(), Matchers.equalTo(Status.OK));

        try (RepositoryConnection conn = repositoryRule.getRepository().getConnection()) {
            assertTrue(conn.hasStatement(null, RDFS.LABEL, vf.createLiteral("Alfred Nobel"), true));
            assertFalse(conn.hasStatement(null, RDFS.LABEL, vf.createLiteral("Bob"), true));
        }
    }
}
