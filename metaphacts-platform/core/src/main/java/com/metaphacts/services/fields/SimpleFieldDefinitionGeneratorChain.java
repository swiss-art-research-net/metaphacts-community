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

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ExecutionException;

import org.eclipse.rdf4j.model.IRI;

import com.github.jsonldjava.shaded.com.google.common.collect.Lists;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import com.google.common.collect.Maps;
import com.metaphacts.cache.CacheManager;
import com.metaphacts.cache.PlatformCache;
import com.metaphacts.config.Configuration;

/**
 * A simple list-based implementation of {@link FieldDefinitionGeneratorChain}
 * 
 * @author Jeen Broekstra <jb@metaphacts.com>
 */
public class SimpleFieldDefinitionGeneratorChain implements PlatformCache, FieldDefinitionGeneratorChain {

    public static final String CACHE_ID = "platform.FieldDefinitionGeneratorCache";

    private final List<FieldDefinitionGenerator> generators = new ArrayList<>();

    private final LoadingCache<IRI, Optional<FieldDefinition>> cache;

    public SimpleFieldDefinitionGeneratorChain(Collection<FieldDefinitionGenerator> generators,
            CacheManager cacheManager, Configuration config) {
        this.generators.addAll(generators);
        this.cache = cacheManager
                .newBuilder(CACHE_ID, config.getCacheConfig().getFieldDefinitionCacheSpec())
                .build(new CacheLoader<IRI, Optional<FieldDefinition>>() {
                    @Override
                    public Optional<FieldDefinition> load(IRI key) {
                        return getFromGenerators(key);
                    }

                    @Override
                    public Map<IRI, Optional<FieldDefinition>> loadAll(Iterable<? extends IRI> keys) throws Exception {
                        return getFromGenerators(Lists.newArrayList(keys));
                    }
                });
        cacheManager.register(this);
    }

    public Optional<FieldDefinition> handle(IRI iri) {
        try {
            return this.cache.get(iri);
        } catch (ExecutionException e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public Map<IRI, FieldDefinition> handleAll(Collection<IRI> iris) {
        if (iris.isEmpty()) {
            // bypass cache because it will optimize to ignore a call with no input key params
            Map<IRI, Optional<FieldDefinition>> result = getFromGenerators(iris);
            cache.putAll(result);

            return flattenOptionMap(result);
        }

        try {
            return flattenOptionMap(this.cache.getAll(iris));
        } catch (ExecutionException e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public void invalidate() {
        this.cache.invalidateAll();
    }

    @Override
    public void invalidate(Set<IRI> iris) {
        this.cache.invalidateAll(iris);
    }

    @Override
    public String getId() {
        return CACHE_ID;
    }

    private Optional<FieldDefinition> getFromGenerators(IRI iri) {
        for (FieldDefinitionGenerator generator : generators) {
            Optional<FieldDefinition> result = generator.generate(iri);
            if (result.isPresent()) {
                return result;
            }
        }
        return Optional.empty();
    }

    private Map<IRI, Optional<FieldDefinition>> getFromGenerators(Collection<IRI> iris) {
        final Map<IRI, Optional<FieldDefinition>> result = Maps.newHashMap();

        for (FieldDefinitionGenerator generator : generators) {
            Map<IRI, FieldDefinition> generated = generator.generateAll(iris);

            // add all generated entries
            generated.forEach((iri, fd) -> {
                if (!result.containsKey(iri) || !result.get(iri).isPresent()) {
                    result.put(iri, Optional.ofNullable(fd));
                }
            });

        }

        if (!iris.isEmpty()) {
            // add entries in result for any query params that had no fd generated
            iris.forEach(iri -> {
                if (!result.containsKey(iri)) {
                    result.put(iri, Optional.empty());
                }
            });
        }

        return result;
    }

    private static <K, V> Map<K, V> flattenOptionMap(Map<K, Optional<V>> map) {
        Map<K, V> result = new HashMap<>();
        map.forEach((key, optional) -> {
            optional.ifPresent(value -> result.put(key, value));
        });
        return result;
    }
}
