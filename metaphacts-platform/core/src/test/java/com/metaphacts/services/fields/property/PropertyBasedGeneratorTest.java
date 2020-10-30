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
package com.metaphacts.services.fields.property;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.util.Arrays;
import java.util.Collections;
import java.util.Map;
import java.util.Optional;

import javax.inject.Inject;

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.vocabulary.FOAF;
import org.eclipse.rdf4j.model.vocabulary.OWL;
import org.eclipse.rdf4j.model.vocabulary.RDF;
import org.eclipse.rdf4j.model.vocabulary.RDFS;
import org.eclipse.rdf4j.model.vocabulary.XMLSchema;
import org.eclipse.rdf4j.repository.Repository;
import org.eclipse.rdf4j.repository.RepositoryConnection;
import org.eclipse.rdf4j.repository.util.Repositories;
import org.junit.Before;
import org.junit.Test;

import com.google.inject.Injector;
import com.metaphacts.junit.AbstractIntegrationTest;
import com.metaphacts.services.fields.FieldDefinition;


public class PropertyBasedGeneratorTest extends AbstractIntegrationTest {

    private Repository rep;

    private PropertyBasedGenerator subject;

    @Inject
    private Injector injector;

    private final IRI property = FOAF.NAME;

    private final String expectedInsertPattern = "INSERT { $subject <" + property + "> $value . } WHERE {}";

    @Before 
    public void setUp() throws Exception {
        this.rep = repositoryRule.getRepository();
        this.subject = new PropertyBasedGenerator();
        injector.injectMembers(this.subject);
    }

    @Test
    public void testGenerate_UnknownProperty() throws Exception {
        Repositories.consume(rep, RepositoryConnection::clear);
        Optional<FieldDefinition> result = subject.generate(property);
        assertFalse(result.isPresent());
    }

    @Test
    public void testGenerate_RdfProperty() throws Exception {
        Repositories.consume(rep, conn -> conn.add(property, RDF.TYPE, RDF.PROPERTY));
        Optional<FieldDefinition> result = subject.generate(property);
        assertTrue(result.isPresent());

        FieldDefinition fd = result.get();

        assertNotNull(fd.getIri());
        assertEquals(expectedInsertPattern, fd.getInsertPattern());
    }

    @Test
    public void testGenerate_Domains() throws Exception {
        Repositories.consume(rep, conn -> {
            conn.add(property, RDF.TYPE, RDF.PROPERTY);
            conn.add(property, RDFS.DOMAIN, FOAF.AGENT);
            conn.add(property, RDFS.DOMAIN, FOAF.ACCOUNT);
        });
        Optional<FieldDefinition> result = subject.generate(property);
        assertTrue(result.isPresent());

        FieldDefinition fd = result.get();
        assertTrue(fd.getDomain().contains(FOAF.AGENT));
        assertTrue(fd.getDomain().contains(FOAF.ACCOUNT));
    }

    @Test
    public void testGenerate_Ranges() throws Exception {
        Repositories.consume(rep, conn -> {
            conn.add(property, RDF.TYPE, RDF.PROPERTY);
            conn.add(property, RDFS.RANGE, FOAF.AGENT);
            conn.add(property, RDFS.RANGE, FOAF.ACCOUNT);
        });
        Optional<FieldDefinition> result = subject.generate(property);
        assertTrue(result.isPresent());

        FieldDefinition fd = result.get();
        assertTrue(fd.getRange().contains(FOAF.AGENT));
        assertTrue(fd.getRange().contains(FOAF.ACCOUNT));
    }

    @Test
    public void testGenerate_DatatypeConstraint() throws Exception {
        Repositories.consume(rep, conn -> {
            conn.add(property, RDF.TYPE, RDF.PROPERTY);
            conn.add(property, RDFS.RANGE, XMLSchema.POSITIVE_INTEGER);
        });
        Optional<FieldDefinition> result = subject.generate(property);
        assertTrue(result.isPresent());

        FieldDefinition fd = result.get();
        assertTrue(fd.getRange().contains(XMLSchema.POSITIVE_INTEGER));
        assertEquals(XMLSchema.POSITIVE_INTEGER, fd.getXsdDatatype());
    }

    @Test
    public void testGenerate_DatatypeFromRange1() throws Exception {
        Repositories.consume(rep, conn -> {
            conn.add(property, RDF.TYPE, RDF.PROPERTY);
            conn.add(property, RDFS.RANGE, RDFS.LITERAL);
        });
        Optional<FieldDefinition> result = subject.generate(property);
        assertTrue(result.isPresent());

        FieldDefinition fd = result.get();
        assertEquals(XMLSchema.STRING, fd.getXsdDatatype());
    }

    @Test
    public void testGenerate_DatatypeFromRange2() throws Exception {
        Repositories.consume(rep, conn -> {
            conn.add(property, RDF.TYPE, RDF.PROPERTY);
            conn.add(property, RDFS.RANGE, RDFS.RESOURCE);
        });
        Optional<FieldDefinition> result = subject.generate(property);
        assertTrue(result.isPresent());

        FieldDefinition fd = result.get();
        assertEquals(XMLSchema.ANYURI, fd.getXsdDatatype());
    }

    @Test
    public void testGenerate_DatatypeFromRange3() throws Exception {
        Repositories.consume(rep, conn -> {
            conn.add(property, RDF.TYPE, RDF.PROPERTY);
            conn.add(property, RDFS.RANGE, FOAF.PERSON);
        });
        Optional<FieldDefinition> result = subject.generate(property);
        assertTrue(result.isPresent());

        FieldDefinition fd = result.get();
        assertEquals(XMLSchema.ANYURI, fd.getXsdDatatype());
    }

    @Test
    public void testGenerate_DatatypeFromMultipleRanges1() throws Exception {
        Repositories.consume(rep, conn -> {
            conn.add(property, RDF.TYPE, RDF.PROPERTY);
            conn.add(property, RDFS.RANGE, FOAF.PERSON);
            conn.add(property, RDFS.RANGE, RDFS.LITERAL);
        });
        Optional<FieldDefinition> result = subject.generate(property);
        assertTrue(result.isPresent());

        FieldDefinition fd = result.get();
        assertEquals(XMLSchema.STRING, fd.getXsdDatatype());
    }

    @Test
    public void testGenerate_DatatypeFromMultipleRanges2() throws Exception {
        Repositories.consume(rep, conn -> {
            conn.add(property, RDF.TYPE, RDF.PROPERTY);
            conn.add(property, RDFS.RANGE, FOAF.PERSON);
            conn.add(property, RDFS.RANGE, FOAF.AGENT);
        });
        Optional<FieldDefinition> result = subject.generate(property);
        assertTrue(result.isPresent());

        FieldDefinition fd = result.get();
        assertEquals(XMLSchema.STRING, fd.getXsdDatatype());
    }

    @Test
    public void testGenerate_DatatypeFromOccurrence1() throws Exception {
        Repositories.consume(rep, conn -> {
            conn.add(property, RDF.TYPE, RDF.PROPERTY);
            conn.add(RDF.ALT, property, FOAF.PERSON);
        });
        Optional<FieldDefinition> result = subject.generate(property);
        assertTrue(result.isPresent());

        FieldDefinition fd = result.get();
        assertEquals(XMLSchema.ANYURI, fd.getXsdDatatype());
    }

    @Test
    public void testGenerate_DatatypeFromOccurrence2() throws Exception {
        Repositories.consume(rep, conn -> {
            conn.add(property, RDF.TYPE, RDF.PROPERTY);
            conn.add(RDF.ALT, property, FOAF.PERSON);
            conn.add(RDF.ALT, property, conn.getValueFactory().createLiteral("literal"));
        });
        Optional<FieldDefinition> result = subject.generate(property);
        assertTrue(result.isPresent());

        FieldDefinition fd = result.get();
        assertEquals(XMLSchema.ANYURI, fd.getXsdDatatype());
    }

    @Test
    public void testGenerate_DatatypeFromOccurrence3() throws Exception {
        Repositories.consume(rep, conn -> {
            conn.add(property, RDF.TYPE, RDF.PROPERTY);
            conn.add(RDF.ALT, property, conn.getValueFactory().createLiteral("literal"));
            conn.add(RDF.ALT, property, conn.getValueFactory().createLiteral("another literal"));
        });
        Optional<FieldDefinition> result = subject.generate(property);
        assertTrue(result.isPresent());

        FieldDefinition fd = result.get();
        assertEquals(XMLSchema.STRING, fd.getXsdDatatype());
    }

    @Test
    public void testGenerate_DatatypeProperty() throws Exception {
        Repositories.consume(rep, conn -> conn.add(property, RDF.TYPE, OWL.DATATYPEPROPERTY));
        Optional<FieldDefinition> result = subject.generate(property);
        assertTrue(result.isPresent());

        FieldDefinition fd = result.get();

        assertNotNull(fd.getIri());
        assertEquals(expectedInsertPattern, fd.getInsertPattern());
        assertEquals(XMLSchema.STRING, fd.getXsdDatatype());
    }

    @Test
    public void testGenerate_ObjectProperty() throws Exception {
        Repositories.consume(rep, conn -> conn.add(property, RDF.TYPE, OWL.OBJECTPROPERTY));
        Optional<FieldDefinition> result = subject.generate(property);
        assertTrue(result.isPresent());

        FieldDefinition fd = result.get();
        assertNotNull(fd.getIri());
        assertEquals(expectedInsertPattern, fd.getInsertPattern());
        assertEquals(XMLSchema.ANYURI, fd.getXsdDatatype());
    }

    @Test
    public void testGenerate_Predicate() throws Exception {
        // a statement with the property used as a predicate
        Repositories.consume(rep, conn -> conn.add(RDF.ALT, property, RDF.ALT));

        Optional<FieldDefinition> result = subject.generate(property);
        assertTrue(result.isPresent());

        FieldDefinition fd = result.get();
        assertNotNull(fd.getIri());
        assertEquals(expectedInsertPattern, fd.getInsertPattern());
        assertEquals(XMLSchema.ANYURI, fd.getXsdDatatype());

    }

    @Test
    public void testGenerateAll_Property() throws Exception {
        Repositories.consume(rep, conn -> conn.add(property, RDF.TYPE, RDF.PROPERTY));
        Map<IRI, FieldDefinition> result = subject.generateAll(Arrays.asList(property));
        assertFalse(result.isEmpty());
        assertTrue(result.keySet().contains(property));
    }

    @Test
    public void testGenerateAll_EmptyList() throws Exception {
        Repositories.consume(rep, conn -> conn.add(property, RDF.TYPE, RDF.PROPERTY));
        Map<IRI, FieldDefinition> result = subject.generateAll(Collections.emptyList());
        assertTrue(result.isEmpty());
    }
    
    @Test
    public void testGenerate_AutoSuggestionFromSingleRange() throws Exception {
        Repositories.consume(rep, conn -> {
            conn.add(FOAF.KNOWS, RDF.TYPE, OWL.OBJECTPROPERTY);
            conn.add(FOAF.KNOWS, RDFS.RANGE, FOAF.PERSON);
        });
        Optional<FieldDefinition> result = subject.generate(FOAF.KNOWS);
        assertTrue(result.isPresent());

        FieldDefinition fd = result.get();
        assertEquals(
                "SELECT ?value ?label WHERE {"
                        + "?value rdfs:label|skos:prefLabel ?label. "
                + "?value a ?type. "
                + "FILTER(?type in (<http://xmlns.com/foaf/0.1/Person>) ) "
                + "FILTER REGEX(?label, \"?token\",\"i\")"
                + "} LIMIT 10",
                fd.getAutosuggestionPattern());
    }

    @Test
    public void testGenerate_AutoSuggestionWithNoRange() throws Exception {
        Repositories.consume(rep, conn -> {
            conn.add(FOAF.KNOWS, RDF.TYPE, OWL.OBJECTPROPERTY);
        });
        Optional<FieldDefinition> result = subject.generate(FOAF.KNOWS);
        assertTrue(result.isPresent());
        
        FieldDefinition fd = result.get();
        assertEquals(
                "SELECT ?value ?label WHERE {"
                        + "?value rdfs:label|skos:prefLabel ?label. "
                        + "?value a ?type. "
                        + "FILTER REGEX(?label, \"?token\",\"i\")"
                        + "} LIMIT 10",
                        fd.getAutosuggestionPattern());
    }

    @Test
    public void testGenerate_AutoSuggestionFromMultipleRanges() throws Exception {
        Repositories.consume(rep, conn -> {
            conn.add(FOAF.KNOWS, RDF.TYPE, OWL.OBJECTPROPERTY);
            conn.add(FOAF.KNOWS, RDFS.RANGE, FOAF.PERSON);
            conn.add(FOAF.KNOWS, RDFS.RANGE, FOAF.AGENT);
        });
        Optional<FieldDefinition> result = subject.generate(FOAF.KNOWS);
        assertTrue(result.isPresent());
        
        FieldDefinition fd = result.get();
        assertEquals(
                "SELECT ?value ?label WHERE {"
                        + "?value rdfs:label|skos:prefLabel ?label. "
                        + "?value a ?type. "
                        + "FILTER(?type in (<http://xmlns.com/foaf/0.1/Agent>,<http://xmlns.com/foaf/0.1/Person>) ) "
                        + "FILTER REGEX(?label, \"?token\",\"i\")"
                        + "} LIMIT 10",
                        fd.getAutosuggestionPattern());
    }

    @Test
    public void testGenerate_NoAutoSuggestionForDatatype() throws Exception {
        Repositories.consume(rep, conn -> {
            conn.add(FOAF.NAME, RDF.TYPE, OWL.DATATYPEPROPERTY);
        });
        Optional<FieldDefinition> result = subject.generate(FOAF.NAME);
        assertTrue(result.isPresent());
        
        FieldDefinition fd = result.get();
        assertNull(fd.getAutosuggestionPattern());
    }

    @Test
    public void testGenerate_NoAutoSuggestionForDatatypeLiteral() throws Exception {
        Repositories.consume(rep, conn -> {
            conn.add(FOAF.NAME, RDF.TYPE, OWL.DATATYPEPROPERTY);
            conn.add(FOAF.NAME, RDFS.RANGE, RDFS.LITERAL);
        });
        Optional<FieldDefinition> result = subject.generate(FOAF.NAME);
        assertTrue(result.isPresent());
        
        FieldDefinition fd = result.get();
        assertNull(fd.getAutosuggestionPattern());
    }
    
    @Test
    public void testGenerate_SelectPatternDataTypeProperty() throws Exception {
        Repositories.consume(rep, conn -> {
            conn.add(FOAF.NAME, RDF.TYPE, OWL.DATATYPEPROPERTY);
        });
        Optional<FieldDefinition> result = subject.generate(FOAF.NAME);
        assertTrue(result.isPresent());
        
        FieldDefinition fd = result.get();
        assertEquals("SELECT ?value WHERE { $subject <"+FOAF.NAME.stringValue()+"> ?value. }",fd.getSelectPattern());
    }

    @Test
    public void testGenerate_SelectPatternObjectProperty() throws Exception {
        Repositories.consume(rep, conn -> {
            conn.add(FOAF.KNOWS, RDF.TYPE, OWL.OBJECTPROPERTY);
        });
        Optional<FieldDefinition> result = subject.generate(FOAF.KNOWS);
        assertTrue(result.isPresent());
        
        FieldDefinition fd = result.get();
        assertEquals("SELECT ?value WHERE { $subject <"+FOAF.KNOWS.stringValue()+"> ?value. }",fd.getSelectPattern());
    }

    @Test
    public void testGenerate_DeletePatternDataTypeProperty() throws Exception {
        Repositories.consume(rep, conn -> {
            conn.add(FOAF.NAME, RDF.TYPE, OWL.DATATYPEPROPERTY);
        });
        Optional<FieldDefinition> result = subject.generate(FOAF.NAME);
        assertTrue(result.isPresent());
        
        FieldDefinition fd = result.get();
        assertEquals("SELECT ?value WHERE { $subject <"+FOAF.NAME.stringValue()+"> ?value. }",fd.getSelectPattern());
    }
    
    @Test
    public void testGenerate_DeletePatternObjectProperty() throws Exception {
        Repositories.consume(rep, conn -> {
            conn.add(FOAF.KNOWS, RDF.TYPE, OWL.OBJECTPROPERTY);
        });
        Optional<FieldDefinition> result = subject.generate(FOAF.KNOWS);
        assertTrue(result.isPresent());
        
        FieldDefinition fd = result.get();
        assertEquals("SELECT ?value WHERE { $subject <"+FOAF.KNOWS.stringValue()+"> ?value. }",fd.getSelectPattern());
    }


}
