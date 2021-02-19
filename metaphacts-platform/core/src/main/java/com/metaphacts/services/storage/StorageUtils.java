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
package com.metaphacts.services.storage;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;

import org.apache.commons.io.IOUtils;
import org.apache.shiro.SecurityUtils;
import org.apache.shiro.subject.Subject;

import com.metaphacts.config.Configuration;
import com.metaphacts.security.SecurityService;
import com.metaphacts.services.storage.api.ObjectRecord;
import com.metaphacts.services.storage.api.StorageException;

public final class StorageUtils {
    private StorageUtils() {}

    public static String readTextContent(ObjectRecord record) throws IOException {
        try (InputStream content = record.getLocation().readContent()) {
            return IOUtils.toString(content, StandardCharsets.UTF_8);
        }
    }

    /**
     * Get the user name of the currently authenticated user.
     * <p>
     * If there is no user session, this method returns {@link Optional#empty()}.
     * </p>
     * 
     * @return the current user name or {@link Optional#empty()}
     * @see SecurityService#getUserName()
     */
    public static Optional<String> currentUsername() {
        Subject subject = SecurityUtils.getSubject();
        if (subject == null) {
            return Optional.empty();
        }
        return Optional.of(SecurityService.getUserName());
    }

    public static void throwIfNonMutable(boolean isMutable) throws StorageException {
        if (!isMutable) {
            throw new StorageException("Cannot write to read-only storage");
        }
    }

    /**
     * Create the folder in the given location.
     * <p>
     * The location must be a sub-directory of
     * {@link Configuration#getStorageDirectory()}, otherwise a
     * {@link StorageException} is thrown.
     * </p>
     * <p>
     * This method is a no-op if location is pointing to an already existing
     * directory.
     * </p>
     * 
     * @param location the location
     * @throws StorageException if the folder is not allowed to be created
     */
    public static void mkdirs(Path location) throws StorageException {

        if (Files.isDirectory(location)) {
            return;
        }

        if (!isInStorageDirectory(location)) {
            throw new StorageException(
                    "Cannot create folder at " + location + ": not a sub directory of "
                            + Configuration.getStorageDirectory());
        }
        try {
            Files.createDirectories(location);
        } catch (IOException e) {
            throw new StorageException("Cannot create folder at " + location + ": " + e.getMessage(), e);
        }
    }

    /**
     * Returns true if the given location is the same or a sub path of storage
     * directory.
     * 
     * @param parent
     * @param location
     * @return
     * @see #isSameOrSubpath(Path, Path)
     */
    public static boolean isInStorageDirectory(Path location) {
        Path storageLocation = Path.of(Configuration.getStorageDirectory());
        return isSameOrSubpath(storageLocation, location);
    }

    /**
     * Returns true if the given location is the same or a sub path of the parent as
     * defined by {@link Path#startsWith(Path)}.
     * 
     * @param parent
     * @param location
     * @return
     */
    public static boolean isSameOrSubpath(Path parent, Path location) {
        Path normalizedLocation = location.normalize();
        Path normalizedParent = parent.normalize();
        return normalizedLocation.startsWith(normalizedParent);
    }

}
