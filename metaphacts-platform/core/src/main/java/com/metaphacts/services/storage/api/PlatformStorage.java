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
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Represents a stack of registered {@link ObjectStorage} implementations in fixed override order.
 */
public interface PlatformStorage {
    String DEVELOPMENT_RUNTIME_STORAGE_KEY = "runtime";

    PathMapping getPathMapping();

    /**
     * Creates and returns default metadata for current user (determined from thread context).
     */
    ObjectMetadata getDefaultMetadata();

    /**
     * Searches registered storage implementations for given object in reverse override order,
     * e.g. [overrideN, overrideN-1, ..., base], and returns the first match.
     */
    Optional<FindResult> findObject(ObjectKind kind, String objectId) throws StorageException;

    /**
     * @return object results in override order, e.g. [base, override1, override2, ...]
     */
    List<FindResult> findOverrides(ObjectKind kind, String objectId) throws StorageException;

    /**
     * Searches registered storage implementations for all objects of specified type and
     * matching specified object ID prefix; and returns first match for each object ID
     * using the same semantics as {@link #findObject(ObjectKind, String)}.
     *
     * @return map [objectId -> find result]
     */
    Map<String, FindResult> findAll(ObjectKind kind, String idPrefix) throws StorageException;

    @NotNull
    ObjectStorage getStorage(String appId);

    /**
     * Returns a list of registered storage implementations for specified object kind.
     * @return storage status list in override order, e.g. [base, override1, override2, ...]
     */
    List<StorageStatus> getStorageStatusFor(ObjectKind kind);

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
