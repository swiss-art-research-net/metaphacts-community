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
package com.metaphacts.repository.http;

import org.eclipse.rdf4j.repository.RepositoryException;
import org.eclipse.rdf4j.repository.http.HTTPRepository;

import com.google.inject.Inject;
import com.metaphacts.repository.AuthMethod;
import com.metaphacts.secrets.SecretResolver;
import com.metaphacts.secrets.SecretsHelper;

public class AuthenticatingHTTPRepository extends HTTPRepository {

    private AuthMethod authenticationModus = AuthMethod.None;

    // realm value for digest auth
    private String realm;

    private String username;

    private String password;

    @Inject(optional = true)
    private SecretResolver secretResolver;

    public AuthenticatingHTTPRepository(String repositoryURL) {
        super(repositoryURL);
    }

    public void setBasicAuthCredentials(String username, String password) {
        this.username = username;
        this.password = password;
        this.authenticationModus = AuthMethod.BasicAuth;
    }

    public void setDigestAuthCredentials(String username, String password, String realm) {
        this.username = username;
        this.password = password;
        this.realm = realm;
        this.authenticationModus = AuthMethod.DigestAuth;
    }

    @Override
    protected void initializeInternal() throws RepositoryException {
        // replace username, password, and realm with resolved secrets (if applicable)
        username = SecretsHelper.resolveSecretOrFallback(secretResolver, username);
        password = SecretsHelper.resolveSecretOrFallback(secretResolver, password);
        realm = SecretsHelper.resolveSecretOrFallback(secretResolver, realm);

        super.initializeInternal();
    }

    @Override
    protected AuthenticatingRDF4JProtocolSession createHTTPClient() {
        if (authenticationModus.equals(AuthMethod.BasicAuth)) {
            // when setting this on the super class
            // createHTTPClient will create a client with basic auth context
            super.setUsernameAndPassword(username, password);
        }

        // FIXME this relies on the correct session manager being injected. Brittle.
        AuthenticatingRDF4JProtocolSession client = (AuthenticatingRDF4JProtocolSession) super.createHTTPClient();
        if (authenticationModus.equals(AuthMethod.DigestAuth)) {
            client.setDigestAuthCredentials(username, password, this.realm);
        }

        return client;
    }

}
