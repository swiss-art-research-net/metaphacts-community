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



import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.LinkedHashModel;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.model.vocabulary.FOAF;
import org.eclipse.rdf4j.model.vocabulary.RDFS;

import com.metaphacts.junit.AbstractIntegrationTest;

/**
 * @author Johannes Trame <jt@metaphacts.com>
 */
public class ModelUtilsTest extends AbstractIntegrationTest {
    
    Model testModel;
    
    ValueFactory vf = SimpleValueFactory.getInstance();
    
    @Before
    public void initModel(){
       testModel = createModel();
    }
    
    @Test
    public void replaceSubjectAndObjects() throws Exception {
        IRI oldIRI = vf.createIRI("http://www.test.com/Metaphacts");
        IRI newIRI = vf.createIRI("http://www.metaphacts.com/Metaphacts");
        Assert.assertTrue(testModel.contains(oldIRI, null, null));
        Assert.assertTrue(testModel.contains(null, null, oldIRI));
        Model replacedModel = ModelUtils.replaceSubjectAndObjects(testModel, oldIRI, newIRI);
        Assert.assertFalse(replacedModel.contains(oldIRI, null, null));
        Assert.assertFalse(replacedModel.contains(null, null, oldIRI));
        Assert.assertTrue(replacedModel.contains(newIRI, null, null));
        Assert.assertTrue(replacedModel.contains(null, null, newIRI));
        Assert.assertEquals(testModel.size(), replacedModel.size());
    
    }

    private Model createModel() {
        Model m = new LinkedHashModel();
        m.add(vf.createStatement(vf.createIRI("http://www.test.com/Metaphacts"), FOAF.KNOWS, vf.createIRI("http://www.test.com/Systap")));
        m.add(vf.createStatement(vf.createIRI("http://www.test.com/Metaphacts"), RDFS.LABEL, vf.createLiteral("Metaphacts GmbH")));
        m.add(vf.createStatement(vf.createIRI("http://www.test.com/Systap"), FOAF.KNOWS, vf.createIRI("http://www.test.com/Wikidata")));
        m.add(vf.createStatement(vf.createIRI("http://www.test.com/Wikidata"), FOAF.KNOWS, vf.createIRI("http://www.test.com/Metaphacts")));
        return m;
    }

}