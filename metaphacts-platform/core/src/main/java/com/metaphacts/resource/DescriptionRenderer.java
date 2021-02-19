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
import org.eclipse.rdf4j.repository.Repository;

/**
 * Render a textual description of an instance based on its resource
 * description.
 * 
 * @author Wolfgang Schell <ws@metaphacts.com>
 */
public interface DescriptionRenderer {
    /**
     * Specifies whether this renderer can render a description for elements of the
     * specified type.
     * 
     * <p>
     * This method can be used e.g. to determine whether rendering of description is
     * possible before fetching the data for a resource and use a fallback
     * otherwise.
     * </p>
     * 
     * @param typeIRI type for which to render a description
     * @return <code>true</code> if a description can be rendered,
     *         <code>false</code> otherwise
     */
    boolean canRenderDescription(IRI typeIRI);

    /**
     * Render a textual description of an instance based on its resource
     * description.
     * 
     * @param instanceDescription instance description
     * @param repository          repository from which this instance was provided
     * @param preferredLanguage   language tag (or comma-separated list of language
     *                            tags with decreasing order of preference) of the
     *                            preferred language(s) (optional). A language tag
     *                            consists of the language and optionally variant,
     *                            e.g. <code>de</code> or <code>de-CH</code>. See
     *                            <a href=
     *                            "https://tools.ietf.org/html/rfc4647">RFC4647</a>
     *                            for details.<br>
     *                            Examples: <code>en</code>,
     *                            <code>en,fr-CH,de,ru</code></li>
     * @return
     */
    Optional<String> renderTemplate(ResourceDescription instanceDescription, Repository repository,
            @Nullable String preferredLanguage);
}
