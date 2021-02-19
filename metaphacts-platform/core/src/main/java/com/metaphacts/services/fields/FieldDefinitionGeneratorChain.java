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
package com.metaphacts.services.fields;

import java.util.Collection;
import java.util.Map;
import java.util.Optional;

import org.eclipse.rdf4j.model.IRI;

/**
 * An ordered sequence of {@link FieldDefinitionGenerator} objects that are messaged in turn to provide a
 * {@link FieldDefinition} for a particular resource.
 * 
 * @author Jeen Broekstra <jb@metaphacts.com>
 */
public interface FieldDefinitionGeneratorChain {
    /**
     * Find a {@link FieldDefinition} for the supplied resource identifier.
     * 
     * @param iri an {@link IRI} identifying a resource for which to look up or generate a {@link FieldDefinition}
     * @return an optional {@link FieldDefinition}. Returns the result of the first {@link FieldDefinitionGenerator}
     *         that supplies one. Empty if no {@link FieldDefinitionGenerator} can provide a definition for the given
     *         resource.
     */
    Optional<FieldDefinition> handle(IRI iri);

    /**
     * Find all known {@link FieldDefinition}s, optionally for a fixed list of input resources.
     * 
     * @param iris a collection of resources for which to generate a {@link FieldDefinition}. If the collection is
     *             empty, each generator may attempt to provide all known field definitions.
     * @return A Map keyed on field identifier, with a {@link FieldDefinition} as its value. The Map may be empty if no
     *         {@link FieldDefinitionGenerator} can provide any definitions.
     */
    Map<IRI, FieldDefinition> handleAll(Collection<IRI> iris);
}
