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

import java.util.List;
import java.util.Optional;

import org.eclipse.rdf4j.model.Value;

import com.metaphacts.services.fields.FieldDefinition;

/**
 * A PropertyValue provides a set of values for a named property, optionally
 * with its source as defined by a {@link FieldDefinition}.
 * 
 * @author Wolfgang Schell <ws@metaphacts.com>
 */
public interface PropertyValue {
    /**
     * Get the property's description.
     * 
     * @return property description
     */
    PropertyDescription getPropertyDescription();

    /**
     * Get id of the property. This is typically not an IRI but rather a simple key,
     * e.g. the name of a projection variable in a SPARQL query.
     * 
     * @return id of the property
     */
    String getPropertyId();

    /**
     * Get the property value
     * 
     * @return
     */
    Optional<Value> getFirstValue();

    /**
     * Determine whether this property has at least one value provided
     * 
     * @return <code>true</code> if this property has at least one value provided,
     *         <code>false</code> otherwise
     */
    boolean hasValues();

    /**
     * Get the property value
     * 
     * @return
     */
    List<Value> getValues();

    /**
     * Get source of the property
     * 
     * @return field definition or empty if not available
     */
    Optional<FieldDefinition> getFieldDefinition();
}
