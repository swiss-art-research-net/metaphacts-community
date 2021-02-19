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
package com.metaphacts.repository;

import static com.metaphacts.junit.MpMatchers.hasItemsInOrder;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.junit.Assert.assertEquals;

import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Map;

import org.eclipse.rdf4j.repository.config.AbstractRepositoryImplConfig;
import org.eclipse.rdf4j.repository.config.RepositoryConfig;
import org.eclipse.rdf4j.repository.config.RepositoryConfigException;
import org.eclipse.rdf4j.repository.config.RepositoryImplConfig;
import org.eclipse.rdf4j.repository.sail.config.SailRepositoryConfig;
import org.eclipse.rdf4j.sail.config.AbstractSailImplConfig;
import org.eclipse.rdf4j.sail.config.SailImplConfig;
import org.junit.Assert;
import org.junit.Test;

import com.google.common.collect.Lists;
import com.google.common.collect.Maps;
import com.metaphacts.repository.sparql.virtuoso.VirtuosoWrapperRepositoryConfig;

/**
 * Checks the {@link RepositoryDependencySorter} functionalities.
 * 
 * @author Andriy Nikolov <an@metaphacts.com>
 *
 */
public class RepositoryDependencySorterTest {
    
    private static class DummyRepoNoDepsConfig extends AbstractRepositoryImplConfig {
        
    }
    
    private static class DummyRepoWithDepsConfig 
            extends AbstractRepositoryImplConfig 
            implements MpDelegatingImplConfig {

        private final List<String> delegates;
        
        public DummyRepoWithDepsConfig(List<String> delegates) {
            this.delegates = Lists.newArrayList(delegates);
        }
        
        @Override
        public Collection<String> getDelegateRepositoryIDs() {
            return delegates;
        }
    }
    
    private static class DummySailWithDepsConfig 
            extends AbstractSailImplConfig 
            implements MpDelegatingImplConfig {
        
        private final List<String> delegates;
        
        public DummySailWithDepsConfig(List<String> delegates) {
            this.delegates = Lists.newArrayList(delegates);
        }

        @Override
        public Collection<String> getDelegateRepositoryIDs() {
            return delegates;
        }
        
    }

    
    private RepositoryConfig createTestRepoNoDepsConfig(String name) {
        RepositoryImplConfig impl = new DummyRepoNoDepsConfig();
        RepositoryConfig res = new RepositoryConfig(name, impl);
        return res;
    }
    
    private RepositoryConfig createTestRepoWithDepsConfig(
            String name, List<String> dependencyNames) {
        RepositoryImplConfig impl = new DummyRepoWithDepsConfig(dependencyNames);
        RepositoryConfig res = new RepositoryConfig(name, impl);
        return res;
    }
    
    private RepositoryConfig createTestSailRepoConfig(String name, List<String> dependencyNames) {
        SailImplConfig sailImpl = new DummySailWithDepsConfig(dependencyNames);
        RepositoryImplConfig impl = new SailRepositoryConfig(sailImpl);
        RepositoryConfig res = new RepositoryConfig(name, impl);
        return res;
    }
    
    private void addRepo(Map<String, RepositoryConfig> map, String name, String ... deps) {
        List<String> depList = Arrays.asList(deps);
        if (depList.isEmpty()) {
            map.put(name, createTestRepoNoDepsConfig(name));
        } else {
            map.put(name, createTestRepoWithDepsConfig(name, depList));
        }
    }
    
    private void addSailRepo(Map<String, RepositoryConfig> map, String name, String ... deps) {
        List<String> depList = Arrays.asList(deps);
        if (depList.isEmpty()) {
            map.put(name, createTestRepoNoDepsConfig(name));
        } else {
            map.put(name, createTestSailRepoConfig(name, depList));
        }
    }
    
    @Test
    public void testSimpleDependency() throws Exception {
        Map<String, RepositoryConfig> originals = Maps.newLinkedHashMap();
        // second <- first
        addRepo(originals, "first");
        addRepo(originals, "second", "first");
        
        Map<String, RepositoryConfig> sorted = RepositoryDependencySorter.sortConfigs(originals);
        assertEquals(
                Lists.newArrayList("first", "second"), Lists.newArrayList(sorted.keySet()));
    }
    
    @Test
    public void testSimpleDependencyChangedOrder() throws Exception {
        Map<String, RepositoryConfig> originals = Maps.newLinkedHashMap();
        // second <- first
        addRepo(originals, "second", "first");
        addRepo(originals, "first");
        
        Map<String, RepositoryConfig> sorted = RepositoryDependencySorter.sortConfigs(originals);
        assertEquals(
                Lists.newArrayList("first", "second"), Lists.newArrayList(sorted.keySet()));
    }
    
    @Test
    public void testSimpleDependencyViaSail() throws Exception {
        Map<String, RepositoryConfig> originals = Maps.newLinkedHashMap();
        // second <- first
        addRepo(originals, "first");
        addSailRepo(originals, "second", "first");
        
        Map<String, RepositoryConfig> sorted = RepositoryDependencySorter.sortConfigs(originals);
        assertEquals(
                Lists.newArrayList("first", "second"), Lists.newArrayList(sorted.keySet()));
    }
    
    @Test
    public void testSimpleLoop() throws Exception {
        Map<String, RepositoryConfig> originals = Maps.newLinkedHashMap();
        // first <- second
        // second <- first
        addRepo(originals, "first", "second");
        addRepo(originals, "second", "first");
        
        Assert.assertThrows(RepositoryConfigException.class, () -> {
            RepositoryDependencySorter.sortConfigs(originals);
        });
    }
    
    @Test
    public void testLoopOfThree() throws Exception {
        Map<String, RepositoryConfig> originals = Maps.newLinkedHashMap();
        // second <- first
        // third <- second
        // first <- third
        addRepo(originals, "first", "third");
        addRepo(originals, "second", "first");
        addRepo(originals, "third", "second");
        
        Assert.assertThrows(RepositoryConfigException.class, () -> {
            RepositoryDependencySorter.sortConfigs(originals);
        });
    }
    
    @Test
    public void testTree() {
        Map<String, RepositoryConfig> originals = Maps.newLinkedHashMap();
        // fourth <- third <- second
        // third <- first
        addRepo(originals, "fourth", "third");
        addRepo(originals, "first");
        addRepo(originals, "third", "first", "second");
        addRepo(originals, "second");
        
        Map<String, RepositoryConfig> sorted = RepositoryDependencySorter.sortConfigs(originals);
        assertThat(Lists.newArrayList(sorted.keySet()), 
                hasItemsInOrder("first", "third", "fourth"));
        assertThat(Lists.newArrayList(sorted.keySet()), 
                hasItemsInOrder("second", "third", "fourth"));
    }
    
    @Test
    public void testMultipleRoutes() {
        Map<String, RepositoryConfig> originals = Maps.newLinkedHashMap();
        // fourth <- third <- first
        // fourth <- second <- first
        addRepo(originals, "fourth", "third", "second");
        addRepo(originals, "first");
        addRepo(originals, "third", "first");
        addRepo(originals, "second", "first");
        
        Map<String, RepositoryConfig> sorted = RepositoryDependencySorter.sortConfigs(originals);
        assertThat(Lists.newArrayList(sorted.keySet()), 
                hasItemsInOrder("first", "third", "fourth"));
        assertThat(Lists.newArrayList(sorted.keySet()), 
                hasItemsInOrder("first", "second", "fourth"));
    }

    @Test
    public void testEphedraAsDefaultWithProxy() {

        Map<String, RepositoryConfig> originals = Maps.newLinkedHashMap();
        addRepo(originals, "default");
        addRepo(originals, "defaultEphedra", RepositoryManager.PROXY_TO_DEFAULT_REPOSITORY_ID);

        Map<String, RepositoryConfig> sorted = RepositoryDependencySorter.sortConfigs(originals);
        assertThat(Lists.newArrayList(sorted.keySet()), hasItemsInOrder("default", "defaultEphedra"));
    }

    @Test
    public void testVirtuosoWrapperAsDefault() {

        Map<String, RepositoryConfig> originals = Maps.newLinkedHashMap();

        VirtuosoWrapperRepositoryConfig virtuosoWrapperConfig = new VirtuosoWrapperRepositoryConfig();
        virtuosoWrapperConfig.setDelegateRepositoryId("virtuoso");

        originals.put("default", new RepositoryConfig("default", virtuosoWrapperConfig));
        addRepo(originals, "defaultEphedra", RepositoryManager.PROXY_TO_DEFAULT_REPOSITORY_ID);
        originals.put("virtuoso", createTestRepoNoDepsConfig("virtuoso"));

        Map<String, RepositoryConfig> sorted = RepositoryDependencySorter.sortConfigs(originals);
        assertThat(Lists.newArrayList(sorted.keySet()), hasItemsInOrder("virtuoso", "default", "defaultEphedra"));
    }

}