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

package com.metaphacts.services.storage.file;

import com.metaphacts.services.storage.api.AbstractStorageFactory;
import com.metaphacts.services.storage.api.ObjectStorage;
import com.metaphacts.services.storage.api.StorageConfig;
import com.metaphacts.services.storage.api.StorageConfigException;
import com.metaphacts.services.storage.api.StorageCreationParams;

/**
 * @author Johannes Trame <jt@metaphacts.com>
 *
 */
public class ClassPathStorageFactory extends AbstractStorageFactory{
    public final static String STORAGE_TYPE="classpath";
    @Override
    public String getStorageType() {
        return ClassPathStorageFactory.STORAGE_TYPE;
    }

    @Override
    public ObjectStorage getStorage(StorageConfig config, StorageCreationParams creationParams) throws StorageConfigException {
        return config.createStorage(creationParams);
    }

    @Override
    public StorageConfig getConfig(String storageId) {
        return new ClassPathStorage.Config(storageId, STORAGE_TYPE);
    }

}
