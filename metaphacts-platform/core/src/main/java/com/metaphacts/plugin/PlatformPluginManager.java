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
package com.metaphacts.plugin;

import java.io.File;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import javax.inject.Inject;
import javax.inject.Singleton;

import org.apache.commons.io.FileUtils;
import org.apache.commons.io.filefilter.TrueFileFilter;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.pf4j.CompoundPluginLoader;
import org.pf4j.CompoundPluginRepository;
import org.pf4j.DefaultExtensionFactory;
import org.pf4j.DefaultExtensionFinder;
import org.pf4j.DefaultPluginLoader;
import org.pf4j.DefaultPluginManager;
import org.pf4j.ExtensionFactory;
import org.pf4j.ExtensionFinder;
import org.pf4j.JarPluginLoader;
import org.pf4j.Plugin;
import org.pf4j.PluginClassLoader;
import org.pf4j.PluginDescriptor;
import org.pf4j.PluginDescriptorFinder;
import org.pf4j.PluginLoader;
import org.pf4j.PluginRepository;
import org.pf4j.PluginRuntimeException;
import org.pf4j.PluginWrapper;

import com.google.common.collect.Lists;
import com.google.common.collect.Sets;
import com.google.inject.ConfigurationException;
import com.google.inject.Injector;
import com.metaphacts.config.Configuration;
import com.metaphacts.plugin.extension.ConfigurationExtension;
import com.metaphacts.plugin.extension.RestExtension;
import com.metaphacts.sail.rest.sql.MpJDBCDriverManager;

/**
 * @author Johannes Trame <jt@metaphacts.com>
 */
@Singleton
public class PlatformPluginManager extends DefaultPluginManager {

    private static final Logger logger = LogManager
            .getLogger(PlatformPluginManager.class);

    protected Injector applicationInjector = null;
    protected Injector pluginInjector = null;
    
    public PlatformPluginManager() {
        this(Paths.get(Configuration.getAppsDirectory()));
    }
    
    protected PlatformPluginManager(Path pluginsPath) {
        super(pluginsPath);

        if (this.getPluginsRoot().toFile().exists()) {
            // regular bootstrap
            this.loadPlugins();
            logger.info("Loaded plugins: {}", this.plugins);
        } else {
            // notify user that the directory does not exist / no apps have been
            // loaded
            logger.warn(
                    "App directory {} does not exist. No apps will be initialized.",
                    this.getPluginsRoot());
        }
    }

    @Override
    protected void initialize() {
        super.initialize();
        // replace plugins map with Map implementation which keeps insertion order
        this.plugins = new LinkedHashMap<String, PluginWrapper>(this.plugins);
    }
    
    @Override
    public PluginLoader getPluginLoader() {
        // note: we always enable all loaders independent of development mode!
        return new CompoundPluginLoader()
                .add(new PlatformPluginLoader(this))
                .add(new JarPluginLoader(this))
                .add(new DefaultPluginLoader(this));
    }

    /**
     * Eager singleton class to start plugins after Configuration is loaded.
     */
    public static class Loader {
        @Inject
        public Loader(
            PlatformPluginManager pluginManager,
            Configuration config,
            MpJDBCDriverManager jdbcDriverManager
        ) {
            // plugins are already loaded, install extensions
            pluginManager.installExtensions(config, jdbcDriverManager);
        }
    }

    @Override
    public void startPlugins() {
        logger.info("Initializing plugins...");
        // Initialize plugins and log any custom plugin classes
        for (PluginWrapper wrapper : this.getResolvedPlugins()) {
            initializePlugin(wrapper);
            Plugin mphPlugin = wrapper.getPlugin();

            if (mphPlugin.getClass().equals(Plugin.class)) {
                logger.info("Using default {} as main class.",
                    Plugin.class.getName());
            } else {
                logger.info(
                    "Using custom platform plugin class extension {} as provided by the plugin.",
                    mphPlugin.getClass().getName());
            }
        }
        
        logger.info("Starting plugins...");
        
        super.startPlugins();
        
        logger.info("Started plugins: {}", this.getStartedPlugins());
    }
    
    protected void installExtensions(Configuration config, MpJDBCDriverManager jdbcDriverManager) {
        logger.info("Installing plugin extensions...");

        // initialize/install extensions
        for (PluginWrapper wrapper : this.getResolvedPlugins()) {
            PlatformPlugin platformPlugin = new PlatformPlugin(wrapper);
            platformPlugin.init(config, jdbcDriverManager);
            platformPlugin.installExtensions();
            // register config extensions
            for (Class<? extends ConfigurationExtension> group :
                getConfigGroupExtensions(wrapper.getPluginId())
            ) {
                platformPlugin.registerCustomConfigurationGroup(group);
            }
        }
    }
    
    @Override
    public <T> List<T> getExtensions(Class<T> type) {
        try {
            List<T> extensions = super.getExtensions(type);
            // filter any null entries
            return extensions.stream().filter(e -> e != null).collect(Collectors.toList());
        } catch (Exception e) {
            logger.warn("Failed to load extensions for type '{}': {}", type, e.getMessage());
            logger.debug("Details:", e);
            // avoid breaking the program and return an empty list instead of throwing an error
            return Collections.emptyList();
        }
    }

    public Set<Class<?>> getRestExtensions() {
        HashSet<Class<?>> set = Sets.newHashSet();
        for (Class<? extends RestExtension> e : getExtensionClasses(RestExtension.class)) {
            set.add(e);
        }
        logger.info("Detected the following REST Extensions: " + set);
        return set;
    }

    public Set<Class<? extends ConfigurationExtension>> getConfigGroupExtensions(
            String pluginId) {
        HashSet<Class<? extends ConfigurationExtension>> set = Sets
                .newHashSet();
        for (ConfigurationExtension e : getExtensions(
                ConfigurationExtension.class, pluginId)) {
            set.add(e.getClass());
        }
        logger.info("Detected the following ConfigurationGroup Extensions: "
                + set);
        return set;
    }

    @Override
    protected PluginDescriptorFinder createPluginDescriptorFinder() {
        return super.createPluginDescriptorFinder();
    }

    @Override
    public void loadPlugins() {
        try {
            super.loadPlugins();
        } catch (Exception e) {
            logger.error("Failed to load Plugins: ", e.getMessage());
            logger.debug("Details:", e);
        }
    }
    
    @Override
    protected ExtensionFinder createExtensionFinder() {
        ExtensionFinder parentExtensionFinder = super.createExtensionFinder();
        DefaultExtensionFinder compositeExtensionFinder = null;
        if (parentExtensionFinder instanceof DefaultExtensionFinder) {
            compositeExtensionFinder = (DefaultExtensionFinder) parentExtensionFinder;
        }
        else {
            // no composite ExtensionFinder so we'll create one and add the parent extension finder
            compositeExtensionFinder = new DefaultExtensionFinder(this);
            compositeExtensionFinder.add(parentExtensionFinder);
        }
        // add custom extension finder using ServiceLoader
        // note: do NOT use PF4J's ServiceProviderExtensionFinder as this leads to all classes registered 
        // in ANY file under META-INF/services/ being loaded and compared against the desired type when 
        // looking for extensions... 
        boolean includeApplicationClasspath = true;
        ServiceLoaderExtensionFinder serviceLoaderExtensionFinder = new ServiceLoaderExtensionFinder(this, includeApplicationClasspath) {
            @Override
            protected <T> T initializeExtension(T extension, boolean fromPlugin) {
                return PlatformPluginManager.this.initializeExtension(extension, fromPlugin);
            }
        };
        compositeExtensionFinder.add(serviceLoaderExtensionFinder);
        return compositeExtensionFinder;
    }
    
    @Override
    protected ExtensionFactory createExtensionFactory() {
        return new DefaultExtensionFactory() {
            @Override
            public <T> T create(Class<T> extensionClass) {
                T extension = super.create(extensionClass);
                // assume that all extensions were loaded from plugins
                boolean fromPlugin = true;
                return initializeExtension(extension, fromPlugin);
            }
        };
    }
    
    @Override
    protected PluginRepository createPluginRepository() {
        CompoundPluginRepository compoundPluginRepository = new CompoundPluginRepository();
        compoundPluginRepository.add(new PlatformPluginRepository(getPluginsRoot()));
        compoundPluginRepository.add(new PlatformExternalPluginRepository());
        return compoundPluginRepository;
    }
    
    @Override
    protected PluginWrapper loadPluginFromPath(Path pluginPath) {
        
        // First unzip any ZIP files
        try {
            pluginPath = PluginZipUtils.expandAndDeleteIfValidZipApp(pluginPath);
            checkAppStructureLogWarning(pluginPath.toFile());
        } catch (Exception e) {
            logger.error("Failed to unzip {} . Error: {} " ,pluginPath, e.getMessage() );
            logger.debug("Details: {}", e);
            return null;
        }
        try {
            PluginWrapper plugin = super.loadPluginFromPath(pluginPath);
            return plugin;
        }
        catch (PluginRuntimeException e) {
            throw e;
        }
        catch (Exception e) {
            // re-throw as PluginRuntimeException so it is caught by the parent class
            throw new PluginRuntimeException(e);
        }
    }

    /**
     * Perform additional plugin initialization.
     * 
     * <p>
     * This method currently does nothing, but can be overridden/extended, 
     * e.g. to apply dependency injection or other additional initialization.
     * </p>
     * 
     * @param pluginWrapper wrapper for the plugin to initialize 
     * @return initialized plugin wrapper
     */
    protected PluginWrapper initializePlugin(PluginWrapper pluginWrapper) {
        // further initialize the plugin
        injectDependencies(pluginWrapper.getPlugin(), true);
        
        return pluginWrapper;
    }
    
    /**
     * Perform additional extension initialization.
     * 
     * <p>
     * This method applies dependency injection and can be overridden to apply additional initialization.
     * </p>
     * 
     * <p>
     * In case of initialization errors, e.g. unsatisfied dependencies, all exceptions are caught, logged 
     * and this method returns <code>null</code>. This is because returning a list of dependencies from
     * various code paths would otherwise abort scanning of extensions on the first error, so we rather 
     * catch errors here and return <code>null</code>. Note that null entries are filtered in the list 
     * returned by {@link #getExtensions(Class)}. Any sub-class should retain that behavior when 
     * performing initialization of extensions. 
     * </p>
     * 
     * @param <T> type of extension
     * @param extension extension to initialize
     * @param fromPlugin <code>true</code> if the extension was provided by an plugin, <code>false</code> for extensions loaded from application classpath
     * @return initialized extension or <code>null</code> if there was an error when initializing the extension
     * @see #injectDependencies(Object, boolean)
     */
    protected <T> T initializeExtension(T extension, boolean fromPlugin) {
        try {
            injectDependencies(extension, fromPlugin);
            return extension;
        }
        catch (Exception e) {
            logger.warn("failed to initialize extension of type {} ({}): {}", extension.getClass(), extension, e.getMessage());
            logger.debug("Details: ",  e);
            return null;
        }
    }

    /**
     * Inject required dependencies into the provided extensions.
     * 
     * <p>
     * Depending on whether the extension is provided by a plugin or 
     * the main application the relevant injector is chosen from either 
     * {@link #getApplicationInjector()} or {@link #getPluginInjector()}.
     * </p>
     * 
     * @param <T> type of extensions
     * @param extension extension into which to inject dependencies
     * @param fromPlugin <code>true</code> if the extension is a plugin extension, 
     *          <code>false</code> for an extension loaded from the main application.
     * @return
     */
    protected <T> T injectDependencies(T extension, boolean fromPlugin) {
        // perform dependency injection
        Injector injector = (fromPlugin ? getPluginInjector() : getApplicationInjector());
        if (injector != null) {
            injector.injectMembers(extension);
        }
        else {
            logger.warn("Dependency injection for extension not possible: no injector available!");
        }
        return extension;
    }
    
    /**
     * Get injector to be used for plugins and extensions provided by plugins.
     * If no plugin injector is provided the application injector is used as fallback.
     * @return injector to be used for plugins and extensions provided by plugins
     */
    public Injector getPluginInjector() {
        if (pluginInjector != null) {
            return pluginInjector;
        }
        return getApplicationInjector();
    }
    
    /**
     * Set injector to be used for plugins and extensions provided by plugins.
     * 
     * @param pluginInjector injector to use for plugins and extensions provided by plugins
     */
    public void setPluginInjector(Injector pluginInjector) {
        this.pluginInjector = pluginInjector;
    }
    
    /**
     * Get application injector for extensions provided as part of the application.
     * @return application injector for extensions provided as part of the application
     */
    public Injector getApplicationInjector() {
        return applicationInjector;
    }
    
    /**
     * Set application injector for extensions provided as part of the application and to 
     * create the plugin injector.
     * @param injector
     */
    public void setApplicationInjector(Injector injector) {
        this.applicationInjector = injector;
    }

    private void checkAppStructureLogWarning(File appFolder) {
        // TODO expand checks to files in the future
        final ArrayList<String> supportedFolders = Lists.newArrayList("data", "data/templates", "data/i18n",
                "plugin.properties", "assets", "ldp", "ldp/assets", "ldp/default", "config", "config/repositories",
                "config/services", "config/page-layout", "lib", 
                // development-related folders:
                "src", "target", "bin", ".DS_Store", 
                ".git", ".settings", ".project", ".classpath" 
                );
        for (File f : FileUtils.listFiles(appFolder, TrueFileFilter.INSTANCE,
                TrueFileFilter.INSTANCE)) {
            // relativize returns without leading /
            String relativePath = appFolder.toURI().relativize(f.toURI()).getPath();
            if (supportedFolders.contains(relativePath) || supportedFolders.stream().anyMatch(supported -> relativePath.startsWith(supported) )) {
               continue;
            }
            logger.warn(
                    "App \"{}\" contains a folder \"{}\"  which doesn't seem to be a supported app artefact or is packaged into the wrong directory structure.",
                    appFolder.getName(), relativePath);
        }
    }

    /*
     * pf4j's default implementation reads package implementation version and
     * requires valid semantic version. However, in particular for development
     * builds we do not use valid sem version format.
     *
     * (non-Javadoc)
     *
     * @see org.pf4j.DefaultPluginManager#getVersion()
     */
    @Override
    public String getVersion() {
        String version;
        try {
            version = super.getVersion();
        } catch (Exception e) {
            logger.error("Current implementation version is not valid sem version format. Using 0.0.0 fallback.");
            version = "0.0.0";
        }
        return version;
    }

    @Override
    protected final void validatePluginDescriptor(PluginDescriptor pluginDescriptor) {
        super.validatePluginDescriptor(pluginDescriptor);
    }
    
    /**
     * Load and instantiate a class by name from either the main application classpath or an app.
     * 
     * <p>
     * If the class is available on the main classpath, the PlatformPluginManager will first try 
     * to resolve it from the Dependency Injection context. Only if that fails, the class will be 
     * loaded and an instance created using {@link Class#newInstance()}.  
     * </p>
     * 
     * <p>
     * If the class is available on an app classpath it will be loaded using the app's {@link PluginClassLoader}
     * and an instance created using {@link Class#newInstance()}.
     * </p>
     * 
     * <p>
     * When creating the instance using {@link Class#newInstance()} the instance will still be 
     * initialized using {@link #initializeExtension(Object, boolean)}, e.g. to perform dependency 
     * injection.
     * </p>
     * 
     * 
     * @param <T> type of super class or interface
     * @param className name of the class to Load and instantiate
     * @param superClassOrInterface super class or interface of the class to load
     * @return instance of specified class
     */
    public <T> Optional<T> createInstance(String className, Class<T> superClassOrInterface) {
        logger.debug("Creating instance for class " + className);

        // try to load specified class from main application class path
        Optional<T> instance = createInstanceFromApplication(className, superClassOrInterface);
        if (instance.isPresent()) {
            return instance;
        }
        // try to load specified class from plugin class path
        instance = createInstanceFromApps(className, superClassOrInterface);
        if (instance.isPresent()) {
            return instance;
        }

        logger.debug("Class could not be resolved: " + className + "!");
        return Optional.empty();
    }
    
    protected <T> Optional<T> createInstanceFromApplication(String className, Class<T> superClassOrInterface) {

        // try to load class from application classpath
        Class<?> clazz;
        try {
            clazz = Class.forName(className);
        } catch (ClassNotFoundException e1) {
            logger.trace("Class not found on application classpath: " + className);
            return Optional.empty();
        }

        try {
            Class<? extends T> targetClass = clazz.asSubclass(superClassOrInterface);
            // find concrete implementation from Guice context
            try {
                Injector applicationInjector = getApplicationInjector();
                if (applicationInjector == null) {
                    return Optional.empty();
                } else {
                    return Optional.of(applicationInjector.getInstance(targetClass));
                }
            }
            catch (ConfigurationException e) {
                // if there is none specified try to create an instance using a parameter-less constructor
                T instance = targetClass.getDeclaredConstructor().newInstance();
                initializeExtension(instance, false);
                return Optional.of(instance);
            }
        }
        catch (Exception e) {
            // this exception is expected if the class is e.g. provided by an app
            logger.warn("Failed to create instance of class {} from application: {}", className,
                    e.getMessage());
            logger.debug("Details: ", e);
            return Optional.empty();
        }
    }

    protected <T> Optional<T> createInstanceFromApps(String className, Class<T> superClassOrInterface) {
        for (PluginWrapper wrapper : getResolvedPlugins()) {
            try {
                // try to load class from plugin class path
                ClassLoader pluginClassLoader = getPluginClassLoader(wrapper.getPluginId());
                Class<?> clazz = Class.forName(className, true, pluginClassLoader);
                Class<? extends T> targetClass = clazz.asSubclass(superClassOrInterface);
                T instance = targetClass.getDeclaredConstructor().newInstance();
                initializeExtension(instance, true);
                return Optional.of(instance);
            }
            catch (Exception e) {
                logger.trace("Failed to create instance of class {} from plugin {}: {}", className, wrapper.getPluginId(), e.getMessage());
            }
        }
        return Optional.empty();
    }
}
