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
package com.metaphacts.servlet;

import java.io.IOException;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.eclipse.rdf4j.query.Dataset;

/**
 * Handler for SPARQL requests received in the SPARQL endpoint.
 * Implementing this interface allows intercepting SPARQL requests and handle them in a different way.
 * 
 * @author Wolfgang Schell <ws@metaphacts.com>
 */
public interface SparqlRequestHandler {

    /**
     * Determine whether this handler wants to handle the SPARQL query.
     * @param context meta information for the query
     * @return <code>true</code> if the handler wants to handle the query, <code>false</code> otherwise.
     */
    boolean canHandle(SparqlRequestContext context);

    /**
     * Process the SPARQL query, e.g. by executing it or doing some alternative processing.
     * The results will be written to the HTTP resposnse.
     * 
     * @param context meta information for the query
     * @param req servlet request for the SPARQL operation
     * @param resp servlet response for the SPARQL operation
     * @return <code>true</code> if operation was handled, <code>false</code> if it should still be 
     *      handled by the default processing. When an error occurred which is handled (or forwarded 
     *      to the caller with an error message to the servlet response) the handler should return <code>true</code>.
     * @throws IOException in case of an error
     */
    boolean processOperation(SparqlRequestContext context, HttpServletRequest req, HttpServletResponse resp) throws IOException;
    
    /**
     * Meta information for a SPARQL query.
     * @author Wolfgang Schell <ws@metaphacts.com>
     */
    public static class SparqlRequestContext {
        private final String repositoryId;
        private final String queryString;
        private final String preferredMimeType;
        private final Dataset dataset;

        public SparqlRequestContext(String repositoryId, Dataset dataset, String queryString, String preferredMimeType) {
            this.repositoryId = repositoryId;
            this.dataset = dataset;
            this.queryString = queryString;
            this.preferredMimeType = preferredMimeType;
        }
        
        public String getRepositoryId() {
            return repositoryId;
        }
        
        public String getQueryString() {
            return queryString;
        }
        
        public String getPreferredMimeType() {
            return preferredMimeType;
        }
        
        public Dataset getDataset() {
            return dataset;
        }
    }

}
