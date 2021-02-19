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
package com.metaphacts.util;

import static org.hamcrest.MatcherAssert.assertThat;

import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.model.vocabulary.RDF;
import org.eclipse.rdf4j.model.vocabulary.XSD;
import org.hamcrest.CoreMatchers;
import org.junit.Test;

import com.metaphacts.sparql.renderer.MpSparqlQueryRendererTest;

/**
 * Tests for {@link QueryUtil} functions.
 *
 * FIXME: migrate some (all?) test cases from {@link MpSparqlQueryRendererTest} to this test class.
 *
 * @author Jeen Broekstra <jb@metaphacts.com>
 *
 */
public class QueryUtilTest {

    private static final ValueFactory vf = SimpleValueFactory.getInstance();

    @Test
    public void toSPARQLOnStringLiteral() throws Exception {
        Literal fooBar = vf.createLiteral("foo bar");
        assertThat(QueryUtil.toSPARQL(fooBar), CoreMatchers.equalTo("\"foo bar\""));
    }

    @Test
    public void toSPARQLOnIntegerLiteral() throws Exception {
        Literal fooBar = vf.createLiteral(42);
        assertThat(QueryUtil.toSPARQL(fooBar), CoreMatchers.equalTo("\"42\"^^<" + XSD.INT + ">"));
    }

    @Test
    public void toSPARQLOnIRI() throws Exception {
        assertThat(QueryUtil.toSPARQL(RDF.TYPE), CoreMatchers.equalTo("<" + RDF.TYPE + ">"));
    }
}
