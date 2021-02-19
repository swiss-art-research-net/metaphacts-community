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
package com.metaphacts.cache;

import java.util.List;
import java.util.Objects;

import javax.validation.constraints.NotNull;

import org.eclipse.rdf4j.model.IRI;

public class LiteralCacheKey {
    private final IRI iri;
    /**
     * The non-null language tag which is used for cache lookups
     * 
     * @see #equals(Object)
     * @see #hashCode()
     */
    private final @NotNull String languageTag;

    /**
     * The list of language tags in preference order
     * 
     * This list is expected to have a least one preferred language tag.
     */
    private final @NotNull List<String> preferredLanguages;

    /**
     * 
     * @param iri
     * @param preferredLanguages list of resolved language tags, must have at least
     *                           one preferred language
     * @throws IllegalArgumentException if the preferredLanguage parameter does not
     *                                  have at least one language tag
     */
    public LiteralCacheKey(IRI iri, List<String> preferredLanguages) {
        if (preferredLanguages == null || preferredLanguages.isEmpty()) {
            throw new IllegalArgumentException("Expected at least one preferred language");
        }
        this.iri = iri;
        this.preferredLanguages = preferredLanguages;
        this.languageTag = preferredLanguages.get(0);
    }

    /**
     * 
     * @return the resource IRI
     */
    public IRI getIri() {
        return this.iri;
    }

    /**
     * 
     * @return the language tag that is used for caching this entry
     */
    public String getLanguageTag() {
        return this.languageTag;
    }

    /**
     * 
     * @return the non-null list of preferred language tags with at least one item
     */
    public List<String> getPreferredLanguages() {
        return this.preferredLanguages;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        LiteralCacheKey that = (LiteralCacheKey) o;
        return Objects.equals(iri, that.iri) && Objects.equals(languageTag, that.languageTag);
    }

    @Override
    public int hashCode() {
        return Objects.hash(iri, languageTag);
    }
}
