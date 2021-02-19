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
package com.metaphacts.rest.endpoint;

import java.io.IOException;
import java.util.List;
import java.util.Map;

import javax.inject.Inject;
import javax.inject.Named;
import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;

import com.metaphacts.config.Configuration;
import com.metaphacts.security.FormAuthenticationFilter;
import com.metaphacts.ui.templates.ST;
import com.metaphacts.ui.templates.ST.TEMPLATES;
import com.metaphacts.util.BrowserDetector;

/**
 * @author Artem Kozlov <ak@metaphacts.com>
 */
@Path("")
public class LoginEndpoint {
    @Inject
    private ST st;

    @Inject
    protected Configuration config;

    @Inject @Named("ASSETS_MAP")
    private Map<String, String> assetsMap;

    @GET()
    @Path("{path: .*}")
    @Produces(MediaType.TEXT_HTML)
    public String getLoginPageGet(@Context HttpServletRequest httpRequest) throws IOException {
        return getPage(httpRequest);
    }
    
    /**
     * POST is needed for redirect after authentication failure i.e. {@link FormAuthenticationFilter} 
     * redirects the POST sent with an login attempt again to the /login url.
     * @param httpRequest
     * @return
     */
    @POST()
    @Path("{path: .*}")
    @Produces(MediaType.TEXT_HTML)
    public String getLoginPagePost(@Context HttpServletRequest httpRequest) throws IOException {
        return getPage(httpRequest);
    }
    
    private String getPage(HttpServletRequest request) throws IOException {
        Map<String, Object> map = st.getDefaultPageLayoutTemplateParams();
        if (request.getAttribute(FormAuthenticationFilter.DEFAULT_ERROR_KEY_ATTRIBUTE_NAME) != null) {
            map.put(FormAuthenticationFilter.DEFAULT_ERROR_KEY_ATTRIBUTE_NAME, "Username or Password incorrect.");
        }
        map.put("assetsMap", this.assetsMap);

        String browserId = BrowserDetector.detectBrowser(request.getHeader("User-Agent"));
        if (this.isBrowserUnsupported(browserId)) {
            return st.renderPageLayoutTemplate(TEMPLATES.UNSUPPORTED_BROWSER, map);
        } else {
            return st.renderPageLayoutTemplate(TEMPLATES.LOGIN_PAGE, map);
        }
    }

    private boolean isBrowserUnsupported(String browserId) {
        List<String> browsers = this.config.getUiConfig().getUnsupportedBrowsers();
        return browsers.stream().anyMatch(bid -> bid.equals(browserId));
    }
}
