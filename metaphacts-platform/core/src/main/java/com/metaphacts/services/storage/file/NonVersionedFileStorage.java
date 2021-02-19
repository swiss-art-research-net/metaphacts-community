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
package com.metaphacts.services.storage.file;

import static java.util.stream.Collectors.toList;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

import javax.annotation.Nullable;

import org.apache.commons.lang.StringUtils;

import com.google.common.collect.ImmutableList;
import com.metaphacts.services.storage.StorageUtils;
import com.metaphacts.services.storage.api.ObjectMetadata;
import com.metaphacts.services.storage.api.ObjectRecord;
import com.metaphacts.services.storage.api.ObjectStorage;
import com.metaphacts.services.storage.api.PathMapping;
import com.metaphacts.services.storage.api.SizedStream;
import com.metaphacts.services.storage.api.StorageConfig;
import com.metaphacts.services.storage.api.StorageConfigException;
import com.metaphacts.services.storage.api.StorageException;
import com.metaphacts.services.storage.api.StorageLocation;
import com.metaphacts.services.storage.api.StoragePath;

public class NonVersionedFileStorage implements ObjectStorage {
    public final static String STORAGE_TYPE = "nonVersionedFile";

    private final PathMapping paths;
    private final Config config;

    public NonVersionedFileStorage(PathMapping paths, Config config) {
        this.paths = paths;
        this.config = config;
    }

    public static final class Config extends StorageConfig {
        private Path root;

        public Config() {}

        public Config(Path root) {
            this.root = root;
        }

        @Override
        public String getStorageType() {
            return STORAGE_TYPE;
        }

        public Path getRoot() {
            return root;
        }

        public void setRoot(Path root) {
            this.root = root;
        }


        @Override
        protected void validate() throws StorageConfigException {
            super.validate();
            if (getRoot() == null) {
                throw new StorageConfigException("Missing required property 'root'");
            }
            if (!getRoot().isAbsolute()) {
                throw new StorageConfigException("'root' path must be absolute: '" + getRoot() + "'");
            }
            // the directory must already exist or must be inside the storage directory
            // (where it can get created on the fly)
            if (!Files.isDirectory(getRoot())) {
                if (!StorageUtils.isInStorageDirectory(getRoot())) {
                    throw new StorageConfigException(
                            "'root' path does not exists or not a permitted directory: '" + getRoot() + "'");
                }
            }
        }
    }

    private class DirectStorageLocation implements StorageLocation {
        public final Path objectFile;

        public DirectStorageLocation(Path objectFile) {
            this.objectFile = objectFile;
        }

        @Override
        public ObjectStorage getStorage() {
            return NonVersionedFileStorage.this;
        }

        @Override
        public InputStream readContent() throws IOException {
            return new FileInputStream(objectFile.toFile());
        }

        @Override
        public SizedStream readSizedContent() throws IOException {
            FileInputStream inputStream = new FileInputStream(objectFile.toFile());
            long size = inputStream.getChannel().size();
            return new SizedStream(inputStream, size);
        }
    }

    @Override
    public boolean isMutable() {
        return config.isMutable();
    }

    @Override
    public Optional<ObjectRecord> getObject(StoragePath path, @Nullable String revision) throws StorageException {
        Optional<Path> mappedPath = fileFromObjectPath(path);
        if (!mappedPath.isPresent()) {
            return Optional.empty();
        }

        Path objectFile = mappedPath.get();
        if (!Files.isRegularFile(objectFile)) {
            return Optional.empty();
        }

        Instant creationDate;
        try {
            creationDate = getLastModified(objectFile);
        } catch (NoSuchFileException e) {
            return Optional.empty();
        } catch (IOException e) {
            throw new StorageException("Failed to read last modified time for file: " + objectFile, e);
        }

        String foundRevision = revisionFromCreationDate(creationDate);
        if (revision != null && !foundRevision.equals(revision)) {
            return Optional.empty();
        }


        StorageLocation key = new DirectStorageLocation(objectFile);
        ObjectMetadata metadata = new ObjectMetadata(null, creationDate);
        return Optional.of(
            new ObjectRecord(key, path, foundRevision, metadata)
        );
    }

    private String revisionFromCreationDate(Instant date) {
        return String.valueOf(date.toEpochMilli());
    }

    @Override
    public List<ObjectRecord> getRevisions(StoragePath path) throws StorageException {
        return getObject(path, null).map(ImmutableList::of).orElse(ImmutableList.of());
    }

    @Override
    public List<ObjectRecord> getAllObjects(StoragePath prefix) throws StorageException {
        Optional<Path> mappedFolder = fileFromObjectPath(prefix);
        if (!mappedFolder.isPresent()) {
            return ImmutableList.of();
        }

        List<StoragePath> objectIds;
        try (Stream<Path> files = Files.walk(mappedFolder.get())) {
            objectIds = files
                .flatMap(file ->
                    objectPathFromFile(file)
                        .map(Stream::of).orElseGet(Stream::empty)
                )
                .filter(prefix::isPrefixOf)
                .collect(toList());
        } catch (NoSuchFileException e) {
            return ImmutableList.of();
        } catch (IOException e) {
            throw new StorageException("Failed to list directory: " + mappedFolder.get(), e);
        }

        List<ObjectRecord> objects = new ArrayList<>();
        for (StoragePath path : objectIds) {
            getObject(path, null).ifPresent(object -> {
                objects.add(object);
            });
        }
        return objects;
    }

    @Override
    public ObjectRecord appendObject(
        StoragePath path,
        ObjectMetadata metadata,
        InputStream content,
        long contentLength
    ) throws StorageException {
        StorageUtils.throwIfNonMutable(isMutable());
        Path objectPath = fileFromObjectPath(path).orElseThrow(() ->
            new StorageException(String.format("Cannot map object ID to path: %s", path)));
        try {
            Files.createDirectories(objectPath.getParent());
            Files.copy(content, objectPath, StandardCopyOption.REPLACE_EXISTING);
            StorageLocation key = new DirectStorageLocation(objectPath);

            Instant creationDate = getLastModified(objectPath);
            String foundRevision = revisionFromCreationDate(creationDate);

            ObjectMetadata createdMetadata = new ObjectMetadata(
                metadata.getAuthor(),
                creationDate
            );

            return new ObjectRecord(key, path, foundRevision, createdMetadata);
        } catch (IOException e) {
            throw new StorageException(e);
        }
    }

    @Override
    public void deleteObject(
        StoragePath path,
        ObjectMetadata metadata
    ) throws StorageException {
        StorageUtils.throwIfNonMutable(isMutable());
        Path objectFile = fileFromObjectPath(path).orElseThrow(() ->
            new StorageException(String.format("Cannot map object path to filesystem: %s", path)));
        try {
            Files.deleteIfExists(objectFile);
        } catch (IOException e) {
            throw new StorageException("Failed to delete file: " + objectFile, e);
        }
    }

    private Instant getLastModified(Path file) throws IOException {
        return Files.getLastModifiedTime(file).toInstant();
    }

    private Optional<Path> fileFromObjectPath(StoragePath path) {
        return paths.mapForward(path)
            .map(mapped -> {
                String filesystemSubPath = mapped.toString()
                    .replace(StoragePath.SEPARATOR, File.separator);
                return config.getRoot().resolve(filesystemSubPath);
            })
            .map(Path::normalize);
    }

    private Optional<StoragePath> objectPathFromFile(Path file) {
        String absolutePath = file.toString();
        String absoluteBase = config.getRoot().toString();
        if (!absolutePath.startsWith(absoluteBase)) {
            return Optional.empty();
        }
        String relativeFilePath = absolutePath.substring(absoluteBase.length());
        String storagePath = StringUtils.removeStart(
            relativeFilePath.replace(File.separator, StoragePath.SEPARATOR),
            StoragePath.SEPARATOR
        );
        return paths.mapBack(StoragePath.parse(storagePath));
    }
}
