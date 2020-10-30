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
package com.metaphacts.repository;

import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.Resource;
import org.eclipse.rdf4j.model.util.ModelException;
import org.eclipse.rdf4j.model.util.Models;
import org.eclipse.rdf4j.repository.config.RepositoryConfig;
import org.eclipse.rdf4j.repository.config.RepositoryConfigException;
import org.eclipse.rdf4j.repository.config.RepositoryImplConfig;

import com.metaphacts.lookup.spi.AbstractLookupServiceConfig;
import com.metaphacts.lookup.spi.LookupServiceConfig;
import com.metaphacts.lookup.spi.LookupServiceConfigHolder;
import com.metaphacts.lookup.spi.LookupServiceConfigException;
import com.metaphacts.lookup.spi.LookupVocabulary;

public class RepositoryConfigWithLookup extends RepositoryConfig implements LookupServiceConfigHolder, LookupVocabulary {
    
    protected LookupServiceConfig lookupServiceConfig;
    
    public RepositoryConfigWithLookup() {
        super();
    }

    public RepositoryConfigWithLookup(String id, RepositoryImplConfig implConfig) {
        super(id, implConfig);
    }

    public RepositoryConfigWithLookup(String id, String title, RepositoryImplConfig implConfig) {
        super(id, title, implConfig);
    }

    public RepositoryConfigWithLookup(String id, String title) {
        super(id, title);
    }

    public RepositoryConfigWithLookup(String id) {
        super(id);
    }
    
    public void setLookupServiceConfig(LookupServiceConfig lookupServiceConfig) {
        this.lookupServiceConfig = lookupServiceConfig;
    }

    @Override
    public void parse(Model model, Resource repositoryNode) throws RepositoryConfigException {
        try {
            super.parse(model, repositoryNode);
            Models.objectResource(model.getStatements(repositoryNode, LOOKUP_CONFIGURATION, null))
                    .ifPresent(res -> setLookupServiceConfig(AbstractLookupServiceConfig.create(model, res)));
        } catch (ModelException e) {
            throw new LookupServiceConfigException(e.getMessage(), e);
        }
    }
    
    @Override
    public void export(Model model, Resource repositoryNode) {
        super.export(model, repositoryNode);
        
        if (lookupServiceConfig != null) {
            Resource implNode = lookupServiceConfig.export(model);
            model.add(repositoryNode, LOOKUP_CONFIGURATION, implNode);
        }
    }

    @Override
    public String getLookupType() {
        if (lookupServiceConfig != null) {
            return lookupServiceConfig.getType();
        }
        return null;
    }

    @Override
    public LookupServiceConfig getLookupServiceConfig() {
        return lookupServiceConfig;
    }
    
    /**
     * Creates a new {@link RepositoryConfig} object and initializes it by supplying the {@code model} and
     * {@code repositoryNode} to its {@link #parse(Model, Resource) parse} method.
     *
     * @param model          the {@link Model} to read initialization data from.
     * @param repositoryNode the subject {@link Resource} that identifies the {@link RepositoryConfig} in the supplied
     *                       Model.
     */
    public static RepositoryConfig create(Model model, Resource repositoryNode) throws RepositoryConfigException {
        RepositoryConfig config = new RepositoryConfigWithLookup();
        config.parse(model, repositoryNode);
        return config;
    }
}
