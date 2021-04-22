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
package com.metaphacts.di;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.ServiceLoader;
import java.util.stream.Collectors;

import javax.inject.Inject;
import javax.inject.Named;
import javax.servlet.ServletContext;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.shiro.authc.credential.CredentialsMatcher;
import org.apache.shiro.authc.credential.DefaultPasswordService;
import org.apache.shiro.authc.credential.PasswordMatcher;
import org.apache.shiro.authc.credential.PasswordService;
import org.eclipse.rdf4j.repository.RepositoryResolver;
import org.eclipse.rdf4j.rio.RDFParserRegistry;
import org.eclipse.rdf4j.rio.RDFWriterRegistry;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.github.jknack.handlebars.Handlebars;
import com.github.jknack.handlebars.HelperRegistry;
import com.google.common.collect.Maps;
import com.google.inject.AbstractModule;
import com.google.inject.Injector;
import com.google.inject.Provider;
import com.google.inject.Provides;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.metaphacts.cache.CacheManager;
import com.metaphacts.cache.DelegatingDescriptionService;
import com.metaphacts.cache.DelegatingLabelService;
import com.metaphacts.cache.DescriptionService;
import com.metaphacts.cache.ExternalLabelDescriptionService;
import com.metaphacts.cache.LabelService;
import com.metaphacts.cache.LookupBasedResourceInformationService;
import com.metaphacts.cache.QueryTemplateCache;
import com.metaphacts.cache.ResourceDescriptionCache;
import com.metaphacts.cache.ResourceDescriptionCacheHolder;
import com.metaphacts.cache.TemplateIncludeCache;
import com.metaphacts.config.Configuration;
import com.metaphacts.data.rdf.container.LDPApiInternal;
import com.metaphacts.data.rdf.container.LDPApiInternalRegistry;
import com.metaphacts.data.rdf.container.LDPAssetsLoader;
import com.metaphacts.data.rdf.container.LDPImplManager;
import com.metaphacts.data.rdf.container.PermissionsAwareLDPApiRegistry;
import com.metaphacts.federation.service.MpSparqlServiceRegistry;
import com.metaphacts.lookup.api.LookupServiceManager;
import com.metaphacts.lookup.impl.DefaultLookupServiceManager;
import com.metaphacts.plugin.PlatformPluginManager;
import com.metaphacts.querycatalog.QueryCatalogRESTServiceRegistry;
import com.metaphacts.repository.RepositoryManager;
import com.metaphacts.repository.RepositoryManagerInterface;
import com.metaphacts.resource.DefaultModelService;
import com.metaphacts.resource.DefaultResourceDescriptionService;
import com.metaphacts.resource.DelegatingDescriptionRenderer;
import com.metaphacts.resource.DelegatingTypePropertyProvider;
import com.metaphacts.resource.DelegatingTypeService;
import com.metaphacts.resource.DescriptionRenderer;
import com.metaphacts.resource.ModelService;
import com.metaphacts.resource.ResourceDescriptionService;
import com.metaphacts.resource.TypePropertyProvider;
import com.metaphacts.resource.TypeService;
import com.metaphacts.rest.swagger.SwaggerRegistry;
import com.metaphacts.security.ShiroTextRealm;
import com.metaphacts.services.fields.FieldDefinitionGenerator;
import com.metaphacts.services.fields.FieldDefinitionGeneratorChain;
import com.metaphacts.services.fields.FieldDefinitionManager;
import com.metaphacts.services.fields.FieldsBasedSearch;
import com.metaphacts.services.fields.SimpleFieldDefinitionGeneratorChain;
import com.metaphacts.servlet.MProxyServlet;
import com.metaphacts.servlet.SparqlRequestHandler;
import com.metaphacts.servlet.SparqlRequestHandlerProvider;
import com.metaphacts.servlet.SparqlServlet;
import com.metaphacts.templates.MetaphactsHandlebars;
import com.metaphacts.templates.PageViewConfigManager;
import com.metaphacts.templates.PageViewConfigSettings;
import com.metaphacts.templates.index.TemplateIndexManager;
import com.metaphacts.thumbnails.DefaultThumbnailService;
import com.metaphacts.thumbnails.ThumbnailService;
import com.metaphacts.thumbnails.ThumbnailServiceRegistry;
import com.metaphacts.ui.templates.MainTemplate;
import com.metaphacts.upload.UploadHandler;
import com.metaphacts.upload.handlers.FileUploadHandler;
import com.metaphacts.util.OrderableComparator;

/**
 * @author Artem Kozlov <ak@metaphacts.com>
 */
public class MainGuiceModule extends AbstractModule {

    private static final Logger logger = LogManager.getLogger(MainGuiceModule.class);

    @SuppressWarnings("unused")
    private Injector coreInjector;

    private ServletContext servletContext;

    public MainGuiceModule(ServletContext servletContext, Injector coreInjector){
        this.coreInjector=coreInjector;
        this.servletContext = servletContext;
    }

    @Override
    protected void configure() {
        // need to bind shiro stuff already here because it will be accessed in REST endpoint
        bind(CredentialsMatcher.class).to(PasswordMatcher.class);
        bind(PasswordService.class).to(DefaultPasswordService.class);
        bind(ShiroTextRealm.class).in(Singleton.class);

        bind(MainTemplate.class).in(Singleton.class);
        requestStaticInjection(MainTemplateProvider.class);
        bind(MpSparqlServiceRegistry.class).in(Singleton.class);

        bind(SwaggerRegistry.class).in(Singleton.class);

        bind(RepositoryManager.class).in(Singleton.class);
        bind(RepositoryManagerInterface.class).to(RepositoryManager.class);
        bind(RepositoryResolver.class).to(RepositoryManagerInterface.class);
        bind(LDPApiInternalRegistry.class).in(Singleton.class);
        bind(PermissionsAwareLDPApiRegistry.class).in(Singleton.class);
        bind(QueryTemplateCache.class).in(Singleton.class);
        bind(QueryCatalogRESTServiceRegistry.class).in(Singleton.class);
        bind(ExternalLabelDescriptionService.class).in(Singleton.class);
        bind(LookupBasedResourceInformationService.class).in(Singleton.class);
        bind(ResourceDescriptionCacheHolder.class).in(Singleton.class);
        bind(LabelService.class).to(DelegatingLabelService.class).in(Singleton.class);
        bind(DescriptionService.class).to(DelegatingDescriptionService.class).in(Singleton.class);
        bind(DefaultModelService.class).in(Singleton.class);
        bind(ModelService.class).to(DefaultModelService.class).in(Singleton.class);
        bind(DefaultResourceDescriptionService.class).in(Singleton.class);
        bind(ResourceDescriptionService.class).to(DefaultResourceDescriptionService.class).in(Singleton.class);
        bind(ResourceDescriptionCache.class).in(Singleton.class);
        bind(TemplateIncludeCache.class).in(Singleton.class);
        bind(SparqlRequestHandler.class).toProvider(SparqlRequestHandlerProvider.class).in(Singleton.class);
        bind(SparqlServlet.class).in(Singleton.class);
        bind(MProxyServlet.class).in(Singleton.class);
        bind(ThumbnailServiceRegistry.class).in(Singleton.class);
        bind(DefaultThumbnailService.class).asEagerSingleton();
        bind(ThumbnailService.class).to(DefaultThumbnailService.class);
        bind(FieldDefinitionManager.class).in(Singleton.class);
        bind(FieldsBasedSearch.class).in(Singleton.class);
        bind(FieldDefinitionGeneratorChain.class).to(SimpleFieldDefinitionGeneratorChain.class);
        bind(PageViewConfigSettings.class).in(Singleton.class);
        bind(TemplateIndexManager.class).in(Singleton.class);

        bind(MetaphactsHandlebars.class).in(Singleton.class);
        bind(Handlebars.class).to(MetaphactsHandlebars.class);
        bind(HelperRegistry.class).to(Handlebars.class);
        bind(PageViewConfigManager.class).in(Singleton.class);

        bind(DefaultLookupServiceManager.class).in(Singleton.class);
        bind(LookupServiceManager.class).to(DefaultLookupServiceManager.class);

        bind(LDPImplManager.class).in(Singleton.class);
        bind(LDPAssetsLoader.class).in(Singleton.class);
        requestStaticInjection(LDPImplManager.class);
        requestStaticInjection(LDPApiInternal.class);

        //file upload url processors
        Multibinder<UploadHandler> uriBinder = Multibinder.newSetBinder(binder(), UploadHandler.class);
        uriBinder.addBinding().to(FileUploadHandler.class);
    }

    /**
     * Create Composite LabelService implementation which delegates to a set of
     * other implementations until a valid value is provided.
     * <p>
     * Labels are queried in a well-defined order which balances
     * priority of sources and performance of the actual retrieval.
     * </p>
     *
     * @param descriptionCacheHolder                implementation based on fetching
     *                                              properties for configured
     *                                              predicates/expressions
     * @param lookupCandidateDescriptionCacheHolder implementation which provides
     *                                              values from injected
     *                                              LookupService response
     * @param lookupBasedLabelService               implementation which is based on
     *                                              the DelegatingLabelService which
     *                                              includes LabelServices implemented by lookup
     *                                              services
     * @return
     */
    @Inject
    @Provides
    @Singleton
    public DelegatingLabelService getLabelService(
        ResourceDescriptionCacheHolder descriptionCacheHolder,
        ExternalLabelDescriptionService lookupCandidateDescriptionCacheHolder,
        LookupBasedResourceInformationService lookupBasedLabelService
    ) {
        final List<LabelService> labelServices = Arrays.asList(
            descriptionCacheHolder,
            lookupCandidateDescriptionCacheHolder,
            lookupBasedLabelService
        );
        return new DelegatingLabelService(labelServices);
    }

    /**
     * Create Composite DescriptionService implementation which delegates to a set
     * of other implementations until a valid value is provided.
     * <p>
     * Descriptions are queried in a well-defined order which balances priority of
     * sources and performance of the actual retrieval.
     * </p>
     *
     * @param descriptionCacheHolder                implementation based on fetching
     *                                              properties for configured
     *                                              predicates/expressions
     * @param lookupCandidateDescriptionCacheHolder implementation which provides
     *                                              values from injected
     *                                              LookupService response
     * @param resourceDescriptionCache              implementation which is based on
     *                                              the ResourceDescriptionService
     *
     * @param lookupBasedDescriptionService         implementation which is based on
     *                                              the DelegatingDescriptionService which
     *                                              includes DescriptionServices implemented by lookup
     *                                              services
     * @return
     */
    @Inject
    @Provides
    @Singleton
    public DelegatingDescriptionService getDescriptionService(
        ResourceDescriptionCacheHolder descriptionCacheHolder,
        ExternalLabelDescriptionService lookupCandidateDescriptionCacheHolder,
        ResourceDescriptionCache resourceDescriptionCache,
        LookupBasedResourceInformationService lookupBasedDescriptionService
    ) {
        final List<DescriptionService> descriptionServices = Arrays.asList(
            resourceDescriptionCache,
            descriptionCacheHolder,
            lookupCandidateDescriptionCacheHolder,
            lookupBasedDescriptionService
        );
        return new DelegatingDescriptionService(descriptionServices);
    }

    @Inject
    @Provides
    @Singleton
    public TypeService getTypeService(
        PlatformPluginManager platformPluginManager,
        LookupBasedResourceInformationService lookupBasedResourceInformationService
    ) {
        List<TypeService> delegates = loadServiceInstancesIncludingApps(platformPluginManager, TypeService.class);
        delegates.add(lookupBasedResourceInformationService);
        return new DelegatingTypeService(delegates);
    }

    @Inject
    @Provides
    @Singleton
    public TypePropertyProvider getTypePropertyProvider(PlatformPluginManager platformPluginManager) {
        List<TypePropertyProvider> delegates = loadServiceInstancesIncludingApps(platformPluginManager,
                TypePropertyProvider.class);
        if (delegates.size() == 1) {
            // if there's only one instance, return that directly
            return delegates.get(0);
        }
        return new DelegatingTypePropertyProvider(delegates);
    }

    @Inject
    @Provides
    @Singleton
    public DescriptionRenderer getDescriptionRenderer(PlatformPluginManager platformPluginManager) {
        List<DescriptionRenderer> delegates = loadServiceInstancesIncludingApps(platformPluginManager,
                DescriptionRenderer.class);
        if (delegates.size() == 1) {
            // if there's only one instance, return that directly
            return delegates.get(0);
        }
        return new DelegatingDescriptionRenderer(delegates);
    }

    /**
     * When bundling client-side assets with webpack we attach bundle hash to
     * every file to make sure that browser cache is reset when we deploy new version.
     * see webpack.dll.prod.js and webpack.prod.config.js for more details.
     */
    @Provides
    @Singleton
    @Named("ASSETS_MAP")
    public Map<String, String> getAssetsMap() throws IOException {
        ObjectMapper mapper = new ObjectMapper();
        // TODO: use generated manifest files even in local dev builds
        // (i.e. "/project/webpack/assets/bundle-manifest.json")
        JsonNode dllManifest = mapper.readTree(
            this.servletContext.getResourceAsStream("/assets/dll-manifest.json")
        );
        ObjectNode appManifest = (ObjectNode)mapper.readTree(
            this.servletContext.getResourceAsStream("/assets/bundles-manifest.json")
        );

        Map<String, String> map = Maps.newLinkedHashMap();
        map.put("vendor", dllManifest.get("vendor").get("js").asText());
        map.put("basic_styling", dllManifest.get("basic_styling").get("css").asText());

        Iterator<Map.Entry<String, JsonNode>> iterator = appManifest.fields();
        while (iterator.hasNext()) {
            Map.Entry<String, JsonNode> entry = iterator.next();
            String bundleName = entry.getKey();
            JsonNode bundlePath = entry.getValue().get("js");
            if (bundlePath == null || !bundlePath.isTextual()) {
                throw new IllegalStateException(
                    "Invalid value for bundle name '" + bundleName + "' in bundles-manifest.json");
            }
            map.put(bundleName, bundlePath.asText());
        }

        return Collections.unmodifiableMap(map);
    }

    @Provides
    protected RDFWriterRegistry getRDFWriterRegistry() {
        return RDFWriterRegistry.getInstance();
    }

    @Provides
    protected RDFParserRegistry getRDFParserRegistry() {
        return RDFParserRegistry.getInstance();
    }

    /**
     * Load services from the main class path as well as apps.
     *
     * <p>
     * The loaded service instances will be subjected to dependency injection, but
     * only after instantiation, i.e. they need a parameter-less constructor and
     * cannot use constructor injection.
     * </p>
     *
     * @param <T>           type of service to load
     * @param pluginManager plugin manager to load app classes from
     * @param serviceClass  service class for which to load service instances
     * @return list of instances
     */
    public static <T> List<T> loadServiceInstancesIncludingApps(
            PlatformPluginManager pluginManager, Class<T> serviceClass) {
        // dependency injection happens in PlatformPluginManager
        List<T> extensions = pluginManager.getExtensions(serviceClass);
        // copy list as we are going to change it (by sorting)
        List<T> services = new ArrayList<>(extensions);
        // sort the generators defined from the service loader in a deterministic order
        Collections.sort(services, OrderableComparator.INSTANCE);

        if (logger.isTraceEnabled()) {
            logger.trace("loading services of type {} from main classpath and apps: {}", serviceClass.getSimpleName(),
                    services.stream().map(g -> g.getClass().getSimpleName()).collect(Collectors.joining(", ")));
        }

        return services;
    }

    /**
     * Load services from the main class path.
     *
     * <p>
     * The loaded service instances will be subjected to dependency injection, but
     * only after instantiation, i.e. they need a parameter-less constructor and
     * cannot use constructor injection.
     * </p>
     *
     * <p>
     * Note: this method will NOT load classes froms apps, see
     * {@link #loadServiceInstancesIncludingApps(PlatformPluginManager, Class)}
     * for a method to also load classes from apps.
     * </p>
     *
     * @param <T>          type of service to load
     * @param injector     Guice injector for dependency injection
     * @param classLoader  class loader from which to load the service classes
     * @param serviceClass service class for which to load service instances
     * @return list of instances
     */
    public static <T> List<T> loadServiceInstances(Injector injector, ClassLoader classLoader,
            Class<T> serviceClass) {
        List<T> services = new ArrayList<>();
        ServiceLoader<T> loader = java.util.ServiceLoader.load(serviceClass, classLoader);
        for (T service : loader) {
            injector.injectMembers(service);
            services.add(service);
        }
        // sort the generators defined from the service loader in a deterministic order
        Collections.sort(services, OrderableComparator.INSTANCE);

        if (logger.isTraceEnabled()) {
            logger.trace("loading services of type {} from main classpath: {}", serviceClass.getSimpleName(),
                    services.stream().map(g -> g.getClass().getSimpleName()).collect(Collectors.joining(", ")));
        }

        return services;
    }

    @Inject
    @Provides
    @Singleton
    public SimpleFieldDefinitionGeneratorChain provideGeneratorChain(PlatformPluginManager pluginManager,
            FieldDefinitionManager fdManager, CacheManager cacheManager, Configuration config) {
        List<FieldDefinitionGenerator> newGenerators = loadServiceInstancesIncludingApps(pluginManager,
                FieldDefinitionGenerator.class);

        // hard-code FieldDefinitionManager as the first generator to use.
        newGenerators.add(0, fdManager);

        if (logger.isTraceEnabled()) {
            logger.trace("Initializing field generators: {}",
                newGenerators.stream().map(g -> g.getClass().getSimpleName()).collect(Collectors.joining(", ")));
        }

        return new SimpleFieldDefinitionGeneratorChain(newGenerators, cacheManager, config);
    }

    public static class MainTemplateProvider implements Provider<String> {
        @Inject
        private MainTemplate mainTemplate;

        @Override
        public String get() {
            try {
                return mainTemplate.getMainTemplate();
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }
    }
}
