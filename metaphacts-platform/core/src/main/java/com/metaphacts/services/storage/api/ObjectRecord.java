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

/**
 * Represents a reference to existing object at {@link ObjectStorage} with
 * <ul>
 *   <li>object identity information (kind, ID and revision);</li>
 *   <li>metadata ({@link #getMetadata()});</li>
 *   <li>handle to fetch it's content ({@link #getLocation()}).</li>
 * </ul>
 */
public final class ObjectRecord {
    private StorageLocation location;
    private StoragePath path;
    private String revision;
    private ObjectMetadata metadata;

    public ObjectRecord(
        StorageLocation location,
        StoragePath path,
        String revision,
        ObjectMetadata metadata
    ) {
        this.location = location;
        this.path = path;
        this.revision = revision;
        this.metadata = metadata;
    }

    public StorageLocation getLocation() {
        return location;
    }

    public StoragePath getPath() {
        return path;
    }

    public String getRevision() {
        return revision;
    }

    public ObjectMetadata getMetadata() {
        return metadata;
    }
}
