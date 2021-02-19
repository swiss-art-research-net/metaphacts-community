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

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.is;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;

import javax.inject.Inject;
import javax.ws.rs.client.Entity;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.LinkedHashModel;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.model.vocabulary.FOAF;
import org.eclipse.rdf4j.repository.RepositoryConnection;
import org.glassfish.jersey.server.ResourceConfig;
import org.junit.After;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;

import com.google.common.collect.Lists;
import com.metaphacts.junit.AbstractRepositoryBackedIntegrationTest;
import com.metaphacts.junit.MetaphactsJerseyTest;
import com.metaphacts.junit.PlatformStorageRule;
import com.metaphacts.resource.ResourcesTestData;

public class ResourceUtilsEndpointTest extends MetaphactsJerseyTest implements ResourcesTestData {

    private final ValueFactory vf = SimpleValueFactory.getInstance();

    private final IRI subject = vf.createIRI("http://metaphacts.com/test/a");
    private final Model testModel = new LinkedHashModel(
            Lists.newArrayList(vf.createStatement(subject, vf.createIRI("http://b"), vf.createIRI("http://c"))));

    @Inject
    @Rule
    public PlatformStorageRule storage;

    @Override
    protected void register(ResourceConfig resourceConfig) {
        resourceConfig.register(ResourceUtilsEndpoint.class);
    }

    @Before
    public void setUp() throws Exception {
        super.setUp();
        namespaceRule.set("test", "http://metaphacts.com/test/");
        try (RepositoryConnection con = repositoryRule.getRepository().getConnection()) {
            con.add(testModel);
        }
        AbstractRepositoryBackedIntegrationTest.addStatementsFromResources(repositoryRule.getRepository(),
                ResourcesTestData.class, TEST_DATA_FILE);
    }

    @After
    public void tearDown() throws Exception {
        super.tearDown();
    }

    @SuppressWarnings("unchecked")
    @Test
    public void testFetchLabel() throws IOException, InterruptedException, ExecutionException {
        List<IRI> iris = Arrays.asList(ALICE, BOB, CHARLIE);
        String iriJSONArrayString = createJSONArrayForIRIs(iris);
        Entity<String> entity = Entity.entity(iriJSONArrayString, MediaType.APPLICATION_JSON_TYPE);

        Map<String, String> values;
        Response response;

        // fetch labels for language 'de'
        response = target("data/rdf/utils/getLabelsForRdfValue")
                .queryParam("preferredLanguage", "de")
                .request().accept(MediaType.APPLICATION_JSON).post(entity);

        assertEquals(200, response.getStatus());

        values = response.readEntity(Map.class);
        assertThat(values.size(), is(equalTo(iris.size())));
        assertThat(values.get(ALICE.stringValue()), is(equalTo("Alice (de)")));
        assertThat(values.get(BOB.stringValue()), is(equalTo("Bob")));
        assertThat(values.get(CHARLIE.stringValue()), is(equalTo("Charlie (de)")));

        // fetch labels for language 'ru'
        response = target("data/rdf/utils/getLabelsForRdfValue").queryParam("preferredLanguage", "ru").request()
                .accept(MediaType.APPLICATION_JSON).post(entity);

        assertEquals(200, response.getStatus());

        values = response.readEntity(Map.class);
        assertThat(values.size(), is(equalTo(iris.size())));
        assertThat(values.get(ALICE.stringValue()), is(equalTo("Alice (ru)")));
        assertThat(values.get(BOB.stringValue()), is(equalTo("Bob")));
        assertThat(values.get(CHARLIE.stringValue()), is(equalTo("Charlie (ru)")));
    }

    @SuppressWarnings("unchecked")
    @Test
    public void testFetchDescription() throws IOException, InterruptedException, ExecutionException {
        List<IRI> iris = Arrays.asList(ALICE, BOB, CHARLIE);
        String iriJSONArrayString = createJSONArrayForIRIs(iris);
        Entity<String> entity = Entity.entity(iriJSONArrayString, MediaType.APPLICATION_JSON_TYPE);

        Map<String, String> values;
        Response response;

        // fetch labels for language 'de'
        response = target("data/rdf/utils/getDescriptionForRdfValue")
                .queryParam("preferredLanguage", "de").request().accept(MediaType.APPLICATION_JSON)
                .post(entity);

        Assert.assertEquals(200, response.getStatus());
        values = response.readEntity(Map.class);
        assertThat(values.size(), is(equalTo(iris.size())));
        System.out.println(values);
        assertThat(values.get(ALICE.stringValue()), is(equalTo("Don't ask her about wonderland")));
        assertThat(values.get(BOB.stringValue()), is(equalTo("Bob is a nice guy")));
        assertNull(values.get(CHARLIE.stringValue()));

        // fetch labels for language 'ru'
        response = target("data/rdf/utils/getDescriptionForRdfValue").queryParam("preferredLanguage", "ru").request()
                .accept(MediaType.APPLICATION_JSON).post(entity);

        Assert.assertEquals(200, response.getStatus());
        values = response.readEntity(Map.class);
        assertThat(values.size(), is(equalTo(iris.size())));
        System.out.println(values);
        assertThat(values.get(ALICE.stringValue()), is(equalTo("Don't ask her about wonderland (ru)")));
        assertThat(values.get(BOB.stringValue()), is(equalTo("Bob is a nice guy")));
        assertNull(values.get(CHARLIE.stringValue()));
    }

    @SuppressWarnings("unchecked")
    @Test
    public void testFetchTypes() throws IOException, InterruptedException, ExecutionException {
        List<IRI> iris = Arrays.asList(ALICE, BOB, CHARLIE);
        String iriJSONArrayString = createJSONArrayForIRIs(iris);
        Entity<String> entity = Entity.entity(iriJSONArrayString, MediaType.APPLICATION_JSON_TYPE);

        Map<String, List<String>> values;
        Response response;

        response = target("data/rdf/utils/getTypesForRdfValue").request()
                .accept(MediaType.APPLICATION_JSON).post(entity);

        Assert.assertEquals(200, response.getStatus());
        values = response.readEntity(Map.class);
        assertThat(values.size(), is(equalTo(iris.size())));
        System.out.println(values);
        assertThat(values.get(ALICE.stringValue()), containsInAnyOrder(EXAMPLE_PERSON.stringValue()));
        assertThat(values.get(BOB.stringValue()),
                containsInAnyOrder(EXAMPLE_PERSON.stringValue(), FOAF.PERSON.stringValue()));
        assertThat(values.get(CHARLIE.stringValue()), containsInAnyOrder(EXAMPLE_PERSON.stringValue()));
    }

    static class TypesResult {

    }

    private String createJSONArrayForIRIs(List<IRI> iris) {
        StringBuilder b = new StringBuilder("[");
        for (int i = 0; (iris != null) && (i < iris.size()); i++) {
            IRI iri = iris.get(i);
            if (i > 0) {
                b.append(", ");
            }
            b.append("\"");
            b.append(iri.stringValue());
            b.append("\"");
        }
        b.append("]");
        return b.toString();
    }
}
