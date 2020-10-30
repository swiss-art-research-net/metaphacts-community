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

import java.util.HashMap;
import java.util.Map;
import java.util.Map.Entry;

import javax.inject.Singleton;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.glassfish.jersey.servlet.ServletContainer;

import com.google.inject.Injector;
import com.google.inject.servlet.ServletModule;
import com.metaphacts.rest.SwaggerApplication;
import com.metaphacts.secrets.SecretResolver;
import com.metaphacts.services.storage.api.PlatformStorage;
import com.metaphacts.servlet.MProxyServlet;
import com.metaphacts.servlet.ProxyConfigs;
import com.metaphacts.servlet.SparqlServlet;
import com.metaphacts.servlet.filter.AssetFilter;
import com.metaphacts.servlet.filter.CorsFilter;
import com.metaphacts.servlet.filter.ErrorLoggingFilter;
import com.metaphacts.servlet.filter.HomePageFilter;
import com.metaphacts.servlet.filter.MDCFilter;
import com.metaphacts.servlet.filter.RewriteFilter;

import io.swagger.v3.jaxrs2.integration.JaxrsOpenApiContextBuilder;
import io.swagger.v3.oas.integration.OpenApiConfigurationException;
import io.swagger.v3.oas.integration.SwaggerConfiguration;

/**
 * @author Artem Kozlov <ak@metaphacts.com>
 */
public class PlatformGuiceModule extends ServletModule {
    private static final Logger logger = LogManager.getLogger(PlatformGuiceModule.class);

    private final Injector coreInjector;

    public PlatformGuiceModule(Injector coreInjector) {
        this.coreInjector = coreInjector;
    }

    @Override
    protected void configureServlets() {
        //register servlet filters

        // invoke MDCFilter before all other filters and endpoints, so that the MDC context
        // variables are available for all log commands throughout the application
        filter("*").through(MDCFilter.class);
        filter(
            AssetFilter.ASSETS_PATH_PREFIX + "*",
            AssetFilter.IMAGES_PATH_PREFIX + "*"
        ).through(AssetFilter.class);
        filter("*").through(HomePageFilter.class);

        filter("*").through(RewriteFilter.class);
        filter("*").through(CorsFilter.class);
        filter("/rest/*").through(ErrorLoggingFilter.class);

        //register servlets
        serve("/sparql").with(SparqlServlet.class);

        PlatformStorage platformStorage = coreInjector.getProvider(PlatformStorage.class).get();
        SecretResolver secretResolver = coreInjector.getProvider(SecretResolver.class).get();
        Map<String, Map<String, String>> proxies = ProxyConfigs.getConfigs(platformStorage, secretResolver);

        for (Entry<String, Map<String, String>> proxy : proxies.entrySet()) {
            logger.info("Registering proxy {}", proxy.getKey());
            serve("/proxy/" + proxy.getKey() + "/*").with(new MProxyServlet(proxy.getKey()),
                    proxy.getValue());
        }

        //bind(ApiOriginFilter.class).in(Singleton.class);
        bind(ServletContainer.class).in(Singleton.class);
        Map<String, String> props = new HashMap<>();
        props.put("javax.ws.rs.Application", SwaggerApplication.class.getName());
        props.put("jersey.config.server.wadl.disableWadl", "true");
        serve("/swagger/*").with(ServletContainer.class, props);

        // Use Application scanner to only get endpoints registered on the application
        SwaggerConfiguration conf = new SwaggerConfiguration()
                .scannerClass("io.swagger.v3.jaxrs2.integration.JaxrsApplicationScanner");

        try {
            new JaxrsOpenApiContextBuilder<>().openApiConfiguration(conf).buildContext(true);
        } catch (OpenApiConfigurationException e) {
            throw new RuntimeException(e.getMessage(), e);
        }

    }

}
