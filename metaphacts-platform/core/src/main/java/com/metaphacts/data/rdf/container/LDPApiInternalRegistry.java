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
package com.metaphacts.data.rdf.container;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;

import javax.inject.Inject;
import javax.inject.Provider;
import javax.inject.Singleton;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import com.google.common.cache.Cache;
import com.metaphacts.cache.CacheManager;
import com.metaphacts.config.Configuration;
import com.metaphacts.config.NamespaceRegistry;
import com.metaphacts.querycatalog.QueryCatalogRESTServiceRegistry;
import com.metaphacts.repository.MpRepositoryProvider;
import com.metaphacts.repository.RepositoryManager;

/**
 * Registry for maintaining {@link LDPApiInternal} instances.
 * 
 * @author Andriy Nikolov an@metaphacts.com
 *
 */
@Singleton
public class LDPApiInternalRegistry {
    
    public static final String CACHE_ID = "platform.ldp.ApiInternalRegistry";
    
    private static final Logger logger = LogManager
            .getLogger(QueryCatalogRESTServiceRegistry.class);
    
    @Inject
    private NamespaceRegistry namespaceRegistry;
    
    @Inject
    private Provider<RepositoryManager> repositoryManagerProvider;
    
    protected final Cache<String, LDPApiInternal> ldpCache;
    
    @Inject
    public LDPApiInternalRegistry(CacheManager cacheManager, Configuration config) {
        ldpCache = cacheManager.newBuilder(CACHE_ID, config.getCacheConfig().getLDPApiInternalRegistrySpec()).build();
    }
    
    public void invalidate() {
        ldpCache.invalidateAll();
    }

    public void invalidate(List<String> repos) {
        ldpCache.invalidateAll(repos);
    }
    
    
    public LDPApiInternal api(String repositoryId) {
        final String repId = Optional.ofNullable(repositoryId)
                                .orElse(RepositoryManager.ASSET_REPOSITORY_ID);
        try {
        
            return ldpCache.get(repId, new Callable<LDPApiInternal>() {
                @Override
                public LDPApiInternal call() {
                    logger.debug("Creating new LDPApi instance for repository \"{}\".", repId);
                    return new LDPApiInternal(
                            new MpRepositoryProvider(repositoryManagerProvider.get(), repId),
                            namespaceRegistry);
                }
            });
        } catch (ExecutionException e) {
            // This exception should never be thrown
            // But in case if something happens, we just send a newly created API instance.
            return new LDPApiInternal(
                    new MpRepositoryProvider(repositoryManagerProvider.get(), repId),
                    namespaceRegistry);
        }
    }

}
