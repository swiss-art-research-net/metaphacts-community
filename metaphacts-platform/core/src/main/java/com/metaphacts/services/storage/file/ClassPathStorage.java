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

import io.github.classgraph.ClassGraph;
import io.github.classgraph.Resource;
import io.github.classgraph.ScanResult;

import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.net.URLConnection;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import javax.annotation.Nullable;

import org.apache.commons.lang.StringUtils;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import com.google.common.collect.ImmutableList;
import com.metaphacts.services.storage.api.ObjectKind;
import com.metaphacts.services.storage.api.ObjectMetadata;
import com.metaphacts.services.storage.api.ObjectRecord;
import com.metaphacts.services.storage.api.ObjectStorage;
import com.metaphacts.services.storage.api.PathMapping;
import com.metaphacts.services.storage.api.SizedStream;
import com.metaphacts.services.storage.api.StorageConfig;
import com.metaphacts.services.storage.api.StorageCreationParams;
import com.metaphacts.services.storage.api.StorageException;
import com.metaphacts.services.storage.api.StorageLocation;

public class ClassPathStorage implements ObjectStorage {
    private static final Logger logger = LogManager.getLogger(ClassPathStorage.class);
    
    private static final String FIXED_REVISION = "";

    private final PathMapping paths;
    private final ClassLoader classLoader;
    private final String baseClasspathFolder;

    public ClassPathStorage(PathMapping paths, ClassLoader classLoader, Config config) {
        this.paths = paths;
        this.classLoader = classLoader;
        this.baseClasspathFolder = StringUtils.strip(config.getRoot(), "/");
    }

    public static class Config extends StorageConfig {
        public Config(String storageId) {
            super(storageId);
        }

        public Config(String storageId, String storageType) {
            super(storageId, storageType);
        }

        @Override
        public ClassPathStorage createStorage(StorageCreationParams params) {
            return new ClassPathStorage(params.getPathMapping(), params.getClassLoader(), this);
        }

        @Override
        protected void validate() {
        }
    }

    private class ClassPathStorageLocation implements StorageLocation {
        private URL classPathLocation;

        public ClassPathStorageLocation(URL classPathLocation) {
            this.classPathLocation = classPathLocation;
        }

        @Override
        public ObjectStorage getStorage() {
            return ClassPathStorage.this;
        }

        @Override
        public InputStream readContent() throws IOException {
            return classPathLocation.openStream();
        }

        @Override
        public SizedStream readSizedContent() throws IOException {
            URLConnection connection = classPathLocation.openConnection();
            long contentLength = connection.getContentLength();
            return new SizedStream(connection.getInputStream(), contentLength);
        }
    }

    @Override
    public boolean isMutable() {
        return false;
    }

    @Override
    public Optional<ObjectRecord> getObject(ObjectKind kind, String id, @Nullable String revision) throws StorageException {
        if (revision != null && !revision.equals(FIXED_REVISION)) {
            return Optional.empty();
        }

        Optional<String> resourcePath = getObjectResourcePath(kind, id);
        if (!resourcePath.isPresent()) {
            return Optional.empty();
        }

        URL resource = classLoader.getResource(resourcePath.get());
        if (resource == null) {
            return Optional.empty();
        }

        StorageLocation key = new ClassPathStorageLocation(resource);
        return Optional.of(
            new ObjectRecord(key, kind, id, FIXED_REVISION, ObjectMetadata.empty())
        );
    }

    @Override
    public List<ObjectRecord> getRevisions(ObjectKind kind, String id) throws StorageException {
        return getObject(kind, id, null).map(ImmutableList::of).orElse(ImmutableList.of());
    }

    @Override
    public List<ObjectRecord> getAllObjects(ObjectKind kind, String idPrefix) throws StorageException {
        String basePrefix = baseClasspathFolder + PathMapping.SEPARATOR;
        String fullPrefix = basePrefix + paths.getPathPrefix(kind);

        String packageToSearch = resourceFolderPathToPackageName(fullPrefix);
        ClassGraph classGraph = new ClassGraph()
            .addClassLoader(classLoader)
            .whitelistPackages(packageToSearch);

        List<String> objectIds = new ArrayList<>();
        try (ScanResult scanResult = classGraph.scan()) {
            for (Resource resource : scanResult.getAllResources()) {
                // returns something like "com/metaphacts/etc/Foo.ext"
                String absolutePath = resource.getPath();
                if (absolutePath.startsWith(basePrefix)) {
                    String relativePath = absolutePath.substring(basePrefix.length());
                    paths.objectIdFromPath(kind, relativePath).ifPresent(id -> {
                        if (id.startsWith(idPrefix)) {
                            objectIds.add(id);
                        }
                    });
                }
            }
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
        throw new StorageException("appendObject is not supported by ClassPathStorage");
    }

    @Override
    public void deleteObject(ObjectKind kind, String id) throws StorageException {
        throw new StorageException("deleteObject is not supported by ClassPathStorage");
    }

    private Optional<String> getObjectResourcePath(ObjectKind kind, String id) {
        PathMapping.throwIfNonCanonical(id);
        return paths.pathForObjectId(kind, id)
            .map(objectPath -> baseClasspathFolder + "/" + objectPath);
    }

    private static String resourceFolderPathToPackageName(String resourcePath) {
        return StringUtils.strip(resourcePath, "/").replace("/", ".");
    }
}
