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
package com.metaphacts.cache;

import com.google.common.base.Strings;
import org.glassfish.jersey.client.ClientConfig;
import org.glassfish.jersey.client.ClientProperties;
import org.glassfish.jersey.client.authentication.HttpAuthenticationFeature;

import javax.annotation.Nullable;
import javax.ws.rs.client.ClientBuilder;
import javax.ws.rs.client.WebTarget;

/**
 * The class represents an object which contains configuration for remote service.
 *
 * @author Daniil Razdiakonov <dr@metaphacts.com>
 */
public class RemoteServiceConfiguration {
    protected static final String DEFAULT_REPOSITORY = "default";

    private final String remoteUrl;
    private final @Nullable String targetRepository;
    private final @Nullable String username;
    private final @Nullable String password;
    private final @Nullable Integer timeout;

    public RemoteServiceConfiguration(
            String remoteUrl,
            @Nullable String repository,
            @Nullable String username,
            @Nullable String password,
            @Nullable Integer timeout
    ) {
        this.remoteUrl = remoteUrl;
        this.targetRepository = repository;
        this.username = username;
        this.password = password;
        this.timeout = timeout;
    }

    public String getRemoteUrl() {
        return remoteUrl;
    }

    @Nullable
    public String getUsername() {
        return username;
    }

    @Nullable
    public String getPassword() {
        return password;
    }

    public String getTargetRepository() {
        return Strings.isNullOrEmpty(this.targetRepository) ? DEFAULT_REPOSITORY : this.targetRepository;
    }

    @Nullable
    public Integer getTimeout() {
        return timeout;
    }

    protected WebTarget getTarget() {
        String url = this.getRemoteUrl();
        String username = this.getUsername();
        String password = this.getPassword();
        Integer timeout = this.getTimeout();

        ClientConfig configuration = new ClientConfig();
        // define timeout
        if (timeout != null) {
            configuration.property(ClientProperties.CONNECT_TIMEOUT, timeout * 1000);
            configuration.property(ClientProperties.READ_TIMEOUT, timeout * 1000);
        }

        WebTarget client = ClientBuilder.newClient(configuration).target(url);

        if (username != null && password != null) {
            client.register(HttpAuthenticationFeature.basic(username, password));
        }

        return client;
    }
}
