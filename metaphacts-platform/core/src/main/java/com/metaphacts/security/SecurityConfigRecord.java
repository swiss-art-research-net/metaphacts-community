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

package com.metaphacts.security;

import com.metaphacts.services.storage.api.ObjectKind;
import com.metaphacts.services.storage.api.ObjectRecord;
import com.metaphacts.services.storage.api.ObjectStorage;
import com.metaphacts.services.storage.api.PlatformStorage;
import org.apache.commons.io.IOUtils;
import org.apache.shiro.config.Ini;

import java.io.*;
import java.nio.channels.FileLock;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;

/**
 * Represents information about security config file location and methods to read/write it.
 */
public abstract class SecurityConfigRecord {
    private final SecurityConfigType type;

    public SecurityConfigRecord(SecurityConfigType type) {
        this.type = type;
    }

    public SecurityConfigType getType() {
        return type;
    }

    /**
     * @return human-readable description of how to access the config file
     */
    public abstract String getLocationDescription();

    /**
     * @return whether the file config exists
     */
    public abstract boolean exists();

    /**
     * Opens a stream to read the config file contents.
     * <p>The returned stream is required to be closed by the caller.</p>
     */
    public abstract InputStream readStream() throws IOException;

    /**
     * Writes specified content to the config file.
     */
    public abstract void writeAll(String entireContent) throws IOException;

    public static SecurityConfigRecord fromFilesystem(SecurityConfigType type, Path path) {
        return new SecurityConfigRecord(type) {
            @Override
            public String getLocationDescription() {
                return "file at path: " + path.toAbsolutePath().toString();
            }

            @Override
            public boolean exists() {
                return Files.exists(path);
            }

            @Override
            public InputStream readStream() throws IOException {
                return new FileInputStream(path.toFile());
            }

            @Override
            public void writeAll(String entireContent) throws IOException {
                try (FileOutputStream fos = new FileOutputStream(path.toFile())) {
                    try (FileLock lock = fos.getChannel().lock()) {
                        IOUtils.write(entireContent, fos, StandardCharsets.UTF_8);
                    }
                }
            }
        };
    }

    public static SecurityConfigRecord fromStorage(
        SecurityConfigType type, PlatformStorage platformStorage, String storageId
    ) {
        ObjectStorage configStorage = platformStorage.getStorage(storageId);
        String objectId = type.getFileName();
        return new SecurityConfigRecord(type) {
            @Override
            public String getLocationDescription() {
                return String.format(
                    "storage '%s' at path: %s", storageId, objectId);
            }

            @Override
            public boolean exists() {
                try {
                    return fetchRecord().isPresent();
                } catch (IOException e) {
                    throw new RuntimeException(e);
                }
            }

            @Override
            public InputStream readStream() throws IOException {
                return fetchRecord()
                    .orElseThrow(() -> new IOException(
                        "Security config file not found in " + getLocationDescription()))
                    .getLocation().readContent();
            }

            @Override
            public void writeAll(String entireContent) throws IOException {
                byte[] bytes = entireContent.getBytes();
                configStorage.appendObject(
                    ObjectKind.CONFIG,
                    objectId,
                    platformStorage.getDefaultMetadata(),
                    new ByteArrayInputStream(bytes),
                    bytes.length
                );
            }

            private Optional<ObjectRecord> fetchRecord() throws IOException {
                return configStorage.getObject(ObjectKind.CONFIG, objectId, null);
            }
        };
    }

    public static Ini readIni(SecurityConfigRecord record) {
        try (InputStream stream = record.readStream()) {
            Ini ini = new Ini();
            ini.load(stream);
            return ini;
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }
}
