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

import java.util.Enumeration;

import javax.servlet.ServletContext;
import javax.servlet.ServletContextEvent;

import org.apache.log4j.Logger;
import org.apache.shiro.guice.web.ShiroWebModule;
import org.apache.shiro.subject.PrincipalCollection;
import org.apache.shiro.subject.SimplePrincipalCollection;
import org.apache.shiro.subject.Subject;

import com.google.common.collect.Lists;
import com.google.inject.CreationException;
import com.google.inject.Guice;
import com.google.inject.Injector;
import com.google.inject.Module;
import com.google.inject.servlet.GuiceServletContextListener;
import com.google.inject.spi.Message;
import com.metaphacts.config.Configuration;
import com.metaphacts.data.rdf.container.LDPAssetsLoader;
import com.metaphacts.lookup.api.LookupServiceManager;
import com.metaphacts.plugin.PlatformPluginManager;
import com.metaphacts.querycatalog.QueryCatalogRESTServiceRegistry;
import com.metaphacts.repository.RepositoryManager;
import com.metaphacts.security.ShiroGuiceModule;
import com.metaphacts.services.storage.MainPlatformStorage;
import com.metaphacts.templates.index.TemplateIndexManager;

/**
 * @author Artem Kozlov <ak@metaphacts.com>
 */
public class GuiceServletConfig extends GuiceServletContextListener {

    private static final Logger logger = Logger
            .getLogger(GuiceServletConfig.class.getName());

    protected ServletContext servletContext;

    public static Injector injector;

    @Override
    public void contextInitialized(ServletContextEvent event) {
        this.servletContext = event.getServletContext();

        /**
         * Set context param properties as System properties. This allow
         * override of platform config properties using context-param in web.xml
         */
        propagateContextProperties(this.servletContext);

        try {
            super.contextInitialized(event);
        } catch (CreationException e) {
            logger.error("Failed to initialize web application");
            for (Message message : e.getErrorMessages()) {
                logger.error(message.getMessage());
                logger.debug("Details: ", message.getCause());
            }
            throw new IllegalStateException("Failed to initialize webapp context. See error log for details.");
        } catch (Throwable e) {
            logger.error("Failed to initialize web application: " + e.getMessage());
            logger.debug("Details: ", e);
            throw new IllegalStateException("Failed to initialize webapp context. See error log for details.");
        }
        
        // create and set injector to be used for plugins
        PlatformPluginManager pluginManager = injector.getInstance(PlatformPluginManager.class);
        pluginManager.setApplicationInjector(injector);
        pluginManager.setPluginInjector(createPluginInjector(injector));
        pluginManager.startPlugins();
        
        logger.info("Main platform servlet context initialized.");
        System.out.println("\n"
                + "*************************************************************************************\n"
                + "* Main platform servlet context initialized. Press CTRL+C to terminate the process. *\n"
                + "*************************************************************************************\n"
        );
        
        // Replace with proper onContextInitialized hook
        injector.getInstance(RepositoryManager.class).sentTestQueries();
        
        org.apache.shiro.mgt.SecurityManager securityManager = injector
                .getInstance(org.apache.shiro.mgt.SecurityManager.class);
        TemplateIndexManager templateIndexManager = injector.getInstance(TemplateIndexManager.class);
        Configuration systemConfig = injector.getInstance(Configuration.class);

        updatePlatformMetadata(securityManager, templateIndexManager, systemConfig);

        // initialize the lookup service manager explicitly during startup
        injector.getInstance(LookupServiceManager.class).getDefaultLookupService();


        try {
            injector.getInstance(LDPAssetsLoader.class).load();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public void contextDestroyed(ServletContextEvent sce) {
        logger.info("Main platform servlet context in process of shutting down.");
        System.out.println("\n"
                + "*************************************************************************************\n"
                + "* Main platform servlet context in process of shutting down.                        *\n"
                + "*************************************************************************************\n"
        );
        
        logger.info("Shutting down repositories.");
        injector.getInstance(RepositoryManager.class).shutdown();
        
        logger.info("Shutting down main platform storage.");
        try {
            injector.getInstance(MainPlatformStorage.class).shutdown();
        } catch (Throwable t) {
            logger.warn("Error while shutting down main platform storage: " + t.getMessage());
            logger.debug("Details:", t);
        }
        
        try {
            logger.debug("Shutting down query catalog registry");
            injector.getInstance(QueryCatalogRESTServiceRegistry.class).shutdown();
        } catch (Throwable t) {
            logger.warn("Error while shutting down query catalog registry: " + t.getMessage());
            logger.debug("Details:", t);
        }


        super.contextDestroyed(sce);
    }
    
    protected Injector createPluginInjector(Injector applicationInjector) {
        return Guice.createInjector(getPluginModules(applicationInjector));
    }
    
    protected Iterable<? extends Module> getPluginModules(Injector parentInjector) {
        return Lists.newArrayList(
                new PluginModule(parentInjector)
        );
    }

    @Override
    protected Injector getInjector() {
        Injector platformBaseInjector = Guice.createInjector(new ConfigurationModule());
        GuiceServletConfig.injector = platformBaseInjector.createChildInjector(
                getPlatformModules(platformBaseInjector)
        );
        return injector;
    }
    
    protected Iterable<? extends Module> getPlatformModules(Injector platformBaseInjector) {
        return Lists.newArrayList(
                new MainGuiceModule(this.servletContext, platformBaseInjector), 
                new ShiroGuiceModule(this.servletContext, platformBaseInjector), 
                ShiroWebModule.guiceFilterModule(), 
                new PlatformGuiceModule(platformBaseInjector)
        );
    }

    /**
     * Set context param properties as System
     * properevent.getServletContext()ties. This allow override of platform
     * config properties using context-param in web.xml
     */
    private void propagateContextProperties(ServletContext context) {
        Enumeration<String> names = context.getInitParameterNames();
        while (names.hasMoreElements()) {
            String propName = names.nextElement();
            if (System.getProperty(propName) == null) {
                System.setProperty(propName, context.getInitParameter(propName));
            }
        }
    }

    /**
     * Update the platform index in scope of a Shiro system context.
     * 
     * @param securityManager
     * @param templateManager
     * @param systemConfig
     */
    protected void updatePlatformMetadata(org.apache.shiro.mgt.SecurityManager securityManager,
            TemplateIndexManager templateManager, Configuration systemConfig) {

        // make sure to execute this in scope of a Shiro system subject
        PrincipalCollection principals = new SimplePrincipalCollection("System", "platform");
        Subject subject = (new Subject.Builder(securityManager)).authenticated(true).principals(principals)
                .buildSubject();

        Runnable updateIndex = () -> {
            if (systemConfig.getGlobalConfig().isTemplateIndexingEnabled()) {
                logger.info("Indexing template pages");
                try {
                    templateManager.reindex();
                    logger.debug("Re-indexing completed");
                } catch (Throwable t) {
                    logger.error("Failed to re-index template pages: " + t.getMessage());
                    logger.debug("Details:", t);
                }
            } else {
                logger.info("Indexing templates is deactivated.");
            }

            try {
                templateManager.bootstrapMetadata();
            } catch (Throwable t) {
                logger.error("Failed to bootstrap documentation metadata: " + t.getMessage());
                logger.debug("Details:", t);
            }
        };

        subject.execute(updateIndex);


    }
}
