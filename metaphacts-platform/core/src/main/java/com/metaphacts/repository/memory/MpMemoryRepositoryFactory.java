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

package com.metaphacts.repository.memory;

import org.eclipse.rdf4j.repository.Repository;
import org.eclipse.rdf4j.repository.config.RepositoryConfigException;
import org.eclipse.rdf4j.repository.config.RepositoryFactory;
import org.eclipse.rdf4j.repository.config.RepositoryImplConfig;

public class MpMemoryRepositoryFactory implements RepositoryFactory {
    
    public static final String REPOSITORY_TYPE = "metaphactory:DefaultMemoryRepository";

    @Override
    public String getRepositoryType() {
        return REPOSITORY_TYPE;
    }

    @Override
    public RepositoryImplConfig getConfig() {
        return new MpMemoryRepositoryImplConfig();
    }

    @Override
    public Repository getRepository(RepositoryImplConfig config) throws RepositoryConfigException {
        Repository result;
        if (config instanceof MpMemoryRepositoryImplConfig) {
            result = new MpMemoryRepository();
        } else {
            throw new RepositoryConfigException(
                    "Invalid configuration class: " + config.getClass());
        }
        return result;
    }

}
