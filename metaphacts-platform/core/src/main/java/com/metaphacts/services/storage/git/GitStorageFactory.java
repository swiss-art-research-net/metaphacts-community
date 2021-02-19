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
package com.metaphacts.services.storage.git;

import java.nio.file.Path;
import java.nio.file.Paths;

import javax.inject.Inject;

import org.apache.commons.configuration2.Configuration;

import com.metaphacts.secrets.SecretResolver;
import com.metaphacts.secrets.SecretsHelper;
import com.metaphacts.services.storage.api.ObjectStorage;
import com.metaphacts.services.storage.api.StorageConfig;
import com.metaphacts.services.storage.api.StorageConfigException;
import com.metaphacts.services.storage.api.StorageCreationParams;
import com.metaphacts.services.storage.api.StorageException;
import com.metaphacts.services.storage.api.StorageFactory;

public class GitStorageFactory implements StorageFactory<GitStorageConfig> {

    @Inject
    private SecretResolver secretResolver;

    @Override
    public String getStorageType() {
        return GitStorage.STORAGE_TYPE;
    }

    @Override
    public StorageConfig parseStorageConfig(
        String storageType,
        Configuration properties
    ) throws StorageConfigException {
        GitStorageConfig config = new GitStorageConfig();
        StorageConfig.readBaseProperties(config, properties);
        if (properties.containsKey("localPath")) {
            Path localPath = Paths.get(properties.getString("localPath"));
            config.setLocalPath(localPath);
        }
        if (properties.containsKey("branch")) {
            config.setBranch(properties.getString("branch"));
        }
        if (properties.containsKey("remoteUrl")) {
            String remoteUrl = properties.getString("remoteUrl");
            config.setRemoteUrl(SecretsHelper.resolveSecretOrFallback(secretResolver, remoteUrl));
        }
        if (properties.containsKey("keyPath")) {
            String keyPath = properties.getString("keyPath");
            config.setKeyPath(SecretsHelper.resolveSecretOrFallback(secretResolver, keyPath));
        }
        if (properties.containsKey("key")) {
            String key = properties.getString("key");
            config.setKey(SecretsHelper.resolveSecretOrFallback(secretResolver, key));
        }
        if (properties.containsKey("username")) {
            String username = properties.getString("username");
            config.setUsername(SecretsHelper.resolveSecretOrFallback(secretResolver, username));
        }
        if (properties.containsKey("password")) {
            String password = properties.getString("password");
            config.setPassword(SecretsHelper.resolveSecretOrFallback(secretResolver, password));
        }
        if (properties.containsKey("verifyKnownHosts")) {
            config.setVerifyKnownHosts(properties.getBoolean("verifyKnownHosts"));
        }
        if (properties.containsKey("maxPushAttempts")) {
            config.setMaxPushAttempts(properties.getInt("maxPushAttempts"));
        }
        return config;
    }

    @Override
    public ObjectStorage createStorage(GitStorageConfig config, StorageCreationParams creationParams)
            throws StorageException {
        return new GitStorage(creationParams.getPathMapping(), config);
    }
}
