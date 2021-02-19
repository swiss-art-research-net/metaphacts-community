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
package com.metaphacts.junit;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import javax.validation.constraints.NotNull;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import com.google.common.collect.ImmutableList;
import com.google.common.collect.Lists;
import com.metaphacts.services.storage.api.ObjectMetadata;
import com.metaphacts.services.storage.api.ObjectRecord;
import com.metaphacts.services.storage.api.ObjectStorage;
import com.metaphacts.services.storage.api.PathMapping;
import com.metaphacts.services.storage.api.PlatformStorage;
import com.metaphacts.services.storage.api.StorageConfigException;
import com.metaphacts.services.storage.api.StorageException;
import com.metaphacts.services.storage.api.StoragePath;
import com.metaphacts.services.storage.file.InMemoryStorage;

public class TestPlatformStorage implements PlatformStorage {

    private static final Logger logger = LogManager.getLogger(TestPlatformStorage.class);

    public static final String STORAGE_ID = PlatformStorage.DEVELOPMENT_RUNTIME_STORAGE_KEY;

    private final PathMapping paths = new PathMapping.Default();

    private Map<String, ObjectStorage> storages = new HashMap<>();
    private List<String> searchOrder;

    public TestPlatformStorage() {
        storages.put(STORAGE_ID, new InMemoryStorage());
        searchOrder = ImmutableList.of(STORAGE_ID);
    }

    public ObjectStorage getMainStorage() {
        return storages.get(STORAGE_ID);
    }

    public void reset() {
        storages.put(STORAGE_ID, new InMemoryStorage());
    }

    public void addStorage(String storageId) {
        addStorage(storageId, new InMemoryStorage());
    }

    public void addStorage(String storageId, ObjectStorage storage) {
        storages.put(storageId, storage);
        if (!searchOrder.contains(storageId)) {
            searchOrder = Lists.newArrayList(searchOrder);
            searchOrder.add(storageId);
        }
    }

    @Override
    public PathMapping getPathMapping() {
        return paths;
    }

    @Override
    public ObjectMetadata getDefaultMetadata() {
        return new ObjectMetadata(null, null);
    }

    @Override
    public Optional<PlatformStorage.FindResult> findObject(StoragePath path) throws StorageException {
        for (String appId : searchOrder) {
            ObjectStorage storage = storages.get(appId);
            Optional<ObjectRecord> record = storage.getObject(path, null);
            if (record.isPresent()) {
                return Optional.of(new PlatformStorage.FindResult(appId, record.get()));
            }
        }
        return Optional.empty();
    }

    @Override
    public Map<StoragePath, PlatformStorage.FindResult> findAll(StoragePath prefix) throws StorageException {
        Map<StoragePath, PlatformStorage.FindResult> results = new HashMap<>();
        for (String appId : searchOrder) {
            ObjectStorage storage = storages.get(appId);
            storage.getAllObjects(prefix).forEach(record -> {
                results.put(record.getPath(), new PlatformStorage.FindResult(appId, record));
            });
        }
        return results;
    }

    @Override
    public List<FindResult> findOverrides(StoragePath path) throws StorageException {
        List<FindResult> overrides = new ArrayList<>();
        for (String appId : getOverrideOrder()) {
            ObjectStorage storage = storages.get(appId);
            storage.getObject(path, null).ifPresent(record -> {
                overrides.add(new PlatformStorage.FindResult(appId, record));
            });
        }
        return overrides;
    }

    @NotNull
    @Override
    public ObjectStorage getStorage(String appId) {
        ObjectStorage storage = storages.get(appId);
        if (storage == null) {
            throw new IllegalArgumentException("Cannot get storage for unknown appId = \"" + appId + "\"");
        }
        return storage;
    }

    @Override
    public List<String> getOverrideOrder() {
        return Lists.reverse(searchOrder);
    }

    @Override
    public List<PlatformStorage.StorageStatus> getStorageStatusFor(StoragePath prefix) {
        return ImmutableList.of(
            new PlatformStorage.StorageStatus(STORAGE_ID, true)
        );
    }

    @Override
    public void refreshDynamicStorages() throws StorageConfigException, StorageException {
        logger.warn("Refreshing dynamic storages is not implemented in TestPlatformStorage");
    }
}
