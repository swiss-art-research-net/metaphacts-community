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
package com.metaphacts.di;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
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
import com.metaphacts.cache.DescriptionCache;
import com.metaphacts.cache.LabelCache;
import com.metaphacts.cache.QueryTemplateCache;
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
        bind(ResourceDescriptionCacheHolder.class).in(Singleton.class);
        bind(LabelCache.class).to(ResourceDescriptionCacheHolder.class);
        bind(DescriptionCache.class).to(ResourceDescriptionCacheHolder.class);
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
     * When bundling client-side assets with webpack we attach bundle hash to
     * every file to make sure that browser cache is reset when we deploy new version.
     * see webpack.dll.prod.js and webpack.prod.config.js for more details.
     */
    @Provides
    @Singleton
    @Named("ASSETS_MAP")
    public Map<String, String> getAssetsMap() throws IOException {
        ObjectMapper mapper = new ObjectMapper();
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

    @Inject
    @Provides
    @Singleton
    public SimpleFieldDefinitionGeneratorChain provideGeneratorChain(PlatformPluginManager pluginManager,
            FieldDefinitionManager fdManager, CacheManager cacheManager, Configuration config) {
        List<FieldDefinitionGenerator> generators = pluginManager.getExtensions(FieldDefinitionGenerator.class);


        List<FieldDefinitionGenerator> newGenerators = new ArrayList<>(generators);

        // sort the generators defined from the service loader in a deterministic order
        Collections.sort(newGenerators, OrderableComparator.INSTANCE);

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
