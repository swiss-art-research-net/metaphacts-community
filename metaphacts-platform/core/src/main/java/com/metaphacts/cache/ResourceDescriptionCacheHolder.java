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

import com.google.common.cache.CacheBuilder;
import com.google.inject.Inject;
import com.metaphacts.config.Configuration;
import com.metaphacts.config.NamespaceRegistry;
import com.metaphacts.config.groups.UIConfiguration;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.repository.Repository;

import javax.annotation.Nullable;
import javax.inject.Singleton;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Implements interfaces of LabelCache and DescriptionCache.
 * Extraction and caching logics for batched access to URI labels, according
 * to the specification in {@link UIConfiguration#getPreferredLabels()} and
 * {@link UIConfiguration#getPreferredLanguages()}. The label cache maps IRIs
 * to Optional<Literal>. As it is not guaranteed that a literal for a given
 * IRI is present in the repo (i.e., the Optional may be not present),
 * the caller should use the the LabelCache's method
 * {@link LabelCache#resolveLabelWithFallback(Optional, IRI)} in order to
 * safely get a display string for a given Optional + the IRI.
 *
 * @author Johannes Trame <jt@metaphacts.com>
 * @author Michael Schmidt <ms@metaphacts.com>
 * @author Wolfgang Schell <ws@metaphacts.com>
 * @author Daniil Razdiakonov <dr@metaphacts.com>
 *
 */
@Singleton
public class ResourceDescriptionCacheHolder implements LabelCache, DescriptionCache {
    public static final String LABEL_CACHE_ID = "repository.LabelCache";
    public static final String DESCRIPTION_CACHE_ID = "repository.DescriptionCache";
    private final LiteralCache labelCache;
    private final LiteralCache descriptionCache;

    @Inject
    public ResourceDescriptionCacheHolder(
        Configuration config,
        NamespaceRegistry namespaceRegistry,
        CacheManager cacheManager
    ) {
        this.labelCache = new LiteralCache(LABEL_CACHE_ID, namespaceRegistry) {
            @Override
            protected List<String> getPreferredProperties() {
                return config.getUiConfig().getPreferredLabels();
            }

            @Override
            protected List<String> getPreferredLanguages() {
                return config.getUiConfig().getPreferredLanguages();
            }

            @Override
            protected String resolvePreferredLanguage(String preferredLanguage) {
                return config.getUiConfig().resolvePreferredLanguage(preferredLanguage);
            }

            /**
             * Provide customized cache specification for label cache
             */
            @Override
            protected CacheBuilder<Object,Object> createCacheBuilder() {
                return cacheManager.newBuilder(LABEL_CACHE_ID, config.getCacheConfig().getLabelCacheSpec());
            };
        };
        cacheManager.register(this.labelCache);

        this.descriptionCache = new LiteralCache(DESCRIPTION_CACHE_ID, namespaceRegistry) {
            @Override
            protected List<String> getPreferredProperties() {
                return config.getUiConfig().getPreferredDescription();
            }

            @Override
            protected List<String> getPreferredLanguages() {
                return config.getUiConfig().getPreferredLanguages();
            }

            @Override
            protected String resolvePreferredLanguage(String preferredLanguage) {
                return config.getUiConfig().resolvePreferredLanguage(preferredLanguage);
            }

            /**
             * Provide customized cache specification for description cache
             */
            @Override
            protected CacheBuilder<Object,Object> createCacheBuilder() {
                return cacheManager.newBuilder(DESCRIPTION_CACHE_ID, config.getCacheConfig().getDescriptionCacheSpec());
            };
        };
        cacheManager.register(this.descriptionCache);
    }

    @Override
    public Optional<Literal> getLabel(
        IRI resourceIri,
        Repository repository,
        @Nullable String preferredLanguage
    ) {
        return this.labelCache.getLiteral(resourceIri, repository, preferredLanguage);
    }

    @Override
    public Map<IRI, Optional<Literal>> getLabels(
        Iterable<? extends IRI> resourceIris,
        Repository repository,
        @Nullable String preferredLanguage
    ) {
        return this.labelCache.getLiterals(resourceIris, repository, preferredLanguage);
    }

    @Override
    public Optional<Literal> getDescription(
            IRI resourceIri,
            Repository repository,
            @Nullable String preferredLanguage
    ) {
        return this.descriptionCache.getLiteral(resourceIri, repository, preferredLanguage);
    }

    @Override
    public Map<IRI, Optional<Literal>> getDescriptions(
            Iterable<? extends IRI> resourceIris,
            Repository repository,
            @Nullable String preferredLanguage
    ) {
        return this.descriptionCache.getLiterals(resourceIris, repository, preferredLanguage);
    }
}
