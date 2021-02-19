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

import java.io.InputStream;
import java.util.Collections;
import java.util.Optional;
import java.util.ServiceLoader;
import java.util.Set;
import java.util.function.Function;

import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.model.impl.TreeModel;
import org.eclipse.rdf4j.repository.Repository;
import org.eclipse.rdf4j.repository.RepositoryConnection;
import org.eclipse.rdf4j.repository.config.RepositoryConfig;
import org.eclipse.rdf4j.repository.config.RepositoryImplConfig;
import org.eclipse.rdf4j.repository.sail.SailRepository;
import org.eclipse.rdf4j.repository.sail.config.SailRepositoryConfig;
import org.eclipse.rdf4j.rio.RDFFormat;
import org.eclipse.rdf4j.rio.Rio;
import org.eclipse.rdf4j.sail.config.SailImplConfig;
import org.eclipse.rdf4j.sail.memory.MemoryStore;
import org.eclipse.rdf4j.sail.memory.config.MemoryStoreConfig;
import org.junit.rules.TemporaryFolder;

import com.google.common.base.Throwables;
import com.google.inject.Inject;
import com.google.inject.Injector;
import com.google.inject.Provider;
import com.google.inject.Singleton;
import com.metaphacts.data.rdf.ReadConnection;
import com.metaphacts.lookup.api.LookupProcessingException;
import com.metaphacts.lookup.api.LookupService;
import com.metaphacts.lookup.impl.AbstractLookupService;
import com.metaphacts.lookup.impl.AbstractLookupServiceFactory;
import com.metaphacts.lookup.impl.CommonLookupConfig;
import com.metaphacts.lookup.impl.LookupServiceRegistry;
import com.metaphacts.lookup.model.LookupRequest;
import com.metaphacts.lookup.model.LookupResponse;
import com.metaphacts.lookup.spi.LookupServiceConfig;
import com.metaphacts.lookup.spi.LookupServiceFactory;
import com.metaphacts.lookup.spi.TargetRepositoryAware;
import com.metaphacts.repository.RepositoryConfigWithLookup;
import com.metaphacts.repository.RepositoryManager;

/**
 * @author Johannes Trame <jt@metaphacts.com>
 *
 */
@Singleton
public class RepositoryRule extends TemporaryFolder {
    private SailRepository repository;
    private SailRepository assetRepository;
    private SailRepository testRepository;
    private ReadConnection read;
    
    /**
     * ensure that the runtime folder is properly defined by injecting the RuntimeFolderRule
     * (will be used indirectly)
     */
    @Inject
    protected RuntimeFolderRule runtimeFolderRule;
    /**
     * ensure that the platform storage is properly defined by injecting the PlatformStorageRule
     * (will be used indirectly)
     */
    @Inject
    protected PlatformStorageRule platformStorageRule;

    @Inject
    private Provider<RepositoryManager> repositoryManagerProvider;
    // this is lazily set from repositoryManagerProvider in #repositoryManager
    private RepositoryManager repositoryManager;
    
    @Inject
    Injector injector;
    
    public RepositoryRule() {
    }

    @Override
    public void before() throws Throwable {
        super.before();

        try {
            repository = new SailRepository(new MemoryStore());
            if(!repository.isInitialized()) {
                repository.init();
            }
            try(RepositoryConnection conn = repository.getConnection();) {}

            assetRepository = new SailRepository(new MemoryStore());
            if (!assetRepository.isInitialized()) {
                assetRepository.init();
            }
            try(RepositoryConnection conn = assetRepository.getConnection();) {}

            testRepository = new SailRepository(new MemoryStore());
            if (!testRepository.isInitialized()) {
                testRepository.init();
            }
            try(RepositoryConnection conn = testRepository.getConnection();) {}

            this.read = new ReadConnection(repository);
        } catch (Exception e) {
            Throwables.throwIfUnchecked(e);
            throw new RuntimeException(e);
        }
    }

    @Override
    public void after() {
        super.after();
        this.repository.shutDown();
        this.assetRepository.shutDown();
        this.testRepository.shutDown();
        if (this.repositoryManager != null) {
            // shutdown and cleanup repositories and repository manager (only if somebody ever 
            // asked for an instance of repository manager or one of the in-memory repositories)
            RepositoryManager repositoryManager = getRepositoryManager();
            Set<String> ids = repositoryManager.getInitializedRepositoryIds();
            for (String id : ids) {
                try {
                    Repository repo = repositoryManager.getRepository(id);
                    if (repo.isInitialized()) {
                        repo.shutDown();
                    }
                } catch (Exception e) {
                    // Could not shut down properly
                }
            }
            repositoryManager.shutdown();
        }
    }

    public Repository getRepository(){
        ensureRepositoryManagerWithInMemoryRepositories();
        return this.repository;
    }

    public Repository getAssetRepository() {
        ensureRepositoryManagerWithInMemoryRepositories();
        return this.assetRepository;
    }
    
    public Repository getTestRepository() {
        ensureRepositoryManagerWithInMemoryRepositories();
        return this.testRepository;
    }

    public RepositoryManager getRepositoryManager() {
        ensureRepositoryManagerWithInMemoryRepositories();
        return this.repositoryManager;
    }
    
    /**
     * Adds and initializes the given repository configuration to the repository manager.
     * 
     * @param repositoryId id of the repository to add
     * @param repoConfig serialized repository config
     * @return initialized repository
     * @throws Exception in case of an error
     */
    public Repository addRepository(String repositoryId, SailImplConfig implConfig) throws Exception {
        return addRepository(repositoryId, new SailRepositoryConfig(implConfig));
    }
    
    /**
     * Adds and initializes the given repository configuration to the repository manager.
     * 
     * @param repositoryId id of the repository to add
     * @param repoConfig repository config
     * @return initialized repository
     * @throws Exception in case of an error
     */
    public Repository addRepository(String repositoryId, RepositoryImplConfig implConfig) throws Exception {
        RepositoryConfig repoConfig = new RepositoryConfig(repositoryId, implConfig);
        return addRepository(repositoryId, repoConfig);
    }
    
    /**
     * Adds and initializes the given repository configuration to the repository manager.
     * 
     * @param repositoryId id of the repository to add
     * @param repoConfig repository config
     * @return initialized repository
     * @throws Exception in case of an error
     */
    public Repository addRepository(String repositoryId, RepositoryConfig repositoryConfig) {
        Model m = new TreeModel();
        repositoryConfig.export(m, SimpleValueFactory.getInstance().createBNode());
        return addRepository(repositoryId, m);
    }

    /**
     * Adds and initializes the given repository configuration to the repository manager.
     * 
     * @param repositoryId id of the repository to add
     * @param repoConfig serialized repository config
     * @return initialized repository
     * @throws Exception in case of an error
     */
    public Repository addRepository(String repositoryId, Model repoConfig) {
        try {
            ensureRepositoryManagerWithInMemoryRepositories();
            repositoryManager.createNewRepository(repoConfig);
            repositoryManager.reinitializeRepositories(Collections.singletonList(repositoryId));
        } catch (Exception e) {
            Throwables.throwIfUnchecked(e);
            throw new RuntimeException(e);
        }
        return repositoryManager.getRepository(repositoryId);
    }
    
    /**
     * Helper method to load a model containing repository configuration from a named resource.
     * @param clazz class to use for loading the resource stream
     * @param repositoryConfigResourcePath name of the resource stream (absolute or relative to provided class)
     * @return Model containing repository configuration
     * @throws Exception in case of an error
     */
    public Model loadRepositoryConfigFromResource(Class<?> clazz, String repositoryConfigResourcePath) throws Exception {
        String baseURI = "http://example.org/";
        Model repoConfig = null;
        try (InputStream in = clazz.getResourceAsStream(repositoryConfigResourcePath)) {
            repoConfig = Rio.parse(in, baseURI, RDFFormat.TURTLE);
        }
        return repoConfig;
    }
    
    /**
     * Adds and initializes the given LookupService configuration to the repository manager as part of a memory repository.
     * <p>
     * This variant allows specifying a Function which is used in a wrapping LookupService to from
     * a factory with a generated lookup type.
     * </p>
     * 
     * @param repositoryId id of the repository to add
     * @param lookupFunction Function to create the lookup response
     * @return initialized repository
     */
    public Repository addRepoWithLookupConfig(String repositoryId, final Function<LookupRequest, LookupResponse> lookupFunction) {
        CommonLookupConfig config = new CommonLookupConfig();
        return addRepoWithLookupService(repositoryId, new AbstractLookupService<CommonLookupConfig>(config) {
            @Override
            protected LookupResponse doLookup(LookupRequest request) throws LookupProcessingException {
                return lookupFunction.apply(request);
            }
        });
    }
    
    /**
     * Adds and initializes the given LookupService to the repository manager as part of a memory repository.
     * <p>
     * This variant allows specifying a concrete pre-configured LookupService instance which is returned as-is from a
     * factory with a generated lookup type.
     * </p>
     * 
     * @param repositoryId  id of the repository to add
     * @param lookupService LookupService to use
     * @return initialized repository
     */
    public Repository addRepoWithLookupService(String repositoryId, LookupService lookupService) {
        LookupServiceRegistry registry = LookupServiceRegistry.getInstance();
        String lookupType = "lookupService-" + lookupService.hashCode();
        CommonLookupConfig config = new CommonLookupConfig(lookupType);
        CustomLookupServiceFactory<CommonLookupConfig> factory = new CustomLookupServiceFactory<CommonLookupConfig>(lookupType, 
                CommonLookupConfig.class, config, lookupService);
        injector.injectMembers(factory);
        registry.add(factory);
        return addRepoWithLookupConfig(repositoryId, config);
    }
    
    /**
     * Adds and initializes the given LookupService configuration to the repository manager as part of a memory repository.
     * @param repositoryId id of the repository to add
     * @param lookupServiceConfig LookupService configuration
     * @return initialized repository
     */
    public Repository addRepoWithLookupConfig(String repositoryId, LookupServiceConfig lookupServiceConfig) {
        MemoryStoreConfig implConfig = new MemoryStoreConfig();
        RepositoryConfigWithLookup repoConfig = new RepositoryConfigWithLookup(repositoryId, new SailRepositoryConfig(implConfig));
        repoConfig.setLookupServiceConfig(lookupServiceConfig);
        return addRepository(repositoryId, repoConfig);
    }
    
    /**
     * Adds and initializes the given LookupService configuration to the repository manager as part of a memory repository.
     * @param repositoryId id of the repository to add
     * @param lookupType type of LookupService to use. This corresponds to the value return by {@link LookupServiceFactory#getLookupServiceType()}
     * @return initialized repository
     */
    public Repository addRepoWithLookupConfig(String repositoryId, String lookupType) {
        return addRepoWithLookupConfig(repositoryId, lookupType, RepositoryManager.DEFAULT_REPOSITORY_ID);
    }
    
    /**
     * Adds and initializes the given LookupService configuration to the repository manager as part of a memory repository.
     * @param repositoryId id of the repository to add
     * @param lookupType type of LookupService to use. This corresponds to the value return by {@link LookupServiceFactory#getLookupServiceType()}
     * @return initialized repository
     */
    public Repository addRepoWithLookupConfig(String repositoryId, String lookupType, String targetRepositoryId) {
        Optional<LookupServiceConfig> config = getLookupServiceConfig(lookupType);
        return config
            .map(cfg -> {
                if ((targetRepositoryId != null) && (cfg instanceof TargetRepositoryAware)) {
                    ((TargetRepositoryAware) cfg).setTargetRepository(targetRepositoryId);
                    
                }
                return addRepoWithLookupConfig(repositoryId, cfg);
            })
            .orElseThrow(() -> new IllegalArgumentException("no factory found for lookupType " + lookupType));
    }

    /**
     * Create LookupServiceConfig class for specified lookup type
     * @param lookupType type of LookupService to use. This corresponds to the value return by {@link LookupServiceFactory#getLookupServiceType()}
     * @return LookupServiceConfig  instance or empty
     */
    public Optional<LookupServiceConfig> getLookupServiceConfig(String lookupType) {
        // create temporary registry of known LookupServiceFactory
        // NOTE: this will only capture instances on the local classpath!
        LookupServiceRegistry registry = new LookupServiceRegistry();
        ServiceLoader<LookupServiceFactory> lookupServiceFactoryLoader = ServiceLoader.load(LookupServiceFactory.class);
        lookupServiceFactoryLoader.forEach(factory -> registry.add(factory));
        return registry.get(lookupType)
            .map(factory -> factory.getConfig());
    }
    
    /**
     * Ensure that the standard set of repositories in the RepositoryManager have been 
     * replaced with appropriate in-memory repositories
     */
    public void ensureRepositoryManagerWithInMemoryRepositories() {
        synchronized(this) {
            if (this.repositoryManager == null) {
                this.repositoryManager = this.repositoryManagerProvider.get();
                // replace default repositories in RepositoryManager with our local dummy repositories
                repositoryManager.setForTests(repository, assetRepository, testRepository);
            }
        }
    }

    public ReadConnection getReadConnection(){
       return this.read;
    }
    
    static class CustomLookupServiceFactory<CFG extends CommonLookupConfig> extends AbstractLookupServiceFactory<CFG> {
        final protected LookupService lookupService;
        final protected CFG config;

        protected CustomLookupServiceFactory(String lookupType, Class<CFG> configClass, CFG config, LookupService lookupService) {
            super(lookupType, configClass);
            this.lookupService = lookupService;
            this.config = config;
        }

        @Override
        public CFG getConfig() {
            return config;
        }

        @Override
        protected LookupService createLookupService(CFG config) {
            return lookupService;
        }
    }
}
