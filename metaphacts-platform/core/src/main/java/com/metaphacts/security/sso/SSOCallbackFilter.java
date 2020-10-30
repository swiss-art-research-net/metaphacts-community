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
package com.metaphacts.security.sso;

import java.io.IOException;

import javax.inject.Inject;
import javax.inject.Singleton;
import javax.servlet.Filter;
import javax.servlet.FilterChain;
import javax.servlet.FilterConfig;
import javax.servlet.ServletException;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;

import io.buji.pac4j.filter.CallbackFilter;

/**
 * Proxies SSO callbacks to the filter from pac4j configuration.
 * 
 * @author Artem Kozlov {@literal <ak@metaphacts.com>}
 */
@Singleton
public class SSOCallbackFilter implements Filter {

    /**
     * Name of the callback filter parameter in the shiro INI configuration file.
     * 
     * @see metaphacts.security.sso.shiro-sso-oauth-default.ini
     * @see metaphacts.security.sso.shiro-sso-saml-default.ini
     */
    private static final String CALLBACK_FILTER = "callbackFilter";

    private CallbackFilter callbackFilter;

    @Inject
    public SSOCallbackFilter(SSOEnvironment env) {
        this.callbackFilter = env.getObject(CALLBACK_FILTER, CallbackFilter.class);
    }

    @Override
    public void init(FilterConfig filterConfig) throws ServletException {
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        this.callbackFilter.doFilter(request, response, chain);
    }

    @Override
    public void destroy() {
        this.callbackFilter.destroy();
    }
}
