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
package com.metaphacts.plugin;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.ServiceLoader;
import java.util.Set;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.pf4j.ExtensionDescriptor;
import org.pf4j.ExtensionFinder;
import org.pf4j.ExtensionWrapper;
import org.pf4j.PluginManager;
import org.pf4j.PluginState;
import org.pf4j.PluginWrapper;

/**
 * ExtensionFinder implementation which uses the {@link ServiceLoader}. 
 * 
 * <p>
 * This class does not perform any class path scanning but only resolves classes through
 * {@link ServiceLoader}. This means that the performance is much better for this use case,
 * but it does not support {@link #findClassNames(String)} and {@link #find(String)}, which 
 * would require knowing about all classes.
 * </p>
 * 
 * <p>
 * Besides extensions in apps this class optionally also return extensions in the application class path.
 * </p>
 * 
 * <p>
 * Note that this class does NOT support the legacy {@code META-INF/extensions.idx} file.
 * </p>
 * @author wschell
 *
 */
public class ServiceLoaderExtensionFinder implements ExtensionFinder {
    private static final Logger logger = LogManager.getLogger(ServiceLoaderExtensionFinder.class);
    
    protected final PluginManager pluginManager;

    protected final boolean includeApplicationClasspath;
    
    /**
     * Create the extension finder
     * @param pluginManager plugin manager to use for plugin access
     * @param includeApplicationClasspath determine whether to also scan the application class path (i.e. outside of plugins) for extensions 
     */
    public ServiceLoaderExtensionFinder(PluginManager pluginManager, boolean includeApplicationClasspath) {
        this.pluginManager = pluginManager;
        this.includeApplicationClasspath = includeApplicationClasspath;
    }

    @Override
    public <T> List<ExtensionWrapper<T>> find(Class<T> type) {
        logger.debug("Finding extensions of extension point '{}'", type.getName());
        List<ExtensionWrapper<T>> result = new ArrayList<>();
        
        if (includeApplicationClasspath) {
            List<ExtensionWrapper<T>> pluginExtensions = find(type, getApplicationClassLoader(), false);
            result.addAll(pluginExtensions);
        }

        // add extensions found in classpath and plugins
        for (PluginWrapper pluginWrapper : pluginManager.getResolvedPlugins()) {
            // classpath's extensions <=> pluginId = null
            List<ExtensionWrapper<T>> pluginExtensions = find(pluginWrapper, type);
            result.addAll(pluginExtensions);
        }

        // sort by "ordinal" property
        Collections.sort(result);

        return result;
    }

    /**
     * Returns application class loader to be used for global service loader scanning.
     * This implementation returns this class' class loader.
     * 
     * @return application class loader
     */
    protected ClassLoader getApplicationClassLoader() {
        return getClass().getClassLoader();
    }
    
    public boolean isIncludeApplicationClasspath() {
        return includeApplicationClasspath;
    }

    @Override
    public <T> List<ExtensionWrapper<T>> find(Class<T> type, String pluginId) {
        if (pluginId == null || pluginId.isEmpty()) {
            // no plugin id provided
            return Collections.emptyList();
        }
        PluginWrapper pluginWrapper = pluginManager.getPlugin(pluginId);
        if (pluginWrapper == null) {
            logger.debug("No such plugin '{}'", pluginId);
            return Collections.emptyList();
        }
        return find(pluginWrapper, type);
    }
    
    protected <T> List<ExtensionWrapper<T>> find(PluginWrapper pluginWrapper, Class<T> type) {
        if (pluginWrapper == null) {
            return Collections.emptyList();
        }
        String pluginId = pluginWrapper.getPluginId();
        logger.trace("Finding extensions of extension point '{}' for plugin '{}'", type.getName(), pluginId);
        if (PluginState.STARTED != pluginWrapper.getPluginState()) {
            logger.debug("Plugin '{}' is not yet started", pluginId);
        }
        
        ClassLoader pluginClassLoader = pluginManager.getPluginClassLoader(pluginId);
        return find(type, pluginClassLoader, true);
    }
    
    protected <T> List<ExtensionWrapper<T>> find(Class<T> type, ClassLoader classLoader, boolean fromPlugin) {
        ServiceLoader<T> serviceLoader = ServiceLoader.load(type, classLoader);
        return loadExtensions(type, serviceLoader, fromPlugin);
    }

    protected <T> List<ExtensionWrapper<T>> loadExtensions(Class<T> searchType, ServiceLoader<T> serviceLoader, boolean fromPlugin) {
        List<ExtensionWrapper<T>> result = new ArrayList<>();
        try {
            int ordinal = 1;
            for (T extension : serviceLoader) {
                Class<?> extensionType = extension.getClass();
                result.add(createExtensionWrapper(searchType, extensionType, extension, ordinal++, fromPlugin));
            }
        }
        catch (Exception e) {
            logger.warn("Failed to load extensions of extension point '{}': {}", searchType.getName(), e.getMessage());
            logger.debug("Details: ", e);
        }
        return result;
    }

    protected <T> ExtensionWrapper<T> createExtensionWrapper(Class<T> searchType, Class<?> extensionType, T extension, int ordinal, boolean fromPlugin) {
        ExtensionDescriptor descriptor = new ExtensionDescriptor(ordinal, extensionType);

        // note we actually do not need the factory, but rather return the extension directly
        return new ExtensionWrapper<T>(descriptor, pluginManager.getExtensionFactory()) {
            public T getExtension() {
                return initializeExtension(extension, fromPlugin);
            }
        };
    }
    
    /**
     * This method can be overridden for initialization, e.g. to perform dependency injection. 
     * The default implementation returns the extension unchanged.
     *  
     * @param <T> type of extension
     * @param extension extension implementation
     * @param fromPlugin <code>true</code> if the extension was provided by an plugin, <code>false</code> for extensions loaded from application classpath
     * @return the (initialized) extension
     */
    protected <T> T initializeExtension(T extension, boolean fromPlugin) {
        return extension;
    }

    @SuppressWarnings("rawtypes")
    @Override
    public List<ExtensionWrapper> find(String pluginId) {
        // not supported
        return Collections.emptyList();
    }

    @Override
    public Set<String> findClassNames(String pluginId) {
        // not supported
        return Collections.emptySet();
    }

}
