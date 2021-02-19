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
package com.metaphacts.config;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;

import org.apache.commons.configuration2.ex.ConfigurationException;
import org.apache.commons.lang.StringUtils;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.shiro.authz.UnauthorizedException;

import com.google.inject.Inject;
import com.metaphacts.config.groups.CacheConfiguration;
import com.metaphacts.config.groups.ConfigurationGroup;
import com.metaphacts.config.groups.ConfigurationGroupBase;
import com.metaphacts.config.groups.DataQualityConfiguration;
import com.metaphacts.config.groups.EnvironmentConfiguration;
import com.metaphacts.config.groups.GlobalConfiguration;
import com.metaphacts.config.groups.LookupConfiguration;
import com.metaphacts.config.groups.UIConfiguration;

/**
 * Main configuration class, providing entry points to the configuration groups
 * as well as common base functionality.
 *
 * @author Michael Schmidt <ms@metaphacts.com>
 */
public class Configuration {

    private static final Logger logger = LogManager
            .getLogger(Configuration.class);

    /**
     * The key of the system property to look-up {@link #getRuntimeDirectory()} property.
     */
    // TODO: should be private but still used in tests to set temporary runtime directory
    public static final String SYSTEM_PROPERTY_RUNTIME_DIRECTORY = "runtimeDirectory";

    /**
     * The key of the system property to look-up
     */
    private static final String SYSTEM_PROPERTY_STORAGE_DIRECTORY = "storageDirectory";

    /**
     * The key of the system property to look-up {@link #getConfigBasePath()} property.
     */
    private static final String SYSTEM_PROPERTY_RUNTIME_CONFIG_BASE = "com.metaphacts.config.baselocation";

    /**
     * The key of the system property to look-up {@link #getPlatformStorageId()}
     * property.
     */
    public static final String SYSTEM_PROPERTY_PLATFORM_STORAGE_ID = "platformStorage";

    /**
     * Default value for {@link #getConfigBasePath()} property.
     */
    private final static String DEFAULT_CONFIG_BASE_LOCATION = "config/";

    private final GlobalConfiguration globalConfig;

    private final EnvironmentConfiguration environmentConfig;

    private final UIConfiguration uiConfig;

    private final DataQualityConfiguration dataQualityConfig;

    private final CacheConfiguration cacheConfig;

    private final LookupConfiguration lookupConfiguration;

    /**
     * A registry of configuration groups administered by the config. The
     * registry is used for automatic lookup via the REST API.
     */
    private final Map<String, ConfigurationGroup> registry;

    @Inject
    public Configuration(
        GlobalConfiguration globalConfig,
        UIConfiguration uiConfig,
        EnvironmentConfiguration environmentConfig,
        DataQualityConfiguration dataQualityConfig,
        CacheConfiguration cacheConfig,
        LookupConfiguration lookupConfiguration
    ) {
        this.globalConfig = globalConfig;
        this.uiConfig = uiConfig;
        this.environmentConfig = environmentConfig;
        this.dataQualityConfig = dataQualityConfig;
        this.cacheConfig = cacheConfig;
        this.lookupConfiguration = lookupConfiguration;

        registry = new HashMap<>();
        registry.put(globalConfig.getId(), globalConfig);
        registry.put(uiConfig.getId(), uiConfig);
        registry.put(environmentConfig.getId(), environmentConfig);
        registry.put(dataQualityConfig.getId(), dataQualityConfig);
        registry.put(cacheConfig.getId(), cacheConfig);
        registry.put(lookupConfiguration.getId(), lookupConfiguration);
    }

    public static String getRuntimeDirectory() {
        String value = System.getProperty(SYSTEM_PROPERTY_RUNTIME_DIRECTORY);
        if (StringUtils.isEmpty(value)) {
            logger.warn("using current directory as runtime directory as system property " + SYSTEM_PROPERTY_RUNTIME_DIRECTORY + " is not set!");
            return "./";
        }
        return value;
    }

    /**
     * Return the location of the storage directory (i.e where new dynamic storages
     * are allowed to be added).
     * 
     * @return the location of the storage directory
     */
    public static String getStorageDirectory() {
        String value = System.getProperty(SYSTEM_PROPERTY_STORAGE_DIRECTORY);
        if (StringUtils.isEmpty(value)) {
            logger.warn("using current directory as storage directory as system property "
                    + SYSTEM_PROPERTY_STORAGE_DIRECTORY + " is not set!");
            return "./";
        }
        return value;
    }


    /**
     * Base config location (relative to working dir); may be overridden by system property
     * <pre>com.metaphacts.config.baselocation</pre> (see {@link #DEFAULT_CONFIG_BASE_LOCATION}).
     *
     * @return the config base path, including a trailing "/"
     */
    public static String getConfigBasePath() {
        String configBaseLocation = System.getProperty(SYSTEM_PROPERTY_RUNTIME_CONFIG_BASE);
        if (configBaseLocation == null) {
            return DEFAULT_CONFIG_BASE_LOCATION;
        } else {
            return configBaseLocation.endsWith("/") ? configBaseLocation
                : configBaseLocation + "/";
        }
    }

    public static String getAppsDirectory() {
        String value = System.getProperty("appsDirectory");
        return StringUtils.isEmpty(value) ? (getRuntimeDirectory() + "/apps/") : value;
    }

    /**
     * @return identifier of the main platform storage
     */
    public static String getPlatformStorageId() {
        return System.getProperty(SYSTEM_PROPERTY_PLATFORM_STORAGE_ID, "metaphacts-platform");
    }

    public static boolean arePluginBasedAppsMutable() {
        String value = System.getProperty("config.mutablePluginApps");
        return value != null && value.equals("true");
    }

    /**
     * @return the global configuration group
     */
    public GlobalConfiguration getGlobalConfig() {
        return globalConfig;
    }

    /**
     * @return the environment configuration group.
     */
    public EnvironmentConfiguration getEnvironmentConfig() {
        return environmentConfig;
    }

    /**
     * @return the UI configuration group
     */
    public UIConfiguration getUiConfig() {
        return uiConfig;
    }

    public DataQualityConfiguration getDataQualityConfig() {
        return dataQualityConfig;
    }

    /**
     * @return the cache configuration group
     */
    public CacheConfiguration getCacheConfig() {
        return cacheConfig;
    }

    /**
     * @return the lookup service configuration group
     */
    public LookupConfiguration getLookupConfig() {
        return lookupConfiguration;
    }

    /**
     * Registers the custom configuration group. Throws an
     * {@link IllegalArgumentException} if the configuration group ID is null or
     * empty. The group is only registered if there exists no configuration
     * group with the given ID.
     *
     * @param configurationGroup
     *            the group to register
     * @return true if the group was registered, false otherwise
     */
    final public boolean registerCustomConfigurationGroup(
            final ConfigurationGroup configurationGroup) {

        // make sure there's no configuration group with the given ID
        final String customGroupId = configurationGroup.getId();
        if (StringUtils.isEmpty(customGroupId)) {
            throw new IllegalArgumentException(
                    "Cannot register configuration group: ID must not be null or empty.");
        }

        if (registry.keySet().contains(customGroupId))
            return false; // group with the given ID already exists

        // no ID conflict detected -> register the group
        registry.put(configurationGroup.getId(), configurationGroup);
        return true;

    }

    /**
     * Returns a custom configuration group with the given ID, casting it to the
     * specified clazz. Returns null of the config group does not exist or the
     * cast fails (in the latter case, a WARNING will be logged out in
     * addition).
     *
     * This is the proper mechanism to access configuration groups that are
     * hooked in via plugins, see the sample plugin for example code.
     *
     * @param configGroupId
     *            ID of the configuration group
     * @param clazz
     *            expected clazz of the configuration group
     *
     * @return the configuration group with the given ID or null, if not defined
     */
    final public <T extends ConfigurationGroup> T getCustomConfigurationGroup(
            final String configGroupId, final Class<T> clazz) {
        try {
            return clazz.cast(registry.get(configGroupId));
        } catch (ClassCastException e) {
            logger.warn("Error casting to configuration group class: "
                    + e.getMessage());
        }

        return null; // fallback
    }

    /************************** REST CALL ENTRY POINTS ************************/

    /**
     * Lists all configuration groups, in alphabetically sorted order.
     *
     * @return all configuration groups, independently from whether the user has
     *         access rights to (any of) their items
     */
    public List<String> listGroups() {

        // convert to tree set first in order to have it sorted alphabetically
        return new ArrayList<String>(new TreeSet<String>(registry.keySet()));
    }

    /**
     * <p>
     * Returns a mapping from configuration parameters in the group to parameter
     * value information objects.
     * </p>
     *
     * <p>
     * <strong>Please note security checks need to done outside of this method
     * i.e. the map being returned contains all configuration parameters
     * regardless of whether the user has the respective permissions!</strong>
     * </p>
     *
     * @param configGroup config group for which the lookup is performed
     * @return a map from identifiers to configuration parameter value
     *         information objects
     */
    public Map<String, ConfigParameterValueInfo> listParamsInGroups(
            final String configGroup) throws UnknownConfigurationException {

        ConfigurationGroup group = registry.get(configGroup);
        if (group == null) {
            throw new UnknownConfigurationException();
        }

        return group.getAllParametersInfo();
    }

    /**
     * <p>
     * Returns a description of the group defined in the group's configuration
     * class.
     * </p>
     *
     * @param configGroup configGroup config group for which the lookup is performed
     * @throws UnknownConfigurationException
     */
    public String getDescriptionForGroup(String configGroup) throws UnknownConfigurationException {
        ConfigurationGroup group = registry.get(configGroup);

        if (group == null) {
            throw new UnknownConfigurationException();
        }

        return group.getDescription();
    }

    /**
     * <p>
     * Tries to lookup the specified <strong>configIdInGroup</strong> in the
     * specified <strong>configGroup</strong>.
     * </p>
     *
     * <p>
     * <strong>Please note security checks need to done outside of this
     * method!</strong>
     * </p>
     *
     * @param configGroup
     * @param configIdInGroup
     * @return The configuration parameter value encapsulated in a
     *         {@link ConfigParameterValueInfo}
     * @throws UnknownConfigurationException
     *             If the config group or parameter in the group does not exit
     *             or there are any unexpected expections during the lookup.
     */
    public ConfigParameterValueInfo lookupProperty(final String configGroup,
            final String configIdInGroup) throws UnknownConfigurationException {

        // assert parameters are set correctly
        if (StringUtils.isEmpty(configGroup)
                || StringUtils.isEmpty(configIdInGroup)) {
            throw new UnknownConfigurationException();
        }

        ConfigurationGroup group = registry.get(configGroup);
        if (group == null) {
            throw new UnknownConfigurationException();
        }

        return group.getParameterInfo(configIdInGroup);
    }

    /**
     * Sets (writes) the <strong>configValue</strong> for the specified
     * <strong>configIdInGroup</strong> in the specified
     * <strong>configGroup</strong>.
     *
     * @throws UnknownConfigurationException
     *             If the config group or parameter in the group does not exit
     *             or there are any unexpected exceptions while writing the
     *             property.
     * @throws ConfigurationException
     */
    public void setProperty(
        String configGroup,
        String configIdInGroup,
        List<String> configValues,
        String targetAppId
    ) throws UnknownConfigurationException, ConfigurationException {

        // assert parameters are set correctly
        if (StringUtils.isEmpty(configGroup)
                || StringUtils.isEmpty(configIdInGroup)) {
            throw new UnknownConfigurationException();
        }

        ConfigurationGroup group = registry.get(configGroup);
        if (group == null) {
            throw new UnknownConfigurationException("Configuration group: \""
                    + configGroup + "\" is unknown.");
        }

        // prevent writing if property is shadowed by runtime configuration
        String systemPropertyName =
            ConfigurationUtil.configParamToSystemParam(configGroup, configIdInGroup);
        String systemProperty = System.getProperty(systemPropertyName);

        if (StringUtils.isNotEmpty(systemProperty)) { // shadowed by -Dconfig....
            throw new UnauthorizedException(
                    "Configuration element is shadowed by system parameter. "
                            + "Changing the parameter would have no effect and is forbidden.");
        }


        // invoke method and return result
        try {
            if (group instanceof ConfigurationGroupBase) {
                ((ConfigurationGroupBase) group).setParameter(
                    configIdInGroup, configValues, targetAppId
                );
            } else {
                throw new UnknownConfigurationException();
            }
        } catch (Exception e) {
            if (e.getCause() instanceof ConfigurationException) {
            	throw (ConfigurationException) e.getCause();
            }
            // this should not happen, so write some log output
            logger.warn("Exception during setting values [" + configValues +
                "]\" for configuration property \"" + configIdInGroup + "\"", e);
            throw new UnknownConfigurationException();
        }
    }

    /************************ END REST CALL ENTRY POINTS ***********************/


}
