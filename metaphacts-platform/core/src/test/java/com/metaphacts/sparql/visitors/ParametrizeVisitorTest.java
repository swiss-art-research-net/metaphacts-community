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
package com.metaphacts.sparql.visitors;

import java.util.Map;

import org.eclipse.rdf4j.model.Value;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.query.QueryLanguage;
import org.eclipse.rdf4j.query.parser.ParsedQuery;
import org.eclipse.rdf4j.query.parser.QueryParserUtil;
import org.junit.Assert;
import org.junit.Test;

import com.google.common.collect.ImmutableMap;
import com.metaphacts.junit.AbstractIntegrationTest;
import com.metaphacts.util.QueryUtil;

/**
 * Test cases for {@link ParametrizeVisitor}
 */
public class ParametrizeVisitorTest extends AbstractIntegrationTest {
    private final Map<String, Value> parameters;

    public ParametrizeVisitorTest() {
        ValueFactory vf = SimpleValueFactory.getInstance();
        this.parameters = ImmutableMap.of(
            "iri", vf.createIRI("test:iri"),
            "literal", vf.createLiteral("TestLiteral"),
            "intLiteral", vf.createLiteral(42),
            "langLiteral", vf.createLiteral("TestLangLiteral", "en"),
            "blank", vf.createBNode("testBlank")
        );
    }

    @Test
    public void testSingleTriples() throws Exception {
        assertParametrizationResult(
            "SELECT ?s ?p WHERE { ?s ?p ?iri . ?s ?p ?literal . }",
            "SELECT ?s ?p WHERE { ?s ?p <test:iri> . ?s ?p \"TestLiteral\" . }"
        );
    }
    
    @Test
    public void testSingleTriples_intLiteral() throws Exception {
        assertParametrizationResult(
            "SELECT ?s ?p WHERE { ?s ?p ?iri . ?s ?p ?intLiteral . }",
            "SELECT ?s ?p WHERE { ?s ?p <test:iri> . ?s ?p \"42\"^^<http://www.w3.org/2001/XMLSchema#int> . }"
        );
    }

    @Test
    public void testBind() throws Exception {
        assertParametrizationResult(
            "SELECT ?s WHERE { BIND(?langLiteral AS ?s) . }",
            "SELECT ?s WHERE {{} BIND(\"TestLangLiteral\"@en AS ?s) . }"
        );
    }

    @Test
    public void testPredicateVariable() throws Exception {
        assertParametrizationResult(
            "SELECT ?s ?o WHERE { ?s ?iri ?o . }",
            "SELECT ?s ?o WHERE { ?s <test:iri> ?o . }"
        );
    }

    @Test
    public void testInsideFilter() throws Exception {
        assertParametrizationResult(
                "SELECT ?s ?o WHERE { ?s ?p ?o . FILTER((?iri + \"s\") = \"abc\") }",
                "SELECT ?s ?o WHERE { ?s ?p ?o . FILTER((<test:iri> + \"s\") = \"abc\") }"
        );
    }

    @Test
    public void testProjection() throws Exception {
        assertParametrizationResult(
            "SELECT ?iri ?p ?o WHERE { ?iri ?p ?o . }",
            "SELECT (<test:iri> AS ?iri) ?p ?o WHERE { <test:iri> ?p ?o . }"
        );
    }

    private void assertParametrizationResult(String source, String expected) throws Exception {
        ParsedQuery parsedQuery = QueryParserUtil.parseQuery(QueryLanguage.SPARQL, source, null);
        parsedQuery.getTupleExpr()
            .visit(new ParametrizeVisitor(this.parameters));
        String rendered = QueryUtil.toSPARQL(parsedQuery);
        Assert.assertEquals(
            expected.replaceAll("\\s+", ""),
            rendered.replaceAll("\\s+", "")
        );
    }
}
