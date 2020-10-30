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
package com.metaphacts.rest.endpoint;

import static org.hamcrest.Matchers.is;
import static org.junit.Assert.assertThat;
import static org.junit.Assert.fail;

import java.util.Arrays;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import javax.ws.rs.client.Entity;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.Status;

import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.util.ModelBuilder;
import org.eclipse.rdf4j.model.vocabulary.FOAF;
import org.eclipse.rdf4j.model.vocabulary.LDP;
import org.eclipse.rdf4j.model.vocabulary.RDF;
import org.eclipse.rdf4j.model.vocabulary.RDFS;
import org.eclipse.rdf4j.model.vocabulary.XMLSchema;
import org.eclipse.rdf4j.repository.RepositoryConnection;
import org.eclipse.rdf4j.repository.util.Repositories;
import org.eclipse.rdf4j.rio.RDFFormat;
import org.glassfish.jersey.server.ResourceConfig;
import org.hamcrest.collection.IsEmptyCollection;
import org.hamcrest.core.IsCollectionContaining;
import org.hamcrest.core.StringContains;
import org.junit.Before;
import org.junit.Test;

import com.metaphacts.data.rdf.container.FieldDefinitionContainer;
import com.metaphacts.junit.MetaphactsJerseyTest;
import com.metaphacts.vocabulary.FIELDS;

public class FieldEndpointTest extends MetaphactsJerseyTest {

    @Override
    protected void register(ResourceConfig resourceConfig) {
        resourceConfig.register(FieldEndpoint.class);
    }

    @Before
    public void setUp() throws Exception {
        super.setUp();

        // load some field definitions
        Model fields = new ModelBuilder()
                .setNamespace(LDP.NS)
                .setNamespace("field", FIELDS.NAMESPACE)
                .setNamespace("ex", "http://example.org/")
                .subject(FieldDefinitionContainer.IRI_STRING)
                    .add("ldp:contains", "ex:field1")
                    .add("ldp:contains", "ex:field2")
                .subject("ex:field1")
                    .add(RDF.TYPE, "field:Field")
                    .add(RDFS.COMMENT, "a comment for field 1")
                .subject("ex:field2")
                    .add(RDF.TYPE, "field:Field")
                    .add(RDFS.COMMENT, "a comment for field 2")
                .build();

        Repositories.consume(repositoryRule.getAssetRepository(), conn -> conn.add(fields));

        // add some example data to the default repository
        try (RepositoryConnection conn = repositoryRule.getRepository().getConnection()) {
            conn.add(this.getClass().getResourceAsStream("dummyData.ttl"), "", RDFFormat.TURTLE);
        }
    }

    @Test
    public void testRequestAllFieldDefinitions() throws Exception {
        Response response = target("fields/definitions").request().post(null);
        assertThat(response.getStatusInfo(), is(Status.OK));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> fieldDefinitions = Arrays.asList(response.readEntity(Map[].class));
        assertThat(fieldDefinitions.size(), is(2));
    }

    @Test
    public void testRequestSomeFieldDefinitions() throws Exception {
        Response response = target("fields/definitions").request()
                .post(Entity.json("{ \"fields\": [\"http://example.org/field1\"] }"));
        assertThat(response.getStatusInfo(), is(Status.OK));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> fieldDefinitions = Arrays.asList(response.readEntity(Map[].class));
        assertThat(fieldDefinitions.size(), is(1));

        Map<String, Object> fieldDefinition = fieldDefinitions.get(0);
        assertThat(fieldDefinition.get("iri"), is("http://example.org/field1"));
    }

    @Test
    public void testRequestMultipleFieldDefinitions() throws Exception {
        Response response = target("fields/definitions").request()
                .post(Entity.json("{ \"fields\": [\"http://example.org/field1\", \"http://example.org/field2\"] }"));
        assertThat(response.getStatusInfo(), is(Status.OK));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> fieldDefinitions = Arrays.asList(response.readEntity(Map[].class));
        assertThat(fieldDefinitions.size(), is(2));

        Map<String, Object> fieldDefinition1 = fieldDefinitions.get(0);
        assertThat(fieldDefinition1.get("iri"), is("http://example.org/field1"));
        Map<String, Object> fieldDefinition2 = fieldDefinitions.get(1);
        assertThat(fieldDefinition2.get("iri"), is("http://example.org/field2"));
    }

    @Test
    public void testRequestNonExistentFieldDefinitions() throws Exception {
        Response response = target("fields/definitions").request()
                .post(Entity.json("{ \"fields\": [\"http://example.org/non-existent\"] }"));
        assertThat(response.getStatusInfo(), is(Status.OK));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> fieldDefinitions = Arrays.asList(response.readEntity(Map[].class));
        assertThat(fieldDefinitions.size(), is(0));
    }

    @Test
    public void testRequestFieldDefinitionForProperty() throws Exception {

        // we'll get field definitions for schema:birthDate and foaf:knows
        final String birthDate = "http://schema.org/birthDate";
        final String knows = FOAF.KNOWS.stringValue();

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("fields", Arrays.asList(knows, birthDate));

        Response response = target("fields/definitions").request().post(Entity.json(requestBody));
        assertThat(response.getStatusInfo(), is(Status.OK));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> fieldDefinitions = Arrays.asList(response.readEntity(Map[].class));
        assertThat(fieldDefinitions.size(), is(2));

        for (Map<String, Object> fieldDefinition : fieldDefinitions) {

            @SuppressWarnings("unchecked")
            Collection<String> domain = (Collection<String>) fieldDefinition.get("domain");

            String iri = (String) fieldDefinition.get("iri");

            assertThat(fieldDefinition.get("insertPattern").toString(),
                    StringContains.containsString("INSERT { $subject <" + iri + "> $value"));
            if (knows.equals(iri)) {
                assertThat(domain, IsCollectionContaining.hasItem(FOAF.AGENT.stringValue()));
            } else if (birthDate.equals(iri)) {
                assertThat(domain, IsEmptyCollection.empty());
                assertThat(fieldDefinition.get("xsdDatatype"), is(XMLSchema.DATE.stringValue()));
            } else {
                fail("unexpected iri: " + iri);
            }

        }
    }

    @Test
    public void testRequestInvalidFieldIRI() throws Exception {
        Response response = target("fields/definitions").request()
                .post(Entity.json("{ \"fields\": [\"this is not a valid iri. \"] }"));
        assertThat(response.getStatusInfo(), is(Status.BAD_REQUEST));
    }

}
