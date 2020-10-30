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
 * Copyright (C) 2015-2020, metaphacts GmbH
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
package com.metaphacts.repository.sparql;

import org.apache.http.client.config.CookieSpecs;
import org.apache.http.client.config.RequestConfig;
import org.apache.http.impl.client.HttpClientBuilder;
import org.eclipse.rdf4j.http.client.SharedHttpClientSessionManager;
import org.eclipse.rdf4j.query.resultio.TupleQueryResultFormat;
import org.eclipse.rdf4j.rio.RDFFormat;

import com.metaphacts.config.Configuration;
import com.metaphacts.repository.http.AuthenticatingRDF4JProtocolSession;

/**
 * @author Johannes Trame <jt@metaphacts.com>
 *
 */
public class MpSharedHttpClientSessionManager extends SharedHttpClientSessionManager {
    
    private final Configuration config;
    
    public MpSharedHttpClientSessionManager(Configuration config) {
        this.config = config;
        Integer maxConnections = this.config.getEnvironmentConfig().getMaxSparqlHttpConnections();
        Integer connectionTimeout = this.config.getEnvironmentConfig()
                                            .getSparqlHttpConnectionTimeout();
        
        RequestConfig.Builder configBuilder = RequestConfig.custom();
        if (connectionTimeout != null) {
            configBuilder = configBuilder.setConnectTimeout(connectionTimeout * 1000);
            configBuilder = configBuilder.setSocketTimeout(connectionTimeout * 1000);
        }
        configBuilder.setCookieSpec(CookieSpecs.STANDARD);

        RequestConfig requestConfig = configBuilder.build();
        HttpClientBuilder mpHttpClientBuilder = HttpClientBuilder
                                                    .create()
                                                    .setMaxConnPerRoute(maxConnections)
                                                    .setMaxConnTotal(maxConnections)
                                                    .setDefaultRequestConfig(requestConfig);
        
        this.setHttpClientBuilder(mpHttpClientBuilder);
    }

    @Override
    public MpSPARQLProtocolSession createSPARQLProtocolSession(String queryEndpointUrl, String updateEndpointUrl) {
        MpSPARQLProtocolSession session = new MpSPARQLProtocolSession(getHttpClient(), getExecutorService());
        session.setPreferredTupleQueryResultFormat(TupleQueryResultFormat.JSON);
        session.setQueryURL(queryEndpointUrl);
        session.setUpdateURL(updateEndpointUrl);
        return session;
    }

    @Override
    public AuthenticatingRDF4JProtocolSession createRDF4JProtocolSession(String serverURL) {
        AuthenticatingRDF4JProtocolSession session = new AuthenticatingRDF4JProtocolSession(getHttpClient(),
                getExecutorService());
        session.setServerURL(serverURL);
        return session;
    }
}
