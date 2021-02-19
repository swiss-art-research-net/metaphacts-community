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
package com.metaphacts.servlet;

import java.util.Optional;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import com.google.inject.Inject;
import com.google.inject.Provider;
import com.metaphacts.config.Configuration;
import com.metaphacts.config.groups.EnvironmentConfiguration;
import com.metaphacts.plugin.PlatformPluginManager;

/**
 * Provider for a SparqlRequestHandler.
 * 
 * <p>A handler may be specified using config setting {@link EnvironmentConfiguration#getSparqlRequestHandlerClassName()}.
 * The referenced class will be loaded, it can also be provided by an app.</p>
 * 
 * <p>If no handler is configured a placeholder implementation is returned which rejects handling of requests.</p>
 * 
 * @author Wolfgang Schell <ws@metaphacts.com>
 */
public class SparqlRequestHandlerProvider implements Provider<SparqlRequestHandler> {
    private static final Logger logger = LogManager.getLogger(SparqlRequestHandlerProvider.class);
    
    public final static SparqlRequestHandler NO_HANDLER = new SparqlRequestHandler() {
        @Override
        public boolean canHandle(SparqlRequestContext context) {
            return false;
        }

        @Override
        public boolean processOperation(SparqlRequestContext context, HttpServletRequest req,
                HttpServletResponse resp) {
            return false;
        }
    };
    @Inject
    PlatformPluginManager pluginManager;
    
    @Inject
    Configuration config;

    @Override
    public SparqlRequestHandler get() {
        return Optional.ofNullable(config.getEnvironmentConfig().getSparqlRequestHandlerClassName())
            .filter(className -> { logger.info("Using SparqlRequestHandler {}", className); return true; } )
            .flatMap(className -> pluginManager.createInstance(className, SparqlRequestHandler.class))
            .orElse(NO_HANDLER);
    }

}
