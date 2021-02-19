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

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.StreamSupport;

import javax.annotation.Nullable;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.repository.Repository;

import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import com.google.inject.Inject;
import com.metaphacts.config.Configuration;
import com.metaphacts.config.groups.UIConfiguration;
import com.metaphacts.util.LanguageHelper;

/**
 * Implements interfaces of LabelCache and DescriptionCache.
 * Extraction and caching logics for batched access to URI labels, according
 * to the specification in {@link UIConfiguration#getPreferredLabels()} and
 * {@link UIConfiguration#getPreferredLanguages()}. The label cache maps IRIs
 * to Optional<Literal>. As it is not guaranteed that a literal for a given
 * IRI is present in the repo (i.e., the Optional may be not present),
 * the caller should use the the LabelCache's method
 * {@link LabelService#resolveLabelWithFallback(Optional, IRI)} in order to
 * safely get a display string for a given Optional + the IRI.
 * To cache labels and descriptions use {@link #putLabel} and {@link #putDescription}
 *
 * @author Daniil Razdiakonov <dr@metaphacts.com>
 */
public class ExternalLabelDescriptionService implements LabelService, DescriptionService {
    private static final Logger logger = LogManager.getLogger(ExternalLabelDescriptionService.class);

    public static final String LOOKUP_RESOURCE_DESCRIPTION_CACHE_ID = "LookupCandidateResourceDescriptionCache";
    private Cache<LiteralCacheKey, Literal> labelCache;
    private Cache<LiteralCacheKey, Literal> descriptionCache;
    private Configuration config;
    private CacheManager cacheManager;

    @Inject
    public ExternalLabelDescriptionService(
        Configuration config,
        CacheManager cacheManager
    ) {
        this.config = config;
        this.cacheManager = cacheManager;
        this.labelCache = CacheBuilder.from(config.getCacheConfig().getLabelCacheSpec()).build();
        this.descriptionCache = CacheBuilder.from(config.getCacheConfig().getDescriptionCacheSpec()).build();
        this.registerCaches();
    }

    public void registerCaches() {
        try {
            unregisterCache();
            cacheManager.register(new PlatformCache() {
                @Override
                public void invalidate() {
                    labelCache.invalidateAll();
                    descriptionCache.invalidateAll();
                }

                @Override
                public void invalidate(Set<IRI> iris) {
                    // ignore
                }

                @Override
                public String getId() {
                    return LOOKUP_RESOURCE_DESCRIPTION_CACHE_ID;
                }
            });
        } catch (IllegalStateException e) {
            // this may happen when registration is performed multiple times, e.g.
            // because of multiple dependency injections
            // ignore
            logger.debug("Cache " + LOOKUP_RESOURCE_DESCRIPTION_CACHE_ID + " is already registered: " + e.getMessage());
        }
    }

    protected void unregisterCache() {
        if (cacheManager != null && cacheManager.isRegistered(LOOKUP_RESOURCE_DESCRIPTION_CACHE_ID)) {
            // avoid duplicate registration, e.g. when re-initializing the LookupServices
            cacheManager.deregister(LOOKUP_RESOURCE_DESCRIPTION_CACHE_ID);
        }
        labelCache.invalidateAll();
        descriptionCache.invalidateAll();
    }

    @Override
    public Optional<Literal> getLabel(
        IRI resourceIri,
        Repository repository,
        @Nullable String preferredLanguage
    ) {
        List<String> languageTags = this.resolvePreferredLanguages(preferredLanguage);
        LiteralCacheKey key = new LiteralCacheKey(resourceIri, languageTags);
        return Optional.ofNullable(this.labelCache.getIfPresent(key));
    }

    @Override
    public Map<IRI, Optional<Literal>> getLabels(
        Iterable<? extends IRI> resourceIris,
        Repository repository,
        @Nullable String preferredLanguage
    ) {
        Map<IRI, Optional<Literal>> result = new LinkedHashMap<>();
        StreamSupport.stream(resourceIris.spliterator(), false)
            .forEach(iri -> result.put(iri, this.getLabel(iri, repository, preferredLanguage)));
        return result;
    }

    @Override
    public Optional<Literal> getDescription(
        IRI resourceIri,
        Repository repository,
        @Nullable String preferredLanguage
    ) {
        List<String> languageTags = this.resolvePreferredLanguages(preferredLanguage);
        LiteralCacheKey key = new LiteralCacheKey(resourceIri, languageTags);
        return Optional.ofNullable(this.descriptionCache.getIfPresent(key));
    }

    @Override
    public Map<IRI, Optional<Literal>> getDescriptions(
            Iterable<? extends IRI> resourceIris,
            Repository repository,
            @Nullable String preferredLanguage
    ) {
        Map<IRI, Optional<Literal>> result = new LinkedHashMap<>();
        StreamSupport.stream(resourceIris.spliterator(), false)
            .forEach(iri -> result.put(iri, this.getDescription(iri, repository, preferredLanguage)));
        return result;
    }

    /**
     * Resolve the given user preferredLanguage using {@link LanguageHelper} and add
     * those system preferred languages which are not already provided.
     * 
     * @param preferredLanguage
     * @return
     */
    protected List<String> resolvePreferredLanguages(@Nullable String preferredLanguage) {
        return LanguageHelper.getPreferredLanguages(preferredLanguage, config.getUiConfig().getPreferredLanguages());
    }

    public void putLabel(LiteralCacheKey key, Literal label) {
        this.labelCache.put(key, label);
    }

    public void putDescription(LiteralCacheKey key, Literal label) {
        this.descriptionCache.put(key, label);
    }
}
