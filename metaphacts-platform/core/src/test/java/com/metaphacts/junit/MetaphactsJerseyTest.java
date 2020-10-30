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
package com.metaphacts.junit;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.core.Application;

import org.glassfish.hk2.utilities.binding.AbstractBinder;
import org.glassfish.jersey.server.ResourceConfig;
import org.glassfish.jersey.test.DeploymentContext;
import org.glassfish.jersey.test.JerseyTestNg;
import org.jukito.UseModules;
import org.junit.After;
import org.junit.Before;
import org.junit.Rule;
import org.junit.rules.ExpectedException;
import org.junit.runner.RunWith;

import com.google.inject.Inject;
import com.metaphacts.rest.providers.IriParamProvider;
import com.metaphacts.rest.providers.OptionalParamProvider;
import com.metaphacts.rest.providers.OptionalParamProviderTest.OptionalTestEndpoint;
import com.metaphacts.ui.templates.MainTemplate;

/**
 * @author Johannes Trame <jt@metaphacts.com>
 *
 */
@RunWith(MetaphactsJukitoRunner.class)
@UseModules(MetaphactsGuiceTestModule.class)
public abstract class MetaphactsJerseyTest extends JerseyTestNg.ContainerPerMethodTest{

    @Inject 
    protected MainTemplate mainTemplate;
    
    @Inject
    @Rule
    public RuntimeFolderRule runtimeFolderRule;

    @Inject
    @Rule
    public RepositoryRule repositoryRule;

    @Inject
    @Rule
    public NamespaceRule namespaceRule;
    
    @Rule
    public ExpectedException exception= ExpectedException.none();
    
    /**
     * Mocked request object, the should be used to mock, for example, headers
     * This is usually only needed if the request is used and expected to be
     * injected, for example, when using the @Conext annotation
     */
    protected HttpServletRequest req = mock(HttpServletRequest.class);
    
    /**
     * Test implementations need to register the jersey resources to be tested
     * on the provided resourceConfig
     * 
     * @param resourceConfig
     */
    protected abstract void register(ResourceConfig resourceConfig);
    
    @Before
    @Override
    public void setUp() throws Exception {
        super.setUp();
    }
    
    @After
    @Override
    public void tearDown() throws Exception {
        super.tearDown();
    }
    
    @Override
    protected DeploymentContext configureDeployment() {
        DeploymentContext context = DeploymentContext.builder(ResourceTestConfig.class)
                .build();
        register(context.getResourceConfig());

        /*
         * We need to bind a servlet mock here, otherwise @Context
         * HttpServletRequest will not be injected and be null
         * http://stackoverflow.com/questions/17973277/problems-running-jerseytest-when-dealing-with-httpservletresponse
         * https://java.net/jira/browse/JERSEY-623 
         * 3.6. Use of @Context (Jersey Doc):
         * [...] When
         * deploying a JAX-RS application using servlet then ServletConfig,
         * ServletContext, HttpServletRequest and HttpServletResponse are
         * available using @Context.
         */
        context.getResourceConfig().register(new AbstractBinder() {
            @Override
            protected void configure() {
                when(req.getRemoteAddr()).thenReturn("127.0.0.1");
                bind(req).to(HttpServletRequest.class);
            }
        });
        
        context.getResourceConfig()
                .register(IriParamProvider.class)
                .register(OptionalParamProvider.class)
                .register(OptionalTestEndpoint.class);

        return context;
    }
    
    @Override
    protected Application configure() {
        // we configure the DeploymentContext directly
        // to invoke ResourceTestConfig for configuring the HK2 bridge
        // and registration of the resource enpoint
        return null;
    }

}