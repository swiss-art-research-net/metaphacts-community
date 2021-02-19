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
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import javax.inject.Inject;

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.repository.Repository;

import com.google.common.collect.Iterables;
import com.metaphacts.cache.CacheManager;
import com.metaphacts.cache.ResourcePropertyCache;
import com.metaphacts.config.Configuration;
import com.metaphacts.config.NamespaceRegistry;
import com.metaphacts.config.PropertyPattern;
import com.metaphacts.util.Orderable;
import com.metaphacts.util.OrderableComparator;

public class DefaultTypeService implements TypeService, Orderable {

    public static final String DEFAULT_TYPE_SERVICE_CACHE_ID = "repository.DefaultTypeService";

    private Configuration config;
    private NamespaceRegistry namespaceRegistry;
    private CacheManager cacheManager;

    private final ResourcePropertyCache<IRI, Iterable<IRI>> cache = new ResourcePropertyCache<>(
            DEFAULT_TYPE_SERVICE_CACHE_ID) {

        @Override
        protected IRI keyToIri(IRI iri) {
            return iri;
        }

        @Override
        protected java.util.Optional<CacheManager> cacheManager() {
            return Optional.of(cacheManager);
        };

        @Override
        protected Map<IRI, Optional<Iterable<IRI>>> queryAll(Repository repository, Iterable<? extends IRI> iris) {
            if (Iterables.isEmpty(iris)) {
                return Collections.emptyMap();
            }

            List<String> preferredTypes = config.getUiConfig().getPreferredTypes();
            try {
                // convert to IRI list (filtering out invalid IRIs)
                List<PropertyPattern> typePatterns = preferredTypes.stream()
                        .map(pattern -> PropertyPattern.parse(pattern, namespaceRegistry)).collect(Collectors.toList());

                String queryString = constructPropertyQuery(iris, typePatterns);

                // for each input IRI we map to a list of lists of values, where
                // (1) the outer list represents the predicate index and
                // (2) the inner list contains the types for this predicate index
                // -> note this is done in a single pass (linear time & space w.r.t. result_
                Map<IRI, List<List<IRI>>> iriToPredicateToType = queryAndExtractProperties(repository, queryString,
                        preferredTypes.size(),
                        value -> (value instanceof IRI ? Optional.of((IRI) value) : Optional.empty()));

                // next, we flatten the inner list of list structure into one continuous list,
                // making sure that we have one entry per IRI
                Map<IRI, Optional<Iterable<IRI>>> types = new HashMap<>();
                for (IRI iri : iris) {
                    List<List<IRI>> liriToPredicate = iriToPredicateToType.get(iri);
                    types.put(iri, Optional.ofNullable(flattenProperties(liriToPredicate)));
                }

                return types;
            } catch (Exception ex) {
                throw new RuntimeException("Failed to query for types of IRI(s).", ex);
            }
        }
    };

    @Inject
    public DefaultTypeService() {
    }

    @Inject
    public void setCacheManager(CacheManager cacheManager) {
        this.cacheManager = cacheManager;
        cacheManager.register(cache);
    }

    @Inject
    public void setConfiguration(Configuration config) {
        this.config = config;
    }

    @Inject
    public void setNamespaceRegistry(NamespaceRegistry namespaceRegistry) {
        this.namespaceRegistry = namespaceRegistry;
    }

    @Override
    public Map<IRI, Optional<Iterable<IRI>>> getAllTypes(Iterable<? extends IRI> resourceIris, Repository repository) {
        return cache.getAll(repository, resourceIris);
    }

    @Override
    public int getOrder() {
        return OrderableComparator.MIDDLE;
    }

}
