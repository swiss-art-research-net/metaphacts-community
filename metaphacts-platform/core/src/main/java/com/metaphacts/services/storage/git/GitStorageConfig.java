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

import javax.annotation.Nullable;

import com.metaphacts.services.storage.api.StorageConfig;
import com.metaphacts.services.storage.api.StorageConfigException;

/**
 * Configuration for the {@link GitStorage}.
 * 
 * <p>
 * The GitStorage supports the following authentication modes:
 * </p>
 * 
 * <ul>
 * <li>built-in: use openssh configuration (i.e. ~/.ssh) or user/password from
 * connection URL</li>
 * <li>custom private key for SSH connection as specified using
 * {@link #getKeyPath()} or {@link #getKey()}</li>
 * <li>username + password / token for HTTPS connection as specified using
 * {@link #getUsername()} and {@link #getPassword()}</li>
 * </ul>
 * 
 *
 */
public class GitStorageConfig extends StorageConfig {

    private Path localPath;

    @Nullable
    private String branch;

    @Nullable
    private String remoteUrl;

    @Nullable
    private String keyPath;

    @Nullable
    private String key;

    @Nullable
    private String username;

    @Nullable
    private String password;

    private int maxPushAttempts = 3;

    private boolean verifyKnownHosts = true;

    @Override
    public String getStorageType() {
        return GitStorage.STORAGE_TYPE;
    }


    @Override
    protected void validate() throws StorageConfigException {
        super.validate();
        if (localPath == null) {
            throw new StorageConfigException("Missing required property 'localPath'");
        }
        if (!getLocalPath().isAbsolute()) {
            throw new StorageConfigException(
                "'localPath' path must be absolute: '" + getLocalPath() + "'");
        }
        if (getMaxPushAttempts() <= 0) {
            throw new StorageConfigException("'maxPushAttempts' must be greater than zero");
        }
    }

    public Path getLocalPath() {
        return localPath;
    }

    public void setLocalPath(Path localPath) {
        this.localPath = localPath;
    }

    @Nullable
    public String getBranch() {
        return branch;
    }

    public void setBranch(@Nullable String branch) {
        this.branch = branch;
    }

    @Nullable
    public String getRemoteUrl() {
        return remoteUrl;
    }

    public void setRemoteUrl(@Nullable String remoteUrl) {
        this.remoteUrl = remoteUrl;
    }

    /**
     * The location of the private key pointing to an existing location in the file
     * system
     * 
     * @return
     */
    @Nullable
    public String getKeyPath() {
        return keyPath;
    }

    public void setKeyPath(String keyPath) {
        this.keyPath = keyPath;
    }

    /**
     * The private key as String
     * 
     * @return
     */
    @Nullable
    public String getKey() {
        return key;
    }

    public void setKey(String key) {
        this.key = key;
    }

    /**
     * The username used for HTTPS authentication
     * 
     * @return the username
     */
    @Nullable
    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    /**
     * The password or token used for HTTPS authentication
     * 
     * @return
     */
    @Nullable
    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    /**
     * Maximum count of attempts to push changes before throwing an error.
     */
    public int getMaxPushAttempts() {
        return maxPushAttempts;
    }

    public void setMaxPushAttempts(int maxPushAttempts) {
        this.maxPushAttempts = maxPushAttempts;
    }

    /**
     * Whether to verify if the host is accepted as known host
     * 
     * @return
     */
    public boolean isVerifyKnownHosts() {
        return verifyKnownHosts;
    }

    public void setVerifyKnownHosts(boolean verifyKnownHosts) {
        this.verifyKnownHosts = verifyKnownHosts;
    }

    /**
     * Whether custom authentication is enabled requiring specific transport
     * configuration. This is if there is {@link #customSSHAuthentication()} or a
     * username is defined
     * 
     * @return
     */
    public boolean customAuthenticationScheme() {
        return customSSHAuthentication() || username != null;
    }

    /**
     * Whether a customized SSH transport factory needs to be configured. This is if
     * {@link #getKeyPath()} , {@link #getKey()} or if {@link #verifyKnownHosts} is
     * deactivated.
     * 
     * @return
     */
    public boolean customSSHAuthentication() {
        return keyPath != null || key != null || verifyKnownHosts == false;
    }
}
