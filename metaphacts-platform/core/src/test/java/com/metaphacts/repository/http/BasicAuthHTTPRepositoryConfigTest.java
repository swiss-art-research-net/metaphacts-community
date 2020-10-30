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
package com.metaphacts.repository.http;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.repository.config.RepositoryConfig;
import org.eclipse.rdf4j.repository.config.RepositoryConfigException;
import org.junit.Test;

import com.metaphacts.junit.TestUtils;
import com.metaphacts.repository.RepositoryConfigUtils;
import com.metaphacts.repository.sparql.SPARQLBasicAuthRepositoryConfig;

public class BasicAuthHTTPRepositoryConfigTest {

    private ValueFactory vf = SimpleValueFactory.getInstance();
    private final IRI baseIri = vf.createIRI("http://www.metaphacts.com/base");

    private String serverURL = "http://example.org/rdf4j-server";
    private final String BASIC_AUTHC_CONFIG_FILE = "/com/metaphacts/repository/http/test-basic-auth-httprepository.ttl";

    @Test(expected = RepositoryConfigException.class)
    public void testNoCredentials() {
        RepositoryConfig config = createBasicAuthConfig(null, null);
        config.validate();
    }

    @Test
    public void testParseConfig() throws Exception {
        Model model = TestUtils
                .readTurtleInputStreamIntoModel(TestUtils.readPlainTextTurtleInput(BASIC_AUTHC_CONFIG_FILE), baseIri);

        RepositoryConfig config = RepositoryConfigUtils.createRepositoryConfig(model);

        assertEquals("test-http-basic-auth-repository", config.getID());
        assertEquals("Test HTTP Basic Auth Description", config.getTitle());
        assertTrue(config.getRepositoryImplConfig() instanceof BasicAuthHTTPRepositoryConfig);
        BasicAuthHTTPRepositoryConfig impl = ((BasicAuthHTTPRepositoryConfig) config.getRepositoryImplConfig());
        assertEquals("http://localhost:8080/rdf4j-server/repositories/test", impl.getURL());
        assertEquals("testuser", impl.getUsername());
        assertEquals("testpassword", impl.getPassword());
    }

    private RepositoryConfig createBasicAuthConfig(String username, String password) {

        final RepositoryConfig repConfig = new RepositoryConfig("test-http-basic-auth-repository",
                "Test HTTP Basic Auth Description");
        BasicAuthHTTPRepositoryConfig repImplConfig = new BasicAuthHTTPRepositoryConfig();
        repImplConfig.setURL(serverURL);
        repImplConfig.setUsername(username);
        repImplConfig.setPassword(password);
        repConfig.setRepositoryImplConfig(repImplConfig);

        return repConfig;

    }
}
