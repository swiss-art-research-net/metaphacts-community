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
import org.eclipse.rdf4j.repository.Repository;

/**
 * Provider for properties for the specified type.
 * <p>
 * An implementation might e.g. scan for SHACL property shapes or evaluate
 * domain and range relations to determine the properties associated with a
 * type.
 * </p>
 * 
 * @author Wolfgang Schell <ws@metaphacts.com>
 */
public interface TypePropertyProvider {
    /**
     * Get the list of properties for the specified type.
     * 
     * @param repository repository for which to get the type description
     * @param typeIRI    type for which to get the description properties
     * 
     * @return list of properties or empty if not available
     */
    Optional<List<PropertyDescription>> getProperties(Repository repository, IRI typeIRI);

    /**
     * Get the list of properties for the specified type and role.
     * 
     * <p>
     * The default implementation of this method simply fetches all properties using
     * {@link #getProperties(Repository, IRI)} and filters the results by role.
     * </p>
     * 
     * @param repository repository for which to get the type description
     * @param typeIRI    type for which to get the description properties
     * 
     * @return list of properties or empty if not available
     */
    default Optional<List<PropertyDescription>> getPropertiesForRole(Repository repository, IRI typeIRI,
            IRI propertyRole) {
        Optional<List<PropertyDescription>> props = getProperties(repository, typeIRI);
        if (props.isEmpty()) {
            return Optional.empty();
        }
        List<PropertyDescription> properties = props.get();
        List<PropertyDescription> roleProperties = properties.stream()
                .filter(property -> property.hasPropertyRole(propertyRole)).collect(Collectors.toList());
        if (roleProperties.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(roleProperties);
    }
}
