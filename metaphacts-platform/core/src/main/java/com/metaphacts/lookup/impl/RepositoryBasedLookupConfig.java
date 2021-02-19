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
package com.metaphacts.lookup.impl;

import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.Resource;
import org.eclipse.rdf4j.model.util.Models;

import com.metaphacts.lookup.spi.LookupServiceConfigException;
import com.metaphacts.lookup.spi.TargetRepositoryAware;

/**
 * Configuration for lookup services based on repositories.
 * 
 * @author Wolfgang Schell <ws@metaphacts.com>
 */
public class RepositoryBasedLookupConfig extends CommonLookupConfig implements TargetRepositoryAware {
    private String targetRepository;
    
    public RepositoryBasedLookupConfig() {
    }

    public RepositoryBasedLookupConfig(String type) {
        super(type);
    }

    @Override
    public void setTargetRepository(String targetRepository) {
        this.targetRepository = targetRepository;
    }

    @Override
    public String getTargetRepository() {
        return targetRepository;
    }
    
    @Override
    public Resource export(Model model) {
        Resource implNode = super.export(model);
        
        if (getTargetRepository() != null) {
            model.add(implNode, LOOKUP_TARGET_REPOSITORY, VF.createLiteral(getTargetRepository()));
        }
        
        return implNode;
    }
    
    @Override
    public void parse(Model model, Resource resource) throws LookupServiceConfigException {
        super.parse(model, resource);
        
        Models.objectLiteral(model.filter(resource, LOOKUP_TARGET_REPOSITORY, null))
            .ifPresent(literal -> setTargetRepository(literal.stringValue()));
    }
    
    @Override
    public void validate() throws LookupServiceConfigException  {
        super.validate();
        if (getTargetRepository() == null) {
            throw new LookupServiceConfigException("No target repository set!");
        }
    }
}
