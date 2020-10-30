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
package com.metaphacts.data.json;

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.model.Value;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.model.vocabulary.XMLSchema;
import org.junit.Assert;
import org.junit.BeforeClass;
import org.junit.Test;

import com.fasterxml.jackson.databind.ObjectMapper;


public class RdfJsTermSerializationTest {

    static ObjectMapper mapper;

    static ValueFactory vf = SimpleValueFactory.getInstance();

    @BeforeClass
    public static void beforeClass() throws Exception {
        mapper = new ObjectMapper();
        mapper.registerModule(RdfJsTermSerialization.MODULE);
    }

    @Test
    public void testSerialize() throws Exception {
         
        Assert.assertEquals("{\"termType\":\"NamedNode\",\"value\":\"http://example.org/subject\"}",
                mapper.writeValueAsString(vf.createIRI("http://example.org/subject")));
        
        Assert.assertEquals("{\"termType\":\"Literal\",\"value\":\"Hello World\",\"datatype\":{\"termType\":\"NamedNode\",\"value\":\"" + XMLSchema.STRING + "\"}}",
                mapper.writeValueAsString(vf.createLiteral("Hello World")));
        
        Assert.assertEquals("{\"termType\":\"Literal\",\"value\":\"42\",\"datatype\":{\"termType\":\"NamedNode\",\"value\":\"" + XMLSchema.INT + "\"}}",
                mapper.writeValueAsString(vf.createLiteral(42)));
        
        Assert.assertEquals(
                "{\"termType\":\"Literal\",\"value\":\"Hallo Welt\",\"datatype\":{\"termType\":\"NamedNode\",\"value\":\"http://www.w3.org/1999/02/22-rdf-syntax-ns#langString\"},\"language\":\"de\"}",
                mapper.writeValueAsString(vf.createLiteral("Hallo Welt", "de")));
    }

    @Test
    public void testDeserialize() throws Exception {

        Assert.assertEquals(vf.createIRI("http://example.org/subject"), 
                mapper.readValue("{\"termType\" : \"NamedNode\", \"value\" : \"http://example.org/subject\"}", Value.class));

        Assert.assertEquals(vf.createIRI("http://example.org/subject"), 
                mapper.readValue("{\"termType\" : \"NamedNode\", \"value\" : \"http://example.org/subject\"}", IRI.class));

        Assert.assertEquals(vf.createLiteral("Hello World"),
                mapper.readValue("{\"termType\" : \"Literal\", \"value\" : \"Hello World\",  \"datatype\" : { \"termType\" : \"NamedNode\", \"value\" : \"" + XMLSchema.STRING + "\" } }", Value.class));
        
        Assert.assertEquals(vf.createLiteral("Hello World"),
                mapper.readValue("{\"termType\" : \"Literal\", \"value\" : \"Hello World\",  \"datatype\" : { \"termType\" : \"NamedNode\", \"value\" : \"" + XMLSchema.STRING + "\" } }", Literal.class));

        Assert.assertEquals(vf.createLiteral(42),
                mapper.readValue("{\"termType\" : \"Literal\", \"value\" : \"42\",  \"datatype\" : { \"termType\" : \"NamedNode\", \"value\" : \"" + XMLSchema.INT + "\" } }", Value.class));

        Assert.assertEquals(vf.createLiteral("Hallo Welt", "de"),
                mapper.readValue("{\"termType\" : \"Literal\", \"value\" : \"Hallo Welt\", \"language\" : \"de\", \"datatype\" : { \"termType\" : \"NamedNode\", \"value\" : \"http://www.w3.org/1999/02/22-rdf-syntax-ns#langString\" } }", Literal.class));

    }

    @Test
    public void testSymmetry() throws Exception {

        Assert.assertEquals(vf.createIRI("http://example.org/subject"),
                mapper.readValue(mapper.writeValueAsString(vf.createIRI("http://example.org/subject")), IRI.class));

        Assert.assertEquals(vf.createLiteral("Hello World"),
                mapper.readValue(mapper.writeValueAsString(vf.createLiteral("Hello World")), Literal.class));

        Assert.assertEquals(vf.createLiteral("Hallo Welt", "de"),
                mapper.readValue(mapper.writeValueAsString(vf.createLiteral("Hallo Welt", "de")), Value.class));

        Assert.assertEquals(vf.createLiteral(42),
                mapper.readValue(mapper.writeValueAsString(vf.createLiteral(42)), Literal.class));
    }
}
