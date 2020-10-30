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
package com.metaphacts.rest.endpoint;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutionException;

import javax.inject.Inject;
import javax.inject.Singleton;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.rdf4j.model.IRI;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.common.cache.Cache;
import com.metaphacts.cache.CacheManager;
import com.metaphacts.cache.PlatformCache;
import com.metaphacts.services.storage.StorageUtils;
import com.metaphacts.services.storage.api.PlatformStorage;
import com.metaphacts.services.storage.api.PlatformStorage.FindResult;
import com.metaphacts.services.storage.api.StorageException;
import com.metaphacts.services.storage.api.StoragePath;

/**
 * Endpoint for reading registered web extensions.
 * 
 * @author Stefan Schmitt <stefan.schmitt@metaphacts.com>
 *
 */
@Singleton
@Path("webextensions")
public class WebExtensionsEndpoint {
    private static final Logger logger = LogManager.getLogger(WebExtensionsEndpoint.class);

    public static final String CACHE_ID = "platform.WebExtensionsCache";
    private static final String CACHE_KEY = "extensions";

    private static final String WEB_EXTENSIONS_CONFIG = "web-extensions.json";

    private PlatformStorage platformStorage;

    private CacheManager cacheManager;

    private WebExtensionsCache cache;

    @Inject
    public WebExtensionsEndpoint(PlatformStorage platformStorage, CacheManager cacheManager) {
        this.platformStorage = platformStorage;
        this.cacheManager = cacheManager;

        cache = new WebExtensionsCache();
        cacheManager.register(cache);
    }

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Object combined() throws ExecutionException {
        return cache.getValue();
    }

    protected WebExtensions combinePageLayoutTemplates() {
        StoragePath configPath = StoragePath.EMPTY.resolve(WEB_EXTENSIONS_CONFIG);

        ObjectMapper mapper = new ObjectMapper();

        List<String> extensions = new ArrayList<>();
        try {
            List<FindResult> resources = platformStorage.findOverrides(configPath);
            for (FindResult findResult : resources) {
                String appId = findResult.getAppId();
                try {
                    String resourceContent = StorageUtils.readTextContent(findResult.getRecord());
                    WebExtensions storageExtensions = mapper.readValue(resourceContent, WebExtensions.class);
                    if (storageExtensions.extensions != null) {
                        extensions.addAll(storageExtensions.extensions);
                    }
                } catch (Exception e) {
                    logger.warn("failed to load {} from app {}: {}", configPath, appId, e.getMessage());
                    logger.debug("Details: ", e);
                }
            }
        } catch (StorageException e) {
            logger.warn("failed to load {} from apps: {}", configPath, e.getMessage());
            logger.debug("Details: ", e);
        }

        return new WebExtensions(extensions);
    }

    protected class WebExtensionsCache implements PlatformCache {
        private Cache<String, WebExtensions> cache;

        public WebExtensionsCache() {
            cache = cacheManager.newBuilder(CACHE_ID).build();
        }

        public WebExtensions getValue() throws ExecutionException {
            return cache.get(CACHE_KEY, () -> combinePageLayoutTemplates());
        }

        @Override
        public void invalidate() {
            cache.invalidateAll();
        }

        @Override
        public void invalidate(Set<IRI> iris) {
        }

        @Override
        public String getId() {
            return CACHE_ID;
        }
    }
}
