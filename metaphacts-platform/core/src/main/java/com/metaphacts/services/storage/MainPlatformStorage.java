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

package com.metaphacts.services.storage;

import static java.util.stream.Collectors.toList;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import javax.inject.Inject;
import javax.validation.constraints.NotNull;

import org.apache.commons.configuration2.ex.ConfigurationException;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.common.collect.Lists;
import com.metaphacts.config.Configuration;
import com.metaphacts.plugin.PlatformPlugin;
import com.metaphacts.plugin.PlatformPluginManager;
import com.metaphacts.services.storage.api.ObjectKind;
import com.metaphacts.services.storage.api.ObjectMetadata;
import com.metaphacts.services.storage.api.ObjectRecord;
import com.metaphacts.services.storage.api.ObjectStorage;
import com.metaphacts.services.storage.api.PathMapping;
import com.metaphacts.services.storage.api.PlatformStorage;
import com.metaphacts.services.storage.api.StorageConfig;
import com.metaphacts.services.storage.api.StorageConfigException;
import com.metaphacts.services.storage.api.StorageConfigLoader;
import com.metaphacts.services.storage.api.StorageCreationParams;
import com.metaphacts.services.storage.api.StorageException;
import com.metaphacts.services.storage.api.StorageRegistry;
import com.metaphacts.services.storage.file.NonVersionedFileStorage;
import com.metaphacts.services.storage.file.NonVersionedFileStorage.Config;

/**
 * Main {@link PlatformStorage} implementation for the platform.
 */
public class MainPlatformStorage implements PlatformStorage {
    private static final Logger logger = LogManager.getLogger(MainPlatformStorage.class);

    private final Map<String, StorageDescription> storages = new LinkedHashMap<>();
    private final List<String> appSearchOrder = new ArrayList<>();

    private final PathMapping appPaths = new PathMapping.Default();

    private static class StorageDescription {
        public static final Set<ObjectKind> ALL_KINDS = ImmutableSet.copyOf(ObjectKind.values());

        public final String storageId;
        public final ObjectStorage storage;
        public final Set<ObjectKind> storedKinds;

        public StorageDescription(String storageId, ObjectStorage storage) {
            this(storageId, storage, ALL_KINDS);
        }

        public StorageDescription(String storageId, ObjectStorage storage, Set<ObjectKind> storedKinds) {
            this.storageId = storageId;
            this.storage = storage;
            this.storedKinds = storedKinds;
        }
    }

    @Inject
    public MainPlatformStorage(PlatformPluginManager pluginManager, StorageRegistry storageRegistry)
            throws ConfigurationException {
        StorageConfigLoader storageConfigLoader = new StorageConfigLoader(storageRegistry);
        LinkedHashMap<String, StorageConfig> internalConfigs = storageConfigLoader
            .readInternalStorageConfig(PlatformStorage.class.getClassLoader());
        internalConfigs.forEach((storageId, config) -> {
            logger.info("Adding internal storage {}:", storageId);
            addStorageFromConfig(storageRegistry, storageId, config);
        });

        List<PlatformPlugin> plugins = PlatformPluginManager
            .asPlatformPlugins(pluginManager.getPlugins());

        for (PlatformPlugin plugin : plugins) {
            String pluginId = plugin.getWrapper().getPluginId();
            Path pluginPath = plugin.getWrapper().getPluginPath();
            createFileStorageWithFallbacks(pluginId, pluginPath, false);
        }

        LinkedHashMap<String, StorageConfig> globalConfigs = storageConfigLoader.readSystemStorageConfig();
        for (Map.Entry<String, StorageConfig> entry : globalConfigs.entrySet()) {
            if (storages.containsKey(entry.getKey())) {
                logger.info("Overriding storage '" + entry.getKey() + "' by storage configuration:");
            }
            addStorageFromConfig(storageRegistry, entry.getKey(), entry.getValue());
        }

        if (!storages.containsKey(DEVELOPMENT_RUNTIME_STORAGE_KEY)) {
            Path runtimeFolder = Paths.get(Configuration.getRuntimeDirectory());
            logger.info(
                "Runtime storage is not defined, creating one as mutable file storage at: {}",
                runtimeFolder
            );
            createFileStorageWithFallbacks(
                DEVELOPMENT_RUNTIME_STORAGE_KEY, runtimeFolder, true);
        }
    }

    @Override
    public PathMapping getPathMapping() {
        return appPaths;
    }

    @Override
    public ObjectMetadata getDefaultMetadata() {
        String author = StorageUtils.currentUsername().orElse(null);
        return new ObjectMetadata(author, null);
    }

    private void createFileStorageWithFallbacks(String baseStorageId, Path root, boolean mutable) {
        // try to read from "images/" directory as fallback to preserve backwards compatibility
        Path imagesFolder = root.resolve("images");
        if (Files.isDirectory(imagesFolder)) {
            String imagesStorageId = baseStorageId + "/" + "images";
            logger.warn(
                "Creating fallback readonly storage '{}' at: {}",
                imagesStorageId, imagesFolder, root.resolve("assets/images")
            );
            addStorageAsFirstInSearchOrder(new StorageDescription(
                imagesStorageId,
                new NonVersionedFileStorage(
                    new PathMapping.RemovePrefixFallback(ObjectKind.ASSET, "images/"),
                    new NonVersionedFileStorage.Config(imagesStorageId, imagesFolder)
                ),
                ImmutableSet.of(ObjectKind.ASSET)
            ));
        }

        // try to read from resource/* directory as fallback to preserve backwards compatibility
        Path pageLayoutFolder = root.resolve("resources/com/metaphacts/ui/templates");
        if (Files.isDirectory(pageLayoutFolder)) {
            String pageLayoutStorageId = baseStorageId + "/" + "page-layout";
            logger.warn(
                "Creating fallback readonly storage '{}' at: {}",
                pageLayoutStorageId, pageLayoutFolder, root.resolve("config/page-layout")
            );
            addStorageAsFirstInSearchOrder(new StorageDescription(
                pageLayoutStorageId,
                new NonVersionedFileStorage(
                    new PathMapping.RemovePrefixFallback(ObjectKind.CONFIG, "page-layout/"),
                    new NonVersionedFileStorage.Config(pageLayoutStorageId, pageLayoutFolder)
                ),
                ImmutableSet.of(ObjectKind.CONFIG)
            ));
        }
        
        Config storageConfig = new NonVersionedFileStorage.Config(baseStorageId, root);
        storageConfig.setMutable(mutable);
        addStorageAsFirstInSearchOrder(new StorageDescription(
            baseStorageId,
            new NonVersionedFileStorage(
                appPaths,
                storageConfig
            )
        ));
    }

    private void addStorageFromConfig(StorageRegistry storageRegistry, String storageId, StorageConfig config) {
        logger.info("Creating {} storage '{}' with config type {}",
            config.isMutable() ? "mutable" : "readonly", storageId, config.getClass().getName());
        StorageCreationParams params = new StorageCreationParams(
            appPaths, PlatformStorage.class.getClassLoader());
        ObjectStorage storage = storageRegistry
                .get(config.getStorageType())
                .orElseThrow(
                        () -> new StorageConfigException("No storage factory for storage type"
                                + config.getStorageType())).getStorage(config, params);
        addStorageAsFirstInSearchOrder(new StorageDescription(storageId, storage));
    }

    private void addStorageAsFirstInSearchOrder(StorageDescription description) {
        storages.put(description.storageId, description);
        // we may have already initialized a default app storage for the given id
        // and as such must first remove it
        if(appSearchOrder.remove(description.storageId)){
            logger.info("Replacing initial storage with id '"+description.storageId+"' in app search order.");
        }
        appSearchOrder.add(0, description.storageId);
    }

    @Override
    public Optional<FindResult> findObject(ObjectKind kind, String objectId) throws StorageException {
        logger.trace("Searching for single {} object at: {}", kind, objectId);
        for (String appId : appSearchOrder) {
            StorageDescription description = storages.get(appId);
            if (!description.storedKinds.contains(kind)) {
                continue;
            }
            Optional<ObjectRecord> found = description.storage.getObject(kind, objectId, null);
            if (found.isPresent()) {
                ObjectRecord record = found.get();
                logger.trace(
                    "Found {} object in storage '{}' with revision {}",
                    kind, appId, record.getRevision());
                return Optional.of(new FindResult(appId, record));
            }
        }
        logger.trace("None {} objects found at: {}", kind, objectId);
        return Optional.empty();
    }

    @Override
    public Map<String, FindResult> findAll(ObjectKind kind, String idPrefix) throws StorageException {
        logger.trace("Searching for all {} objects with prefix: {}", kind, idPrefix);
        Map<String, FindResult> objectsById = new HashMap<>();
        for (String appId : Lists.reverse(appSearchOrder)) {
            StorageDescription description = storages.get(appId);
            if (!description.storedKinds.contains(kind)) {
                continue;
            }

            List<ObjectRecord> objects = description.storage.getAllObjects(kind, idPrefix);
            int beforeSize = objectsById.size();

            for (ObjectRecord record : objects) {
                objectsById.put(record.getId(), new FindResult(appId, record));
            }

            if (logger.isTraceEnabled()) {
                int added = objectsById.size() - beforeSize;
                int overridden = objects.size() - added;
                logger.trace(
                    "Found {} {} objects in storage '{}': {} added, {} overridden",
                    objects.size(), kind, appId, added, overridden);
            }
        }
        logger.trace(
            "Found {} {} objects in total with prefix: {}",
            objectsById.size(), kind, idPrefix);
        return objectsById;
    }

    @Override
    public List<FindResult> findOverrides(ObjectKind kind, String objectId) throws StorageException {
        logger.trace("Searching for overrides of {} object at: {}", kind, objectId);
        List<FindResult> results = new ArrayList<>();
        for (String appId : Lists.reverse(appSearchOrder)) {
            StorageDescription description = storages.get(appId);
            if (!description.storedKinds.contains(kind)) {
                continue;
            }
            Optional<ObjectRecord> found = description.storage.getObject(kind, objectId, null);
            if (found.isPresent()) {
                ObjectRecord record = found.get();
                logger.trace(
                    "Found override in storage '{}' with revision {}",
                    appId, record.getRevision());
                results.add(new FindResult(appId, record));
            }
        }
        logger.trace("Found {} overrides for {} object at: {}", results.size(), kind, objectId);
        return results;
    }

    @NotNull
    @Override
    public ObjectStorage getStorage(String appId) {
        StorageDescription description = storages.get(appId);
        if (description == null) {
            throw new RuntimeException("Cannot get storage for unknown appId = \"" + appId + "\"");
        }
        return description.storage;
    }

    @Override
    public List<StorageStatus> getStorageStatusFor(ObjectKind kind) {
        return Lists.reverse(appSearchOrder).stream()
            .map(storageId -> storages.get(storageId))
            .filter(desc -> desc.storedKinds.contains(kind))
            .map(desc -> new StorageStatus(desc.storageId, desc.storage.isMutable()))
            .collect(toList());
    }

    public Map<String, StorageDescription> getStorages() {
        return ImmutableMap.copyOf(storages);
    }
}
