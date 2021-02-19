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
package com.metaphacts.repository.sparql.virtuoso;

import java.io.File;

import org.eclipse.rdf4j.repository.RepositoryConnection;
import org.eclipse.rdf4j.repository.RepositoryException;
import org.eclipse.rdf4j.repository.base.RepositoryWrapper;

import com.google.inject.Inject;
import com.google.inject.Provider;
import com.metaphacts.repository.RepositoryManager;

/**
 * A wrapper repository to be used over a remote Virtuoso SPARQL endpoint.
 * Features:
 * <ul>
 *  <li>Supports ASK queries (not allowed in Virtuoso) by transforming them 
 *      into equivalent SELECT ones.</li>
 * </ul>
 * 
 * @author Andriy Nikolov an@metaphacts.com
 *
 */
public class VirtuosoWrapperRepository extends RepositoryWrapper {
    
    protected final String repositoryId;
    
    @Inject
    protected Provider<RepositoryManager> repositoryManagerProvider;
    
    /**
     * Creates an instance of the repository taking the ID of 
     * the delegate repository as a parameter.
     * 
     * @param repositoryId ID of the delegate repository in Repository
     */
    public VirtuosoWrapperRepository(String repositoryId) {
        super();
        this.repositoryId = repositoryId;
        this.setDelegate(null);
    }
    
    @Override
    public RepositoryConnection getConnection() throws RepositoryException {
        if (this.getDelegate() == null) {
            this.setDelegate(repositoryManagerProvider
                                        .get().getRepository(this.repositoryId));
        }
        if (!isInitialized()) {
            throw new RepositoryException("SPARQLRepository not initialized.");
        }
        return new VirtuosoWrapperRepositoryConnection(this, getDelegate().getConnection());
    }

    @Override
    public void setDataDir(File dataDir) {
        
    }
    
    @Override
    public void initialize() {
        // do not initialize the delegate as this is managed by the repository manager
    }
    
    @Override
    public void shutDown() throws RepositoryException {
        // do not shutdown the delegate as this is managed by the repository manager
    }
    
}
