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

import java.util.Set;

import org.eclipse.rdf4j.model.IRI;

/**
 * Specifies information about a property of a type.
 * 
 * <p>
 * The property is identified by an IRI which is typically a predicate IRI.
 * </p>
 * 
 * <p>
 * Additionally, a property can be annotated with so-called property roles which
 * further specify hints on the contexts in which this property may be useful.
 * See <a href="http://datashapes.org/propertyroles.html">DataShapes
 * PropertyRoles</a> for more details.
 * </p>
 * 
 * @author Wolfgang Schell <ws@metaphacts.com>
 */
public interface PropertyDescription {
    /**
     * Get IRI of the property.
     * 
     * @return property IRI
     */
    IRI getPropertyIRI();

    /**
     * Name of a projection variable. This can be used to present this property's
     * value in a query or when rendering a template.
     * 
     * @return projection name
     */
    String getProjectionName();

    /**
     * Get roles for this property.
     * 
     * @return set of property roles. May be empty, but never null
     */
    Set<IRI> getPropertyRoles();

    /**
     * Determine whether the property has a certain role.
     * 
     * @param role role to check for
     * @return <code>true</code> if the property has a certain role,
     *         <code>false</code> otherwise
     */
    boolean hasPropertyRole(IRI role);
}
