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

import java.util.Optional;

import javax.annotation.Nullable;

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.repository.Repository;

/**
 * The ResourceDescriptionService provides information about resources. This
 * includes general information such as the type as well as description
 * properties which are typically a subset of properties actually available on
 * an entity. Finally, it provides a textual summary of a resource.
 * 
 * @author Wolfgang Schell <ws@metaphacts.com>
 */
public interface ResourceDescriptionService {
    /**
     * Get the description for the provided resource.
     * <p>
     * The description is typically based on the types (or primary type) of the
     * instance.
     * </p>
     * 
     * <p>
     * The result of this method is typically cached to speed up repeated lookups.
     * </p>
     * 
     * @param repository        repository for which to get the types
     * @param instanceIRI       IRI of the entity of which to fetch the description
     * @param preferredLanguage preferred language
     * @return {@link ResourceDescription} or empty if not available
     */
    Optional<ResourceDescription> getResourceDescription(Repository repository, IRI instanceIRI,
            String preferredLanguage);

    /**
     * Extracts description of specified resource from specified repository.
     *
     * @param resourceIri IRI of resource to extract descriptions for.
     * @return textual description of the resource if found in the specified
     *         repository, otherwise {@link Optional#empty}.
     */
    Optional<Literal> getDescription(IRI resourceIri, Repository repository, @Nullable String preferredLanguage);
}
