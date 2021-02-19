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

import java.sql.Driver;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.Iterator;
import java.util.ServiceLoader;
import java.util.function.Function;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.rdf4j.common.lang.service.ServiceRegistry;
import org.eclipse.rdf4j.repository.config.RepositoryFactory;
import org.eclipse.rdf4j.repository.config.RepositoryRegistry;
import org.eclipse.rdf4j.sail.config.SailFactory;
import org.eclipse.rdf4j.sail.config.SailRegistry;
import org.pf4j.Plugin;
import org.pf4j.PluginWrapper;

import com.metaphacts.config.Configuration;
import com.metaphacts.config.groups.ConfigurationGroup;
import com.metaphacts.plugin.extension.ConfigurationExtension;
import com.metaphacts.plugin.extension.RestExtension;
import com.metaphacts.sail.rest.sql.MpJDBCDriverManager;

/**
 * <p>
 * This class will be instantiated by all plugins and
 * serve as the adapter between a plugin (aka app) and the platform.
 * </p>
 * <strong> Please note: </strong>
 * <p>
 * In most cases it should not be required to have a custom implementation of the {@link Plugin} class,
 * it should be sufficient to implement or extend the extension points. In
 * particular, {@link RestExtension} and {@link ConfigurationExtension}.
 * </p>
 *
 * @author Johannes Trame <jt@metaphacts.com>
 *
 */
public class PlatformPlugin {

    private static final Logger logger = LogManager.getLogger(PlatformPlugin.class);
    
    private final PluginWrapper wrapper;
    private final Plugin plugin;

    // set via init() via external call
    private Configuration config;
    
    // set via init() via external call
    private MpJDBCDriverManager jdbcDriverManager;

    public PlatformPlugin(final PluginWrapper wrapper) {
        this.wrapper = wrapper;
        this.plugin = wrapper.getPlugin();
    }
    
    public PluginWrapper getWrapper() {
        return wrapper;
    }
    
    public Plugin getPlugin() {
        return plugin;
    }


    /**
     * Initializes the plugin with relevant information (such as configuration).
     * Is called once internally *prior* to start being executed.
     */
    public void init(Configuration config, MpJDBCDriverManager jdbcDriverManager) {
        this.config = config;
        this.jdbcDriverManager = jdbcDriverManager;
    }


    /**
     * Adds a custom configuration group. The configuration group must be registered
     * *prior* to the start() call of the method. It will then be automatically
     * registered to the platform configuration, where it can be looked up using
     * {@link Configuration#getCustomConfigurationGroup(String, Class)} using the ID as parameter.
     */
    public void registerCustomConfigurationGroup(final Class<? extends ConfigurationGroup> configGroupClass) {
        // instantiate the class
        try {
            final ConfigurationGroup configurationGroup = configGroupClass.getDeclaredConstructor().newInstance();

            final boolean success = config.registerCustomConfigurationGroup(configurationGroup);
            if (success) {
                logger.info("Registered configuration group " + configurationGroup.getId());
            } else {
                logger.warn("Registration of configuration group " + configurationGroup.getId() + " failed."
                    + "This is probably due to an ID clash, make sure you use a unique ID for your config group. ");
            }

        } catch (Exception e) {

            logger.warn("Error instantiating configuration group from class "
                + configGroupClass.getName() + ". Config class will not be available. "
                + "One problem might be that the configuration file is not included in the plugin."
                + "Please make sure that the configuration file is present.");

        }
    }


    /**
     * Start method is called by the application when the plugin is loaded.
     * @see org.pf4j.Plugin#start()
     */
    public void installExtensions() {
        // install/bootstrap the artifacts from the plugin
        handleRepositoryInstallation();
        handleJDBCDrivers();
    }

    protected void handleRepositoryInstallation() {
        handleServiceInstallation(SailRegistry.getInstance(), SailFactory.class, SailFactory::getSailType);
        handleServiceInstallation(RepositoryRegistry.getInstance(), RepositoryFactory.class, RepositoryFactory::getRepositoryType);
    }

    protected <S> void handleServiceInstallation(ServiceRegistry<String, S> parentRegistry, Class<S> serviceClass, Function<S, String> serviceIdFunction) {
        // Collects all services available on the classpath: both those added in the plugin
        // and those available in the main codebase and dependencies.
        ServiceLoader<S> loader = java.util.ServiceLoader.load(serviceClass, this.getWrapper().getPluginClassLoader());

        Iterator<S> services = loader.iterator();
        while (services.hasNext()) {
            try {
                S service = services.next();

                // We should only add the new services defined in this plugin
                if (!parentRegistry.get(serviceIdFunction.apply(service)).isPresent()) {
                    parentRegistry.add(service);
                    logger.debug("Registered service class {}", service.getClass().getName());
                }
                else {
                    logger.debug("Skipping duplicated service class {}", service.getClass().getName());
                }
            } catch (Error e) {
                logger.error("Failed to instantiate service", e);
            }
        }
    }

    protected void handleJDBCDrivers() {
        ServiceLoader<Driver> loader = java.util.ServiceLoader.load(Driver.class,
                this.getWrapper().getPluginClassLoader());

        Iterator<Driver> services = loader.iterator();
        while (services.hasNext()) {
            Driver driver = services.next();
            try {
                DriverManager.registerDriver(driver);
                jdbcDriverManager.registerDriver(driver);
            } catch (SQLException e) {
                logger.error("Failed to register the JDBC driver "
                        + driver.getClass().getCanonicalName(), e);
            }
        }
    }
}
