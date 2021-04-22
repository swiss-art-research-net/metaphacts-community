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
import static org.hamcrest.MatcherAssert.assertThat;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.fail;

import java.util.Arrays;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import javax.ws.rs.client.Entity;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.Status;

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.util.ModelBuilder;
import org.eclipse.rdf4j.model.vocabulary.FOAF;
import org.eclipse.rdf4j.model.vocabulary.LDP;
import org.eclipse.rdf4j.model.vocabulary.RDF;
import org.eclipse.rdf4j.model.vocabulary.RDFS;
import org.eclipse.rdf4j.model.vocabulary.XSD;
import org.eclipse.rdf4j.repository.RepositoryConnection;
import org.eclipse.rdf4j.repository.util.Repositories;
import org.eclipse.rdf4j.rio.RDFFormat;
import org.glassfish.jersey.server.ResourceConfig;
import org.hamcrest.Matchers;
import org.hamcrest.collection.IsEmptyCollection;
import org.hamcrest.collection.IsIterableContainingInOrder;
import org.hamcrest.core.IsIterableContaining;
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
            conn.add(this.getClass().getResourceAsStream("shapes-for-fieldendpoint.ttl"), "", RDFFormat.TURTLE);
        }
    }

    @Test
    public void testRequestAllFieldDefinitions() throws Exception {
        Response response = target("fields/definitions").request().post(null);
        assertThat(response.getStatusInfo(), Matchers.equalTo(Status.OK));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> fieldDefinitions = Arrays.asList(response.readEntity(Map[].class));
        assertThat(fieldDefinitions.size(), Matchers.equalTo(2));
    }

    @Test
    public void testRequestSomeFieldDefinitions() throws Exception {
        Response response = target("fields/definitions").request()
                .post(Entity.json("{ \"fields\": [\"http://example.org/field1\"] }"));
        assertThat(response.getStatusInfo(), Matchers.equalTo(Status.OK));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> fieldDefinitions = Arrays.asList(response.readEntity(Map[].class));
        assertThat(fieldDefinitions.size(), Matchers.equalTo(1));

        Map<String, Object> fieldDefinition = fieldDefinitions.get(0);
        assertThat(fieldDefinition.get("iri"), Matchers.equalTo("http://example.org/field1"));
    }

    @Test
    public void testRequestMultipleFieldDefinitions() throws Exception {
        Response response = target("fields/definitions").request()
                .post(Entity.json("{ \"fields\": [\"http://example.org/field1\", \"http://example.org/field2\"] }"));
        assertThat(response.getStatusInfo(), Matchers.equalTo(Status.OK));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> fieldDefinitions = Arrays.asList(response.readEntity(Map[].class));
        assertThat(fieldDefinitions.size(), Matchers.equalTo(2));

        Map<String, Object> fieldDefinition1 = fieldDefinitions.get(0);
        assertThat(fieldDefinition1.get("iri"), Matchers.equalTo("http://example.org/field1"));
        Map<String, Object> fieldDefinition2 = fieldDefinitions.get(1);
        assertThat(fieldDefinition2.get("iri"), Matchers.equalTo("http://example.org/field2"));
    }

    @Test
    public void testRequestNonExistentFieldDefinitions() throws Exception {
        Response response = target("fields/definitions").request()
                .post(Entity.json("{ \"fields\": [\"http://example.org/non-existent\"] }"));
        assertThat(response.getStatusInfo(), Matchers.equalTo(Status.OK));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> fieldDefinitions = Arrays.asList(response.readEntity(Map[].class));
        assertThat(fieldDefinitions.size(), Matchers.equalTo(0));
    }

    @Test
    public void testRequestFieldDefinitionsForSubject() throws Exception {
        // get all field definitions applicable to a particular instance.
        Response response = target("fields/definitions").request()
                .post(Entity.json("{ \"subject\": \"http://example.org/bob#me\" }"));

        assertThat(response.getStatusInfo(), Matchers.equalTo(Status.OK));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> fieldDefinitions = Arrays.asList(response.readEntity(Map[].class));

        assertThat(fieldDefinitions.size(), Matchers.equalTo(5));

        // we expect five field definitions: rdfs:label, schema:birthDate, foaf:knows, foaf:topicOfInterest, and
        // rdf:type. In that order.
        List<String> fieldIRIs = fieldDefinitions.stream().map(fd -> (String) fd.get("iri"))
                .collect(Collectors.toList());
        assertThat(fieldIRIs,
                IsIterableContainingInOrder.contains(RDFS.LABEL.stringValue(), "http://schema.org/birthDate",
                        FOAF.KNOWS.stringValue(), FOAF.TOPIC_INTEREST.stringValue(), RDF.TYPE.stringValue()));

        for (Map<String, Object> fieldDefinition : fieldDefinitions) {
            IRI iri = iri((String) fieldDefinition.get("iri"));

            assertThat(fieldDefinition.get("insertPattern").toString(),
                    StringContains.containsString("INSERT { $subject <" + iri + "> $value"));

            if (FOAF.KNOWS.equals(iri)) {
                @SuppressWarnings("unchecked")
                Collection<String> domain = (Collection<String>) fieldDefinition.get("domain");
                assertThat(domain, IsIterableContaining.hasItem(FOAF.AGENT.stringValue()));
            } else if (iri("http://schema.org/birthDate").equals(iri)) {
                assertThat(fieldDefinition.get("xsdDatatype"), Matchers.equalTo(XSD.DATE.stringValue()));
            } else if (FOAF.TOPIC_INTEREST.equals(iri)) {
                assertThat(fieldDefinition.get("xsdDatatype"), Matchers.equalTo(XSD.ANYURI.stringValue()));
            } else if (RDF.TYPE.equals(iri)) {
                assertThat(fieldDefinition.get("xsdDatatype"), Matchers.equalTo(XSD.ANYURI.stringValue()));

                @SuppressWarnings("unchecked")
                var defaultValues = (Collection<String>) fieldDefinition.get("defaultValues");
                assertThat(defaultValues.size(), Matchers.equalTo(1));
                assertThat(defaultValues, IsIterableContaining.hasItem(FOAF.PERSON.stringValue()));
                assertThat(defaultValues, IsIterableContaining.hasItem(FOAF.PERSON.stringValue()));
            } else if (RDFS.LABEL.equals(iri)) {
                assertThat(fieldDefinition.get("xsdDatatype"), Matchers.equalTo(XSD.STRING.stringValue()));
            } else {
                fail("unexpected iri: " + iri);
            }
        }
    }

    @Test
    public void testRequestFieldDefinitionsForUnknownSubject() throws Exception {
        // get all field definitions applicable to the subejct ex:UnknownResource
        Response response = target("fields/definitions").request()
                .post(Entity.json("{ \"subject\": \"http://example.org/UnknownResource\" }"));

        assertThat(response.getStatusInfo(), Matchers.equalTo(Status.BAD_REQUEST));
    }

    @Test
    public void testRequestFieldDefinitionsForClass() throws Exception {

        // get all field definitions applicable to the class foaf:Person.
        Response response = target("fields/definitions").request()
                .post(Entity.json("{ \"class\": \"" + FOAF.PERSON.stringValue() + "\" }"));

        assertThat(response.getStatusInfo(), Matchers.equalTo(Status.OK));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> fieldDefinitions = Arrays.asList(response.readEntity(Map[].class));

        assertThat(fieldDefinitions.size(), Matchers.equalTo(5));

        // we expect five field definitions: rdfs:label, schema:birthDate, foaf:knows, foaf:topicOfInterest, and
        // rdf:type. In that order.
        List<String> fieldIRIs = fieldDefinitions.stream().map(fd -> (String) fd.get("iri"))
                .collect(Collectors.toList());
        assertThat(fieldIRIs,
                IsIterableContainingInOrder.contains(RDFS.LABEL.stringValue(), "http://schema.org/birthDate",
                FOAF.KNOWS.stringValue(), FOAF.TOPIC_INTEREST.stringValue(), RDF.TYPE.stringValue()));

        for (Map<String, Object> fieldDefinition : fieldDefinitions) {
            IRI iri = iri((String) fieldDefinition.get("iri"));

            assertThat(fieldDefinition.get("insertPattern").toString(),
                    StringContains.containsString("INSERT { $subject <" + iri + "> $value"));

            if (FOAF.KNOWS.equals(iri)) {
                @SuppressWarnings("unchecked")
                Collection<String> domain = (Collection<String>) fieldDefinition.get("domain");
                assertThat(domain, IsIterableContaining.hasItem(FOAF.AGENT.stringValue()));
            } else if (iri("http://schema.org/birthDate").equals(iri)) {
                assertThat(fieldDefinition.get("xsdDatatype"), Matchers.equalTo(XSD.DATE.stringValue()));
            } else if (FOAF.TOPIC_INTEREST.equals(iri)) {
                assertThat(fieldDefinition.get("xsdDatatype"), Matchers.equalTo(XSD.ANYURI.stringValue()));
            } else if (RDF.TYPE.equals(iri)) {
                assertThat(fieldDefinition.get("xsdDatatype"), Matchers.equalTo(XSD.ANYURI.stringValue()));

                @SuppressWarnings("unchecked")
                var defaultValues = (Collection<String>) fieldDefinition.get("defaultValues");
                assertThat(defaultValues.size(), Matchers.equalTo(1));
                assertThat(defaultValues, IsIterableContaining.hasItem(FOAF.PERSON.stringValue()));
            } else if (RDFS.LABEL.equals(iri)) {
                assertThat(fieldDefinition.get("xsdDatatype"), Matchers.equalTo(XSD.STRING.stringValue()));
            } else {
                fail("unexpected iri: " + iri);
            }
        }
    }

    @Test
    public void testRequestFieldDefinitionsForUnknownClass() throws Exception {

        // get all field definitions applicable to the class ex:UnknownClass
        Response response = target("fields/definitions").request()
                .post(Entity.json("{ \"class\": \"http://example.org/UnknownClass\" }"));

        assertThat(response.getStatusInfo(), Matchers.equalTo(Status.BAD_REQUEST));
    }

    @Test
    public void testRequestFieldDefinitionsForClassPlusFields() throws Exception {

        // get a subset of field definitions applicable to the class foaf:Person.
        Response response = target("fields/definitions").request()
                .post(Entity.json(
                        "{ \"class\": \"" + FOAF.PERSON.stringValue() + "\", \"fields\": [ \"" + FOAF.KNOWS + "\"] }"));

        assertThat(response.getStatusInfo(), Matchers.equalTo(Status.OK));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> fieldDefinitions = Arrays.asList(response.readEntity(Map[].class));
        assertThat(fieldDefinitions.size(), Matchers.equalTo(2));

        var fieldDefinition = fieldDefinitions.get(0);

        IRI iri = iri((String) fieldDefinition.get("iri"));
        assertEquals(FOAF.KNOWS, iri);

        assertThat(fieldDefinition.get("insertPattern").toString(),
                StringContains.containsString("INSERT { $subject <" + iri + "> $value"));

        @SuppressWarnings("unchecked")
        Collection<String> domain = (Collection<String>) fieldDefinition.get("domain");
        assertThat(domain, IsIterableContaining.hasItem(FOAF.AGENT.stringValue()));

        fieldDefinition = fieldDefinitions.get(1);
        assertEquals(RDF.TYPE, iri((String) fieldDefinition.get("iri")));
        assertThat(fieldDefinition.get("xsdDatatype"), Matchers.equalTo(XSD.ANYURI.stringValue()));

        @SuppressWarnings("unchecked")
        var defaultValues = (Collection<String>) fieldDefinition.get("defaultValues");
        assertThat(defaultValues.size(), Matchers.equalTo(1));
        assertThat(defaultValues, IsIterableContaining.hasItem(FOAF.PERSON.stringValue()));
        assertThat(defaultValues, IsIterableContaining.hasItem(FOAF.PERSON.stringValue()));
    }

    @Test
    public void testRequestFieldDefinitionForProperty() throws Exception {

        // we'll get field definitions for schema:birthDate and foaf:knows
        final String birthDate = "http://schema.org/birthDate";
        final String knows = FOAF.KNOWS.stringValue();

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("fields", Arrays.asList(knows, birthDate));

        Response response = target("fields/definitions").request().post(Entity.json(requestBody));
        assertThat(response.getStatusInfo(), Matchers.equalTo(Status.OK));

        List<Map<String, Object>> fieldDefinitions = Arrays.asList(response.readEntity(Map[].class));
        assertThat(fieldDefinitions.size(), Matchers.equalTo(2));

        // check that definitions are returned in expected order and with expected attributes
        var fieldDefinition = fieldDefinitions.get(0);
        assertThat(fieldDefinition.get("iri"), Matchers.equalTo(knows));
        assertThat((Collection<String>) fieldDefinition.get("domain"),
                IsIterableContaining.hasItem(FOAF.AGENT.stringValue()));
        assertThat(fieldDefinition.get("insertPattern").toString(),
                StringContains.containsString("INSERT { $subject <" + knows + "> $value"));

        fieldDefinition = fieldDefinitions.get(1);
        assertThat(fieldDefinition.get("iri"), Matchers.equalTo(birthDate));
        assertThat((Collection<String>) fieldDefinition.get("domain"), IsEmptyCollection.empty());
        assertThat(fieldDefinition.get("xsdDatatype"), Matchers.equalTo(XSD.DATE.stringValue()));

        // request fields the other way around to make sure ordering works
        requestBody.put("fields", Arrays.asList(birthDate, knows));
        response = target("fields/definitions").request().post(Entity.json(requestBody));
        assertThat(response.getStatusInfo(), Matchers.equalTo(Status.OK));
        fieldDefinitions = Arrays.asList(response.readEntity(Map[].class));
        assertThat(fieldDefinitions.size(), Matchers.equalTo(2));

        assertThat(fieldDefinitions.get(0).get("iri"), Matchers.equalTo(birthDate));
        assertThat(fieldDefinitions.get(1).get("iri"), Matchers.equalTo(knows));
    }

    @Test
    public void testRequestInvalidFieldIRI() throws Exception {
        Response response = target("fields/definitions").request()
                .post(Entity.json("{ \"fields\": [\"this is not a valid iri. \"] }"));
        assertThat(response.getStatusInfo(), Matchers.equalTo(Status.BAD_REQUEST));
    }

}