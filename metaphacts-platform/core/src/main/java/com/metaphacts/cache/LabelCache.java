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
 * Copyright (C) 2015-2020, metaphacts GmbH
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

import java.util.Map;
import java.util.Optional;
import javax.annotation.Nullable;

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.repository.Repository;
import com.metaphacts.config.groups.UIConfiguration;

/**
 * Fetch labels for resources by their IRIs.
 *
 * @author Wolfgang Schell <ws@metaphacts.com>
 * @author Daniil Razdiakonov <dr@metaphacts.com>
 *
 */
public interface LabelCache {
    /**
     * Extracts label of specified resource from specified repository.
     *
     * @param resourceIri IRI of resource to extract label for.
     * @return Label of resource if found in the specified repository;
     * otherwise {@link Optional#empty}.
     */
    Optional<Literal> getLabel(
        IRI resourceIri,
        Repository repository,
        @Nullable String preferredLanguage
    );

    /**
     * Extracts labels of specified resources from specified repository.
     *
     * @param resourceIris IRIs of resources to extract labels for.
     * @return Immutable map from IRI to label. If label was not found
     * it would be still present as {@link Optional#empty}.
     */
    Map<IRI, Optional<Literal>> getLabels(
        Iterable<? extends IRI> resourceIris,
        Repository repository,
        @Nullable String preferredLanguage
    );

    /**
     * Returns the defined label for the IRI if the literal in the optional is present, otherwise
     * computing a fall back label. The fallback is the IRI's local name and if local name is empty,
     * it simply returns the full IRI as a string.
     *
     * @param labelIfDefined
     *            the Optional label (not necessarily present)
     * @param iri
     *            the IRI (used for fallback computation)
     *
     * @return the label
     * @throws IllegalArgumentException
     *             if the label is undefined and the IRI is null
     */
    static String resolveLabelWithFallback(
        final Optional<Literal> labelIfDefined, final IRI iri)
    {
        return LiteralCache.resolveLiteralWithFallback(
                labelIfDefined, iri
        ).stringValue();
    }
}
