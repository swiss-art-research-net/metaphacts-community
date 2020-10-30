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

import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.Resource;
import org.eclipse.rdf4j.model.Statement;
import org.eclipse.rdf4j.repository.config.RepositoryConfigException;

import com.metaphacts.lookup.api.LookupService;

/**
 * Configuraton for a {@link LookupService}.
 * 
 * <p>
 * The configuration is typically read from a {@link Model} (collection of RDF {@link Statement}s)
 * using {@link #parse(Model, Resource)}.
 * </p>
 * 
 * @author Wolfgang Schell <ws@metaphacts.com>
 */
public interface LookupServiceConfig {
    /**
     * Type of LookupService this configuration describes. This typically matches the type 
     * supported by a {@link LookupServiceFactory}.
     * 
     * @return supported lookup type
     */
    public String getType();
    
    /**
     * Validates this configuration. A {@link RepositoryConfigException} is thrown when the configuration is invalid.
     * The exception should contain an error message that indicates why the configuration is invalid.
     * 
     * @throws LookupServiceConfigException  If the configuration is invalid.
     */
    public void validate() throws LookupServiceConfigException ;
    
    /**
     * Reads the properties of this {@link LookupServiceConfig} from the supplied Model and sets them accordingly.
     * 
     * @param model    a {@link Model} containing lookup service configuration data.
     * @param resource the subject {@link Resource} that identifies the {@link LookupServiceConfig} in the Model
     * @throws LookupServiceConfigException  if the configuration data could not be read from the supplied Model.
     */
    public void parse(Model model, Resource resource) throws LookupServiceConfigException ;
    
    /**
     * Export this {@link LookupServiceConfig} to its RDF representation
     * 
     * @param model a {@link Model} object. After successful completion of this method this Model will contain the RDF
     *              representation of this {@link LookupServiceConfig}.
     * @return the subject {@link Resource} that identifies this {@link LookupServiceConfig} in the Model.
     */
    public Resource export(Model model);
}
