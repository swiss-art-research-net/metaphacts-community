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
import com.metaphacts.repository.sparql.virtuoso.VirtuosoWrapperRepositoryConfig;

/**
 * 
 * @author Andriy Nikolov an@metaphacts.com
 *
 */
public class VirtuosoWrapperRepositoryConfigTest {
    ValueFactory vf = SimpleValueFactory.getInstance();
    private final IRI baseIri = vf.createIRI("http://www.metaphacts.com/base");
    private final String BASIC_WRAPPER_CONFIG_FILE = "/com/metaphacts/repository/test-virtuoso-wrapper.ttl";
    private final String LEGACY_WRAPPER_CONFIG_FILE = "/com/metaphacts/repository/test-virtuoso-wrapper-legacy.ttl";

    @Rule
    public TemporaryFolder tempFolder = new TemporaryFolder();

    @Rule
    public ExpectedException exception = ExpectedException.none();

    private String delegateRepositoryId = "test-sparql";

    @Test
    public void testParseConfiguration() throws Exception {
        Model model = TestUtils.readTurtleInputStreamIntoModel(
                TestUtils.readPlainTextTurtleInput(BASIC_WRAPPER_CONFIG_FILE), baseIri);

        RepositoryConfig config = RepositoryConfigUtils.createRepositoryConfig(model);
        assertConfig(config);
    }

    @Test
    public void testParseLegacyConfiguration() throws Exception {
        Model model = TestUtils.readTurtleInputStreamIntoModel(
                TestUtils.readPlainTextTurtleInput(LEGACY_WRAPPER_CONFIG_FILE), baseIri);

        RepositoryConfig config = RepositoryConfigUtils.createRepositoryConfig(model);
        assertConfig(config);
    }

    @Test
    public void testNoDelegate() throws Exception {
        RepositoryConfig config = createVirtuosoWrapperConfig(null);
        exception.expect(RepositoryConfigException.class);
        exception.expectMessage("No delegate repository ID is specified.");
        config.validate();
    }

    @Test
    public void testValidConfiguration() throws Exception {
        RepositoryConfig config = createVirtuosoWrapperConfig(delegateRepositoryId);
        config.validate();
        assertConfig(config);
    }

    @Test
    public void testSerializeConfiguration() throws Exception {
        Model fileModel = TestUtils.readTurtleInputStreamIntoModel(
                TestUtils.readPlainTextTurtleInput(BASIC_WRAPPER_CONFIG_FILE), baseIri);

        RepositoryConfig config = createVirtuosoWrapperConfig(delegateRepositoryId);

        Model model = new LinkedHashModel();
        config.export(model);
        assertTrue(Models.isomorphic(fileModel, model));
    }

    private void assertConfig(RepositoryConfig config) {
        assertEquals("test-virtuoso-wrapper", config.getID());
        assertEquals("Test Virtuoso SPARQL repository wrapper", config.getTitle());
        assertTrue(config.getRepositoryImplConfig() instanceof VirtuosoWrapperRepositoryConfig);
        VirtuosoWrapperRepositoryConfig impl = ((VirtuosoWrapperRepositoryConfig) config
                .getRepositoryImplConfig());
        assertEquals(delegateRepositoryId, impl.getDelegateRepositoryId());
    }

    private RepositoryConfig createVirtuosoWrapperConfig(String delegateRepositoryId) {

        final RepositoryConfig repConfig = new RepositoryConfig("test-virtuoso-wrapper",
                "Test Virtuoso SPARQL repository wrapper");
        VirtuosoWrapperRepositoryConfig repImplConfig = new VirtuosoWrapperRepositoryConfig();
        repConfig.setRepositoryImplConfig(repImplConfig);
        repImplConfig.setDelegateRepositoryId(delegateRepositoryId);
        return repConfig;

    }

}