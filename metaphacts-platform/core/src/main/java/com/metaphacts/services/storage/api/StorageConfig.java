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

import javax.validation.constraints.NotNull;

import org.apache.commons.lang3.StringUtils;

/**
 * Abstract representation of a storage configuration. Specializations may extend it and implement
 * own validation logic in {@link #validate()}, which will be called on {@link #performValidation()}.
 * 
 * Please note that the {@link #setStorageType(String)} is supposed to be called externally after
 * the initialization through the constructor, i.e.in principle it is possible to use the same
 * storage configuration for instantiation of different storage {@link ObjectStorage}
 * implementations through respective {@link StorageFactory}s.
 * 
 * @author Alexey Morozov
 * @author Johannes Trame <jt@metaphacts.com>
 *
 */
public abstract class StorageConfig {
    private String storageType;

    protected String storageId;
    protected boolean mutable = false;
    protected String root;

    /**
     * Creates a read-only storage config.
     * 
     * <b>If you this constructor, you should call {@link #setStorageType(String)} externally</b>.
     * @param storageId
     */
    public StorageConfig(@NotNull String storageId) {
        this.storageId = storageId;
    }

    /**
     * Creates a read-only storage config.
     * @param storageId
     * @param storageType
     */
    public StorageConfig(@NotNull String storageId,@NotNull String storageType) {
        this.storageId = storageId;
        this.storageType = storageType;
    }

    public abstract ObjectStorage createStorage(StorageCreationParams params);
    
    /**
     * Returns a key to identify the type of storage that can be instantiated with this
     * configuration.
     * 
     * @return
     */
    public String getStorageType(){
        return this.storageType;
    }

    /**
     * Triggers validation and is supposed to be called externally. Asserts that all mandatory
     * fields like {@link StorageConfig#storageId} and {@link StorageConfig#storageType} are set.
     * Also calls storage specific validation {@link StorageConfig#validate()}.
     * 
     * @throws StorageConfigException
     */
    public void performValidation() throws StorageConfigException{
        if (StringUtils.isEmpty(this.storageType)) {
            throw new RuntimeException("'storageType' must not be null or an empty string.");
        }
        if (StringUtils.isEmpty(this.storageId)) {
            throw new RuntimeException("'storageId' must not be null or an empty string.");
        }
        this.validate();
    }

    /**
     * Storage specific configuration validation logic. Will be called in
     * {@link AbstractStorageFactory} to validate, whether after the initialization from
     * configuration properties the storage config is consistent and valid.
     * 
     * @throws StorageConfigException
     */
    protected abstract void validate();

    public void setStorageType(String storageType) {
        this.storageType = storageType;
    }

    public void setStorageId(String storageId) {
        this.storageId = storageId;
    }

    public void setMutable(boolean mutable) {
        this.mutable = mutable;
    }

    public boolean isMutable() {
        return this.mutable;
    }

    public void setRoot(String root) {
        this.root = root;
    }
    
    public String getStorageId() {
        return storageId;
    }

    public String getRoot() {
        return root;
    }

}
