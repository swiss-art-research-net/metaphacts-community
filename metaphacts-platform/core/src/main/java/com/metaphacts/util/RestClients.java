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
package com.metaphacts.util;

import javax.ws.rs.client.Client;
import javax.ws.rs.client.ClientBuilder;

import org.glassfish.jersey.client.authentication.HttpAuthenticationFeature;

import com.metaphacts.repository.AuthMethod;
import com.metaphacts.repository.sparql.SPARQLAuthenticatingRepositoryConfig;
import com.metaphacts.secrets.SecretResolver;
import com.metaphacts.secrets.SecretsHelper;

/**
 * Utility functions for JAX-RS {@link Client} configuration.
 * 
 * @author Jeen Broekstra
 */
public class RestClients {

    /**
     * Get a JAX-RS HTTP {@link Client} object that can be used for direct REST access, using the same {@link AuthMethod
     * authentication mechanism} and credentials as set on the supplied {@link SPARQLAuthenticatingRepositoryConfig
     * repository configuration}.
     * 
     * @param config         a {@link SPARQLAuthenticatingRepositoryConfig} that supplies credentials and the
     *                       {@link AuthMethod authentication method} used.
     * @param secretResolver a {@link SecretResolver} to handle resolution of credentials when supplied as externalized
     *                       secrets
     * @return a JAX-RS {@link Client} instance configured with appropriate {@link AuthMethod} and credentials.
     */
    public static Client getAuthenticatedClient(SPARQLAuthenticatingRepositoryConfig config,
            SecretResolver secretResolver) {
        final Client client = ClientBuilder.newClient();

        final String username = SecretsHelper.resolveSecretOrFallback(secretResolver, config.getUsername());
        final String password = SecretsHelper.resolveSecretOrFallback(secretResolver, config.getPassword());

        switch (config.getAuthenticationMethod()) {
        case BasicAuth:
            client.register(HttpAuthenticationFeature.basic(username, password));
            break;
        case DigestAuth:
            client.register(HttpAuthenticationFeature.digest(username, password));
            break;
        case None:
            break;
        }
        return client;
    }

}
