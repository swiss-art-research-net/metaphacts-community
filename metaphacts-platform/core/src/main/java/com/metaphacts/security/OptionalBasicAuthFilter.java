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
package com.metaphacts.security;

import javax.inject.Inject;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;

import org.apache.shiro.session.Session;
import org.apache.shiro.web.filter.authc.BasicHttpAuthenticationFilter;

import com.metaphacts.config.Configuration;
import com.metaphacts.servlet.filter.CorsFilter;

/**
 * A modified shiro {@link BasicHttpAuthenticationFilter} that MUST only be used in combination with
 * a session based authentication filter such as {@link FormAuthenticationFilter}. To allow for
 * proper basic http authentication, the {@link BasicHttpAuthenticationFilter} MUST be placed before
 * any other authentication filter in the filter chain.
 * <p>
 * The filter checks whether the request is an basic authentication attempt (i.e. whether authc
 * headers are being set in the request). If not it will pass on the authentication challenge to the
 * filter chain. That is why this filter <b>MUST</b> only be used in combination with other authentication
 * filters.
 * </p>
 *
 * @author Artem Kozlov <ak@metaphacts.com>
 */
public class OptionalBasicAuthFilter extends BasicHttpAuthenticationFilter {

    @Inject
    private Configuration config;

    @Override
    protected boolean isAccessAllowed(ServletRequest request, ServletResponse response, Object mappedValue) {
        // if CORS is enabled we can't request authentication for OPTIONS requests
        // because browsers don't send basic auth headers for pre-flight requests
        if(CorsFilter.isCorsPreFlightRequest(config, request)) {
            return true;
        } else {
            return super.isAccessAllowed(request, response, mappedValue);
        }
    }

    /**
     * Overwrites
     * {@link BasicHttpAuthenticationFilter#onPreHandle(ServletRequest, ServletResponse, Object)} in
     * order to remove the session created by any follow-up session based filter in the chain.
     */
    protected boolean onAccessDenied(
            ServletRequest request, ServletResponse response
    ) throws Exception {
        boolean loggedIn = false;
        // check if request has authorization header
        if (isLoginAttempt(request, response)) {
            // try to login with authorization header in the request
            loggedIn = executeLogin(request, response);
            if (!loggedIn) {
                // if failed send basic auth login challenge
                return this.sendChallenge(request, response);
            } else {
                // if basic auth login was successful and we have session based filter in the chain,
                // we need to remove the session, because it doesn't make any sense
                // to create session for basic auth request.
                Session existingSession = this.getSubject(request, response).getSession(false);
                if (existingSession != null) {
                    existingSession.stop();
                }
            }
        }
        return true;
    }
}
