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
import java.util.Set;
import java.util.concurrent.TimeUnit;

import javax.annotation.Nullable;

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.model.util.Values;
import org.eclipse.rdf4j.repository.Repository;

import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.inject.Inject;
import com.metaphacts.cache.CacheManager;
import com.metaphacts.cache.LiteralCache;
import com.metaphacts.cache.LiteralCacheKey;
import com.metaphacts.cache.PlatformCache;
import com.metaphacts.cache.RepositoryBasedCache;
import com.metaphacts.config.Configuration;
import com.metaphacts.util.LanguageHelper;

/**
 * Base implementation of a {@link ResourceDescriptionService} which takes care
 * of caching of results from previous invocations to avoid costly
 * re-computation and lookups.
 * 
 * <p>
 * The cache configuration can be overridden using the {@link CacheManager}, the
 * defaults are as set by {@link RepositoryBasedCache#configureCacheBuilder()}.
 * </p>
 * 
 * <p>
 * Sub-classes only need to implement the various {@code lookup*()} methods.
 * </p>
 * 
 * @author Wolfgang Schell <ws@metaphacts.com>
 */
public abstract class AbstractCachingDescriptionService implements ResourceDescriptionService {
    protected static final String RESOURCEDESCRIPTION_CACHE_ID = "repository.resourceDescriptionCache";
    protected static final String DESCRIPTION_CACHE_ID = "repository.compositeDescriptionCache";
    protected final RepositoryBasedCache<LiteralCacheKey, ResourceDescription> resourceDescriptionCache;
    protected final LiteralCache descriptionCache;
    protected Configuration config;
    protected ModelService modelService;

    @Inject
    public AbstractCachingDescriptionService(Configuration config, CacheManager cacheManager,
            ModelService modelService) {
        this.config = config;
        this.modelService = modelService;
        // cache for resource descriptions
        this.resourceDescriptionCache = new RepositoryBasedCache<LiteralCacheKey, ResourceDescription>(
                RESOURCEDESCRIPTION_CACHE_ID) {
            @Override
            protected Optional<CacheLoader<LiteralCacheKey, Optional<ResourceDescription>>> createCacheLoader(
                    Repository repository) {
                return Optional.of(new CacheLoader<LiteralCacheKey, Optional<ResourceDescription>>() {
                    @Override
                    public Optional<ResourceDescription> load(LiteralCacheKey cacheKey) throws Exception {
                        return lookupResourceDescription(repository, cacheKey);
                    }
                });
            }

            protected void configureCacheBuilder(CacheBuilder<Object, Object> cacheBuilder) {
                cacheBuilder.maximumSize(1000).expireAfterWrite(10, TimeUnit.MINUTES);
            }

            @Override
            protected Optional<CacheManager> getCacheManager() {
                return Optional.of(cacheManager);
            }
        };
        // cache for composed textual descriptions
        // note: namespaceRegistry is not required when overriding queryAll(), so it's
        // set to null to avoid another injected dependency here
        this.descriptionCache = new LiteralCache(DESCRIPTION_CACHE_ID, null) {
            @Override
            protected List<String> getPreferredProperties() {
                // not required
                return Collections.emptyList();
            }

            @Override
            protected List<String> resolvePreferredLanguages(@Nullable String preferredLanguage) {
                return resolvePreferredLanguage(preferredLanguage);
            }

            /**
             * Provide customized cache specification for description cache
             */
            @Override
            protected CacheBuilder<Object, Object> createCacheBuilder() {
                return cacheManager.newBuilder(DESCRIPTION_CACHE_ID, config.getCacheConfig().getDescriptionCacheSpec());
            };

            @Override
            protected Map<LiteralCacheKey, Optional<Literal>> queryAll(Repository repository,
                    Iterable<? extends LiteralCacheKey> keys) {
                Map<LiteralCacheKey, Optional<Literal>> descriptions = new HashMap<>();
                for (LiteralCacheKey literalCacheKey : keys) {
                    descriptions.put(literalCacheKey, lookupDescription(repository, literalCacheKey.getIri(),
                            literalCacheKey.getPreferredLanguages()));
                }
                return descriptions;
            }
        };

        String simpleName = getClass().getSimpleName();
        cacheManager.register(new PlatformCache() {

            @Override
            public void invalidate() {
                descriptionCache.invalidate();
                resourceDescriptionCache.invalidate();
            }

            @Override
            public void invalidate(Set<IRI> iris) {
                descriptionCache.invalidate(iris);
                resourceDescriptionCache.invalidate(iris);
            }

            @Override
            public String getId() {
                return "platform." + simpleName;
            }

        });
    }

    @Override
    public Optional<ResourceDescription> getResourceDescription(Repository repository, IRI instanceIRI,
            String preferredLanguage) {
        List<String> preferredLanguages = resolvePreferredLanguage(preferredLanguage);
        return resourceDescriptionCache.get(repository, new LiteralCacheKey(instanceIRI, preferredLanguages));
    }

    @Override
    public Optional<Literal> getDescription(IRI resourceIri, Repository repository, String preferredLanguage) {
        return descriptionCache.getLiteral(resourceIri, repository, preferredLanguage);
    }

    protected Optional<Literal> lookupDescription(Repository repository, IRI resourceIri,
            List<String> preferredLanguages) {

        if (!canProvideDescription(resourceIri, repository)) {
            return Optional.empty();
        }

        // fetch ResourceDescription from cache and get its textual description
        return resourceDescriptionCache.get(repository, new LiteralCacheKey(resourceIri, preferredLanguages))
                .filter(resourceDescription -> resourceDescription != null)
                .map(resourceDescription -> resourceDescription.getDescription())
                .filter(description -> description != null)
                .map(description -> Values.literal(description));
    }

    protected boolean canProvideDescription(IRI resourceIri, Repository repository) {
        return true;
    }

    /**
     * Resolve preferred language with fallback to configured languages
     * 
     * @param preferredLanguage language tag (or comma-separated list of language
     *                          tags with decreasing order of preference) of the
     *                          preferred language(s) (optional). A language tag
     *                          consists of the language and optionally variant,
     *                          e.g. <code>de</code> or <code>de-CH</code>. See
     *                          <a href=
     *                          "https://tools.ietf.org/html/rfc4647">RFC4647</a>
     *                          for details.<br>
     *                          Examples: <code>en</code>,
     *                          <code>en,fr-CH,de,ru</code></li>
     * @return list of resolve languages to be used when retrieving any content
     *         possibly available in multiple languages.
     */
    protected List<String> resolvePreferredLanguage(@Nullable String preferredLanguage) {
        return LanguageHelper.getPreferredLanguages(preferredLanguage, config.getUiConfig().getPreferredLanguages());
    }

    /**
     * Lookup instance description for the specified resource in the specified
     * repository.
     * 
     * @param repository repository for which to get the instance descriptions
     * @param cacheKey   resource and preferred language for which to fetch the
     *                   instance description.
     * @return {@link ResourceDescription} or empty if not available
     */
    protected abstract Optional<ResourceDescription> lookupResourceDescription(Repository repository,
            LiteralCacheKey cacheKey);
}
