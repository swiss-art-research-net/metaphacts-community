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

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import javax.annotation.Nullable;

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.repository.Repository;

import com.metaphacts.util.AbstractDelegatingProvider;

/**
 * DescriptionService which delegates to a list of other implementations. The
 * first valid value returned from an instance is used.
 * 
 * @author Wolfgang Schell <ws@metaphacts.com>
 */
public class DelegatingDescriptionService extends AbstractDelegatingProvider<DescriptionService> implements DescriptionService {
    

    public DelegatingDescriptionService() {
        super();
    }

    public DelegatingDescriptionService(List<DescriptionService> delegates) {
        super(delegates);
    }

    @Override
    public Optional<Literal> getDescription(
        IRI resourceIri,
        Repository repository,
        @Nullable String preferredLanguage
    ) {
        return this.delegates.stream()
            .map(delegate -> delegate.getDescription(resourceIri, repository, preferredLanguage))
            .filter(Optional::isPresent)
            .map(Optional::get)
            .findFirst();
    }

    @Override
    public Map<IRI, Optional<Literal>> getDescriptions(
        Iterable<? extends IRI> resourceIris,
        Repository repository,
        @Nullable String preferredLanguage
    ) {
        Iterable<? extends IRI> irisToFetch = resourceIris;
        Map<IRI, Optional<Literal>> result = new HashMap<>();
        // For each cache implementation we query items from "irisToFetch" list and get result map,
        // then we check the results and all iris for which we get empty results we put in the new
        // list to fetch IRIs on the next step from the other implementations
        for (DescriptionService dc : this.delegates) {
            // Get results from the current cache implementation
            Map<IRI, Optional<Literal>> map = dc.getDescriptions(irisToFetch, repository, preferredLanguage);
            List<IRI> remainingIrisToFetch = new ArrayList<>();
            // Check results and put empty in the "remainingIrisToFetch"
            for (var entry : map.entrySet()) {
                Optional<Literal> literal = entry.getValue();
                if (literal.isEmpty()) {
                    remainingIrisToFetch.add(entry.getKey());
                }
            }
            // Save relevant results
            result.putAll(map);
            // Stop if all result are get
            if (remainingIrisToFetch.size() == 0) {
                break;
            } else {
                // Set IRIs with empty results to be fetched from other implementations
                irisToFetch = remainingIrisToFetch;
            }
        }
        // add negative result for all unresolved descriptions
        for (IRI iri : resourceIris) {
            if (!result.containsKey(iri)) {
                result.put(iri, Optional.empty());
            }
        }
        return result;
    }

}
