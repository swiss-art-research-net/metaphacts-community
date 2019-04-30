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
import com.metaphacts.services.storage.api.ObjectKind;
import com.metaphacts.services.storage.api.ObjectMetadata;
import com.metaphacts.services.storage.api.ObjectRecord;
import com.metaphacts.services.storage.api.ObjectStorage;
import com.metaphacts.services.storage.api.PathMapping;
import com.metaphacts.services.storage.api.StorageConfig;
import com.metaphacts.services.storage.api.StorageCreationParams;
import com.metaphacts.services.storage.api.StorageException;
import com.metaphacts.services.storage.api.StorageLocation;

public class NonVersionedFileStorage implements ObjectStorage {
    private static final String FIXED_REVISION = "";

    private final PathMapping paths;
    private final Config config;

    public NonVersionedFileStorage(PathMapping paths, Config config) {
        this.paths = paths;
        this.config = config;
    }

    public static final class Config extends StorageConfig {
        private Path rootPath;

        public Config(String storageId) {
            super(storageId);
        }

        public Config(String storageId, String storageType) {
            super(storageId, storageType);
        }

        public Config(String storageId, Path rootPath) {
            super(storageId);
            this.rootPath = rootPath;
        }

        public Path getRootPath() {
            // may consider to generalize it in the future for any storage type and move it 
            // to MainPlatformStorage.addStorageFromConfig (c.f. also constructor of S3VersionedStorage)
            return this.rootPath != null ? this.rootPath : this.root != null ? new File(this.root).toPath() :null;
        }

        @Override
        public NonVersionedFileStorage createStorage(StorageCreationParams params) {
            return new NonVersionedFileStorage(params.getPathMapping(), this);
        }

		@Override
		protected void validate() {
			if (getRoot() == null) {
                throw new RuntimeException("Missing 'root' property for non-versioned file storage '"+ this.storageId);
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
    }

    @Override
    public boolean isMutable() {
        return config.isMutable();
    }

    @Override
    public Optional<ObjectRecord> getObject(ObjectKind kind, String id, @Nullable String revision) throws StorageException {
        if (revision != null && !revision.equals(FIXED_REVISION)) {
            return Optional.empty();
        }

        Optional<Path> mappedPath = getObjectFile(kind, id);
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

        StorageLocation key = new DirectStorageLocation(objectFile);
        ObjectMetadata metadata = new ObjectMetadata(null, creationDate);
        return Optional.of(
            new ObjectRecord(key, kind, id, FIXED_REVISION, metadata)
        );
    }

    @Override
    public List<ObjectRecord> getRevisions(ObjectKind kind, String id) throws StorageException {
        return getObject(kind, id, null).map(ImmutableList::of).orElse(ImmutableList.of());
    }

    @Override
    public List<ObjectRecord> getAllObjects(ObjectKind kind, String idPrefix) throws StorageException {
        Path objectFolder = fileFromStoragePath(paths.getPathPrefix(kind));

        List<String> objectIds;
        try (Stream<Path> paths = Files.walk(objectFolder)) {
            objectIds = paths
                .flatMap(objectPath ->
                    objectIdFromFile(kind, objectPath)
                        .map(Stream::of).orElseGet(Stream::empty)
                )
                .filter(id -> id.startsWith(idPrefix))
                .collect(toList());
        } catch (NoSuchFileException e) {
            return ImmutableList.of();
        } catch (IOException e) {
            throw new StorageException("Failed to list directory: " + objectFolder, e);
        }

        List<ObjectRecord> objects = new ArrayList<>();
        for (String objectId : objectIds) {
            getObject(kind, objectId, null).ifPresent(object -> {
                objects.add(object);
            });
        }
        return objects;
    }

    @Override
    public ObjectRecord appendObject(
        ObjectKind kind,
        String id,
        ObjectMetadata metadata,
        InputStream content,
        @Nullable Integer contentLength
    ) throws StorageException {
        StorageUtils.throwIfNonMutable(isMutable());
        Path objectPath = getObjectFile(kind, id).orElseThrow(() ->
            new StorageException(String.format("Cannot map object ID to path: %s at %s", kind, id)));
        try {
            Files.createDirectories(objectPath.getParent());
            Files.copy(content, objectPath, StandardCopyOption.REPLACE_EXISTING);
            StorageLocation key = new DirectStorageLocation(objectPath);
            ObjectMetadata createdMetadata = new ObjectMetadata(
                metadata.getAuthor(),
                getLastModified(objectPath)
            );
            return new ObjectRecord(key, kind, id, FIXED_REVISION, createdMetadata);
        } catch (IOException e) {
            throw new StorageException(e);
        }
    }

    @Override
    public void deleteObject(ObjectKind kind, String id) throws StorageException {
        StorageUtils.throwIfNonMutable(isMutable());
        Path objectFile = getObjectFile(kind, id).orElseThrow(() ->
            new StorageException(String.format("Cannot map object ID to path: %s at %s", kind, id)));
        try {
            Files.deleteIfExists(objectFile);
        } catch (IOException e) {
            throw new StorageException("Failed to delete file: " + objectFile, e);
        }
    }

    private Instant getLastModified(Path file) throws IOException {
        return Files.getLastModifiedTime(file).toInstant();
    }

    private Optional<Path> getObjectFile(ObjectKind kind, String id) {
        return paths.pathForObjectId(kind, id)
            .map(this::fileFromStoragePath)
            .map(Path::normalize);
    }

    private Optional<String> objectIdFromFile(ObjectKind kind, Path file) {
        return storagePathFromFile(file)
            .flatMap(storagePath -> paths.objectIdFromPath(kind, storagePath));
    }

    private Path fileFromStoragePath(String storagePath) {
        PathMapping.throwIfNonCanonical(storagePath);
        return config.getRootPath().resolve(storagePath.replace(PathMapping.SEPARATOR, File.separator));
    }

    private Optional<String> storagePathFromFile(Path file) {
        String absolutePath = file.toString();
        String absoluteBase = config.getRootPath().toString();
        if (!absolutePath.startsWith(absoluteBase)) {
            return Optional.empty();
        }
        String relativeFilePath = absolutePath.substring(absoluteBase.length());
        String storagePath = StringUtils.removeStart(
            relativeFilePath.replace(File.separator, PathMapping.SEPARATOR),
            PathMapping.SEPARATOR
        );
        return Optional.of(storagePath);
    }
}
