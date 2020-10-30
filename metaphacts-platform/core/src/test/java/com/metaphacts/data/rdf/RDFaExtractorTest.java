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
package com.metaphacts.data.rdf;

import static org.junit.Assert.assertEquals;

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.Statement;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.LinkedHashModel;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.model.util.Models;
import org.eclipse.rdf4j.model.vocabulary.FOAF;
import org.junit.Test;

import com.google.common.collect.Lists;
import com.google.common.collect.Sets;

/**
 * @author Johannes Trame <jt@metaphacts.com>
 */
public class RDFaExtractorTest {
    
    private ValueFactory vf = SimpleValueFactory.getInstance();
    /*
     * Testing
     * - subject of RDFa statement being the document baseURI as supplied to the parser
     */
    @Test
    public void testLiteral() throws Exception{
        IRI baseURI= vf.createIRI("http://www.test.de/testSubject");
        
        Model m =  RDFaExtractor.extractModel("His name is <span property=\"http://xmlns.com/foaf/0.1/name\">Joe</span>.", baseURI.stringValue());
        assertEquals(1,m.size());
        assertEquals(Sets.<IRI>newLinkedHashSet(Lists.<IRI>newArrayList(FOAF.NAME)), m.filter(baseURI, null, null).predicates());
        assertEquals(vf.createLiteral("Joe"), Models.objectLiteral(m.filter(baseURI, null, null)).get());
    }
    
    /*
     * Testing
     * - not properly closed html tags
     * - self-closing html tags
     * - a href link as relation 
     */
    @Test
    public void testRelation() throws Exception{
        IRI baseURI= vf.createIRI("http://www.test.de/Mike");
        
        Model m = RDFaExtractor
                .extractModel(
                        "<div resource=\"http://www.test.de/Peter\"> <hr/> His <b>name</b> is <a rel=\"http://xmlns.com/foaf/0.1/knows\" "
                        + "href=\"http://www.test.de/Joe\">Joe</a></div>, but <span property=\"http://xmlns.com/foaf/0.1/name\">Mike</span> <i> calls <i> calls him J. "
                        + "", baseURI.stringValue());
        assertEquals(2, m.size());
        LinkedHashModel expectedModel = new LinkedHashModel(Lists.<Statement>newArrayList(
            vf.createStatement(vf.createIRI("http://www.test.de/Peter"), FOAF.KNOWS, vf.createIRI("http://www.test.de/Joe")),
            vf.createStatement(baseURI, FOAF.NAME, vf.createLiteral("Mike"))
        ));
        assertEquals(expectedModel, m);
    }

}