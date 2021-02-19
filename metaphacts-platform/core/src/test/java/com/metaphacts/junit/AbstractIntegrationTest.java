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
package com.metaphacts.junit;

import static org.junit.Assert.assertTrue;

import org.jukito.UseModules;
import org.junit.After;
import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.ExternalResource;
import org.junit.rules.RuleChain;
import org.junit.runner.RunWith;

import com.google.inject.Inject;
import com.google.inject.Provider;
import com.metaphacts.config.Configuration;
import com.metaphacts.config.NamespaceRegistry;
import com.metaphacts.data.rdf.ReadConnection;

/**
 * Extend this class to automatically run your test with {@link MetaphactsJukitoRunner}
 * and {@link MetaphactsGuiceTestModule}, which will take care of basic
 * configurations (i.e. in temporary folders) as well as binding classes for
 * dynamic and static guice injections.
 *
 * <p>
 * Note: dependencies such as runtime folder, {@link RepositoryRule}, {@link RuntimeFolderRule}, etc. are 
 * reset after each test. 
 * </p>
 * 
 * <p>
 * When using own {@code @}{@link Rule}s care needs to be taken to properly initialize dependencies.
 * Everything that is being {@code @}{@link Inject}ed will be initialized by Guice at roughly the same 
 * time so when injecting JUnit rules this might not work as intended regarding ordering.<br/>
 * Using {@code @}{@link RuleChain}s to order initialization will not work properly as the {@code @}{@link Inject}ed fields
 * for {@code @}{@link Rule}s are not necessarily already available when setting up the RuleChain using 
 * {@code RuleChain.outerRule(outerRule).around(enclosedRule)}. The solution is to call the rule's 
 * {@link ExternalResource#before} and {@link ExternalResource#before} methods manually in methods annotated 
 * with {@code @}{@link Before} and {@code @}{@link After}.
 * </p>
 * 
 * @author Johannes Trame <jt@metaphacts.com>
 * @author Wolfgang Schell <ws@metaphacts.com>
 */
@RunWith(MetaphactsJukitoRunner.class)
@UseModules(MetaphactsGuiceTestModule.class)
public abstract class AbstractIntegrationTest {
    @Inject
    protected Provider<NamespaceRegistry> ns;
    
    @Inject
    protected Configuration config;
    
    @Inject
    @Rule
    public RuntimeFolderRule runtimeFolderRule;

    @Inject
    @Rule
    public RepositoryRule repositoryRule;
    
    
    /**
     * Dummy test method to prevent JukitoRunner from throwing an exception
     * because of none runnable test methods
     */
    @Test
    public void dummyTest(){
        // assert that triple store is empty
        //assertEquals(0,repositoryRule.getReadConnection().size());
        assertTrue("dummy test", true);
    }
    
    protected ReadConnection connection(){
       return this.repositoryRule.getReadConnection();
    }
}