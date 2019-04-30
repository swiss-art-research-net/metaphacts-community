/*
 * Copyright (C) 2015-2019, metaphacts GmbH
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

import static org.mockito.Mockito.when;

import java.io.IOException;
import java.io.InputStream;
import java.util.concurrent.ExecutionException;

import javax.inject.Inject;
import javax.ws.rs.core.HttpHeaders;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.Status;

import com.metaphacts.junit.PlatformStorageRule;
import com.metaphacts.ui.templates.ST;
import org.apache.commons.io.IOUtils;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.LinkedHashModel;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.model.util.Models;
import org.eclipse.rdf4j.repository.RepositoryConnection;
import org.eclipse.rdf4j.rio.RDFFormat;
import org.eclipse.rdf4j.rio.Rio;
import org.glassfish.jersey.server.ResourceConfig;
import org.junit.*;

import com.google.common.base.Charsets;
import com.google.common.collect.Lists;
import com.metaphacts.junit.MetaphactsJerseyTest;
import com.metaphacts.junit.TestUtils;

/**
 * @author Johannes Trame <jt@metaphacts.com>
 *
 */
public class ResourceEndpointTest extends MetaphactsJerseyTest {

        private final ValueFactory vf = SimpleValueFactory.getInstance();
        
        private final IRI subject = vf.createIRI("http://metaphacts.com/test/a");
        private final Model testModel = new LinkedHashModel(
                Lists.newArrayList(vf.createStatement(subject,vf.createIRI("http://b"),vf.createIRI("http://c")))
        );

        @Inject
        @Rule
        public PlatformStorageRule storage;
        
        @Override
        protected void register(ResourceConfig resourceConfig) {
            resourceConfig.register(ResourceEndpoint.class);
        }
        
        @Before
        public void setUp() throws Exception {
            super.setUp();
            namespaceRule.set("test", "http://metaphacts.com/test/");
            try(RepositoryConnection con = repositoryRule.getRepository().getConnection()){
                con.add(testModel);
            }
            storage.mockPageLayoutTemplate(ST.TEMPLATES.HTML_HEAD);
            storage.mockPageLayoutTemplate(ST.TEMPLATES.MAIN);
        }

        @After
        public void tearDown() throws Exception {
            super.tearDown();
            repositoryRule.delete();
        }

        @Test
        public void testTurtleContentNegotiation() throws IOException, InterruptedException, ExecutionException {
            String[] formats = RDFFormat.TURTLE.getMIMETypes().stream().toArray(String[]::new);
            when(req.getHeaders(HttpHeaders.ACCEPT)).then(TestUtils.getMimetypeAnswer(RDFFormat.TURTLE.getMIMETypes()));
            Response response = target("/")
                    .queryParam("uri", subject.stringValue())
                    .request()
                    .accept(formats)
                    .get();

            Assert.assertTrue(
                    Models.isomorphic(
                            testModel, Rio.parse((InputStream)response.getEntity(),"", RDFFormat.TURTLE)
                    )
            );
        }

        @Test
        public void testJSONLDContentNegotiation() throws IOException, InterruptedException, ExecutionException {
            String[] formats = RDFFormat.JSONLD.getMIMETypes().stream().toArray(String[]::new);
            when(req.getHeaders(HttpHeaders.ACCEPT)).then(TestUtils.getMimetypeAnswer(RDFFormat.JSONLD.getMIMETypes()));
            Response response = target("/")
                    .queryParam("uri", subject.stringValue())
                    .request()
                    .accept(formats)
                    .get();
            
            Assert.assertTrue(
                    Models.isomorphic(
                            testModel, Rio.parse((InputStream)response.getEntity(),"", RDFFormat.JSONLD)
                            )
                    );
        }

        @Test
        public void testPrefixedUri() throws IOException, InterruptedException, ExecutionException {
            String[] formats = RDFFormat.TURTLE.getMIMETypes().stream().toArray(String[]::new);
            when(req.getHeaders(HttpHeaders.ACCEPT)).then(TestUtils.getMimetypeAnswer(RDFFormat.TURTLE.getMIMETypes()));
            Response response = target("/test:a")
                    .request()
                    .accept(formats)
                    .get();

            Assert.assertTrue(
                    Models.isomorphic(
                            testModel, Rio.parse((InputStream)response.getEntity(),"", RDFFormat.TURTLE)
                    )
            );
        }

        @Test
        public void testDefaultPrefixedUri() throws IOException, InterruptedException, ExecutionException {
            final Model testModelDefaultPrefix = new LinkedHashModel(
                    Lists.newArrayList(vf.createStatement(vf.createIRI(namespaceRule.getNamespaceRegistry().getDefaultNamespace()+"a"),vf.createIRI("http://b"),vf.createIRI("http://c")))
            );
            try(RepositoryConnection con = repositoryRule.getRepository().getConnection()){
                con.add(testModelDefaultPrefix);
            }
            String[] formats = RDFFormat.TURTLE.getMIMETypes().stream().toArray(String[]::new);
            when(req.getHeaders(HttpHeaders.ACCEPT)).then(TestUtils.getMimetypeAnswer(RDFFormat.TURTLE.getMIMETypes()));
            Response response = target("/a")
                    .request()
                    .accept(formats)
                    .get();

            Assert.assertEquals(Status.OK.getStatusCode(),response.getStatus());
            Assert.assertTrue(
                    Models.isomorphic(
                            testModelDefaultPrefix , Rio.parse((InputStream)response.getEntity(),"", RDFFormat.TURTLE)
                    )
            );
        }

        @Test
        public void testHtmlContentNegotiation() throws IOException, InterruptedException, ExecutionException {
            Response response = target("/")
                    .queryParam("uri", subject.stringValue())
                    .request()
                    .accept(MediaType.TEXT_HTML)
                    .get();

            Assert.assertEquals(
                    mainTemplate.getMainTemplate(),
                    IOUtils.toString((InputStream)response.getEntity(),Charsets.UTF_8)
            );
        }

        @Test
        public void testUnkownAcceptHeader() throws IOException, InterruptedException, ExecutionException {
            when(req.getHeaders(HttpHeaders.ACCEPT)).then(TestUtils.getMimetypeAnswer(Lists.newArrayList("tx/turtle")));
            Response response = target("/")
                    .queryParam("uri", subject.stringValue())
                    .request()
                    .accept("tx/turtle")
                    .get();
            
            Assert.assertEquals(Status.BAD_REQUEST.getStatusCode(),response.getStatus());
            Assert.assertEquals(
                    "Unknown or empty accept header.",
                    IOUtils.toString((InputStream)response.getEntity(),Charsets.UTF_8)
                    );
        }

        @Test
        public void testNoValidIri() throws IOException, InterruptedException, ExecutionException {
            String[] formats = RDFFormat.TURTLE.getMIMETypes().stream().toArray(String[]::new);
            when(req.getHeaders(HttpHeaders.ACCEPT)).then(TestUtils.getMimetypeAnswer(RDFFormat.TURTLE.getMIMETypes()));
            Response response = target("/")
                    .queryParam("uri", "d")
                    .request()
                    .accept(formats)
                    .get();
            
            Assert.assertEquals(Status.BAD_REQUEST.getStatusCode(),response.getStatus());
            Assert.assertEquals(
                    "Not a valid IRI: <d>",
                    IOUtils.toString((InputStream)response.getEntity(),Charsets.UTF_8)
                    );
        }

        @Test
        public void testResourceDoesNotExist() throws IOException, InterruptedException, ExecutionException {
            String[] formats = RDFFormat.TURTLE.getMIMETypes().stream().toArray(String[]::new);
            when(req.getHeaders(HttpHeaders.ACCEPT)).then(TestUtils.getMimetypeAnswer(RDFFormat.TURTLE.getMIMETypes()));
            Response response = target("/")
                    .queryParam("uri", "http://www.metaphacts.com/notexists")
                    .request()
                    .accept(formats)
                    .get();
            
            Assert.assertEquals(Status.NOT_FOUND.getStatusCode(),response.getStatus());
            Assert.assertEquals(
                    "Entity with IRI <http://www.metaphacts.com/notexists> does not exist",
                    IOUtils.toString((InputStream)response.getEntity(),Charsets.UTF_8)
                    );
        }

}
