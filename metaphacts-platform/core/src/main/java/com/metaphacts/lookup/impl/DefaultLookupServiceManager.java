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
package com.metaphacts.lookup.impl;

import java.io.Closeable;
import java.io.IOException;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.repository.Repository;
import org.eclipse.rdf4j.repository.RepositoryConnection;
import org.eclipse.rdf4j.repository.config.RepositoryConfig;
import org.eclipse.rdf4j.repository.config.RepositoryImplConfig;

import com.github.jsonldjava.shaded.com.google.common.base.Throwables;
import com.google.common.base.Strings;
import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import com.google.inject.Inject;
import com.metaphacts.config.Configuration;
import com.metaphacts.config.groups.LookupConfiguration;
import com.metaphacts.lookup.api.LookupService;
import com.metaphacts.lookup.api.LookupServiceManager;
import com.metaphacts.lookup.spi.LookupServiceConfig;
import com.metaphacts.lookup.spi.LookupServiceConfigHolder;
import com.metaphacts.lookup.spi.LookupServiceFactory;
import com.metaphacts.lookup.spi.LookupServiceTypeAware;
import com.metaphacts.lookup.spi.LookupVocabulary;
import com.metaphacts.lookup.spi.TargetRepositoryAware;
import com.metaphacts.plugin.PlatformPluginManager;
import com.metaphacts.repository.RepositoryManager;

public class DefaultLookupServiceManager implements LookupServiceManager, LookupVocabulary {
    private static final Logger logger = LogManager
            .getLogger(DefaultLookupServiceManager.class);
    
    public static final String CACHE_ID = "platform.FederatedLookupServiceCache";
    /**
     * Key for the one and only entry in the cache.
     */
    private static final String CACHE_ENTRY = CACHE_ID + ".SingletonEntry";
    
    private final LoadingCache<String, LookupServiceMap> cache;

    private RepositoryManager repositoryManager;

    private LookupConfiguration config;
    
    @Inject
    public DefaultLookupServiceManager(Configuration config, 
            RepositoryManager repositoryManager, PlatformPluginManager platformPluginManager) {
        this.config = config.getLookupConfig();
        this.repositoryManager = repositoryManager;
        // discover and register LookupServiceFactories
        List<LookupServiceFactory> lookupServiceFactories = platformPluginManager.getExtensions(LookupServiceFactory.class);
        lookupServiceFactories.forEach(factory -> LookupServiceRegistry.getInstance().add(factory));
        
        // create and register cache for lookup service
        this.cache = CacheBuilder.from(config.getCacheConfig().getLookupServiceCacheSpec())
                .build(new CacheLoader<String, LookupServiceMap>() {
                    @Override
                    public LookupServiceMap load(String key) {
                        return new LookupServiceMap(findLookupServices());
                    }

                    @Override
                    public Map<String, LookupServiceMap> loadAll(Iterable<? extends String> keys) throws Exception {
                        // return the one and only entry
                        return Collections.singletonMap(CACHE_ENTRY, load(CACHE_ENTRY));
                    }
                });
    }
    
    @Override
    public Optional<LookupService> getDefaultLookupService() {
        String defaultLookupServiceName = config.getDefaultLookupServiceName();
        if (defaultLookupServiceName != null) {
            return getLookupServiceByName(defaultLookupServiceName);
        }
        
        // use companion LookupService for the default repository 
        return getLookupServiceByName(RepositoryManager.DEFAULT_REPOSITORY_ID);
    }

    @Override
    public Optional<LookupService> getDefaultExternalLookupService() {
        String defaultLookupServiceName = config.getDefaultExternalLookupServiceName();
        if (!Strings.isNullOrEmpty(defaultLookupServiceName)) {
            return getLookupServiceByName(defaultLookupServiceName);
        }
        return getDefaultLookupService();
    }
    
    @Override
    public Optional<LookupService> getLookupServiceByName(String name) {
        if (name == null) {
            return Optional.empty();
        }
        return Optional.ofNullable(getLookupServices().get(name));
    }
    
    @Override
    public Map<String, LookupService> getLookupServices() {
        // get the one and only entry
        try {
            return Collections.unmodifiableMap(this.cache.get(CACHE_ENTRY).getLookupServices());
        } catch (Exception e) {
            logger.warn("Failed to fetch lookup services: {}", e.getMessage());
            logger.debug("Details: ", e);
            // ignore and return empty map
            return Collections.emptyMap();
        }
    }
    
    @Override
    public void reloadLookupServices() {
        cleanupLookupServices();
        this.cache.invalidateAll();
    }

    protected Map<String, LookupService> findLookupServices() {
        Map<String, LookupService> services = new HashMap<>();

        // get companion services for repositories
        Map<String, Repository> repositories = findRepositories();
        repositories.entrySet().stream()
                .forEach(entry -> {
                    String repositoryId = entry.getKey();
                    createLookupServiceForRepository(repositoryId, entry.getValue())
                        .ifPresent(service -> services.put(repositoryId, service));
                });
        if (logger.isDebugEnabled()) {
            logger.debug("Initialized the following loookup services: {}", services.keySet().stream()
                    .map(id -> id + " (" + services.get(id).getClass().getSimpleName() + ")")
                    .collect(Collectors.joining(", ")));
        }
        return services;
    }

    protected Optional<LookupService> createLookupServiceForRepository(String repositoryId, Repository repository) {
        // get LookupService configuration for a repository
        Optional<LookupServiceConfigHolder> repositoryLookupConfig = getLookupServiceConfiguration(repositoryId, repository);
        return repositoryLookupConfig
                .filter(cfg -> isActive(cfg.getLookupType()))
                .map(cfg -> createLookupService(repositoryId, repository, cfg).orElse(null));
    }
    
    protected boolean isActive(String lookupType) {
        return (lookupType != null) && !LOOKUP_TYPE_NONE.equalsIgnoreCase(lookupType);
    }
    
    protected Optional<LookupServiceConfigHolder> getLookupServiceConfiguration(String repositoryId, Repository repository) {
        RepositoryConfig repositoryConfig = null;
        try {
            repositoryConfig = repositoryManager.getRepositoryConfig(repositoryId);
        }
        catch (Throwable t) {
            // log but ignore error
            logger.warn("Failed to read configuration of repository {}: {}", repositoryId, t.getMessage());
            logger.debug("Details:",  t);
        }
        
        // check for explicit configuration on the 'lookup:configuration' section of the repository config
        // or alternatively an indicator for the lookup type in the repository impl config
        LookupServiceConfig lookupServiceConfig = null;
        if (repositoryConfig != null) {
            if (repositoryConfig instanceof LookupServiceConfigHolder) {
                LookupServiceConfigHolder lookupServiceConfigHolder = (LookupServiceConfigHolder) repositoryConfig;
                String lookupType = lookupServiceConfigHolder.getLookupType();
                lookupServiceConfig = lookupServiceConfigHolder.getLookupServiceConfig();
                if (lookupType != null) {
                    // we have explicit configuration of the lookup type and (possibly) additional config
                    return Optional.of((LookupServiceConfigHolder) repositoryConfig);
                }
            }
            
            // check whether the repository impl config has an indicator regarding the lookup type
            RepositoryImplConfig repositoryImplConfig = repositoryConfig.getRepositoryImplConfig();
            if (repositoryImplConfig instanceof LookupServiceTypeAware) {
                LookupServiceTypeAware lookupServiceTypeAware = (LookupServiceTypeAware) repositoryImplConfig;
                String lookupType = lookupServiceTypeAware.getLookupType();
                if (lookupType != null) {
                    // we have explicit configuration of the lookup type from the repository impl config 
                    // and re-use additional lookup config from the outer repository config if available
                    return Optional.of(new DefaultLookupServiceConfigHolder(lookupType, lookupServiceConfig));
                }
            }
        }
        
        // no explicit lookup configuration, apply some heuristics
        if (RepositoryManager.DEFAULT_REPOSITORY_ID.equals(repositoryId)) {
            // apply heuristics for some repository types (repositoryType)
            
            if (isBlazegraphEnvironment(repository)) {
                return Optional.of(new DefaultLookupServiceConfigHolder(BlazegraphFtsLookupServiceFactory.LOOKUP_TYPE));
            }
            
            // fall back to regex for default repository
            return Optional.of(new DefaultLookupServiceConfigHolder(RegexLookupServiceFactory.LOOKUP_TYPE));
        }
        return Optional.empty();
    }
    
    /**
     * Determine whether a database is a Blazegraph configuration. This is
     * determined by an ASK query using query hints.
     * 
     * @return <code>true</code> if the provided repository is a Blazegraph repository, <code>false</code> otherwise
     */
    public static boolean isBlazegraphEnvironment(Repository repository) {
        // determine using heuristics
        try (RepositoryConnection conn = repository.getConnection()) {
            return conn.prepareBooleanQuery(
                    "ASK { <http://www.bigdata.com/queryHints#Query> <http://www.bigdata.com/queryHints#optimizer> 'None' . ?x ?y ?z . }")
                    .evaluate();
        } catch (Exception e) {
            logger.debug("Environment does not seem to be a Blazegraph environment: " + e.getMessage());
            logger.trace("Details: ", e);
            return false;
        }
    }
    
    protected Optional<LookupService> createLookupService(String repositoryId, Repository repository, LookupServiceConfigHolder repositoryLookupConfig) {
        if (repositoryLookupConfig == null) {
            return Optional.empty();
        }
        String lookupType = repositoryLookupConfig.getLookupType();
        if (!isActive(lookupType)) {
            // lookup is not active for this repository
            return Optional.empty();
        }
        LookupServiceConfig config = repositoryLookupConfig.getLookupServiceConfig();
        
        logger.info("Creating LookupService of type {} for repository {}", lookupType, repositoryId);
        try {
            Optional<LookupServiceFactory> fact = LookupServiceRegistry.getInstance().get(lookupType);
            if (!fact.isPresent()) {
                logger.warn("No LookupServiceFactory for type {} available!", lookupType);
                return Optional.empty();
            }
            LookupServiceFactory factory = fact.get();
            if (config == null) {
                // no explicit config, get default config
                config = factory.getConfig();
            }
            if (config instanceof TargetRepositoryAware) {
                TargetRepositoryAware targetRepositoryAware = (TargetRepositoryAware) config;
                // only set target repository if it is not already configured
                if (targetRepositoryAware.getTargetRepository() == null) {
                    targetRepositoryAware.setTargetRepository(repositoryId);
                }
            }
            return Optional.of(factory.getLookupService(config));
        }
        catch (Exception e) {
            logger.warn("Failed to create LookupService of type {}: {}", lookupType, e.getMessage());
            logger.debug("Details: ",  e);
            Throwables.throwIfUnchecked(e);
            throw new RuntimeException(e);
        }
    }
    
    protected Optional<Model> getRepositoryConfigModel(String repositoryId, Repository repository) {
        try {
            Model repoConfig = repositoryManager.getModelForRepositoryConfig(repositoryId);
            return Optional.of(repoConfig);
        } catch (Exception e) {
            logger.warn("Failed to get config for repository {}: {}", repositoryId, e.getMessage());
            logger.debug("Details: ", e);
        }
        return Optional.empty();
    }

    protected Map<String, Repository> findRepositories() {
        Map<String, Repository> repositories = new HashMap<>();
        
        // explicitly get main repository
        repositories.put(RepositoryManager.DEFAULT_REPOSITORY_ID, repositoryManager.getDefaultTargetRepository());
        
        try {
            repositories.putAll(repositoryManager.getInitializedRepositoryIds().stream()
                            // do NOT fetch default Ephedra repo!
                            .filter(repositoryId -> !RepositoryManager.PROXY_TO_DEFAULT_REPOSITORY_ID.equals(repositoryId))
                            .filter(repositoryId -> !RepositoryManager.DEFAULT_REPOSITORY_ID.equals(repositoryId))
                            // get corresponding repository 
                            .collect(Collectors.toMap(repositoryId -> repositoryId, 
                                    repositoryId -> repositoryManager.getRepository(repositoryId)))
                    );
        } catch (Exception e) {
            logger.warn("Failed to get available repositories: {}", e.getMessage());
            logger.debug("Details: ", e);
        }
        
        return repositories;
    }
    
    protected void cleanupLookupServices() {
        try {
            Optional.ofNullable(this.cache.getIfPresent(CACHE_ENTRY)).map(map -> map.getLookupServices())
                    .ifPresent(lookupServices -> {
                logger.debug("Cleaning up " + lookupServices.size() + " LookupServices");
                lookupServices.forEach((id, service) -> {
                    if (service instanceof Closeable) {
                        Closeable closeable = (Closeable) service;
                        try {
                            logger.trace("Cleaning up LookupService " + id);
                            closeable.close();
                        } catch (IOException e) {
                            logger.warn("Failed to close LookupService " + id + ": " + e.getMessage());
                            logger.debug("Details: ", e);
                        }
                    }
                });
                    });
        } catch (Exception e) {
            logger.warn("Failed to cleanup LookupServices: " + e.getMessage());
            logger.debug("Details: ", e);
        }
    }

    static class LookupServiceMap {
        private final Map<String, LookupService> lookupServices;

        public LookupServiceMap(Map<String, LookupService> lookupServices) {
            this.lookupServices = lookupServices;
        }
        
        public Map<String, LookupService> getLookupServices() {
            return lookupServices;
        }
        
    }
    
    public static class DefaultLookupServiceConfigHolder implements LookupServiceConfigHolder {
        protected final String lookupType;
        protected final LookupServiceConfig config;

        public DefaultLookupServiceConfigHolder(String lookupType) {
            this(lookupType, null);
        }
        
        public DefaultLookupServiceConfigHolder(String lookupType, LookupServiceConfig config) {
            this.lookupType = lookupType;
            this.config = config;
        }

        @Override
        public String getLookupType() {
            return lookupType;
        }

        @Override
        public LookupServiceConfig getLookupServiceConfig() {
            return config;
        }
    }
}