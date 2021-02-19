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

import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.repository.Repository;

import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import com.google.common.collect.Maps;
import com.google.common.util.concurrent.UncheckedExecutionException;

/**
 * Abstract per-repository cache.
 * @author Wolfgang Schell <ws@metaphacts.com>
 *
 * @param <KEY> key type
 * @param <VALUE> value type
 */
public abstract class RepositoryBasedCache<KEY, VALUE> implements PlatformCache {
    // implementation note: this functionality was extracted from ResourcePropertyCache
    
    private static final Logger logger = LogManager.getLogger(RepositoryBasedCache.class);
    
    private final Map<Repository, Cache<KEY, VALUE>> repositoryMap  = Maps.newConcurrentMap();
    
    private final String cacheId;

    protected RepositoryBasedCache(String cacheId) {
        this.cacheId = cacheId;
    }
    
    /**
	 * Returns the value associated with {@code key} in this cache, or {@code empty}
	 * if there is no cached value for {@code key}.
	 * 
	 * @param repository repository for which to get the value
	 * @param key        key for which to get the value
	 * @return value or empty if there was none and could not be loaded
	 */
    public Optional<VALUE> getIfPresent(Repository repository, KEY key) {
        initializeCache(repository);
        return Optional.ofNullable(repositoryMap.get(repository).getIfPresent(key));
    }

	/**
	 * Returns the value associated with {@code key} in this cache, or {@code empty}
	 * if there is no cached value for {@code key}.
	 * 
	 * <p>
	 * If there is no value yet and the cache is a LoadingCache, the value will be
	 * loaded using the CacheLoader.
	 * </p>
	 * 
	 * @param repository repository for which to get the value
	 * @param key        key for which to get the value
	 * @return value or empty if there was none and could not be loaded
	 */
	public Optional<VALUE> get(Repository repository, KEY key) {
		initializeCache(repository);
		Cache<KEY, VALUE> cache = repositoryMap.get(repository);
		if (cache instanceof LoadingCache) {
			try {
				LoadingCache<KEY, VALUE> loadingCache = (LoadingCache<KEY, VALUE>) cache;
				return Optional.ofNullable(loadingCache.get(key));
            } catch (UncheckedExecutionException | ExecutionException e) {
                if (e.getCause() instanceof NoSuchElementException) {
                    logger.trace("Element not found: " + e.getMessage());
                } else {
                    // there must have been some issue -> log it
                    logger.debug("Failed to load cache {} for key {}", cacheId, key);
                    logger.trace("Details: ", e);
                }
				return Optional.empty();
			}
		}
		return Optional.ofNullable(cache.getIfPresent(key));
	}

    protected NoSuchElementException notFound(String message) {
        throw new NoSuchElementException(message);
    }

    /**
     * Returns a map of the values associated with {@code keys} in this cache. The returned map will
     * only contain entries which are already present in the cache.
     * 
     * @param repository repository for which to get the value
     * @param keys keys for which to get values
     * 
     * @return map of values
     */
    public Map<KEY, VALUE> getAllPresent(Repository repository, Iterable<? extends KEY> keys) {
        initializeCache(repository);
        return repositoryMap.get(repository).getAllPresent(keys);
    }
    
    /**
     * Get cache for the specified repository.
     * 
     * @param repository repository for which to get the cache
     * @return per-repository cache
     */
    public Cache<KEY, VALUE> getCache(Repository repository) {
        initializeCache(repository);
        return repositoryMap.get(repository);
    }

    protected void initializeCache(Repository repository) {
        if (repositoryMap.containsKey(repository)) { return; }

        logger.debug("Initializing cache for repository: {}", repository);
        Cache<KEY, VALUE> cache = createCacheLoader(repository)
            .map(loader -> (Cache<KEY, VALUE>) createCacheBuilder().build(loader))
            .orElse(createCacheBuilder().build());
        repositoryMap.put(repository, cache);
    }

    /**
     * Create a CacheLoader for the cache.
     * @param repository repository for which to create the CacheLoader
     * @return CacheLoader or empty for a non-loading cache
     */
    protected abstract Optional<CacheLoader<KEY, VALUE>> createCacheLoader(Repository repository);

    /**
     * Create the {@link CacheBuilder}.
     * 
     * <p>
     * If available, use the {@link CacheManager} provided by
     * {@link #cacheService()}
     * </p>
     * 
     * <p>
     * Default settings:
     * </p>
     * 
     * <ul>
     * <li>maximumSize: 1000</li>
     * <li>expireAfterAccess: 30 minutes</li>
     * </ul>
     * 
     * <p>
     * Sub-classes may provide a configuration suitable for the use case.
     * </p>
     * 
     * @return
     */
    protected CacheBuilder<Object, Object> createCacheBuilder() {
        if (getCacheManager().isPresent()) {
            return getCacheManager().get().newBuilder(cacheId, cacheBuilder -> configureCacheBuilder(cacheBuilder));
        }
        CacheBuilder<Object, Object> cacheBuilder = CacheBuilder.newBuilder();
        configureCacheBuilder(cacheBuilder);
        return cacheBuilder;
    }
    
    protected void configureCacheBuilder(CacheBuilder<Object, Object> cacheBuilder) {
        cacheBuilder.maximumSize(1000).expireAfterAccess(30, TimeUnit.MINUTES);
    }

    protected Optional<CacheManager> getCacheManager() {
        return Optional.empty();
    }

    @Override
    public void invalidate() {
        repositoryMap.values().forEach(Cache::invalidateAll);
        repositoryMap.clear();
    }

    /**
     * This variant of {@link #invalidate(Set)}) is ignored, but can be overridden to 
     * provide per-IRI invalidation.
     */
    @Override
    public void invalidate(Set<IRI> iris) {
        // ignore
    }

    @Override
    public String getId() {
        return cacheId;
    }
}
