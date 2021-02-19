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
package com.metaphacts.templates.helper;

import java.util.Map;

import javax.inject.Inject;

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Value;
import org.eclipse.rdf4j.model.util.Values;
import org.eclipse.rdf4j.model.vocabulary.FOAF;
import org.eclipse.rdf4j.model.vocabulary.XSD;
import org.junit.Assert;
import org.junit.Test;

import com.google.common.collect.Maps;
import com.metaphacts.api.dto.query.ConstructQuery;
import com.metaphacts.api.dto.query.SelectQuery;
import com.metaphacts.api.dto.querytemplate.ConstructQueryTemplate;
import com.metaphacts.api.dto.querytemplate.QueryArgument;
import com.metaphacts.api.dto.querytemplate.SelectQueryTemplate;
import com.metaphacts.cache.QueryTemplateCache;
import com.metaphacts.junit.AbstractIntegrationTest;
import com.metaphacts.templates.MetaphactsHandlebarsTest;


/**
 * Tests for {@link SparqlHelperSource}
 * 
 * see also {@link MetaphactsHandlebarsTest} for integration tests.
 * 
 * @author Andreas Schwarte
 *
 */
public class SparqlHelperSourceTest extends AbstractIntegrationTest {

    static final IRI queryId = Values.iri("http://example.org/q1");
    static final IRI argId = Values.iri("http://example.org/arg1");

    @Inject
    private QueryTemplateCache queryTemplateCache;

    @Test
    public void testGetQueryString_SELECT_IRI() throws Exception {

        SparqlHelperSource s = new SparqlHelperSource(queryTemplateCache);

        String query = "SELECT ?instance WHERE { ?instance a ?type }";
        SelectQuery q = new SelectQuery(queryId, "Query", "Query Description", query);

        // 1. test simple
        SelectQueryTemplate queryTemplate = new SelectQueryTemplate(queryId, "Query", "Query Description", q);
        Assert.assertEquals(query, s.getQueryStringInternal(queryTemplate, Maps.newHashMap()));

        // 2. test with required IRI argument
        QueryArgument arg1 = new QueryArgument(argId, "Type", "Type Description", "type", XSD.ANYURI);
        arg1.setRequired(true);
        queryTemplate.addArgument(arg1);

        Map<String, Value> params = Maps.newHashMap();
        // TODO test exception if required parameter is not provided

        params.put("type", FOAF.PERSON);

        Assert.assertEquals("SELECT ?instance WHERE { ?instance a <" + FOAF.PERSON.stringValue() + "> }",
                s.getQueryStringInternal(queryTemplate, params));

    }

    @Test
    public void testGetQueryString_SELECT_Literal() throws Exception {

        SparqlHelperSource s = new SparqlHelperSource(queryTemplateCache);

        String query = "SELECT ?instance WHERE { ?instance <urn:name> ?name }";
        SelectQuery q = new SelectQuery(queryId, "Query", "Query Description", query);

        // 1. test simple
        SelectQueryTemplate queryTemplate = new SelectQueryTemplate(queryId, "Query", "Query Description", q);
        Assert.assertEquals(query, s.getQueryStringInternal(queryTemplate, Maps.newHashMap()));

        // 2. test with required Literal argument
        QueryArgument arg1 = new QueryArgument(argId, "Name", "Name Description", "name", XSD.STRING);
        arg1.setRequired(true);
        queryTemplate.addArgument(arg1);

        Map<String, Value> params = Maps.newHashMap();
        // TODO test exception if required parameter is not provided

        params.put("name", Values.literal("Mike"));

        Assert.assertEquals("SELECT ?instance WHERE { ?instance <urn:name> \"Mike\" }",
                s.getQueryStringInternal(queryTemplate, params));

    }

    @Test
    public void testGetQueryString_CONSTRUCT_IntegerLiteral() throws Exception {

        SparqlHelperSource s = new SparqlHelperSource(queryTemplateCache);

        String query = "CONSTRUCT { ?instance <urn:age> ?age } WHERE { ?instance <urn:age> ?age }";
        ConstructQuery q = new ConstructQuery(queryId, "Query", "Query Description", query);

        // 1. test simple
        ConstructQueryTemplate queryTemplate = new ConstructQueryTemplate(queryId, "Query", "Query Description", q);
        Assert.assertEquals(query, s.getQueryStringInternal(queryTemplate, Maps.newHashMap()));

        // 2. test with required IRI argument
        QueryArgument arg1 = new QueryArgument(argId, "Age", "Age Description", "age", XSD.INT);
        arg1.setRequired(true);
        queryTemplate.addArgument(arg1);

        Map<String, Value> params = Maps.newHashMap();
        // TODO test exception if required parameter is not provided

        params.put("age", Values.literal(42));

        Assert.assertEquals(
                "CONSTRUCT { ?instance <urn:age> \"42\"^^<http://www.w3.org/2001/XMLSchema#int> } WHERE { ?instance <urn:age> \"42\"^^<http://www.w3.org/2001/XMLSchema#int> }",
                s.getQueryStringInternal(queryTemplate, params));
    }

    @Test
    public void testSetQueryBindings_SELECT_IRI() throws Exception {

        SparqlHelperSource s = new SparqlHelperSource(queryTemplateCache);

        String query = "SELECT ?instance WHERE { ?instance a ?type }";

        Map<String, Value> params = Maps.newHashMap();
        params.put("type", FOAF.PERSON);

        Assert.assertEquals("SELECT ?instance WHERE { ?instance a <" + FOAF.PERSON.stringValue() + "> }",
                s.setQueryBindingsInternal(query, params));
    }

}
