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
package com.metaphacts.lookup.spi;

import org.eclipse.rdf4j.model.BNode;
import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.Resource;
import org.eclipse.rdf4j.model.util.ModelException;
import org.eclipse.rdf4j.model.util.Models;
import org.eclipse.rdf4j.repository.config.RepositoryConfigException;

import com.metaphacts.lookup.impl.LookupServiceRegistry;

/**
 * Base implementation for {@link LookupServiceConfig}.
 * 
 * @author Wolfgang Schell <ws@metaphacts.com>
 */
public class AbstractLookupServiceConfig implements LookupServiceConfig, LookupVocabulary {
    
    protected String type;
    
    public AbstractLookupServiceConfig() {
        
    }
    
    public AbstractLookupServiceConfig(String type) {
        this.type = type;
    }

    @Override
    public String getType() {
        return type;
    }
    
    public void setType(String type) {
        this.type = type;
    }

    @Override
    public void validate() throws LookupServiceConfigException  {
        if (type == null) {
            throw new LookupServiceConfigException("No type specified for LookupService implementation");
        }
    }

    @Override
    public void parse(Model model, Resource resource) throws LookupServiceConfigException  {
        Models.objectLiteral(model.getStatements(resource, LOOKUP_TYPE, null))
            .ifPresent(typeLit -> setType(typeLit.getLabel()));
    }

    @Override
    public Resource export(Model model) {
        BNode implNode = VF.createBNode();
        
        model.setNamespace("lookup", LOOKUP_NAMESPACE);

        if (getType() != null) {
            model.add(implNode, LOOKUP_TYPE, VF.createLiteral(getType()));
        }

        return implNode;
    }

    /**
     * Utility method to create a new {@link LookupServiceConfig} by reading data from the supplied {@link Model}.
     *
     * @param model    the {@link Model} to read configuration data from.
     * @param resource the subject {@link Resource} identifying the configuration data in the Model.
     * @return a new {@link LookupServiceConfig} initialized with the configuration from the input Model, or
     *         {@code null} if no {@link LookupVocabulary#LOOKUP_CONFIGURATION} property was found in the configuration
     *         data..
     * @throws LookupServiceConfigException if an error occurred reading the configuration data from the model.
     */
    public static LookupServiceConfig create(Model model, Resource resource) throws RepositoryConfigException {
        try {
            final Literal typeLit = Models.objectLiteral(model.getStatements(resource, LOOKUP_TYPE, null))
                    .orElse(null);
            if (typeLit != null) {
                LookupServiceFactory factory = LookupServiceRegistry.getInstance()
                        .get(typeLit.getLabel())
                        .orElseThrow(() -> new LookupServiceConfigException(
                                "Unsupported LookupService type: " + typeLit.getLabel()));

                LookupServiceConfig implConfig = factory.getConfig();
                implConfig.parse(model, resource);
                return implConfig;
            }

            return null;
        } catch (ModelException e) {
            throw new LookupServiceConfigException(e.getMessage(), e);
        }
    }

}
