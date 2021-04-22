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

import java.util.concurrent.ExecutorService;
import java.util.function.Function;

import org.apache.http.HttpHost;
import org.apache.http.auth.AuthScope;
import org.apache.http.auth.UsernamePasswordCredentials;
import org.apache.http.client.AuthCache;
import org.apache.http.client.CredentialsProvider;
import org.apache.http.client.HttpClient;
import org.apache.http.client.methods.HttpUriRequest;
import org.apache.http.client.protocol.HttpClientContext;
import org.apache.http.impl.auth.DigestScheme;
import org.apache.http.impl.client.BasicAuthCache;
import org.apache.http.impl.client.BasicCredentialsProvider;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.rdf4j.http.client.RDF4JProtocolSession;
import org.eclipse.rdf4j.query.Binding;
import org.eclipse.rdf4j.query.Dataset;
import org.eclipse.rdf4j.query.QueryLanguage;

/**
 * @author Jeen Broekstra
 */
public class AuthenticatingRDF4JProtocolSession extends RDF4JProtocolSession {
    private static final Logger logger = LogManager.getLogger(AuthenticatingRDF4JProtocolSession.class);

    /**
     * If set, the function is used to modify the HTTP request as part of
     * {@link #getQueryMethod(QueryLanguage, String, String, Dataset, boolean, int, Binding...)}.
     * 
     * <p>
     * Can be used for instance to add custom HTTP headers per query request.
     * </p>
     * <p>
     * Note that typically the passed {@link HttpUriRequest} is modified and returned.
     * </p>
     */
    protected Function<HttpUriRequest, HttpUriRequest> httpRequestModifyFunction = null;

    public AuthenticatingRDF4JProtocolSession(HttpClient client, ExecutorService executor) {
        super(client, executor);
    }

    public void setBasicAuthCredentials(String username, String password) {
        super.setUsernameAndPassword(username, password);
    }

    public void setDigestAuthCredentials(String username, String password, String realm) {
        logger.debug("Setting username '{}', realm '{}' and password for digest auth connection to server at {}.",
                username, realm, getQueryURL());
        java.net.URI requestURI = java.net.URI.create(getQueryURL());
        String host = requestURI.getHost();
        int port = requestURI.getPort();
        AuthScope scope = new AuthScope(host, port);
        final CredentialsProvider credsProvider = new BasicCredentialsProvider();
        credsProvider.setCredentials(scope, new UsernamePasswordCredentials(username, password));

        final AuthCache authCache = new BasicAuthCache();
        DigestScheme digestAuth = new DigestScheme();

        digestAuth.overrideParamter("realm", realm);
        digestAuth.overrideParamter("nonce", "metaphactory-nonce");
        HttpHost httpHost = new HttpHost(requestURI.getHost(), requestURI.getPort(), requestURI.getScheme());
        authCache.put(httpHost, digestAuth);

        // Add AuthCache to the execution context
        HttpClientContext context = HttpClientContext.adapt(getHttpContext());
        context.setCredentialsProvider(credsProvider);
        context.setAuthCache(authCache);
    }

    /**
     * Optionally set a function to modify the HTTP request representing a query or update.
     * <p>
     * Example:
     * </p>
     * 
     * <pre>
     * sp.setRequestModifier(request -> {
     *     request.addHeader("SD-Run-As", userId);
     *     return request;
     * });
     * </pre>
     * 
     * <p>
     * Note that the function should typically return the (modified) passed {@link HttpUriRequest} object.
     * </p>
     * 
     * @param requestModifier
     */
    public void setRequestModifier(Function<HttpUriRequest, HttpUriRequest> requestModifier) {
        this.httpRequestModifyFunction = requestModifier;
    }

    @Override
    protected HttpUriRequest getQueryMethod(QueryLanguage ql, String query, String baseURI, Dataset dataset,
            boolean includeInferred, int maxQueryTime, Binding... bindings) {
        HttpUriRequest request = super.getQueryMethod(ql, query, baseURI, dataset, includeInferred, maxQueryTime,
                bindings);

        // if configured, modify the HTTP request (e.g. add custom headers per request)
        if (this.httpRequestModifyFunction != null) {
            request = this.httpRequestModifyFunction.apply(request);
        }

        return request;
    }
}
