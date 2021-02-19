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
package com.metaphacts.api.sparql;

import static org.mockito.Mockito.when;

import java.util.Enumeration;
import java.util.List;
import java.util.Optional;
import java.util.Vector;

import javax.servlet.http.HttpServletRequest;

import org.eclipse.rdf4j.query.resultio.TupleQueryResultFormat;
import org.hamcrest.Matchers;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.mockito.invocation.InvocationOnMock;
import org.mockito.stubbing.Answer;

import com.google.common.collect.Lists;
import com.metaphacts.junit.MpAssert;

/**
 * @author Johannes Trame <jt@metaphacts.com>
 */
public class ServletRequestUtilTest {
    @Mock
    private HttpServletRequest req;

    
    @Before
    public void setUp() {
        MockitoAnnotations.openMocks(this);
    }
    
    private static final String standardHTMLAcceptHeader = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
    
    @Test
    public void testGetPreferredMIMETypeHTML() throws Exception {
        when(req.getHeaders("Accept")).thenAnswer(getMimetypeAnswer(Lists.newArrayList(standardHTMLAcceptHeader)));
        Assert.assertEquals("text/html",ServletRequestUtil.getPreferredMIMEType(Lists.newArrayList("text/html","application/xml"), req).get());
    }

    @Test
    public void testGetPreferredMIMETypeSparqlResultJson() throws Exception {
        when(req.getHeaders("Accept")).thenAnswer(getMimetypeAnswer(TupleQueryResultFormat.JSON.getMIMETypes()));
        Assert.assertEquals( TupleQueryResultFormat.JSON.getDefaultMIMEType(),ServletRequestUtil.getPreferredMIMEType(Lists.newArrayList(TupleQueryResultFormat.JSON.getDefaultMIMEType()), req).get());
    }

    @Test
    public void testGetPreferredMIMETypeAny() throws Exception {
        // If any content type is accepted (*/*), there's no preferred
        when(req.getHeaders("Accept")).thenAnswer(getMimetypeAnswer(Lists.newArrayList("*/*")));
        Assert.assertEquals(Optional.empty(), ServletRequestUtil
                .getPreferredMIMEType(Lists.newArrayList("text/html", "application/xml"), req));
    }

    @Test
    public void testGetContentType() throws Exception {
        when(req.getContentType()).thenReturn("application/sparql-query; charset=utf-8");
        Assert.assertEquals("application/sparql-query",ServletRequestUtil.getContentType(req, Optional.empty()).get());

        when(req.getContentType()).thenReturn("application/sparql-query; charset=utf-8");
        Assert.assertEquals("application/sparql-query",ServletRequestUtil.getContentType(req, Optional.of(Lists.newArrayList("application/sparql-query"))).get());
        
        MpAssert.assertThrows(Matchers.containsString("list of possible content types not be empty"),
                IllegalArgumentException.class, () -> {

            Assert.assertFalse(
                    ServletRequestUtil.getContentType(req, Optional.of(Lists.<String>newArrayList())).isPresent());
        });
    }
    
    private Answer<Enumeration<String>> getMimetypeAnswer(final List<String> listOfMimeTypes) {
        return new Answer<Enumeration<String>>() {
            @Override
            public Enumeration<String> answer(InvocationOnMock invocation) throws Throwable {
                return new Vector<String>(listOfMimeTypes).elements();
            }
        };
    }
}