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
package com.metaphacts.services.fields;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.Set;

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.model.vocabulary.FOAF;
import org.junit.Test;

import com.google.common.collect.Sets;

/**
 * Unit tests on {@link FieldDefinition}
 * 
 * @author Jeen Broekstra <jb@metaphacts.com>
 */
public class FieldDefinitionTest {

    @Test
    public void testToJson_EmptyFieldDefinition() throws Exception {
        FieldDefinition subject = new FieldDefinition();
        Map<String, Object> result = subject.toJson();
        assertNotNull(result);
        assertNull(result.get("iri"));
    }

    @Test
    public void testToJson_IdOnly() {
        final IRI iri = FOAF.NAME;
        FieldDefinition subject = new FieldDefinition();
        subject.setIri(iri);

        Map<String, Object> result = subject.toJson();
        assertNotNull(result);
        assertEquals(iri.stringValue(), result.get("iri"));
    }

    @Test
    public void testToJson_MultipleFields() {
        final IRI iri = FOAF.NAME;
        final Literal description = SimpleValueFactory.getInstance().createLiteral("a description");
        final Set<IRI> domain = Sets.newHashSet(FOAF.AGENT, FOAF.PERSON);

        FieldDefinition subject = new FieldDefinition();
        subject.setIri(iri);
        subject.setDescription(description);
        subject.setDomain(domain);

        Map<String, Object> result = subject.toJson();

        assertNotNull(result);
        assertEquals(iri.stringValue(), result.get("iri"));
        assertEquals(description.stringValue(), result.get("description"));

        List<String> jsonDomains = (List<String>) result.get("domain");
        assertTrue(jsonDomains.contains(FOAF.AGENT.stringValue()));
        assertTrue(jsonDomains.contains(FOAF.PERSON.stringValue()));
    }
}
