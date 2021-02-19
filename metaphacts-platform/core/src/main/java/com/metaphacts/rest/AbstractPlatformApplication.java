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

import java.util.List;
import java.util.logging.Logger;

import javax.inject.Inject;

import org.apache.shiro.mgt.SubjectFactory;
import org.apache.shiro.web.jaxrs.ShiroFeature;
import org.glassfish.hk2.api.ServiceLocator;
import org.glassfish.jersey.jackson.JacksonFeature;
import org.glassfish.jersey.logging.LoggingFeature;
import org.glassfish.jersey.media.multipart.MultiPartFeature;
import org.glassfish.jersey.server.ResourceConfig;
import org.jvnet.hk2.guice.bridge.api.GuiceBridge;
import org.jvnet.hk2.guice.bridge.api.GuiceIntoHK2Bridge;

import com.google.common.collect.Lists;
import com.google.inject.Injector;
import com.metaphacts.di.GuiceServletConfig;
import com.metaphacts.rest.feature.CacheControlFeature;
import com.metaphacts.rest.providers.IriParamProvider;
import com.metaphacts.rest.providers.JacksonObjectMapperProvider;
import com.metaphacts.rest.providers.OptionalParamProvider;
import com.metaphacts.rest.providers.Rdf4jModelTurtleMessageBodyWriter;
import com.metaphacts.rest.swagger.SwaggerRegistry;

/**
 * @author Artem Kozlov <ak@metaphacts.com>
 */
public abstract class AbstractPlatformApplication extends ResourceConfig {

    public Logger logger = Logger.getLogger(AbstractPlatformApplication.class.getName());

    @Inject
    public AbstractPlatformApplication(ServiceLocator serviceLocator) {

        // uncomment for debugging purpose
        // https://jersey.java.net/documentation/latest/user-guide.html#tracing
        // property("jersey.config.server.tracing.type", "ALL");
        // property("jersey.config.server.tracing.threshold", "VERBOSE");
        
        GuiceBridge.getGuiceBridge().initializeGuiceBridge(serviceLocator);

        GuiceIntoHK2Bridge guiceBridge = serviceLocator.getService(GuiceIntoHK2Bridge.class);
        guiceBridge.bridgeGuiceInjector(getEndpointInjector());

        getAuxiliaryComponentClasses().forEach(clazz -> register(clazz));
        
        // Shiro Jax-RS
        register(ShiroFeature.class);

        register(CacheControlFeature.class);
        
        /*
         * Exception mapper for a security {@link Exception} not caught in the method
         * itself.
         */
        register(ForbiddenExceptionMapper.class);
        
        /*
         * Exception mapper for a generic {@link Exception} not caught in the method
         * itself.
         */
        register(DefaultExceptionMapper.class);

        if(logger.isLoggable(java.util.logging.Level.FINER)) {
            register(new LoggingFeature(Logger.getLogger(AbstractPlatformApplication.class.getName())));
        }
    }
    
    /**
     * Registers this application for swagger. An OpenAPI spec for the application
     * is available on {@literal /<appPath>/openapi.json}.
     * 
     * @param name display name for this application
     */
    protected void registerSwagger(String name) {
        SwaggerRegistry registry = getEndpointInjector().getInstance(SwaggerRegistry.class);
        registry.addApp(this, name);

        register(io.swagger.v3.jaxrs2.SwaggerSerializers.class);
        register(io.swagger.v3.jaxrs2.integration.resources.OpenApiResource.class);
    }

    /**
     * Return list of auxiliary component classes required for processing REST requests, e.g. for security,
     * data binding/conversion, etc.
     * 
     * @return list of auxiliary component classes
     */
    public static List<Class<?>> getAuxiliaryComponentClasses() {
        return Lists.newArrayList(
            JacksonFeature.class,
            JacksonObjectMapperProvider.class,
            IriParamProvider.class,
        
            OptionalParamProvider.class,
            SubjectFactory.class,
            Rdf4jModelTurtleMessageBodyWriter.class,
            MultiPartFeature.class);
    }

    /**
     * Get {@link Injector} to be used when injecting dependencies into REST endpoint implementations
     * @return injector for REST endpoint implementations
     */
    protected Injector getEndpointInjector() {
        return GuiceServletConfig.injector;
    }
}