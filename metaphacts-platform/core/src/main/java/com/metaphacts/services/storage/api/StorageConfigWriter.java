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

import java.io.IOException;
import java.io.InputStream;
import java.util.Optional;

import org.apache.commons.configuration2.Configuration;
import org.apache.commons.configuration2.PropertiesConfiguration;
import org.apache.commons.configuration2.ex.ConfigurationException;
import org.apache.commons.configuration2.io.FileHandler;
import org.apache.commons.io.output.ByteArrayOutputStream;

import com.metaphacts.config.ConfigurationUtil;
import com.metaphacts.services.storage.api.ObjectMetadata.ObjectMetadataBuilder;

/**
 * Helper class for writing {@link StorageConfig} related configuration to the
 * {@link ObjectStorage}
 * 
 * @author Andreas Schwarte
 *
 */
public class StorageConfigWriter {

    private static final StoragePath STORAGE_PROP = ObjectKind.CONFIG.resolve("storage.prop");
    /**
     * Merge the provided Configuration with a potentially existing
     * <i>storage.prop</i> configuration and write it to the given
     * {@link ObjectStorage}.
     * 
     * @param configuration
     * @param storage
     * @return true (if storage.prop already existed, meaning that an existing
     *         storage might have been re-configured), false otherwise (incl. the
     *         case when there was no storage.prop, but new storages are added)
     * @throws IOException
     * @throws ConfigurationException
     */
    public static boolean mergeStorageConfig(Configuration configuration, ObjectStorage storage)
            throws IOException, ConfigurationException {

        boolean storagePropExisted = false;

        PropertiesConfiguration targetConfig = ConfigurationUtil.createEmptyConfig();

        // if storage.prop exists in the given storage, load its data
        Optional<ObjectRecord> record = storage.getObject(STORAGE_PROP, null);
        if (record.isPresent()) {
            storagePropExisted = true;
            FileHandler handler = new FileHandler(targetConfig);
            try (InputStream content = record.get().getLocation().readContent()) {
                handler.load(content);
            }
        }

        // merge supplied configuration into targetConfig
        configuration.getKeys().forEachRemaining(key -> targetConfig.setProperty(key, configuration.getProperty(key)));
    
        writeConfigurationInternal(targetConfig, storage);

        return storagePropExisted;
    }

    /**
     * Read the current <i>storage.prop</i> configuration from the provided storage.
     * 
     * @param storage
     * @return the optioanl {@link Configuration}
     * @throws IOException
     * @throws ConfigurationException
     */
    public static Optional<Configuration> currentConfiguration(ObjectStorage storage) throws IOException, ConfigurationException {
     

        Optional<ObjectRecord> record = storage.getObject(STORAGE_PROP, null);
        if (record.isEmpty()) {
            return Optional.empty();
        }

        PropertiesConfiguration targetConfig = ConfigurationUtil.createEmptyConfig();
            
        FileHandler handler = new FileHandler(targetConfig);
        try (InputStream content = record.get().getLocation().readContent()) {
            handler.load(content);
        }
        
        return Optional.of(targetConfig);
    }
    
    /**
     * Write the given configuration to <i>storage.prop</i> in the provided storage
     * and potentially override existing files.
     * 
     * @param configuration
     * @param storage
     * @throws IOException
     * @throws ConfigurationException
     */
    public static void writeStorageConfig(Configuration configuration, ObjectStorage storage) throws IOException, ConfigurationException {
        
        PropertiesConfiguration targetConfig;
        if (configuration instanceof PropertiesConfiguration) {
            targetConfig = (PropertiesConfiguration) configuration;
        } else {
            targetConfig = ConfigurationUtil.createEmptyConfig();
            configuration.getKeys()
                    .forEachRemaining(key -> targetConfig.setProperty(key, configuration.getProperty(key)));
        }
        
        writeConfigurationInternal(targetConfig, storage);
    }

    protected static void writeConfigurationInternal(PropertiesConfiguration configuration, ObjectStorage storage)
            throws IOException, ConfigurationException {
        
        try (ByteArrayOutputStream content = new ByteArrayOutputStream()) {
            FileHandler handler = new FileHandler(configuration);
            handler.save(content);
            storage.appendObject(
                    STORAGE_PROP,
                ObjectMetadataBuilder.defaultMetadata().build(),
                content.toInputStream(),
                content.size()
            );
        }
    }
}
