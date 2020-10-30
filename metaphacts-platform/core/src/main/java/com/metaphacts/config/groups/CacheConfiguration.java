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
package com.metaphacts.config.groups;

import java.util.List;

import javax.inject.Inject;

import org.apache.commons.configuration2.PropertiesConfiguration;
import org.apache.commons.configuration2.ex.ConfigurationException;

import com.metaphacts.cache.QueryTemplateCache;
import com.metaphacts.cache.ResourceDescriptionCacheHolder;
import com.metaphacts.cache.TemplateIncludeCache;
import com.metaphacts.config.ConfigurationParameter;
import com.metaphacts.config.ConfigurationParameterHook;
import com.metaphacts.config.InvalidConfigurationException;
import com.metaphacts.data.rdf.container.LDPApiInternalRegistry;
import com.metaphacts.lookup.impl.DefaultLookupServiceManager;
import com.metaphacts.rest.endpoint.TemplateEndpoint;
import com.metaphacts.services.fields.SimpleFieldDefinitionGeneratorChain;
import com.metaphacts.services.storage.api.PlatformStorage;

public class CacheConfiguration extends ConfigurationGroupBase {

    public final static String ID = "cache";

    public final static String DESCRIPTION =
            "<p>The platform supports the configuration of certain caches, e.g. to define a maximum size or an automatic retention policy.</p>"
            + "<p>Cache configurations can be provided using a "
            + "<a href=\"https://guava.dev/releases/16.0/api/docs/com/google/common/cache/CacheBuilderSpec.html\" target=\"_BLANK\">Guava Cache Builder Spec</a> "
            + "(e.g. <code>maximumSize=1000,expireAfterAccess=6h</code>).</p>";

    @Inject
    public CacheConfiguration(PlatformStorage platformStorage) throws InvalidConfigurationException {
        super(ID, DESCRIPTION, platformStorage);
    }

    @Override
    public void assertConsistency() {
    }

    @ConfigurationParameter(
            name = ResourceDescriptionCacheHolder.LABEL_CACHE_ID,
            desc = "The cache configuration for the label cache. This cache keeps records for display values of resources.", 
            restartRequired = false)
    public String getLabelCacheSpec() {
        return getCacheSpec(ResourceDescriptionCacheHolder.LABEL_CACHE_ID, "maximumSize=100000,expireAfterAccess=6h");
    }

    @ConfigurationParameter(
            name = ResourceDescriptionCacheHolder.DESCRIPTION_CACHE_ID,
            desc = "The cache configuration for for description of resources. This cache keeps records for display values of resources.",
            restartRequired = false)
    public String getDescriptionCacheSpec() {
        return getCacheSpec(ResourceDescriptionCacheHolder.DESCRIPTION_CACHE_ID, "maximumSize=100000,expireAfterAccess=6h");
    }

    @ConfigurationParameter(
            name = TemplateEndpoint.PageViewConfigCache.CACHE_ID, 
            desc = "The cache configuration for the page view configuration cache. "
                    + "This cache keeps records for rendering a specific page (e.g. the "
                    + "resolved template identifiers).",
            restartRequired = false)
    public String getPageViewConfigCacheSpec() {
        return getCacheSpec(TemplateEndpoint.PageViewConfigCache.CACHE_ID, "maximumSize=1000,expireAfterAccess=6h");
    }

    @ConfigurationParameter(
            name = QueryTemplateCache.CACHE_ID,
            desc = "The cache configuration for the query template cache.",
            restartRequired = false)
    public String getQueryTemplateCacheSpec() {
        return getCacheSpec(QueryTemplateCache.CACHE_ID, "maximumSize=5,expireAfterAccess=5m");
    }

    public String getLDPApiInternalRegistrySpec() {
        return getCacheSpec(LDPApiInternalRegistry.CACHE_ID, "maximumSize=5,expireAfterAccess=30m");
    }

    @ConfigurationParameter(
            name = SimpleFieldDefinitionGeneratorChain.CACHE_ID,
            desc = "The cache configuration for field definitions.",
            restartRequired = false)
    public String getFieldDefinitionCacheSpec() {
        return getCacheSpec(SimpleFieldDefinitionGeneratorChain.CACHE_ID, "maximumSize=1000,expireAfterAccess=30m");
    }
    
    @ConfigurationParameter(
            name = DefaultLookupServiceManager.CACHE_ID,
            desc = "The cache configuration for LookupServices.",
            restartRequired = false)
    public String getLookupServiceCacheSpec() {
        return getCacheSpec(DefaultLookupServiceManager.CACHE_ID, "expireAfterWrite=1d");
    }

    @ConfigurationParameter(
            name = TemplateIncludeCache.CACHE_ID,
            desc = "The cache configuration for resolved template includes of resources, e.g. based on rdf:type definitions.",
            restartRequired = false)
    public String getTemplateIncludeCacheSpec() {
        return getCacheSpec(TemplateIncludeCache.CACHE_ID, "maximumSize=1000,expireAfterAccess=30m");
    }
    
    @ConfigurationParameter(
            name = "assetCacheMaxAge",
            desc = "Max age in seconds for caching control of assets. Default: 31536000.",
            restartRequired = false)
    public Integer getAssetCacheMaxAge() {
        return getInteger("assetCacheMaxAge", 31_536_000 /* = 365 days */);
    }

    @ConfigurationParameterHook(forSetting = ResourceDescriptionCacheHolder.LABEL_CACHE_ID)
    public void onUpdateLabelCacheSpec(String configIdInGroup, List<String> configValues,
            PropertiesConfiguration targetConfig) throws ConfigurationException {
        cacheManager.invalidateAll();
    }

    @ConfigurationParameterHook(forSetting = ResourceDescriptionCacheHolder.DESCRIPTION_CACHE_ID)
    public void onUpdateDescriptionCacheSpec(String configIdInGroup, List<String> configValues,
            PropertiesConfiguration targetConfig) throws ConfigurationException {
        cacheManager.invalidateAll();
    }

    @ConfigurationParameterHook(forSetting = QueryTemplateCache.CACHE_ID)
    public void onUpdateQueryTemplateCacheSpec(String configIdInGroup, List<String> configValues,
            PropertiesConfiguration targetConfig) throws ConfigurationException {
        cacheManager.invalidateAll();
    }

    @ConfigurationParameterHook(forSetting = SimpleFieldDefinitionGeneratorChain.CACHE_ID)
    public void onUpdateFieldDefinitionCacheSpec(String configIdInGroup, List<String> configValues,
            PropertiesConfiguration targetConfig) throws ConfigurationException {
        cacheManager.invalidateAll();
    }

    @ConfigurationParameterHook(forSetting = TemplateIncludeCache.CACHE_ID)
    public void onUpdateTemplateIncludeCacheSpec(String configIdInGroup, List<String> configValues,
            PropertiesConfiguration targetConfig) throws ConfigurationException {
        cacheManager.invalidateAll();
    }

    /**
     * Returns the Guava cache specification for the given cache spec known to this
     * configuration, or the fallback value otherwise.
     * 
     * @param cacheId
     * @param fallbackValue
     * @return
     */
    public String getCacheSpec(String cacheId, String fallbackValue) {
        return getString(cacheId, fallbackValue);
    }

}
