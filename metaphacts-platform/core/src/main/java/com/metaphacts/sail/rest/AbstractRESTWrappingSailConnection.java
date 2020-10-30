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
package com.metaphacts.sail.rest;

import java.io.InputStream;
import java.util.Collection;
import java.util.Map.Entry;

import javax.ws.rs.client.Client;
import javax.ws.rs.client.ClientBuilder;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.Status.Family;

import org.eclipse.rdf4j.common.iteration.CloseableIteration;
import org.eclipse.rdf4j.query.BindingSet;
import org.eclipse.rdf4j.query.QueryEvaluationException;
import org.eclipse.rdf4j.repository.sparql.federation.CollectionIteration;
import org.eclipse.rdf4j.sail.SailConnection;
import org.eclipse.rdf4j.sail.SailException;
import org.glassfish.jersey.client.ClientProperties;

/**
 * Abstract superclass for {@link SailConnection}s that wrap around REST APIs. 
 * 
 * @author Andriy Nikolov an@metaphacts.com
 *
 */
public abstract class AbstractRESTWrappingSailConnection extends AbstractServiceWrappingSailConnection {

    public AbstractRESTWrappingSailConnection(AbstractServiceWrappingSail sailBase) {
        super(sailBase);
    }

    @Override
    protected abstract Collection<BindingSet> convertStream2BindingSets(InputStream inputStream,
            RESTParametersHolder parametersHolder) throws SailException;

    /**
     * Default implementation calling the API using an HTTP GET method. Parameters are passed via
     * URL. JSON expected as a result format.
     * 
     * @param parametersHolder
     * @return
     */
    protected Response submit(RESTParametersHolder parametersHolder) {
        try {
            Client client = ClientBuilder.newClient();
            WebTarget targetResource = client.target(getSail().getUrl())
                    .property(ClientProperties.FOLLOW_REDIRECTS, Boolean.TRUE);
            for (Entry<String, String> entry : parametersHolder.getInputParameters().entrySet()) {
                targetResource = targetResource.queryParam(entry.getKey(), entry.getValue());
            }
            return targetResource.request(MediaType.TEXT_PLAIN).get();
        } catch (Exception e) {
            throw new SailException(e);
        }
    }

    @Override
    protected CloseableIteration<? extends BindingSet, QueryEvaluationException> executeAndConvertResultsToBindingSet(
            RESTParametersHolder parametersHolder) {
        Response response = submit(parametersHolder);
        if (!response.getStatusInfo().getFamily().equals(Family.SUCCESSFUL)) {
            throw new SailException("Request failed with HTTP status code " + response.getStatus()
                    + ": " + response.getStatusInfo().getReasonPhrase());
        }
        InputStream resultStream;

        resultStream = (InputStream) response.getEntity();
        return new CollectionIteration<BindingSet, QueryEvaluationException>(
                convertStream2BindingSets(resultStream, parametersHolder));
    }

}
