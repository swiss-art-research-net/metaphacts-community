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
package com.metaphacts.federation.service;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.Resource;
import org.eclipse.rdf4j.model.Value;
import org.eclipse.rdf4j.query.algebra.Service;
import org.eclipse.rdf4j.query.algebra.StatementPattern;

/**
 * Descriptor for custom services.
 * 
 * @author Andriy Nikolov an@metaphacts.com
 * @author Andreas Schwarte
 */
public interface ServiceDescriptor {

    public interface Parameter {

        public Resource getParameterId();

        public String getParameterName();

        public Optional<Value> getDefaultValue();

        public IRI getValueType();

        public List<StatementPattern> getSubjectPatterns();

        public List<StatementPattern> getObjectPatterns();

        // TODO does not belong to this interface
        public Resource getRootNode();
    }

    public Map<String, Parameter> getInputParameters();

    /**
     * The set of explicitly defined output parameters. Note that all such
     * {@link Parameter}s require to be referenced in the {@link StatementPattern}s
     * of the {@link Service}.
     * 
     * @return maps the output variable name
     */
    public Map<String, Parameter> getOutputParameters();

    /**
     * Returns the list of output variables that are provided by the service
     * implementation, independent of whether they are specified as explicit
     * {@link #getOutputParameters()}.
     * 
     * Note that this may be a superset of actually projected variables (e.g. if the
     * SERVICE contains an inner SELECT with variables).
     * 
     * @return
     */
    public List<String> getOutputBindingNames();


    // TODO these do not belong to this interface


    public String getServiceId();

    public String getLabel();

    public IRI getServiceIRI();

    public List<StatementPattern> getStatementPatterns();

    public Model getModel();
}
