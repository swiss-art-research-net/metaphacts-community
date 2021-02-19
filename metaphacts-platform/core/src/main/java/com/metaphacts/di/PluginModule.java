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

import org.apache.shiro.authc.credential.CredentialsMatcher;
import org.apache.shiro.authc.credential.PasswordService;
import org.eclipse.rdf4j.repository.RepositoryResolver;
import org.eclipse.rdf4j.rio.RDFParserRegistry;
import org.eclipse.rdf4j.rio.RDFWriterRegistry;

import com.github.jknack.handlebars.HelperRegistry;
import com.google.inject.Injector;
import com.metaphacts.cache.CacheManager;
import com.metaphacts.cache.DescriptionService;
import com.metaphacts.cache.ExternalLabelDescriptionService;
import com.metaphacts.cache.LabelService;
import com.metaphacts.cache.QueryTemplateCache;
import com.metaphacts.cache.ResourceDescriptionCacheHolder;
import com.metaphacts.config.Configuration;
import com.metaphacts.config.NamespaceRegistry;
import com.metaphacts.repository.RepositoryManagerInterface;
import com.metaphacts.resource.DescriptionPropertiesProvider;
import com.metaphacts.resource.DescriptionRenderer;
import com.metaphacts.resource.ResourceDescriptionService;
import com.metaphacts.resource.TypeService;
import com.metaphacts.rest.AbstractPlatformApplication;
import com.metaphacts.rest.swagger.SwaggerRegistry;
import com.metaphacts.secrets.SecretResolver;
import com.metaphacts.services.fields.FieldDefinitionManager;
import com.metaphacts.services.storage.api.PlatformStorage;
import com.metaphacts.thumbnails.ThumbnailService;
import com.metaphacts.thumbnails.ThumbnailServiceRegistry;

/**
 * This module defines the types and services that are exposed to plugins
 * for dependency injection.
 * 
 * @author Wolfgang Schell <ws@metaphacts.com>
 */
public class PluginModule extends DelegateModule {

    protected Injector delegateInjector;

    public PluginModule(Injector delegateInjector) {
        super(delegateInjector);
    }
    
    @Override
    protected void configure() {
        // disable creating objects on the fly if there is no binding for them
        binder().requireExplicitBindings();
        
        // platform services
        bindDelegate(Configuration.class);
        bindDelegate(PlatformStorage.class);
        bindDelegate(RepositoryManagerInterface.class);
        bindDelegate(RepositoryResolver.class);
        bindDelegate(CacheManager.class);
        
        // data services
        bindDelegate(NamespaceRegistry.class);
        bindDelegate(LabelService.class);
        bindDelegate(ExternalLabelDescriptionService.class);
        bindDelegate(TypeService.class);
        bindDelegate(DescriptionService.class);
        bindDelegate(ResourceDescriptionCacheHolder.class);
        bindDelegate(ResourceDescriptionService.class);
        bindDelegate(DescriptionPropertiesProvider.class);
        bindDelegate(DescriptionRenderer.class);
        bindDelegate(ThumbnailServiceRegistry.class);
        bindDelegate(ThumbnailService.class);
        bindDelegate(QueryTemplateCache.class);
        bindDelegate(FieldDefinitionManager.class);
        bindDelegate(RDFWriterRegistry.class);
        bindDelegate(RDFParserRegistry.class);
        bindDelegate(SwaggerRegistry.class);
        
        // UI related
        bindDelegate(HelperRegistry.class);
        
        // security related
        bindDelegate(PasswordService.class);
        bindDelegate(CredentialsMatcher.class);
        bindDelegate(SecretResolver.class);
        
        
        // required by REST endpoints
        AbstractPlatformApplication.getAuxiliaryComponentClasses().forEach(clazz -> bindDelegate(clazz));
    }
}
