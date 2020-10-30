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
package com.metaphacts.services.storage.api;

import javax.validation.constraints.NotNull;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Represents a stack of registered {@link ObjectStorage} instances in fixed override order.
 */
public interface PlatformStorage {
    String DEVELOPMENT_RUNTIME_STORAGE_KEY = "runtime";

    PathMapping getPathMapping();

    /**
     * Creates and returns default metadata for current user (determined from thread context).
     */
    ObjectMetadata getDefaultMetadata();

    /**
     * Searches registered storage instances for given object in reverse override order,
     * e.g. [overrideN, overrideN-1, ..., base], and returns the first match.
     */
    Optional<FindResult> findObject(StoragePath path) throws StorageException;

    /**
     * @return object results in override order, e.g. [base, override1, override2, ...]
     */
    List<FindResult> findOverrides(StoragePath path) throws StorageException;

    /**
     * Searches registered storage instances for all objects matching specified path prefix;
     * and returns first match for each object path using the same semantics
     * as {@link #findObject(StoragePath)}.
     *
     * @return map [object path -> find result]
     */
    Map<StoragePath, FindResult> findAll(StoragePath prefix) throws StorageException;

    /**
     * Returns storage instance with specified ID.
     * @throws IllegalArgumentException when storage with specified ID does not exists
     */
    @NotNull
    ObjectStorage getStorage(String appId);

    /**
     * Returns a list of all registered storage instances in override order, e.g.
     * [base, override1, override2, ...]
     */
    List<String> getOverrideOrder();

    /**
     * Returns a list of registered storage instances for specified object kind.
     * @return storage status list in override order, e.g. [base, override1, override2, ...]
     */
    List<StorageStatus> getStorageStatusFor(StoragePath prefix);

    class FindResult {
        private final String appId;
        private final ObjectRecord record;

        public FindResult(String appId, ObjectRecord record) {
            this.appId = appId;
            this.record = record;
        }

        public String getAppId() {
            return appId;
        }

        public ObjectRecord getRecord() {
            return record;
        }
    }

    class StorageStatus {
        private final String appId;
        private final boolean writable;

        public StorageStatus(String appId, boolean writable) {
            this.appId = appId;
            this.writable = writable;
        }

        public String getAppId() {
            return appId;
        }

        public boolean isWritable() {
            return writable;
        }
    }
}
