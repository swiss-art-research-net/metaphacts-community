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

import java.io.File;
import java.io.IOException;
import java.lang.ref.WeakReference;
import java.util.Collection;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Optional;
import java.util.Set;

import org.apache.commons.lang3.StringUtils;
import org.apache.http.client.HttpClient;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.rdf4j.common.iteration.Iterations;
import org.eclipse.rdf4j.http.client.HttpClientDependent;
import org.eclipse.rdf4j.http.client.HttpClientSessionManager;
import org.eclipse.rdf4j.http.client.SessionManagerDependent;
import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.query.TupleQuery;
import org.eclipse.rdf4j.query.TupleQueryResult;
import org.eclipse.rdf4j.query.algebra.evaluation.federation.FederatedServiceResolverClient;
import org.eclipse.rdf4j.repository.DelegatingRepository;
import org.eclipse.rdf4j.repository.Repository;
import org.eclipse.rdf4j.repository.RepositoryConnection;
import org.eclipse.rdf4j.repository.RepositoryException;
import org.eclipse.rdf4j.repository.RepositoryResolver;
import org.eclipse.rdf4j.repository.RepositoryResolverClient;
import org.eclipse.rdf4j.repository.config.DelegatingRepositoryImplConfig;
import org.eclipse.rdf4j.repository.config.RepositoryConfig;
import org.eclipse.rdf4j.repository.config.RepositoryConfigException;
import org.eclipse.rdf4j.repository.config.RepositoryFactory;
import org.eclipse.rdf4j.repository.config.RepositoryImplConfig;
import org.eclipse.rdf4j.repository.config.RepositoryRegistry;
import org.eclipse.rdf4j.repository.sail.ProxyRepository;
import org.eclipse.rdf4j.repository.sail.SailRepository;
import org.eclipse.rdf4j.repository.sail.config.SailRepositoryConfig;
import org.eclipse.rdf4j.repository.sparql.SPARQLRepository;
import org.eclipse.rdf4j.repository.sparql.config.SPARQLRepositoryFactory;
import org.eclipse.rdf4j.sail.config.SailImplConfig;
import org.eclipse.rdf4j.sail.nativerdf.config.NativeStoreConfig;

import com.google.common.collect.Lists;
import com.google.common.collect.Maps;
import com.google.common.collect.Sets;
import com.google.inject.Inject;
import com.google.inject.Injector;
import com.metaphacts.cache.CacheManager;
import com.metaphacts.config.Configuration;
import com.metaphacts.config.groups.EnvironmentConfiguration;
import com.metaphacts.data.rdf.container.LDPApiInternalRegistry;
import com.metaphacts.di.SubsystemLifecycle;
import com.metaphacts.repository.memory.MpMemoryRepository;
import com.metaphacts.repository.memory.MpMemoryRepositoryImplConfig;
import com.metaphacts.repository.sparql.DefaultMpSPARQLRepositoryFactory;
import com.metaphacts.repository.sparql.MpSPARQLRepositoryConfig;
import com.metaphacts.repository.sparql.MpSharedHttpClientSessionManager;
import com.metaphacts.services.storage.api.ObjectMetadata;
import com.metaphacts.services.storage.api.ObjectStorage;
import com.metaphacts.services.storage.api.PlatformStorage;

/**
 * @author Johannes Trame <jt@metaphacts.com>
 *
 */
public class RepositoryManager implements RepositoryManagerInterface, SubsystemLifecycle {

    private static final Logger logger = LogManager.getLogger(RepositoryManager.class);

    private Configuration config;
    private CacheManager cacheManager;
    private PlatformStorage platformStorage;
    private LDPApiInternalRegistry ldpCache;

    private final Map<String, Repository> initializedRepositories = Maps.newConcurrentMap();

    private final File repositoryDataFolder;

    /**
     * Repository identifier for retrieving the actual active default repository.
     * Note that using {@link EnvironmentConfiguration#getLinkedDefaultRepository()}
     * it is possible to reference a different existing repository.
     * <p>
     * Example: if linkedDefaultRepository is set to myRepo, then
     * {@link #getRepository(String)} will return the {@link Repository} instance
     * corresponding to the myRepo configuration.
     * </p>
     * <p>
     * For explicitly accessing the actual default repository, the
     * {@link #PROXY_TO_DEFAULT_REPOSITORY_ID} can always be used.
     * </p>
     */
    public static final String DEFAULT_REPOSITORY_ID = "default";

    /**
     * Repository identifier for a virtual repository proxying to the actual default
     * repository corresponding to the default.ttl repository configuration,
     */
    public static final String PROXY_TO_DEFAULT_REPOSITORY_ID = "proxyToDefault";
    public static final String ASSET_REPOSITORY_ID = "assets";
    public static final String TEST_REPOSITORY_ID = "tests";

    private final MpSharedHttpClientSessionManager client;
    private final WeakReference<Thread> hookReference;
    private final PlatformRepositoryFederatedServiceResolver platformRepositoryResolver;

    // Removed the common serviceResolver as some repositories might have their own specific resolvers:
    // e.g., to make some repositories accessible via a SERVICE clause and some other ones hidden.

    // private final FederatedServiceResolverImpl serviceResolver;

    private Injector injector;

    private static RepositoryConfig createSPARQLRepositoryConfigForEndpoint(String sparqlRepositoryUrl) {
        RepositoryConfig repConfig =
                new RepositoryConfig(DEFAULT_REPOSITORY_ID, "Default HTTP SPARQL Repository");
        MpSPARQLRepositoryConfig repImplConfig = new MpSPARQLRepositoryConfig();
        repImplConfig.setQueryEndpointUrl(sparqlRepositoryUrl);
        repImplConfig.setUsingQuads(true);
        repConfig.setRepositoryImplConfig(repImplConfig);
        return repConfig;
    }

    private static RepositoryConfig createMpMemoryRepositoryConfig() {
        RepositoryConfig repConfig =
                new RepositoryConfig(DEFAULT_REPOSITORY_ID, "Default read-only in-memory repository");
        MpMemoryRepositoryImplConfig repImplConfig = new MpMemoryRepositoryImplConfig();
        repConfig.setRepositoryImplConfig(repImplConfig);
        return repConfig;
    }

    @Inject
    public RepositoryManager(
        Injector injector,
        Configuration config,
        CacheManager cacheManager,
        PlatformStorage platformStorage,
        LDPApiInternalRegistry ldpCache
    ) throws IOException {
        this.injector = injector;
        this.config = config;
        this.cacheManager = cacheManager;
        this.platformStorage = platformStorage;
        this.ldpCache = ldpCache;

        File baseDataFolder = new File(Configuration.getRuntimeDirectory(), "data");
        this.repositoryDataFolder = new File(baseDataFolder, "repositories");
        this.client = new MpSharedHttpClientSessionManager(config);
        this.platformRepositoryResolver = new PlatformRepositoryFederatedServiceResolver(this);

        this.hookReference = new WeakReference<>(addShutdownHook(this));
    }

    @Inject
    private void init() throws IOException {
        Map<String, RepositoryConfig> configs =
            RepositoryConfigUtils.readInitialRepositoryConfigsFromStorage(this.platformStorage);

        configs = RepositoryDependencySorter.sortConfigs(configs);

        // initialize default and asset repository first
        initializeDefaultRepositories(configs);

        for (RepositoryConfig config : configs.values()) {
            if (!isInitialized(config.getID())) {
                initializeRepository(config, false);
            }
        }

        logger.info("Linked default repository for all default DB operations is '{}'", getLinkedDefaultRepositoryID());
    }

    public ObjectStorage getDefaultConfigStorage() {
        // TODO: should properly specify default storage to write files
        return platformStorage.getStorage(PlatformStorage.DEVELOPMENT_RUNTIME_STORAGE_KEY);
    }

    /**
     * Sends a simple test query to all available repositories.
     * Moved out of the constructor routine to avoid Guice circular dependency errors
     * caused by repositories that themselves use RepositoryManager.
     * At the moment called explicitly from GuiceServletConfig.
     *
     */
    public void sentTestQueries() {
        for (Entry<String, Repository> entry : initializedRepositories.entrySet()) {
            this.sendTestQuery(entry.getKey(), entry.getValue());
        }
    }

    private Thread addShutdownHook(final RepositoryManager repositoryManager) {
        Thread hook = new Thread() {
            public void run() {
                logger.info("Trying to shutdown repository manager.");
                repositoryManager.shutdown(false);
            }
        };
        logger.debug("Registering RepositoryManager shutdown hook");
        Runtime.getRuntime().addShutdownHook(hook);
        return hook;
    }
    
    private void removeShutdownHook(Thread hook) {
        try {
            if (hook != null) {
                logger.debug("Unregistering RepositoryManager shutdown hook");
                // note that this will fail when it is actually called from the shutdown  
                // hook as in that state the hook cannot be unregistered any more
                Runtime.getRuntime().removeShutdownHook(hook);
            }
        }
        catch (Throwable t) {
            // the exception is expected when called from within the shutdown hook
            logger.warn("Failed to unregister RepositoryManager shutdown hook: {}", t.getMessage());
            logger.debug("Details:", t);
        }
    }

    /**
     * Method to retrieve the active default repository used for all DB operations
     * targeted to {@link #DEFAULT_REPOSITORY_ID}.
     * 
     * <p>
     * Note that using {@link EnvironmentConfiguration#getLinkedDefaultRepository()}
     * it is possible to reference a different existing repository.
     * <p>
     * Example: if linkedDefaultRepository is set to myRepo, then
     * {@link #getRepository(String)} will return the {@link Repository} instance
     * corresponding to the myRepo configuration.
     * </p>
     * <p>
     * For explicitly accessing the actual default repository, the
     * {@link #PROXY_TO_DEFAULT_REPOSITORY_ID} can always be used.
     * </p>
     */
    public Repository getDefault(){
        return this.getRepository(DEFAULT_REPOSITORY_ID);
    }

    /**
     * Method to retrieve the configured physical default repository instance.
     * 
     * <p>
     * Note that compared to {@link #getDefault()} this method does not use
     * {@link EnvironmentConfiguration#getLinkedDefaultRepository()}, i.e. this
     * method will always return the physical repository instance.
     * </p>
     * 
     * @return the physical default repository. If not initialized, this method
     *         returns <code>null</code>
     */
    public Repository getDefaultTargetRepository() {
        // Note: we explicitly do not return the ProxyRepository managed
        // as PROXY_TO_DEFAULT_REPOSITORY_ID here as we do want to have
        // the original instance
        return initializedRepositories.get(DEFAULT_REPOSITORY_ID);
    }

    public Repository getAssetRepository(){
        return this.getRepository(ASSET_REPOSITORY_ID);
    }

    public Repository getTestRepositry() {
        return this.getRepository(TEST_REPOSITORY_ID);
    }

    /**
     * <b>NEVER CALL THIS METHOD </b>
     *  This is for testing purpose only.
     */
    public void setForTests(Repository defaultRepository, Repository assetRepository, Repository testRepository) {
       if(initializedRepositories.containsKey(DEFAULT_REPOSITORY_ID)){
           initializedRepositories.get(DEFAULT_REPOSITORY_ID).shutDown();
       }
        initializedRepositories.put(DEFAULT_REPOSITORY_ID, defaultRepository);

        if (initializedRepositories.containsKey(ASSET_REPOSITORY_ID)) {
            initializedRepositories.get(ASSET_REPOSITORY_ID).shutDown();
        }
        initializedRepositories.put(ASSET_REPOSITORY_ID, assetRepository);

        if (initializedRepositories.containsKey(TEST_REPOSITORY_ID)) {
            initializedRepositories.get(TEST_REPOSITORY_ID).shutDown();
        }
        initializedRepositories.put(TEST_REPOSITORY_ID, testRepository);

        this.ldpCache.invalidate();
    }

    private boolean isInitialized(String repID){
        return initializedRepositories.containsKey(repID);
    }

    private boolean isProtected(String repID){
        return repID.equals(DEFAULT_REPOSITORY_ID) || repID.equals(ASSET_REPOSITORY_ID);
    }

    private File getRepositoryDataFolder(){
        return this.repositoryDataFolder;
    }

    private void initializeDefaultRepositories(Map<String, RepositoryConfig> repositoryConfigs){
        String sparqlRepositoryUrl = this.config.getEnvironmentConfig().getSparqlEndpoint();
        if (repositoryConfigs.containsKey(DEFAULT_REPOSITORY_ID)) {
            // Do nothing: the repository will be initialized in the standard sequence
            // from a Turtle file
        } else if (!StringUtils.isEmpty(sparqlRepositoryUrl)) {
            logger.info("Initializing HTTP Sparql Repository with URL: {}.", sparqlRepositoryUrl);
            RepositoryConfig repConfig =
                    RepositoryManager.createSPARQLRepositoryConfigForEndpoint(sparqlRepositoryUrl);
            initializeRepository(repConfig, false);
        } else {
            RepositoryConfig repConfig = createMpMemoryRepositoryConfig();
            initializeRepository(repConfig, false);
        }

        this.initializeHelperRepository(repositoryConfigs, ASSET_REPOSITORY_ID);
        this.initializeHelperRepository(repositoryConfigs, TEST_REPOSITORY_ID);
    }

    private void initializeHelperRepository(Map<String, RepositoryConfig> repositoryConfigs, String repoId) {
        if (repositoryConfigs.containsKey(repoId)) {
            // Do nothing: the repository will be initialized in the standard sequence
            // from a Turtle file
        } else {
            logger.info("Creating a default {} repository configuration", repoId);
            final RepositoryConfig repConfig = new RepositoryConfig(
                    repoId,
                    repoId + "repository for platform."
            );
            repConfig.setRepositoryImplConfig(
                    new SailRepositoryConfig(
                            new NativeStoreConfig()
                    )
            );
            try {
                RepositoryConfigUtils.writeRepositoryConfigAsPrettyTurtleToFile(
                    getDefaultConfigStorage(), ObjectMetadata.empty(), repConfig, false);
            } catch (RepositoryConfigException | IOException e) {
                logger.error(
                        "Failed to persist auto-generated, "
                        + "default configuration for {} repository: {}", repoId, e.getMessage());
            }
            initializeRepository(repConfig, false);
        }

    }

    private void sendTestQuery(String id, Repository repository){
        logger.info("Testing connection for repository \"{}\".", id);
        try(RepositoryConnection con = repository.getConnection()){
            try (TupleQueryResult tqr = con.prepareTupleQuery("SELECT * WHERE { ?a ?b ?c } LIMIT 1").evaluate()) {
                if (tqr.hasNext()) {
                    Iterations.asList(tqr); // explicitly consume the iteration
                    logger.info(
                            "Connection to repository \"{}\" has been established successfully.",
                            id);
                } else {
                    logger.warn(
                            "Connection to repository \"{}\" has been established successfully. However, repository seems to be empty.",
                            id);
                }
            }
        }catch(Exception e){
            logger.error(
                    "Failed to send test query to repository \"{}\": {} \n", id, e.getMessage());
        }
    }

    private synchronized Repository initializeRepository(
            RepositoryConfig repConfig, boolean allowReplace) throws RepositoryException {
        logger.info("Trying to initialize repository with id \"{}\"",repConfig.getID());
        if (!allowReplace && isInitialized(repConfig.getID())) {
            throw new IllegalStateException(
                    String.format(
                            "Repository with id \"%s\" is already initialized. ",
                            repConfig.getID() ) );
        }
        final RepositoryImplConfig repConfigImpl = repConfig.getRepositoryImplConfig();

        if (repConfigImpl.getType().equals(SPARQLRepositoryFactory.REPOSITORY_TYPE)) {
            throw new RepositoryException(
                    "The default RDF4J SPARQL repository " + SPARQLRepositoryFactory.REPOSITORY_TYPE
                            + " is not allowed because it does not support quad mode. Use "
                            + DefaultMpSPARQLRepositoryFactory.REPOSITORY_TYPE + " instead.");
        }

        Repository repository = createRepositoryStack(repConfigImpl);
        // set the data dir to /data/repositories/{repositoryID}
        // this is mainly relevant for native repository
        repository.setDataDir(new File(getRepositoryDataFolder(),repConfig.getID()));

        repository.init();
        
        if (initializedRepositories.containsKey(repConfig.getID())) {
            initializedRepositories.get(repConfig.getID()).shutDown();
        }
        
        initializedRepositories.put(repConfig.getID(), repository);
        logger.info("Repository with id \"{}\" successfully initialized",repConfig.getID());

        if (repConfig.getID().equals(DEFAULT_REPOSITORY_ID)) {
            initializeProxyForDefault();
        }

        return repository;
    }

    /**
     * Initializes a virtual {@link ProxyRepository} pointing to the initialized
     * {@link #DEFAULT_REPOSITORY_ID}. The repository is explicitly not backed by a
     * repository configuration file on disk.
     * 
     * The purpose of this repository is to act as the actual resolvable target for
     * the Ephedra federation. Note that this is required as the default repository
     * may be linked to an external target using
     * {@link #getLinkedDefaultRepositoryID()}.
     */
    private void initializeProxyForDefault() {

        ProxyRepository proxyRepo = new ProxyRepository(new RepositoryResolver() {

            @Override
            public Repository getRepository(String memberID) throws RepositoryException, RepositoryConfigException {
                return initializedRepositories.get(DEFAULT_REPOSITORY_ID);
            }
        }, DEFAULT_REPOSITORY_ID);

        proxyRepo.init();

        initializedRepositories.put(PROXY_TO_DEFAULT_REPOSITORY_ID, proxyRepo);
    }

    /**
     * Validate the given {@link RepositoryImplConfig} by opening a
     * {@link RepositoryConnection} and send a dummy query.
     * 
     * @param repImplConfig
     * @param repId
     */
    public void validate(RepositoryImplConfig repImplConfig, String repId) {

        Repository repo = createRepositoryStack(repImplConfig);
        // set the data dir to /data/repositories/{repositoryID}
        // this is mainly relevant for native repository
        repo.setDataDir(new File(getRepositoryDataFolder(), repId));

        repo.init();
        try {

            try (RepositoryConnection conn = repo.getConnection()) {
                TupleQuery tq = conn.prepareTupleQuery("SELECT * WHERE { }");
                try (TupleQueryResult tqr = tq.evaluate()) {
                    // just consume the result
                    Iterations.asList(tqr);
                }
            }

        } finally {
            boolean shutdown = true;
            if (repo instanceof ProxyRepository) {
                // never shut down a proxy repository as this will also
                // shutdown the delegate (which we want to keep managed
                // by the platform)
                shutdown = false;
            }
            if (shutdown) {
                repo.shutDown();
            }
        }

    }

    protected synchronized Repository createRepositoryStack(RepositoryImplConfig repImplConfig) {
        RepositoryFactory factory = RepositoryRegistry
                .getInstance()
                .get(
                        repImplConfig.getType())
                            .orElseThrow(
                                () -> new RepositoryConfigException(
                                        "Unsupported repository type: "
                                                + repImplConfig.getType()));
        Repository repository = factory.getRepository(repImplConfig);

        injector.injectMembers(repository);

        if (repImplConfig instanceof DelegatingRepositoryImplConfig) {
            RepositoryImplConfig delegateConfig =

                    ((DelegatingRepositoryImplConfig)repImplConfig).getDelegate();
            Repository delegate = createRepositoryStack(delegateConfig);
            try {
                ((DelegatingRepository)repository).setDelegate(delegate);
            } catch (ClassCastException e) {
                throw new RepositoryConfigException(
                        "Delegate specified for repository that is not a DelegatingRepository: "
                                + delegate.getClass(),
                        e);
            }
        }

        if (repository instanceof SailRepository) {
            injector.injectMembers(((SailRepository)repository).getSail());
        }

        if (repository instanceof RepositoryResolverClient) {
            ((RepositoryResolverClient)repository).setRepositoryResolver(this);
        }
        if (repository instanceof FederatedServiceResolverClient) {
            ((FederatedServiceResolverClient) repository).setFederatedServiceResolver(platformRepositoryResolver);
        }
        if (repository instanceof SessionManagerDependent) {
            ((SessionManagerDependent)repository).setHttpClientSessionManager(client);
        } else if (repository instanceof HttpClientDependent) {
            ((HttpClientDependent)repository).setHttpClient(getHttpClient());
        }
        return repository;
    }

    @Override
    public void shutdown(){
        shutdown(true);
    }
    
    private synchronized void shutdown(boolean unregisterShutdownHook) {
        for(Entry<String, Repository> entry : initializedRepositories.entrySet()){
           try{
               if(isProtected(entry.getKey())){
                   continue;
               }
               logger.info("Trying to shutdown repository \"{}\".", entry.getKey());
               entry.getValue().shutDown();
               initializedRepositories.remove(entry.getKey());
           }catch(RepositoryException e){
               // we will catch and log the exception, so that at least remaining repositories can be shut down
               logger.error("Error while shutting down the repository \"{}\": {}", entry.getKey(), e.getMessage());
           }
        }
        // handle protected repositories separately
        getRepository(Optional.of(DEFAULT_REPOSITORY_ID)).ifPresent(repo -> repo.shutDown());
        getRepository(Optional.of(ASSET_REPOSITORY_ID)).ifPresent(repo -> repo.shutDown());
        getRepository(Optional.of(TEST_REPOSITORY_ID)).ifPresent(repo -> repo.shutDown());
        initializedRepositories.clear();
        
        platformRepositoryResolver.shutDown();

        if (unregisterShutdownHook) {
            // unregister shutdown hook as everything is done
            removeShutdownHook(hookReference.get());
        }
    }

    public synchronized void shutdownRepository(final String repID) throws RepositoryException, IllegalArgumentException{
        if(isInitialized(repID)){
            initializedRepositories.get(repID).shutDown();
            initializedRepositories.remove(repID);
        }else if(isProtected(repID)){
            throw new IllegalAccessError(
                    String.format("Default repository with ID \"%s\" can not be removed.", repID)
            );
        }else{
            throw new IllegalArgumentException(
                    String.format("Repository with ID \"%s\" does not exist.", repID)
            );
        }
    }

    // TODO: remove unused method?
    public void createNewRepository(Model repositoryConfigModel) throws RepositoryConfigException, IOException{
        RepositoryConfig repConfig = RepositoryConfigUtils.createRepositoryConfig(repositoryConfigModel);
        RepositoryConfigUtils.writeRepositoryConfigAsPrettyTurtleToFile(
            getDefaultConfigStorage(), platformStorage.getDefaultMetadata(), repConfig, false);
    }

    public Map<String, Boolean> getAvailableRepositoryConfigs() throws IOException {
        Map <String, Boolean> map = Maps.newHashMap();
        
        Set<String> initializedRepositoryKeys = initializedRepositories.keySet();
        Set<String> definedRepositoryKeys = Sets.newHashSet(RepositoryConfigUtils
            .readInitialRepositoryConfigsFromStorage(platformStorage).keySet());
        String sparqlRepositoryUrl = this.config.getEnvironmentConfig().getSparqlEndpoint();
        if (!StringUtils.isEmpty(sparqlRepositoryUrl)) {
            definedRepositoryKeys.add(RepositoryManager.DEFAULT_REPOSITORY_ID);
        }
        
        // There can exist repositories that were configured, but not initialized (e.g., those just added manually)
        // There can also exist repositories that are still initialized and active, but 
        // for which the config file does not exist (e.g., where the deletion was triggered)
        // We return a union of both.
        for (String repID : Sets.union(initializedRepositoryKeys, definedRepositoryKeys)) {
            map.put(repID, isInitialized(repID) && definedRepositoryKeys.contains(repID));
        }

        // do not expose information on the internal proxy repo
        map.remove(PROXY_TO_DEFAULT_REPOSITORY_ID);

        return map;
    }

    /**
     * Returns the repository config descriptor object for a given repository ID
     *
     * @param repID The repository ID
     * @return A {@link RepositoryConfig} object
     */
    public RepositoryConfig getRepositoryConfig(String repID)
            throws RepositoryConfigException, IllegalArgumentException, IOException {
        if (RepositoryConfigUtils.repositoryConfigFileExists(platformStorage, repID)) {
            return RepositoryConfigUtils.readRepositoryConfigurationFile(platformStorage, repID);
        } else if (repID.equals(DEFAULT_REPOSITORY_ID)) {

            // Note: we need to obtain the Repository instance from the initialized
            // repositories, as getDefault my return the linkedDefaultRepository
            Repository defaultRepoInstance = initializedRepositories.getOrDefault(DEFAULT_REPOSITORY_ID, getDefault());
            if (defaultRepoInstance instanceof SPARQLRepository) {
                // The default repository was created using the sparqlRepositoryUrl
                // property from environment.prop
                SPARQLRepository defaultRepository = (SPARQLRepository) defaultRepoInstance;
                String sparqlRepositoryUrl = defaultRepository.toString(); // returns queryEndpointUrl
                return RepositoryManager.createSPARQLRepositoryConfigForEndpoint(sparqlRepositoryUrl);
            } else if (defaultRepoInstance instanceof MpMemoryRepository) {
                return RepositoryManager.createMpMemoryRepositoryConfig();
            }
        }
        throw new IllegalArgumentException(
                "Repository config for the repository ID '" + repID + "' does not exist (possibly, was deleted).");
        
    }

    /**
     * @param repID The repository ID for which to retrieve the configuration model
     * @return A turtle string i.e. an RDF model of the repository configuration
     * @throws IOException If there any problems related to reading the configuration file from e.g. file system
     * @throws RepositoryConfigException If the configuration is invalid.
     * @throws IllegalArgumentException If the specified repository configuration does not exist
     */
    public String getTurtleConfigStringForRepositoryConfig(String repID) throws IOException, IllegalArgumentException, RepositoryConfigException{
        RepositoryConfig repConfig = getRepositoryConfig(repID);
        return RepositoryConfigUtils.convertRepositoryConfigToPrettyTurtleString(repConfig);
    }

    /**
     * @param repID The repository ID for which to retrieve the configuration model
     * @return An RDF model of the repository configuration
     * @throws IOException If there any problems related to reading the configuration file from e.g. file system
     * @throws RepositoryConfigException If the configuration is invalid.
     * @throws IllegalArgumentException If the specified repository configuration does not exist
     */
    public Model getModelForRepositoryConfig(String repID)
            throws RepositoryConfigException, IllegalArgumentException, IOException {
        RepositoryConfig repConfig = getRepositoryConfig(repID);
        return RepositoryConfigUtils.exportConfigToModel(repConfig);
    }

    @Override
    public synchronized Repository getRepository(String repID) throws RepositoryException, RepositoryConfigException {
        Optional<Repository> repo = getRepository(Optional.of(repID));
        if (repo.isPresent()) {
            return repo.get();
        } else {
            throw new IllegalArgumentException(
                String.format("Repository with ID \"%s\" does not exist.", repID)
            );
        }
    }
    
    public synchronized void deleteRepositoryConfig(String repId) throws Exception {
        if (repId.equals(DEFAULT_REPOSITORY_ID) || repId.equals(ASSET_REPOSITORY_ID)
                || repId.equals(TEST_REPOSITORY_ID)) {
            throw new IllegalArgumentException("Cannot delete one of the pre-defined system repositories: " + repId);
        }

        validateDeletionDependencies(repId);
        
        if (RepositoryConfigUtils.repositoryConfigFileExists(this.platformStorage, repId)) {
            RepositoryConfigUtils.deleteRepositoryConfigurationIfExists(platformStorage, repId);
        }
        
        if (this.initializedRepositories.containsKey(repId)) {
            this.initializedRepositories.get(repId).shutDown();
            this.initializedRepositories.remove(repId);
            this.cacheManager.invalidateAll();
            this.ldpCache.invalidate();
        }
    }
    
    protected void validateDeletionDependencies(String repId) throws Exception {
        Map<String, RepositoryConfig> allConfigs = RepositoryConfigUtils
                .readInitialRepositoryConfigsFromStorage(this.platformStorage);
        Map<String, RepositoryConfig> updatedConfigs = Maps.newHashMap();
        updatedConfigs.put(repId, this.getRepositoryConfig(repId));
        Map<String, RepositoryConfig> configsToRefresh = collectRelevantRepositoryConfigs(updatedConfigs, allConfigs);
        if (configsToRefresh.size() > 1) {
            Set<String> keys = Sets.newHashSet(configsToRefresh.keySet());
            keys.remove(repId);
            throw new Exception("Cannot delete the repository " + repId
                    + " because there are other repositories dependent on it: " + keys.toString());
        }
    }

    /**
     * Returns the {@link Repository} corresponding to the provided repository ID.
     * <p>
     * Note that the {@value #DEFAULT_REPOSITORY_ID} may be virtually linked to a
     * different target externally (e.g. a federation) using the
     * {@link EnvironmentConfiguration#getLinkedDefaultRepository()} setting.
     * </p>
     * 
     * @param repID
     * @return the {@link Repository} or an empty {@link Optional}
     * @throws RepositoryException
     * @throws RepositoryConfigException
     * @see EnvironmentConfiguration#getLinkedDefaultRepository()
     */
    public synchronized Optional<Repository> getRepository(Optional<String> repID) throws RepositoryException, RepositoryConfigException {

        if (repID.isPresent() && repID.get().equals(DEFAULT_REPOSITORY_ID)) {
            repID = Optional.of(getLinkedDefaultRepositoryID());
        }

        return repID.filter(initializedRepositories::containsKey).map(initializedRepositories::get);
    }

    /**
     * Return the linked target repository (if any) for the default repository. If
     * there is none or if the linked target does not exist, this method falls back
     * to {@link #DEFAULT_REPOSITORY_ID}.
     * 
     * @return
     */
    private String getLinkedDefaultRepositoryID() {

        String linkedDefaultRepository = config.getEnvironmentConfig().getLinkedDefaultRepository();
        if (linkedDefaultRepository == null) {
            return DEFAULT_REPOSITORY_ID;
        }

        if (!initializedRepositories.containsKey(linkedDefaultRepository)) {
            logger.warn("Linked default repository '" + linkedDefaultRepository
                    + "' does not exist. Check 'linkedDefaultRepository' setting. Falling back to "
                    + DEFAULT_REPOSITORY_ID);
            return DEFAULT_REPOSITORY_ID;
        }

        return linkedDefaultRepository;
    }

    public String getRepositoryID(Repository repository){
        for( Entry<String, Repository> rep : initializedRepositories.entrySet()){
            if(rep.getValue().equals(repository)){
                return rep.getKey();
            }
        }
        throw new IllegalArgumentException(
                String.format("Repository \"%s\" is not known to the repository manager.", repository)
        );
    }

    public MpSharedHttpClientSessionManager getClientSessionManager() {
        return this.client;
    }

    @Override
    public HttpClient getHttpClient() {
        return client.getHttpClient();
    }

    @Override
    public void setHttpClient(HttpClient client) {
        this.client.setHttpClient(client);
    }

    public synchronized void reinitializeRepositories(Collection<String> ids) throws Exception {
        Map<String, RepositoryConfig> allConfigs = RepositoryConfigUtils
                .readInitialRepositoryConfigsFromStorage(this.platformStorage);
        Map<String, RepositoryConfig> updatedConfigs = Maps.newHashMap();
        for (String id : ids) {
            RepositoryConfig config = this.getRepositoryConfig(id);
            updatedConfigs.put(id, config);
        }
        
        Map<String, RepositoryConfig> configsToRefresh = collectRelevantRepositoryConfigs(updatedConfigs, allConfigs);
        logger.trace("Reinitializing repositories: " + configsToRefresh.keySet().toString());
        Map<String, RepositoryConfig> allConfigsSorted = RepositoryDependencySorter.sortConfigs(allConfigs);
        for (String key : allConfigsSorted.keySet()) {
            if (configsToRefresh.containsKey(key)) {
                logger.trace("Reinitializing repository: " + key);
                this.initializeRepository(configsToRefresh.get(key), true);
            }
        }
        this.cacheManager.invalidateAll();
        this.ldpCache.invalidate();
    }
    
    private Map<String, RepositoryConfig> collectRelevantRepositoryConfigs(Map<String, RepositoryConfig> updatedConfigs, Map<String, RepositoryConfig> allConfigs) throws IOException {
        Map<String, RepositoryConfig> configs = Maps.newHashMap(updatedConfigs);
        // Now we go through all initialized repositories and select all those 
        // which depend on the ones from the input ids list
        // taking into account transitivity
        Map<String, RepositoryConfig> others = Maps.newHashMap(allConfigs); 
        
        boolean exhausted = false;
        while (!exhausted) {
            exhausted = true;
            for (String id : configs.keySet()) {
                others.remove(id);
            }
            for (Entry<String, RepositoryConfig> entry : others.entrySet()) {
                if (configs.containsKey(entry.getKey())) {
                    continue;
                }
                RepositoryImplConfig implConfig = entry.getValue().getRepositoryImplConfig();
                Collection<String> delegates = Lists.newArrayList();
                if (implConfig instanceof MpDelegatingImplConfig) {
                    delegates = ((MpDelegatingImplConfig) implConfig).getDelegateRepositoryIDs();
                } else if (implConfig instanceof SailRepositoryConfig) {
                    SailImplConfig sailConfig = ((SailRepositoryConfig) implConfig).getSailImplConfig();
                    if (sailConfig instanceof MpDelegatingImplConfig) {
                        delegates = ((MpDelegatingImplConfig) sailConfig).getDelegateRepositoryIDs();
                    }
                }
                for (String delegate : delegates) {
                    if (configs.containsKey(delegate)) {
                        configs.put(entry.getKey(), entry.getValue());
                        exhausted = false;
                        break;
                    }
                }
            }
        }
        
        return configs;
    }
    
    /**
     * For JUnit test purposes only
     * 
     * @return
     */
    public Set<String> getInitializedRepositoryIds() {
        return Sets.newHashSet(this.initializedRepositories.keySet());
    }

    @Override
    public HttpClientSessionManager getHttpClientSessionManager() {
        return getClientSessionManager();
    }

    @Override
    public void setHttpClientSessionManager(HttpClientSessionManager client) {
        throw new UnsupportedOperationException("Not supported.");
    }
    
}

