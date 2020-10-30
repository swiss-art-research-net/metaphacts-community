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
package com.metaphacts.ui.templates;

import java.io.IOException;
import java.util.List;
import java.util.Map;

import javax.inject.Inject;
import javax.inject.Named;
import javax.inject.Singleton;
import javax.servlet.ServletContext;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import com.github.jknack.handlebars.Context;
import com.google.inject.Provider;
import com.metaphacts.config.Configuration;
import com.metaphacts.services.storage.StorageUtils;
import com.metaphacts.services.storage.api.PlatformStorage;
import com.metaphacts.services.storage.api.PlatformStorage.FindResult;
import com.metaphacts.services.storage.api.StorageException;
import com.metaphacts.services.storage.api.StoragePath;
import com.metaphacts.ui.templates.ST.TEMPLATES;
import com.metaphacts.util.SystemPropUtils;

/**
 * Main application template with basic html skeleton and main js/css
 * imports. While other ST templates can be loaded from different
 * locations (i.e. classpath, app folder), the main template shouldn't be "overwritten".
 *
 * @author Artem Kozlov <ak@metaphats.com>
 * @author Johannes Trame <jt@metaphats.com>
 */
@Singleton
public class MainTemplate {
    private static final Logger logger = LogManager.getLogger(MainTemplate.class);
    
    @Inject
    private Provider<ServletContext> sc;

    @Inject
    private ST st;

    @Inject
    private Configuration config;
    
    @Inject
    private PlatformStorage platformStorage;

    @Inject @Named("ASSETS_MAP")
    private Map<String, String> assetsMap;

    public String getMainTemplate() throws IOException {
        MainTemplateOpts opts = new MainTemplateOpts(this.getVersion(), this.assetsMap, config);
        String html_head = st.renderPageLayoutTemplate(TEMPLATES.HTML_HEAD, opts);
        String html_header_resources = combinePageLayoutTemplates(TEMPLATES.HTML_HEADER_RESOURCES);
        String html_footer_resources = combinePageLayoutTemplates(TEMPLATES.HTML_FOOTER_RESOURCES);
        Context context = Context.newBuilder(opts)
            .combine(TEMPLATES.HTML_HEAD, html_head)
            .combine(TEMPLATES.HTML_HEADER_RESOURCES, html_header_resources)
            .combine(TEMPLATES.HTML_FOOTER_RESOURCES, html_footer_resources)
            .build();
        return st.renderPageLayoutTemplate(TEMPLATES.MAIN, context);
    }

    /**
     * Fetch specified resource templates from all apps and return the concatenated content.
     * <p>
     * The returned content contains HTML comments indication the source for each app 
     * </p>
     * @param resourceName name of the resource to be resolved by {@link ST#objectIdForTemplate(String)}
     * @return concatenated content or empty string if no such resource exist or in case of errors
     */
    protected String combinePageLayoutTemplates(String resourceName) {
        StoragePath resourcePath = ST.objectIdForTemplate(resourceName);
        try {
            StringBuilder buffer = new StringBuilder();
            // determine whether to print comments to help identify content contributed by an app
            boolean printAppMarkers = logger.isDebugEnabled();
            List<FindResult> resources = platformStorage.findOverrides(resourcePath);
            for (FindResult findResult : resources) {
                String appId = findResult.getAppId();
                try {
                    String resourceContent = StorageUtils.readTextContent(findResult.getRecord());
                    if (resourceContent.length() > 0) {
                        if (printAppMarkers) {
                            buffer.append("<!-- begin app ").append(appId).append(" content -->\n");
                        }
                        buffer.append(resourceContent).append("\n");
                        if (printAppMarkers) {
                            buffer.append("<!-- end app ").append(appId).append(" content -->\n");
                        }
                    }
                }
                catch (Exception e) {
                    logger.warn("failed to load {} from app {}: {}", resourcePath, appId, e.getMessage());
                    logger.debug("Details: ", e);
                }
            }
            return buffer.toString();
        } catch (StorageException e) {
            logger.warn("failed to load {} from apps: {}", resourcePath, e.getMessage());
            logger.debug("Details: ", e);
        }
        // return empty string as fallback
        return "";
    }

    public String renderMainPageLayout(String templateName) throws IOException {
        MainTemplateOpts opts = new MainTemplateOpts(this.getVersion(), this.assetsMap, config);
        Context context = Context.newBuilder(opts).build();
        return st.renderPageLayoutTemplate(templateName, context);
    }

    private class MainTemplateOpts {
        public String version;
        public String deploymentTitle;

		public Map<String, String> assetsMap;

        public MainTemplateOpts(String version, Map<String, String> assetsMap, Configuration config) {
            this.version = version;
            this.assetsMap = assetsMap;
            this.deploymentTitle = config.getUiConfig().getDeploymentTitle();
        }

        @SuppressWarnings("unused")
        public String getVersion() {
            return version;
        }

        @SuppressWarnings("unused")
        public String getDeploymentTitle() {
			return deploymentTitle;
		}

        /**
         * Getter for the template context bean. See main.hbs
         * @return whether platform is started in development modus
         */
        @SuppressWarnings("unused")
        public boolean isDev() {
            // if there is hot bundle in the assets then we're in the dev mode
            return !this.assetsMap.get("hot").equals("");
        }

        /**
         * Getter for the template context bean. See main.hbs
         *
         * @return a map with all assets and respective asset locations to be
         *         loaded by the front-end. The location is different in
         *         development mode, where assets are served by the webpack
         *         server.
         */
        @SuppressWarnings("unused")
        public Map<String, String> getAssetsMap() {
            return assetsMap;
        }
    }

    private String platformVersion;

    private String getVersion() {
        if (platformVersion == null) {
            platformVersion = SystemPropUtils.getVersionFromManifest(sc.get()).getVersion();
        }
        return platformVersion;
    }
}
