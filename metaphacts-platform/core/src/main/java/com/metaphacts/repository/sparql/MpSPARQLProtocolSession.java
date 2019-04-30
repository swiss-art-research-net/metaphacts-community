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

package com.metaphacts.repository.sparql;

import java.lang.reflect.Field;
import java.util.concurrent.ExecutorService;

import org.apache.http.HttpHost;
import org.apache.http.auth.AuthScope;
import org.apache.http.auth.UsernamePasswordCredentials;
import org.apache.http.client.AuthCache;
import org.apache.http.client.CredentialsProvider;
import org.apache.http.client.HttpClient;
import org.apache.http.client.protocol.HttpClientContext;
import org.apache.http.impl.auth.DigestScheme;
import org.apache.http.impl.client.BasicAuthCache;
import org.apache.http.impl.client.BasicCredentialsProvider;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.rdf4j.http.client.SPARQLProtocolSession;


/**
 * @author Johannes Trame <jt@metaphacts.com>
 *
 */
public class MpSPARQLProtocolSession extends SPARQLProtocolSession {
    private static final Logger logger = LogManager.getLogger(MpSPARQLProtocolSession.class);

    public MpSPARQLProtocolSession(HttpClient client, ExecutorService executor) {
        super(client, executor);
    }

    public void setBasicAuthCredentials(String username, String password){
        super.setUsernameAndPassword(username, password);
    }

    public void setDigestAuthCredentials(String username, String password, String realm){
        logger.debug("Setting username '{}', realm '{}' and password for digest auth connection to server at {}.", username, realm, getQueryURL());
        java.net.URI requestURI = java.net.URI.create(getQueryURL());
        String host = requestURI.getHost();
        int port = requestURI.getPort();
        AuthScope scope = new AuthScope(host, port);
        final CredentialsProvider credsProvider = new BasicCredentialsProvider();
        credsProvider.setCredentials(scope,
                new UsernamePasswordCredentials(username, password));

        final AuthCache authCache = new BasicAuthCache();
        DigestScheme digestAuth = new DigestScheme();
        
        digestAuth.overrideParamter("realm", realm);
        digestAuth.overrideParamter("nonce", "metaphactory-nonce");
        HttpHost httpHost = new HttpHost(requestURI.getHost(), requestURI.getPort(),
                requestURI.getScheme());
        authCache.put(httpHost, digestAuth);

        // Add AuthCache to the execution context
        getHttpContext().setCredentialsProvider(credsProvider);
        getHttpContext().setAuthCache(authCache);
    }
    
    /**
     * TODO FIXME
     * 
     * Accessing the http context object via reflection i.e. current RDF4J API
     * makes it impossible to access it
     * 
     * @return
     */
    private HttpClientContext getHttpContext(){
        try {
            Field field = SPARQLProtocolSession.class.getDeclaredField("httpContext");
            field.setAccessible(true);
            Object value = field.get(this);
            field.setAccessible(false);

            if (value == null) {
                throw new IllegalStateException("HttpClientContext not initalized.");
            } else if (HttpClientContext.class.isAssignableFrom(value.getClass())) {
                return (HttpClientContext) value;
            }
            throw new RuntimeException("Not able to access HttpClientContext from SPARQLProtocolSession.");
        } catch (NoSuchFieldException e) {
            throw new RuntimeException(e);
        } catch (IllegalAccessException e) {
            throw new RuntimeException(e);
        }
    }
    
    protected void setQueryURL(String queryURL) {
        super.setQueryURL(queryURL);
    }

    protected void setUpdateURL(String updateURL) {
        super.setUpdateURL(updateURL);
    }
}
