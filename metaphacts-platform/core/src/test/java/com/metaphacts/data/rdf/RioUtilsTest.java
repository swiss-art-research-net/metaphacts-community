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
package com.metaphacts.data.rdf;

import static org.junit.Assert.assertTrue;

import java.io.ByteArrayOutputStream;

import javax.inject.Inject;

import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.DynamicModelFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.model.vocabulary.RDF;
import org.eclipse.rdf4j.model.vocabulary.RDFS;
import org.eclipse.rdf4j.rio.RDFFormat;
import org.junit.Test;

import com.metaphacts.config.NamespaceRegistry;
import com.metaphacts.junit.AbstractIntegrationTest;

public class RioUtilsTest extends AbstractIntegrationTest {

    private final ValueFactory vf = SimpleValueFactory.getInstance();

    @Inject
    public RioUtils subject;

    @Test
    public void writeSendsRegisteredNamespaces() throws Exception {
        NamespaceRegistry registry = ns.get();
        registry.setPrefix("ex", vf.createIRI("http://example.org/"), "runtime");

        Model m = new DynamicModelFactory().createEmptyModel();
        m.add(vf.createIRI("http://example.org/foo"), RDF.TYPE, RDFS.RESOURCE);

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        subject.write(RDFFormat.TURTLE, m, baos);

        String result = new String(baos.toByteArray());

        assertTrue(result.contains("ex: <http://example.org/>"));
        assertTrue(result.contains("ex:foo"));
    }
}
