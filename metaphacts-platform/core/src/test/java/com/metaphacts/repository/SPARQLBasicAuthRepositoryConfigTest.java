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
package com.metaphacts.repository;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.LinkedHashModel;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.model.util.Models;
import org.eclipse.rdf4j.repository.config.RepositoryConfig;
import org.eclipse.rdf4j.repository.config.RepositoryConfigException;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.ExpectedException;
import org.junit.rules.TemporaryFolder;

import com.metaphacts.junit.TestUtils;
import com.metaphacts.repository.sparql.SPARQLBasicAuthRepositoryConfig;

/**
 * @author Johannes Trame <jt@metaphacts.com>
 *
 */
public class SPARQLBasicAuthRepositoryConfigTest {
    ValueFactory vf = SimpleValueFactory.getInstance();
    private final IRI baseIri =  vf.createIRI("http://www.metaphacts.com/base");
    private final String BASIC_AUTHC_CONFIG_FILE = "/com/metaphacts/repository/test-sparql-basic-auth-repository.ttl";

    @Rule
    public TemporaryFolder tempFolder = new TemporaryFolder();
    
    @Rule
    public ExpectedException exception = ExpectedException.none();
    private String sparqlRepositoryUrl = "http://wikidata.metaphacts.com/sparql";
    private String sparqlRepositoryUpdateUrl = "http://wikidata.metaphacts.com/sparql/update";
    
    @Test
    public void testNoUser() throws Exception{
       RepositoryConfig config = createSparqlBasicAuthConfig(null, null);
       exception.expect(RepositoryConfigException.class);
       exception.expectMessage("No username specified for SPARQL authenticating repository.");
       config.validate();
    }

    @Test
    public void testNoPassword() throws Exception{
        RepositoryConfig config = createSparqlBasicAuthConfig("testuser", null);
        exception.expect(RepositoryConfigException.class);
        exception.expectMessage("No password specified for SPARQL authenticating repository.");
        config.validate();
    }

    @Test
    public void testValidConfiguration() throws Exception{
        RepositoryConfig config = createSparqlBasicAuthConfig("testuser", "testpassword");
        config.validate();
        assertConfig(config);
    }
    
    @Test
    public void testParseConfiguration() throws Exception{
        Model model = TestUtils.readTurtleInputStreamIntoModel(
                TestUtils.readPlainTextTurtleInput(BASIC_AUTHC_CONFIG_FILE),
                baseIri
                );
        
        RepositoryConfig config = RepositoryConfigUtils.createRepositoryConfig(model);
        assertConfig(config);
    }

    @Test
    public void testSerializeConfiguration() throws Exception{
        Model fileModel = TestUtils.readTurtleInputStreamIntoModel(
                TestUtils.readPlainTextTurtleInput(BASIC_AUTHC_CONFIG_FILE),
                baseIri
                );
        
        RepositoryConfig config = createSparqlBasicAuthConfig("testuser", "testpassword");
        
        Model model = new LinkedHashModel();
        config.export(model);
        assertTrue(Models.isomorphic(fileModel, model));
    }
    
    private void assertConfig(RepositoryConfig config){
        assertEquals("test-sparql-basic-auth-repository", config.getID());
        assertEquals("Test SPARQL Basic Auth Description", config.getTitle());
        assertTrue(config.getRepositoryImplConfig() instanceof SPARQLBasicAuthRepositoryConfig);
        SPARQLBasicAuthRepositoryConfig impl = ((SPARQLBasicAuthRepositoryConfig)config.getRepositoryImplConfig());
        assertEquals(sparqlRepositoryUrl, impl.getQueryEndpointUrl());
        assertEquals(sparqlRepositoryUpdateUrl, impl.getUpdateEndpointUrl());
        assertEquals("testuser", impl.getUsername());
        assertEquals("testpassword", impl.getPassword());
    }
    
    public RepositoryConfig createSparqlBasicAuthConfig(String username, String password){
    
        final RepositoryConfig repConfig = new RepositoryConfig(
                "test-sparql-basic-auth-repository" , "Test SPARQL Basic Auth Description");
        SPARQLBasicAuthRepositoryConfig repImplConfig = new SPARQLBasicAuthRepositoryConfig();
        repImplConfig.setQueryEndpointUrl(sparqlRepositoryUrl);
        repImplConfig.setUpdateEndpointUrl(sparqlRepositoryUpdateUrl);
        repImplConfig.setUsername(username);
        repImplConfig.setPassword(password);
        repConfig.setRepositoryImplConfig(repImplConfig);
        
        return repConfig;
        
    }

}