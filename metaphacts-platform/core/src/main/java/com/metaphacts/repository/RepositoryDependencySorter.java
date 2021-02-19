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

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Queue;
import java.util.Set;

import org.eclipse.rdf4j.repository.config.RepositoryConfig;
import org.eclipse.rdf4j.repository.config.RepositoryConfigException;
import org.eclipse.rdf4j.repository.config.RepositoryImplConfig;
import org.eclipse.rdf4j.repository.sail.config.ProxyRepositoryConfig;
import org.eclipse.rdf4j.repository.sail.config.SailRepositoryConfig;
import org.eclipse.rdf4j.sail.config.SailImplConfig;

import com.google.common.collect.HashMultimap;
import com.google.common.collect.Lists;
import com.google.common.collect.Maps;
import com.google.common.collect.Queues;
import com.google.common.collect.SetMultimap;



/**
 * Util class serving to establish the order in which given repository configs have to be processed.
 * Some of our custom Repository and Sail implementations make use of other repositories 
 * which are referenced by their IDs. Such implementations are marked by our 
 * {@link MpDelegatingImplConfig} interface. The order must ensure that creation of such custom 
 * delegating implementations happens after the corresponding delegates are created.
 * 
 * @author Andriy Nikolov <an@metaphacts.com>
 *
 */
public class RepositoryDependencySorter {
    
    
    
    private RepositoryDependencySorter() {
    }
    
    private static void fillMultimaps(
            Map<String, RepositoryConfig> originals, 
            SetMultimap<String, String> dependOnMe, 
            SetMultimap<String, String> dependOn) {
        for (Entry<String, RepositoryConfig> entry : originals.entrySet()) {
            RepositoryImplConfig implConfig = entry.getValue().getRepositoryImplConfig();
            List<String> delegateRepositoryIds = Lists.newArrayList();
            if (implConfig instanceof MpDelegatingImplConfig) {
                delegateRepositoryIds.addAll(
                        ((MpDelegatingImplConfig)implConfig).getDelegateRepositoryIDs());
            } else if (implConfig instanceof SailRepositoryConfig) {
                SailImplConfig sailImplConfig = ((SailRepositoryConfig)implConfig)
                                                    .getSailImplConfig();
                if (sailImplConfig instanceof MpDelegatingImplConfig) {
                    delegateRepositoryIds.addAll(
                            ((MpDelegatingImplConfig)sailImplConfig)
                                .getDelegateRepositoryIDs());
                }
            } else if (implConfig instanceof ProxyRepositoryConfig) {
                ProxyRepositoryConfig proxyConfig = (ProxyRepositoryConfig) implConfig;
                delegateRepositoryIds.add(proxyConfig.getProxiedRepositoryID());
            }

            // special handling for virtual proxy repository: if any repo depends on the
            // proxyToDefault repo, it automatically depends on the default repo
            if (delegateRepositoryIds.contains(RepositoryManager.PROXY_TO_DEFAULT_REPOSITORY_ID)) {
                delegateRepositoryIds.add(RepositoryManager.DEFAULT_REPOSITORY_ID);
                delegateRepositoryIds.remove(RepositoryManager.PROXY_TO_DEFAULT_REPOSITORY_ID);
            }

            // default and/or assets repository configs not provided explicitly: 
            // we ignore it as they will be initialized first anyway
            if (!originals.containsKey(RepositoryManager.DEFAULT_REPOSITORY_ID)) {
                delegateRepositoryIds.remove(RepositoryManager.DEFAULT_REPOSITORY_ID);
                delegateRepositoryIds.remove(RepositoryManager.PROXY_TO_DEFAULT_REPOSITORY_ID);
            }
            
            if (!originals.containsKey(RepositoryManager.ASSET_REPOSITORY_ID)) {
                delegateRepositoryIds.remove(RepositoryManager.ASSET_REPOSITORY_ID);
            }
            

            dependOn.putAll(entry.getKey(), delegateRepositoryIds);
            delegateRepositoryIds.stream().forEach(id -> dependOnMe.put(id, entry.getKey()));
        }
    }
    
    /**
     * Takes the provided "id -> RepositoryConfig" map and sorts it according to 
     * the dependencies marked by the {@link MpDelegatingImplConfig} interface.
     * Returns a {@link LinkedHashMap} containing the entries of the originals map
     * in the order in which the corresponding repositories should be created.
     * 
     * @param originals initial repository configs by ID
     * @return {@link LinkedHashMap} containing re-ordered entries of originals
     * @throws RepositoryConfigException in case of a loop dependency.
     */
    public static Map<String, RepositoryConfig> sortConfigs(
            Map<String, RepositoryConfig> originals) throws RepositoryConfigException {
        if (originals == null || originals.isEmpty()) {
            return originals;
        }
        SetMultimap<String, String> dependOnMe = HashMultimap.create();
        SetMultimap<String, String> dependOn = HashMultimap.create();
        
        fillMultimaps(originals, dependOnMe, dependOn);
        
        Queue<String> independents = Queues.newArrayBlockingQueue(originals.size());
        
        List<String> independent = Lists.newArrayList(originals.keySet());
        independent.removeAll(dependOn.keySet());
        independents.addAll(independent);
        
        LinkedHashMap<String, RepositoryConfig> results = Maps.newLinkedHashMap();
        
        while (!independents.isEmpty()) {
            String next = independents.poll();
            Collection<String> satisfiedSet = dependOnMe.get(next);
            if (satisfiedSet != null) {
                for (String satisfied : satisfiedSet) {
                    dependOn.remove(satisfied, next);
                    Set<String> remainingDependencies = dependOn.get(satisfied);
                    if (remainingDependencies == null || remainingDependencies.isEmpty()) {
                        independents.add(satisfied);
                        dependOn.removeAll(satisfied);
                    }
                }
            }
            results.put(next, originals.get(next));
        }
        
        if (results.size() < originals.size()) {
            List<String> unscheduled = Lists.newArrayList(originals.keySet());
            unscheduled.removeAll(results.keySet());
            throw new RepositoryConfigException(
                    "Loop dependencies or unresolved dependencies between "
                            + "the repositories involving [" 
                            + String.join(", ", unscheduled) + "]");
        }
        
        return results;
    }

}