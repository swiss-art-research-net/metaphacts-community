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
import java.util.stream.Collectors;

import org.eclipse.rdf4j.model.IRI;

/**
 * Description for a type.
 * 
 * <p>
 * The description provides information for a type like:
 * <ul>
 * <li>type IRI and label</li>
 * <li>set of properties</li>
 * </ul>
 * </p>
 * 
 * @author Wolfgang Schell <ws@metaphacts.com>
 */
public interface TypeDescription {
    /**
     * Get type IRI
     * 
     * @return type IRI
     */
    IRI getTypeIRI();

    /**
     * Get a label for the current type.
     * 
     * @return type label
     */
    String getTypeLabel();

    /**
     * Get a list of properties which are considered description for representing an
     * entity of this type
     * 
     * @return list of properties, may be empty but never <code>null</code>
     */
    List<PropertyDescription> getProperties();

    /**
     * Determine whether this type description has properties.
     * 
     * @return true when this type description has properties, <code>false</code>
     *         otherwise
     */
    default boolean hasProperties() {
        List<PropertyDescription> properties = getProperties();
        return (properties != null) && !properties.isEmpty();
    }

    /**
     * Determine whether this type description has properties annotated with the
     * specified property role.
     * 
     * @return true when this type description has properties annotated with the
     *         specified property role, <code>false</code> otherwise
     */
    default boolean hasPropertiesForRole(IRI propertyRole) {
        Optional<List<PropertyDescription>> properties = getPropertiesForRole(propertyRole);
        return properties.isPresent() && !properties.get().isEmpty();
    }

    /**
     * Get property description for specified property IRI.
     * 
     * @param propertyIRI IRI of property for which to get the property description
     * @return property description or empty if not available
     */
    default Optional<PropertyDescription> getProperty(IRI propertyIRI) {
        if (propertyIRI == null) {
            return Optional.empty();
        }
        List<PropertyDescription> properties = getProperties();
        if (properties == null || properties.isEmpty()) {
            return Optional.empty();
        }
        return properties.stream().filter(property -> propertyIRI.equals(property.getPropertyIRI())).findFirst();
    }

    /**
     * Get properties annotated with the specified property role.
     * 
     * @param propertyRole IRI of property role to use for the lookup
     * @return list of properties annotated with the specified property role or
     *         empty when there are no matching properties
     */
    default Optional<List<PropertyDescription>> getPropertiesForRole(IRI propertyRole) {
        List<PropertyDescription> properties = getProperties();
        if (properties == null || properties.isEmpty()) {
            return Optional.empty();
        }
        List<PropertyDescription> roleProperties = properties.stream()
                .filter(property -> property.hasPropertyRole(propertyRole)).collect(Collectors.toList());
        if (roleProperties.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(roleProperties);
    }
}