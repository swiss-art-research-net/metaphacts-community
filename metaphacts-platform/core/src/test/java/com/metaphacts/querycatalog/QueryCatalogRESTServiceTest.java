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
package com.metaphacts.querycatalog;

import org.eclipse.rdf4j.model.Value;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.model.vocabulary.FOAF;
import org.eclipse.rdf4j.model.vocabulary.RDFS;
import org.eclipse.rdf4j.model.vocabulary.XSD;
import org.junit.Assert;
import org.junit.Test;

import com.metaphacts.api.dto.querytemplate.QueryArgument;

public class QueryCatalogRESTServiceTest {
    
    private static ValueFactory VF = SimpleValueFactory.getInstance();
    private static final String TEST_NS = "http://example.org";

    
    public QueryCatalogRESTServiceTest() {
        
    }
    
    
    @Test
    public void testCastAnyURI() {
        Value val = QueryCatalogRESTService
                .interpretInputParameter(
                        new QueryArgument(
                                VF.createIRI(TEST_NS + "arg1"), "x", "", "x", XSD.ANYURI), 
                        FOAF.PERSON.stringValue());
        Assert.assertEquals(FOAF.PERSON, val);
    }
    
    @Test
    public void testCastAnyURIFail() {
        Assert.assertThrows(IllegalArgumentException.class, () -> {

            QueryCatalogRESTService
                .interpretInputParameter(
                        new QueryArgument(
                                VF.createIRI(TEST_NS + "arg1"), "x", "", "x", XSD.ANYURI), 
                        "Some string");
        });
    }
    
    @Test
    public void testCastRDFSResource() {        
        Value val = QueryCatalogRESTService
                .interpretInputParameter(
                        new QueryArgument(
                                VF.createIRI(TEST_NS + "arg1"), "x", "", "x", RDFS.RESOURCE), 
                        FOAF.PERSON.stringValue());
        Assert.assertEquals(FOAF.PERSON, val);
    }
    
    @Test
    public void testCastInteger() {        
        Value val = QueryCatalogRESTService
                .interpretInputParameter(
                        new QueryArgument(
                                VF.createIRI(TEST_NS + "arg1"), "z", "", "z", XSD.INT), 
                        "11");
        Assert.assertEquals(VF.createLiteral(11), val);
    }
    
    @Test
    public void testAddNonExistingArgument() {
        Assert.assertThrows(IllegalArgumentException.class, () -> {
            QueryCatalogRESTService.interpretInputParameter(null, FOAF.PERSON.stringValue());
        });
    }

}
