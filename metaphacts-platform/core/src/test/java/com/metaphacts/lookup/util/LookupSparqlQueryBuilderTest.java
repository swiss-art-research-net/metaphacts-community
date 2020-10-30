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
package com.metaphacts.lookup.util;

import static org.junit.Assert.assertEquals;

import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.junit.Test;

import com.metaphacts.lookup.model.LookupQuery;
import com.metaphacts.lookup.util.LookupSparqlQueryBuilder.QueryPart;

public class LookupSparqlQueryBuilderTest {

    private ValueFactory vf = SimpleValueFactory.getInstance();

    @Test
    public void testParseQuery_defaultConversion() throws Exception {
        LookupQuery lookupQuery = new LookupQuery();
        lookupQuery.setQuery("foo bar");
        QueryPart sparqlQuery = LookupSparqlQueryBuilder.parseQuery(lookupQuery,
                LookupSparqlQueryBuilder.DEFAULT_QUERY_TEMPLATE);
        
        Literal tokenizedQueryString = (Literal) sparqlQuery.getBindings()
                .get(LookupSparqlQueryBuilder.TOKEN_VARIABLE_NAME);

        assertEquals(
                "parsing without supplying conversion function should not convert query string",
                "foo bar",
                tokenizedQueryString.stringValue());
    }

    @Test
    public void testParseQuery_PerQueryConversion_NoConversionFunction() throws Exception {
        LookupQuery lookupQuery = new LookupQuery();
        lookupQuery.setQuery("foo bar");
        lookupQuery.setTokenizeQueryString(true);
        QueryPart sparqlQuery = LookupSparqlQueryBuilder.parseQuery(lookupQuery,
                LookupSparqlQueryBuilder.DEFAULT_QUERY_TEMPLATE);

        Literal tokenizedQueryString = (Literal) sparqlQuery.getBindings()
                .get(LookupSparqlQueryBuilder.TOKEN_VARIABLE_NAME);

        assertEquals(
                "parsing without supplying conversion function should not convert query string",
                "foo bar",
                tokenizedQueryString.stringValue());
    }

    @Test
    public void testParseQuery_ConversionFunction() throws Exception {
        LookupQuery lookupQuery = new LookupQuery();
        lookupQuery.setQuery("foo bar");

        QueryPart sparqlQuery = LookupSparqlQueryBuilder.parseQuery(lookupQuery,
                LookupSparqlQueryBuilder.DEFAULT_QUERY_TEMPLATE,
                q -> vf.createLiteral(LookupSparqlQueryBuilder.splitAppend.apply(q, "*")));

        Literal tokenizedQueryString = (Literal) sparqlQuery
                .getBindings()
                .get(LookupSparqlQueryBuilder.TOKEN_VARIABLE_NAME);

        assertEquals(
                "parsing with conversion function should convert query string",
                "foo* bar*",
                tokenizedQueryString.stringValue());
    }

    @Test
    public void testParseQuery_ConversionFunction_NoTokenizeQueryString() throws Exception {
        LookupQuery lookupQuery = new LookupQuery();
        lookupQuery.setQuery("foo bar");
        lookupQuery.setTokenizeQueryString(Boolean.FALSE);

        QueryPart sparqlQuery = LookupSparqlQueryBuilder.parseQuery(lookupQuery,
                LookupSparqlQueryBuilder.DEFAULT_QUERY_TEMPLATE,
                q -> vf.createLiteral(LookupSparqlQueryBuilder.splitAppend.apply(q, "*")));

        Literal tokenizedQueryString = (Literal) sparqlQuery.getBindings()
                .get(LookupSparqlQueryBuilder.TOKEN_VARIABLE_NAME);

        assertEquals(
                "parsing with tokenizeQueryString set to false should not convert query string",
                "foo bar",
                tokenizedQueryString.stringValue());
    }

}
