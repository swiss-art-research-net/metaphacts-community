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
package com.metaphacts.lookup.impl;

import java.io.Closeable;
import java.io.IOException;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Collectors;

import javax.inject.Inject;
import javax.validation.constraints.NotNull;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.rdf4j.common.net.ParsedIRI;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;

import com.google.common.base.Strings;
import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheBuilderSpec;
import com.metaphacts.cache.CacheManager;
import com.metaphacts.cache.LiteralCacheKey;
import com.metaphacts.cache.LookupResponseCacheEntry;
import com.metaphacts.cache.ExternalLabelDescriptionService;
import com.metaphacts.cache.PlatformCache;
import com.metaphacts.config.Configuration;
import com.metaphacts.lookup.api.LookupProcessingException;
import com.metaphacts.lookup.api.LookupService;
import com.metaphacts.lookup.model.LookupCandidate;
import com.metaphacts.lookup.model.LookupObjectPropertyLink;
import com.metaphacts.lookup.model.LookupProperty;
import com.metaphacts.lookup.model.LookupQuery;
import com.metaphacts.lookup.model.LookupRequest;
import com.metaphacts.lookup.model.LookupResponse;
import com.metaphacts.lookup.spi.TargetRepositoryAware;
import com.metaphacts.util.LanguageHelper;

/**
 * Abstract base implementation of a LookupService.
 *
 * <p>
 * This class performs caching of lookup results as configured using the {@code lookup:cacheConfig} property.
 * To disable caching set the cache configuration to {@code "maximumSize=0"}.
 * </p>
 *
 * @author Wolfgang Schell <ws@metaphacts.com>
 *
 * @param <CFG> LookupService config class
 */
public abstract class AbstractLookupService<CFG extends CommonLookupConfig> implements LookupService, Closeable {
    public static final String CACHE_SPEC_DEFAULT = "expireAfterWrite=10m,maximumSize=1000";
    public static final String CACHE_SPEC_NOCACHE = "maximumSize=0";

    private static final Logger logger = LogManager.getLogger(AbstractLookupService.class);
    private static final ValueFactory vf = SimpleValueFactory.getInstance();

    protected CFG config;

    @Inject
    protected ExternalLabelDescriptionService mutableCache;
    protected final Cache<String, LookupResponseCacheEntry> cache;
    protected final String cacheId;
    protected CacheManager cacheManager;

    @Inject
    protected Configuration globalConfig;

    protected AbstractLookupService(CFG config) {
        this.config = config;
        this.cacheId = generateCacheId();
        // the cache configuration is derived from the service-specific configuration
        // if there is none, the default cache config of the LookupService implementation is used.
        String cacheConfig = Optional.ofNullable(config.getLookupCacheConfig()).orElse(getDefaultLookupCacheConfig());
        if (CACHE_SPEC_NOCACHE.equals(cacheConfig.trim())) {
            logger.debug("Caching for " + cacheId + " is disabled");
            this.cache = null;
        } else {
            logger.debug("Configuring caching for " + cacheId + " with settings " + cacheConfig);
            this.cache = CacheBuilder.from(cacheConfig).build();
        }
    }

    /**
     * When injecting a CacheManager we configure the cache to be used
     * @param cacheManager
     */
    @Inject
    public void setCacheManager(CacheManager cacheManager) {
        this.cacheManager = cacheManager;
        try {
            unregisterCache();
            cacheManager.register(new PlatformCache() {
                @Override
                public void invalidate() {
                    if (cache != null) {
                        cache.invalidateAll();
                    }
                }

                @Override
                public void invalidate(Set<IRI> iris) {
                    // ignore
                }

                @Override
                public String getId() {
                    return cacheId;
                }
            });
        }
        catch (IllegalStateException e) {
            // this may happen when registration is performed multiple times, e.g.
            // because of multiple dependency injections
            // ignore
            logger.debug("Cache " + cacheId + " is already registered: " + e.getMessage());
        }
    }

    @Override
    public void close() throws IOException {
        unregisterCache();
    }

    protected void unregisterCache() {
        String cacheId = this.cacheId;
        if (cacheManager != null && cacheManager.isRegistered(cacheId)) {
            // avoid duplicate registration, e.g. when re-initializing the LookupServices
            cacheManager.deregister(cacheId);
        }
        if (cache != null) {
            cache.invalidateAll();
        }
    }

    protected String generateCacheId() {
        StringBuilder cacheId = new StringBuilder("LookupServiceCache.");
        if (config instanceof TargetRepositoryAware) {
            TargetRepositoryAware targetRepositoryAware = (TargetRepositoryAware) config;
            cacheId.append(targetRepositoryAware.getTargetRepository());
        }
        else {
            cacheId.append(System.identityHashCode(this));
        }
        return cacheId.toString();
    }

    /**
     * Get default cache configuration for this LookupService instance.
     *
     * <p>
     * The default implementation uses a value of {@value #CACHE_SPEC_DEFAULT}.
     * This may be overridden by sub classes, e.g. to deactivate caching (using
     * {@link #CACHE_SPEC_NOCACHE}).
     * </p>
     *
     * @return cache spec as interpreted by {@link CacheBuilderSpec}.
     * @see CacheBuilderSpec
     * @see #CACHE_SPEC_DEFAULT
     */
    protected String getDefaultLookupCacheConfig() {
        return CACHE_SPEC_DEFAULT;
    }

    public CFG getConfig() {
        return config;
    }

    /**
     * Perform lookup request.
     *
     * <p>
     * If a cache is configured the call is delegated to {@link #doLookupCached(LookupRequest)},
     * otherwise it is delegated directly to {@link #doLookup(LookupRequest)} without any cache lookup.
     * </p>
     *
     * <p>
     * Sub classes may decide using their own logic whether to perform a cache lookup first and delegate
     * to either {@link #doLookupCached(LookupRequest)} or {@link #doLookup(LookupRequest)}.
     * </p>
     *
     * @param request lookup request
     * @return lookup response
     * @throws LookupProcessingException in case of errors
     */
    @Override
    public LookupResponse lookup(LookupRequest request) throws LookupProcessingException {
        this.updateLanguage(request);
        if (cache != null) {
            return doLookupCached(request);
        } else {
            return doLookupInternal(request);
        }
    }

    /**
     * Perform lookup request.
     *
     * <p>
     * The request is first tried to be satisfied from the cache using {@link LookupRequest}.
     * If the cache does not yet contain a result
     * the lookup is performed using {@link #doLookup(LookupRequest)} and the result stored
     * in the cache under that key.
     * </p>
     *
     * @param request lookup request
     * @return lookup response or <code>null</code> if no caching configured
     * @throws LookupProcessingException in case of errors
     */
    protected LookupResponse doLookupCached(LookupRequest request) throws LookupProcessingException {
        if (cache == null) {
            return null;
        }
        try {
            final AtomicBoolean fromCache = new AtomicBoolean(true);
            String cacheKey = createCacheKey(request);
            LookupResponseCacheEntry entry = cache.get(cacheKey, () -> {
                fromCache.set(false);
                return createCacheEntry(request, this.doLookupInternal(request));
            });
            if (logger.isTraceEnabled()) {
                String queryLogId = request.getQueryId() + ":\"" + request.getQuery() + "\"";
                if (fromCache.get()) {
                    logger.trace("Retrieved " +
                            entry.getCandidateCount() +
                            " candidates from cache for request " + queryLogId);
                }
                else {
                    logger.trace("Caching " + entry.getCandidateCount() + " candidates for request " + queryLogId);
                }
            }
            return createLookupResponse(request, entry);
        } catch (ExecutionException e) {
            throw new LookupProcessingException(e.getMessage(), e);
        }
    }

    /**
     * Perform actual lookup request in an service-specific way.
     *
     * @param request lookup request
     * @return lookup response
     * @throws LookupProcessingException in case of errors
     */
    protected abstract LookupResponse doLookup(LookupRequest request) throws LookupProcessingException;

    /**
     * Create cache entry for provided lookup request and response.
     * 
     * <p>
     * Sub classes may override this method to store additional data in the cache entry.
     * </p>
     * 
     * @param request lookup request
     * @param response lookup response
     * @return cache entry
     */
    protected LookupResponseCacheEntry createCacheEntry(LookupRequest request, LookupResponse response) {
        return new LookupResponseCacheEntry(request.getQueryId(), request.getQuery(), response.getResult());
    }

    /**
     *
     * Create lookup response from cache entry for provided lookup request.
     *
     * <p>
     * Sub classes may override this method to perform additional modifications to the response.
     * </p>
     *
     * @param request lookup request
     * @param cacheEntry cache entry
     * @return lookup response
     */
    protected LookupResponse createLookupResponse(LookupRequest request, LookupResponseCacheEntry cacheEntry) {
        return new LookupResponse(request.getQueryId(), cacheEntry.getCandidates());
    }

    /**
     * Create a cache key for a {@link LookupRequest}.
     * 
     * <p>
     * The cache key consists of all relevant parts of the request such as the query, limit,
     * type, and all properties. 
     * </p>
     * 
     * @param request request for which to create a cache key.
     * 
     * @return cache key
     */
    protected String createCacheKey(LookupRequest request) {
        final String separator = "--"; 
        final String valueSeparator = "="; 
        StringBuilder key = new StringBuilder();
        LookupQuery query = request.getQuery();
        key.append(query.getQuery());
        Optional.ofNullable(query.getType()).ifPresent(t -> key.append(separator).append(t));
        Optional.ofNullable(query.getLimit()).ifPresent(t -> key.append(separator).append(t));
        Optional.ofNullable(query.getStrictType()).ifPresent(t -> key.append(separator).append(t));
        Optional.ofNullable(query.getPreferredLanguage()).ifPresent(t -> key.append(separator).append(t));
        Optional.ofNullable(query.getProperties()).ifPresent(p -> {
            // copy and sort list of properties by pid to get a defined order
            List<LookupProperty<?>> props = new ArrayList<>(p);
            props.sort((p1, p2) -> p1.getPid().compareTo(p2.getPid()));
            props.forEach(prop -> {
                    key.append(separator).append(prop.getPid()).append(valueSeparator);
                    Object value = prop.getValue();
                    if (value instanceof LookupObjectPropertyLink) {
                        LookupObjectPropertyLink link = (LookupObjectPropertyLink) value;
                        key.append(link.getId());
                    }
                    else {
                        key.append(value);
                    }
                }
            );
        });
        return key.toString();
    }

    protected LookupResponse doLookupInternal(LookupRequest request) throws LookupProcessingException {
        LookupResponse response = doLookup(request);
        return postProcess(request, response);
    }

    protected LookupResponse postProcess(LookupRequest request, LookupResponse response) throws LookupProcessingException {
        return this.adjustScores(request, cacheLabelsAndDescriptions(request, response));
    }

    protected LookupResponse cacheLabelsAndDescriptions(LookupRequest request, LookupResponse response) throws LookupProcessingException {
        this.extendResourceCacheUsingLookupResponse(request, response);
        return response;
    }

    protected LookupResponse adjustScores(LookupRequest request, LookupResponse response) {
        LookupScoreOptions scoreOptions = this.config.getLookupScoreOptions();
        if (scoreOptions == null) { 
            return response;
        }

        return adjustResponseScores(response, scoreOptions);
    }

    /**
     * Adjust scores of all candidates according to the provided score options.
     * 
     * <p>
     * The score is adjusted by first applying the factor and then adding the offset.
     * Using negative values for offset and/or factor are supported as well. Factor values 
     * between 0 and 1 can be used to attenuate a score.
     * </p>
     * 
     * <p>
     * If the scores options are similar to the defaults (factor {@code 1.0} and offset {@code 0})
     * then the response is returned unchanged.
     * </p>
     * 
     * @param response response containing candidates of which to adjust the score
     * @param scoreOptions score options, e.g. factor or offset
     * @return original or modified response
     */
    protected static LookupResponse adjustResponseScores(LookupResponse response, @NotNull LookupScoreOptions scoreOptions) {
        if (scoreOptions.equals(CommonLookupConfig.DEFAULT_SCORE_OPTIONS)) { 
            return response; 
        }
        List<LookupCandidate> candidates = response.getResult().stream().map(lookupCandidate -> {
            double newScore = lookupCandidate.getScore() * scoreOptions.getScoreFactor() + scoreOptions.getScoreOffset();
            return new LookupCandidate(
                lookupCandidate.getId(),
                lookupCandidate.getName(),
                lookupCandidate.getTypes(),
                newScore,
                lookupCandidate.isMatch(),
                lookupCandidate.getDataset(),
                lookupCandidate.getDescription()
            );
        }).collect(Collectors.toList());
        return new LookupResponse(response.getQueryId(), candidates);
    }

    protected void updateLanguage(LookupRequest request) {
        List<String> systemLanguages = this.globalConfig.getUiConfig().getPreferredLanguages();
        String preferredLanguage = LanguageHelper.mergePreferredLanguages(
            request.getQuery().getPreferredLanguage(),
            this.config.getPreferredLanguage(),
            LanguageHelper.mergePreferredLanguages(
                systemLanguages.toArray(new String[systemLanguages.size()])
            )
        );
        request.getQuery().setPreferredLanguage(preferredLanguage);
    }

    protected void extendResourceCacheUsingLookupResponse(LookupRequest request, LookupResponse response) {
        if (this.mutableCache == null)
            return;
        for(LookupCandidate candidate : response.getResult()) {
            if (!isValidIri(candidate.getId())) { continue; }
            IRI iri = vf.createIRI(candidate.getId());
            List<String> resolvedLanguageTags = LanguageHelper
                    .getPreferredLanguages(request.getQuery().getPreferredLanguage());
            LiteralCacheKey key = new LiteralCacheKey(iri, resolvedLanguageTags);
            if (!Strings.isNullOrEmpty(candidate.getName())) {
                Literal label = vf.createLiteral(candidate.getName());
                this.mutableCache.putLabel(key, label);
            }
            if (!Strings.isNullOrEmpty(candidate.getDescription())) {
                Literal description = vf.createLiteral(candidate.getDescription());
                this.mutableCache.putDescription(key, description);
            }
        }
    }

    private boolean isValidIri(String stringIri) {
        try {
            return stringIri != null && new ParsedIRI(stringIri).isAbsolute();
        } catch (URISyntaxException e) {
            return false;
        }
    }
}
