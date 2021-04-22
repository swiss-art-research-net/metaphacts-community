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
package com.metaphacts.resource;

import java.util.Collection;
import java.util.HashSet;
import java.util.Set;

import org.eclipse.rdf4j.model.IRI;

/**
 * Default implementation of {@link PropertyDescription}
 * 
 * @author Wolfgang Schell <ws@metaphacts.com>
 */
public class DefaultPropertyDescription implements PropertyDescription {

    protected final IRI propertyIRI;
    protected String projectionName;
    protected final Set<IRI> propertyRoles;

    public DefaultPropertyDescription(IRI propertyIRI) {
        this(propertyIRI, null, null);
    }

    public DefaultPropertyDescription(IRI propertyIRI, String projectionName) {
        this(propertyIRI, projectionName, null);
    }

    public DefaultPropertyDescription(IRI propertyIRI, String projectionName, Set<IRI> propertyRoles) {
        this.propertyIRI = propertyIRI;
        this.projectionName = projectionName;
        this.propertyRoles = new HashSet<>();
        if (propertyRoles != null) {
            this.propertyRoles.addAll(propertyRoles);
        }
    }

    @Override
    public IRI getPropertyIRI() {
        return propertyIRI;
    }

    @Override
    public String getProjectionName() {
        return projectionName;
    }
    
    public void setProjectionName(String projectionName) {
        this.projectionName = projectionName;
    }

    @Override
    public String toString() {
        return new StringBuilder()
                .append(propertyIRI)
                .append(" (")
                .append(projectionName)
                .append(")")
                .toString();
    }

    @Override
    public Set<IRI> getPropertyRoles() {
        return propertyRoles;
    }

    public void setPropertyRoles(Collection<IRI> propertyRoles) {
        this.propertyRoles.clear();
        this.propertyRoles.addAll(propertyRoles);
    }

    public void clearPropertyRoles() {
        this.propertyRoles.clear();
    }

    public void addPropertyRoles(Collection<IRI> propertyRoles) {
        if (propertyRoles != null) {
            this.propertyRoles.addAll(propertyRoles);
        }
    }

    public void addPropertyRole(IRI... propertyRoles) {
        if (propertyRoles != null) {
            for (IRI propertyRole : propertyRoles) {
                this.propertyRoles.add(propertyRole);
            }
        }
    }

    @Override
    public boolean hasPropertyRole(IRI role) {
        return (propertyRoles != null && propertyRoles.contains(role));
    }
}
