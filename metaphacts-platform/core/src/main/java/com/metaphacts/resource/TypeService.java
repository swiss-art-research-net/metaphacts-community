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

import java.util.Collections;
import java.util.Iterator;
import java.util.Map;
import java.util.Optional;

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.repository.Repository;

/**
 * Fetch the type of the specified IRI(s).
 * 
 * <p>
 * Typically a resource has one or more {@code rdf:type} statements indicating
 * the type of an entity. In some dataset types might be expressed differently,
 * e.g. in Wikidata this is rather {@code wdt:P31}.
 * </p>
 * 
 * @author Wolfgang Schell <ws@metaphacts.com>
 */
public interface TypeService {
	/**
     * Get all types for a resource in the provided repository.
     * 
     * <p>
     * The type is typically the {@code rdf:type} of an instance, some systems like
     * Wikidata might use additional or different predicates to specify the type of
     * an entity
     * </p>
     * 
     * <p>
     * The result may contain multiple types. If the caller only needs the "primary"
     * type, it is suggested to simply take the first element of the iteration. The
     * actual order depends on the implementation.
     * </p>
     * 
     * <p>
     * The result of this method is typically cached to speed up repeated lookups.
     * </p>
     * 
     * @param resource   resource IRI for which to get types
     * @param repository repository from which to fetch type information
     * @return collection of types. The list might be empty but never
     *         <code>null</code>
     */
	default Iterable<IRI> getTypes(IRI resource, Repository repository) {
		return getAllTypes(Collections.singletonList(resource), repository).get(resource)
				.orElse(Collections.emptyList());
	}

    /**
     * Get the "primary" RDF types for the provided resource.
     * 
     * <p>
     * The type is typically the {@code rdf:type} of an instance, some systems like
     * Wikidata might use additional or different predicates to specify the type of
     * an entity
     * </p>
     * 
     * <p>
     * It is up to the implementation what to consider the primary type of an
     * entity. This could be e.g. the most specific type if a resource has multiple
     * types which in turn represent a (sub)class hierarchy.
     * </p>
     * 
     * <p>
     * The default implementation simply returns the first element of the types as
     * returned by {@link #getTypes(IRI)}.
     * </p>
     * 
     * <p>
     * The result of this method is typically cached to speed up repeated lookups.
     * </p>
     *
     * @param resource   IRI of the entity of which to fetch the type
     * @param repository repository for which to get the type
     * @return IRI of the entity's type or empty of not available
     */
    default Optional<IRI> getPrimaryType(IRI resource, Repository repository) {
        Iterator<IRI> iterator = getTypes(resource, repository).iterator();
        if (!iterator.hasNext()) {
            return Optional.empty();
        }
        return Optional.ofNullable(iterator.next());
    }

	/**
	 * Get all types for a resource in the provided repository.
	 * 
	 * @param resourceIris iterable of resource IRIs for which to get types
	 * @param repository   repository from which to fetch type information
	 * @return map of collection of types per resource IRI. If no types were found
	 *         for an IRI it would be still present as {@link Optional#empty}.
	 */
	Map<IRI, Optional<Iterable<IRI>>> getAllTypes(Iterable<? extends IRI> resourceIris, Repository repository);

    interface Provider {
        Optional<TypeService> getTypeService();
    }
}
