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

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import javax.annotation.Nullable;

import org.apache.commons.configuration2.CombinedConfiguration;
import org.apache.commons.configuration2.PropertiesConfiguration;
import org.apache.commons.configuration2.builder.FileBasedConfigurationBuilder;
import org.apache.commons.configuration2.builder.fluent.Parameters;
import org.apache.commons.configuration2.convert.DefaultListDelimiterHandler;
import org.apache.commons.configuration2.convert.ListDelimiterHandler;
import org.apache.commons.configuration2.ex.ConfigurationException;
import org.apache.commons.configuration2.io.FileHandler;
import org.apache.commons.configuration2.tree.OverrideCombiner;
import org.apache.commons.lang.StringUtils;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import com.google.common.collect.Maps;
import com.metaphacts.config.ConfigurationParameter.VisibilityLevel;
import com.metaphacts.services.storage.api.ObjectRecord;
import com.metaphacts.services.storage.api.PlatformStorage;
import com.metaphacts.services.storage.api.StoragePath;
import com.metaphacts.util.ReflectionUtil;

/**
 * Utility class for configuration management. Contains methods for setting
 * up configuration builders as well as generic string manipulation and
 * conversion methods related to configuration management
 * 
 * 
 * @author Artem Kozlov <ak@metaphacts.com>
 * @author Michael Schmidt <ms@metaphacts.com>
 */
public class ConfigurationUtil {

    private static final Logger logger = LogManager.getLogger(ConfigurationUtil.class);

    /**
     * Return a comma-based delimiter handler, which is what we use for encoding
     * arrays in the configuration.
     * 
     * @return the list delimiter handler used by the configuration
     */
    public static ListDelimiterHandler commaBasedDelimiterHandler() {
        return new DefaultListDelimiterHandler(',');
    }
    
    /**
     * Splits the configuration value to a list using the commonly used 
     * {@link DefaultListDelimiterHandler}.
     */
    public static List<String> configValueAsList(String val) {
        ListDelimiterHandler delimHandler = ConfigurationUtil.commaBasedDelimiterHandler();
        return new ArrayList<>(delimHandler.split(val, true));
    }

    /**
     * Escapes a list of configuration values using {@link DefaultListDelimiterHandler}.
     */
    @Nullable
    public static Object listAsConfigValue(List<String> list) {
        if (list.isEmpty()) {
            return null;
        }
        ListDelimiterHandler delimHandler = ConfigurationUtil.commaBasedDelimiterHandler();
        return delimHandler.escapeList(list, item -> item);
    }

    public static PropertiesConfiguration createEmptyConfig() {
        FileBasedConfigurationBuilder<PropertiesConfiguration> builder = new FileBasedConfigurationBuilder<PropertiesConfiguration>(
                PropertiesConfiguration.class)
                .configure(new Parameters().properties()
                    .setListDelimiterHandler(commaBasedDelimiterHandler())
                    .setEncoding("UTF-8")
                );

        try {
            return builder.getConfiguration();
        } catch (ConfigurationException e) {
            throw new RuntimeException(e);
        }
    }

    /**
     * Creates a {@link CombinedConfiguration} by finding matching configuration
     * files in the existing storages. The configuration is in override order, i.e.
     * the configuration returns the most specific configuration value.
     * 
     * @param platformStorage
     * @param objectId
     * @param ignoreStorages  set of storages that are ignored (i.e. not added to
     *                        the configuration). Can be empty
     * @return
     * @throws IOException
     * @throws ConfigurationException
     */
    public static CombinedConfiguration readConfigFromStorageOverrides(
        PlatformStorage platformStorage,
            StoragePath objectId, Set<String> ignoreStorages
    ) throws IOException, ConfigurationException {
        CombinedConfiguration combined = new CombinedConfiguration(new OverrideCombiner());

        List<PlatformStorage.FindResult> overrides =
            platformStorage.findOverrides(objectId);
        
        
        // filter ignored storages (if any)
        overrides = overrides.stream().filter(f -> {
            if (ignoreStorages.contains(f.getAppId())) {
                logger.warn(
                        "Ignoring configuration file {} from storage {}: storage is not allowed to define this configuration",
                        objectId, f.getAppId());
                return false;
             }
            return true;
        }).collect(Collectors.toList());


        // use inverted order [...override2, override1, base] for OverrideCombiner
        Collections.reverse(overrides);

        for (PlatformStorage.FindResult override : overrides) {
            ObjectRecord record = override.getRecord();
            PropertiesConfiguration config = createEmptyConfig();
            FileHandler handler = new FileHandler(config);
            try (InputStream content = record.getLocation().readContent()) {
                handler.load(content);
            }
            combined.addConfiguration(config, override.getAppId());
        }

        return combined;
    }

    /**
     * @return a list of storage IDs which override specified parameter
     * in override order [base, override1, override2, ...]
     */
    public static List<String> getStorageIdsInOverrideOrderForParam(
        CombinedConfiguration combined, String parameterId
    ) {
        List<String> order = combined.getConfigurationNameList().stream()
            .filter(appId -> combined.getConfiguration(appId).containsKey(parameterId))
            .collect(Collectors.toList());
        // restore override order (it's reversed for OverrideCombiner)
        Collections.reverse(order);
        return order;
    }

    /**
     * Converts a config parameter for the given group ID its unique
     * system parameter name. More precisely, a config parameter <PARAM> in
     * group <GROUP> is referenced via config.<GROUP>.<PARAM>. Throws an
     * {@link IllegalArgumentException} if the config parameter passed in
     * is null or empty.
     * 
     * @param groupId the ID of the group the parameter belongs to
     * @param configParam the ID of the parameter itself
     * 
     * @return the associated system parameter string
     */
    public static String configParamToSystemParam(final String groupId, final String configParam) {
        
        if (StringUtils.isEmpty(configParam))
            throw new IllegalArgumentException();
        
        final StringBuilder sb = new StringBuilder();
        sb.append("config.").append(groupId).append(".").append(configParam);
        
        return sb.toString();
    }

    /**
     * Instantiate a {@link ConfigurationParameter} annotation instance using the
     * provided values
     * 
     * @param name
     * @param description
     * @param restartRequired
     * @return the {@link ConfigurationParameter}
     */
    public static ConfigurationParameter toConfigurationParameter(String name, String description, boolean restartRequired) {
        Map<String, Object> properties = Maps.newHashMap();
        properties.put("name", name == null ? "" : name);
        properties.put("desc", description == null ? "" : description);
        properties.put("restartRequired", restartRequired);
        properties.put("visibilityLevel", VisibilityLevel.simple);
        return ReflectionUtil.mockAnnotation(ConfigurationParameter.class, properties);
    }
}
