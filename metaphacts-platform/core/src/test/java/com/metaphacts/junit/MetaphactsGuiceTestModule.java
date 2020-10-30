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

import java.util.List;
import java.util.Map;

import javax.inject.Inject;
import javax.inject.Named;

import org.apache.shiro.authc.credential.DefaultPasswordService;
import org.apache.shiro.authc.credential.PasswordService;
import org.eclipse.rdf4j.repository.RepositoryResolver;
import org.jukito.TestEagerSingleton;
import org.jukito.TestSingleton;

import com.github.jknack.handlebars.Handlebars;
import com.github.jknack.handlebars.HelperRegistry;
import com.google.common.collect.ImmutableMap;
import com.google.inject.AbstractModule;
import com.google.inject.Injector;
import com.google.inject.Provides;
import com.google.inject.Singleton;
import com.metaphacts.cache.CacheManager;
import com.metaphacts.cache.DescriptionCache;
import com.metaphacts.cache.LabelCache;
import com.metaphacts.cache.ResourceDescriptionCacheHolder;
import com.metaphacts.cache.TemplateIncludeCache;
import com.metaphacts.config.Configuration;
import com.metaphacts.config.NamespaceRegistry;
import com.metaphacts.config.groups.EnvironmentConfiguration;
import com.metaphacts.data.rdf.container.LDPApiInternal;
import com.metaphacts.data.rdf.container.LDPImplManager;
import com.metaphacts.federation.service.MpSparqlServiceRegistry;
import com.metaphacts.lookup.api.LookupServiceManager;
import com.metaphacts.lookup.impl.DefaultLookupServiceManager;
import com.metaphacts.plugin.PlatformPluginManager;
import com.metaphacts.querycatalog.QueryCatalogRESTServiceRegistry;
import com.metaphacts.repository.RepositoryManager;
import com.metaphacts.repository.RepositoryManagerInterface;
import com.metaphacts.secrets.DefaultSecretsStore;
import com.metaphacts.secrets.SecretResolver;
import com.metaphacts.secrets.SecretsStore;
import com.metaphacts.services.fields.FieldDefinitionGenerator;
import com.metaphacts.services.fields.FieldDefinitionGeneratorChain;
import com.metaphacts.services.fields.FieldDefinitionManager;
import com.metaphacts.services.fields.SimpleFieldDefinitionGeneratorChain;
import com.metaphacts.services.storage.api.PlatformStorage;
import com.metaphacts.servlet.SparqlServlet;
import com.metaphacts.templates.MetaphactsHandlebars;
import com.metaphacts.templates.PageViewConfigSettings;
import com.metaphacts.templates.index.TemplateIndexManager;
import com.metaphacts.thumbnails.DefaultThumbnailService;
import com.metaphacts.thumbnails.ThumbnailServiceRegistry;
import com.metaphacts.ui.templates.MainTemplate;

/**
 * This module provides the basic set of dependencies for platform unit/integration tests.
 *
 * <p>
 * Typically a test class would extend {@link AbstractIntegrationTest} to inherit the test
 * setup and some convenience functionality.
 * </p>
 *
 * @author Johannes Trame <jt@metaphacts.com>
 * @author Wolfgang Schell <ws@metaphacts.com>
 * @see AbstractIntegrationTest
 */
public class MetaphactsGuiceTestModule extends AbstractModule {
    @Override
    protected void configure() {
        // test rules
        bind(RuntimeFolderRule.class).in(TestEagerSingleton.class);
        bind(TestPlatformStorage.class).in(TestEagerSingleton.class);
        bind(PlatformStorageRule.class).in(TestEagerSingleton.class);
        bind(RepositoryRule.class).in(TestSingleton.class);

        bind(PlatformStorage.class).to(TestPlatformStorage.class);

        bind(DefaultLookupServiceManager.class).in(TestSingleton.class);
        bind(LookupServiceManager.class).to(DefaultLookupServiceManager.class);

        bind(PasswordService.class).to(DefaultPasswordService.class);

        bind(EnvironmentConfiguration.class).in(TestSingleton.class);
        bind(com.metaphacts.config.Configuration.class).in(TestSingleton.class);
        bind(NamespaceRegistry.class).in(TestSingleton.class);
        bind(RepositoryManager.class).in(TestSingleton.class);
        bind(RepositoryManagerInterface.class).to(RepositoryManager.class);
        bind(RepositoryResolver.class).to(RepositoryManagerInterface.class);
        bind(SecretResolver.class).to(SecretsStore.class).in(TestSingleton.class);
        bind(SecretsStore.class).to(DefaultSecretsStore.class).in(TestSingleton.class);
        bind(QueryCatalogRESTServiceRegistry.class).in(TestSingleton.class);
        bind(CacheManager.class).in(TestSingleton.class);
        bind(ResourceDescriptionCacheHolder.class).in(TestSingleton.class);
        bind(LabelCache.class).to(ResourceDescriptionCacheHolder.class);
        bind(DescriptionCache.class).to(ResourceDescriptionCacheHolder.class);
        bind(TemplateIncludeCache.class).in(TestSingleton.class);
        bind(SparqlServlet.class).in(TestSingleton.class);
        bind(ThumbnailServiceRegistry.class).in(TestSingleton.class);
        bind(DefaultThumbnailService.class).in(TestEagerSingleton.class);
        bind(MainTemplate.class).in(TestSingleton.class);
        bind(MpSparqlServiceRegistry.class).in(TestSingleton.class);
        bind(FieldDefinitionGeneratorChain.class).to(SimpleFieldDefinitionGeneratorChain.class);
        bind(PageViewConfigSettings.class).in(TestSingleton.class);
        bind(TemplateIndexManager.class).in(TestSingleton.class);

        bind(MetaphactsHandlebars.class).in(TestSingleton.class);
        bind(Handlebars.class).to(MetaphactsHandlebars.class);
        bind(HelperRegistry.class).to(Handlebars.class);

        //ldp bindings
        requestStaticInjection(LDPImplManager.class);
        requestStaticInjection(LDPApiInternal.class);
    }

    @Provides
    @Singleton
    @Named("ASSETS_MAP")
    public Map<String, String> getAssetsMap() {
        return ImmutableMap.of(
    	    "vendor", "vendor.js",
            "basic_styling", "basic_styling.css",
            "app", "app.js",
            "hot", "hot.js"
        );
    }

    @Inject
    @Provides
    @TestSingleton
    public SimpleFieldDefinitionGeneratorChain provideGeneratorChain(PlatformPluginManager pluginManager,
            FieldDefinitionManager fdManager, CacheManager cacheManager, Configuration config) {
        List<FieldDefinitionGenerator> generators = pluginManager.getExtensions(FieldDefinitionGenerator.class);

        // hard-code FieldDefinitionManager as the first generator to use.
        generators.add(0, fdManager);
        
        return new SimpleFieldDefinitionGeneratorChain(generators, cacheManager, config);
    }

    @Provides
    @TestSingleton
    public PlatformPluginManager createPlatformPluginManager(Injector injector) {
        PlatformPluginManager ppm = new PlatformPluginManager();
        ppm.setApplicationInjector(injector);
        return ppm;
    }
}
