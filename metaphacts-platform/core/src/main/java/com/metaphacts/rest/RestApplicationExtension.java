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
package com.metaphacts.rest;

import java.util.Set;

import javax.inject.Inject;
import javax.ws.rs.ApplicationPath;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.glassfish.hk2.api.ServiceLocator;

import com.google.inject.Injector;
import com.metaphacts.di.GuiceServletConfig;
import com.metaphacts.plugin.PlatformPluginManager;

/**
 * RestApplication to hook-in 3rd party extensions loaded via service loader.
 * 
 * <p>
 * For REST endpoints loaded from extensions dependencies are injected from
 * the plugin injector as provided by {@link PlatformPluginManager#getPluginInjector()}.
 * </p>
 *
 * @author Artem Kozlov <ak@metaphacts.com>
 * @author Johannes Trame <jt@metaphacts.com>
 */
@ApplicationPath("rest/extension")
public class RestApplicationExtension extends AbstractPlatformApplication {

    private static Logger logger = LogManager.getLogger(RestApplicationExtension.class);

    
    @Inject
    public RestApplicationExtension(ServiceLocator serviceLocator) {
        super(serviceLocator);
        PlatformPluginManager pluginManger= GuiceServletConfig.injector.getInstance(PlatformPluginManager.class);
        Set<Class<?>> extensions = pluginManger.getRestExtensions();
        logger.info("Trying to register the following RestExtensions: {}",extensions);
        registerClasses(extensions);

        if (!extensions.isEmpty()) {
            registerSwagger("API Extensions");
        }
    }
    
    @Override
    protected Injector getEndpointInjector() {
        // get injector for extensions
        boolean usePluginInjector = true;
        if (usePluginInjector) {
            PlatformPluginManager pluginManager = GuiceServletConfig.injector.getInstance(PlatformPluginManager.class);
            return pluginManager.getPluginInjector();
        }
        return super.getEndpointInjector();
    }
}
