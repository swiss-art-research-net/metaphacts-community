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

package com.metaphacts.repository;

import org.eclipse.rdf4j.repository.Repository;

/**
 * A provider class that retrieves the repository reference on demand from the {@link RepositoryManager}.
 * 
 * @author Andriy Nikolov an@metaphacts.com
 *
 */
public class MpRepositoryProvider {
    
    private final RepositoryManager repositoryManager;
    private final String repositoryId;

    public MpRepositoryProvider(RepositoryManager repositoryManager, String repositoryId) {
        this.repositoryManager = repositoryManager;
        this.repositoryId = repositoryId;
    }
    
    public RepositoryManager getRepositoryManager() {
        return repositoryManager;
    }

    public String getRepositoryId() {
        return repositoryId;
    }

    public Repository getRepository() {
        return repositoryManager.getRepository(repositoryId);
    }

    @Override
    public int hashCode() {
        return repositoryId.hashCode();
    }

    @Override
    public boolean equals(Object obj) {
        return (obj instanceof MpRepositoryProvider)
                ? this.repositoryId.equals(((MpRepositoryProvider) obj).getRepositoryId()) : false;
    }

    
    
}
