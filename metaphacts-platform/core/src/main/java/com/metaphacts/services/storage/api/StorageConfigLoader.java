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
package com.metaphacts.services.storage.api;

import static com.metaphacts.config.ConfigurationUtil.createEmptyConfig;

import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Set;

import org.apache.commons.configuration2.CombinedConfiguration;
import org.apache.commons.configuration2.Configuration;
import org.apache.commons.configuration2.PropertiesConfiguration;
import org.apache.commons.configuration2.SystemConfiguration;
import org.apache.commons.configuration2.ex.ConfigurationException;
import org.apache.commons.configuration2.io.FileHandler;
import org.apache.commons.lang.StringUtils;

import com.google.common.collect.Sets;
import com.metaphacts.config.ConfigurationUtil;

public class StorageConfigLoader {
    
    private final StorageRegistry storageRegistry;
    
    public StorageConfigLoader(StorageRegistry storageRegistry) {
        this.storageRegistry = storageRegistry;
    }

    /**
     * Reads static storage configuration from system variables
     * (-Dconfig.storage.foo=...)
     */
    public LinkedHashMap<String, StorageConfig> readSystemStorageConfig() {
        return parseStorageConfigsSystemConfig(new SystemConfiguration());
    }

    /**
     * Reads dynamic storage configuration from config/storage.prop defined in
     * static apps
     */
    public LinkedHashMap<String, StorageConfig> readDynamicStorageConfig(PlatformStorage platformStorage,
            Collection<String> dynamicStorages) throws StorageException {
        CombinedConfiguration config;
        try {
            // we need to make sure to not include dynamic storages
            Set<String> ignoreStorages = Sets.newHashSet(dynamicStorages);
            config = ConfigurationUtil.readConfigFromStorageOverrides(platformStorage,
                    ObjectKind.CONFIG.resolve("storage.prop"), ignoreStorages);
        } catch (IOException | ConfigurationException e) {
            throw new StorageConfigException("Unable to read dynamic storage configuration", e);
        }
        return parseStorageConfigs(config);
    }

    /**
     * Read {@link StorageConfig} from a provided {@link Configuration}.
     * <p>
     * The configuration is expected to be provided hierarchical, with keys looking
     * like <i>my-storage.type</i>.
     * </p>
     * 
     * @param configuration
     * @return the parsed {@link StorageConfig}
     * @throws StorageConfigException
     */
    public LinkedHashMap<String, StorageConfig> readStorageConfig(Configuration configuration)
            throws StorageConfigException {
        return parseStorageConfigs(configuration);
    }

    /**
     * Reads storage configuration from "com/metaphacts/app/internalStorage.prop" in the classpath
     * resources which is generated at the compile time.
     */
    public LinkedHashMap<String, StorageConfig> readInternalStorageConfig(
            ClassLoader classLoader) throws StorageConfigException {
        URL internalConfigUrl = classLoader.getResource("com/metaphacts/app/internalStorage.prop");
        if (internalConfigUrl == null) {
            throw new StorageConfigException("Unable to find internal storage config");
        }

        try (InputStream is = internalConfigUrl.openStream()) {
            return this.readStorageConfigFromStream(is);
        } catch (IOException | ConfigurationException e) {
            throw new StorageConfigException("Unable to read internal storage config", e);
        }
    }

    public LinkedHashMap<String, StorageConfig> readStorageConfigFromStream(InputStream is)
            throws ConfigurationException {
        PropertiesConfiguration config = createEmptyConfig();
        FileHandler handler = new FileHandler(config);
        handler.load(is);
        return parseStorageConfigsSystemConfig(config);
    }

    private LinkedHashMap<String, StorageConfig> parseStorageConfigsSystemConfig(Configuration config) {
        Configuration allStoragesSubset = config.subset("config.storage");
        return parseStorageConfigs(allStoragesSubset);
    }

    private LinkedHashMap<String, StorageConfig> parseStorageConfigs(Configuration config) {

        HashSet<String> storageIds = new HashSet<>();
        List<String> orderedIds = new ArrayList<>();

        config.getKeys().forEachRemaining(key -> {
            String storageId = StringUtils.substringBefore(key, ".");
            if (storageIds.add(storageId)) {
                orderedIds.add(storageId);
            }
        });

        LinkedHashMap<String, StorageConfig> configs = new LinkedHashMap<>();
        for (String storageId : orderedIds) {
            Configuration properties = config.subset(storageId);
            String storageType = properties.getString("type");
            if (storageType == null) {
                throw new StorageConfigException(
                    "Missing property 'type' for storage '" + storageId + "'");
            }

            StorageFactory<?> factory = storageRegistry.get(storageType)
                    .orElseThrow(
                () -> new StorageConfigException("Unknown storage type '" + storageType + "'"));

            StorageConfig parsedConfig = factory.parseStorageConfig(storageType, properties);
            try {
                parsedConfig.validate();
            } catch (StorageConfigException e) {
                throw new StorageConfigException(
                    "Invalid configuration for storage ID '" + storageId + "'. Details: " + e.getMessage(), e);
            }
            configs.put(storageId, parsedConfig);
        }

        return configs;
    }
}
