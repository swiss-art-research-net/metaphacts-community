/*
 * Copyright (C) 2015-2019, metaphacts GmbH
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

import java.lang.reflect.InvocationTargetException;
import java.util.Map;

import org.apache.commons.beanutils.BeanUtils;
import org.apache.commons.configuration2.Configuration;
import org.apache.commons.configuration2.ConfigurationConverter;

import com.google.common.collect.Maps;

/**
 * @author Johannes Trame <jt@metaphacts.com>
 *
 */
public abstract class AbstractStorageFactory implements StorageFactory {

    protected abstract StorageConfig getConfig(String storageId);

    /* (non-Javadoc)
     * @see com.metaphacts.services.storage.api.StorageFactory#getStorageConfigFromProperties(java.lang.String, org.apache.commons.configuration2.Configuration)
     */
    public StorageConfig getStorageConfigFromProperties(String storageId, String storageType, Configuration properties) throws StorageConfigException{
        StorageConfig storageConfig = getConfig(storageId);
        storageConfig.setStorageType(storageType);
        Map<String, Object> map = Maps.newHashMap();
        ConfigurationConverter.getMap(properties).entrySet()
                .forEach(entry -> map.put((String) entry.getKey(), entry.getValue()));
        try {
            BeanUtils.copyProperties(storageConfig, map);
        } catch (IllegalAccessException | InvocationTargetException e) {
            throw new StorageConfigException(e);
        }
        // validate the configuration
        storageConfig.performValidation();
        return storageConfig;
    }
}
