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
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import javax.ws.rs.HttpMethod;
import javax.ws.rs.client.Entity;
import javax.ws.rs.core.GenericType;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.Status.Family;
import javax.ws.rs.core.Response.StatusType;

import com.google.common.base.Strings;
import org.apache.http.HttpException;
import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.repository.Repository;

import com.google.common.collect.Iterables;
import com.google.common.collect.Maps;
import com.google.common.util.concurrent.ThreadFactoryBuilder;
import com.metaphacts.rest.endpoint.ResourceUtilsEndpoint;

import net.minidev.json.JSONArray;

/**
 * This abstract class directs all literal requests to a remote instance of the
 * platform. The remote service url is fetched from the lookup service manifest.
 *
 * <p>
 * The remote endpoint currently requires authentication but no specific
 * permissions, see {@link ResourceUtilsEndpoint} for details.
 * </p>
 *
 * @author Daniil Razdiakonov <dr@metaphacts.com>
 * @see ResourceUtilsEndpoint#getLabelsForRdfValue(Optional, Optional,
 *      com.fasterxml.jackson.core.JsonParser)
 * @see ResourceUtilsEndpoint#getDescriptionsForRdfValues(Optional, Optional,
 *      com.fasterxml.jackson.core.JsonParser)
 */
public abstract class RemoteLiteralCache extends LiteralCache {
    private final RemoteServiceConfiguration config;
    private static final ValueFactory vf = SimpleValueFactory.getInstance();

    public RemoteLiteralCache(
        String cacheId,
        RemoteServiceConfiguration config
    ) {
        super(cacheId, /* the NamespaceRegistry is not actually required */ null);
        this.config = config;
    }

    @Override
    protected List<String> getPreferredProperties() {
        // this method will never be called but is required from the parent class
        return Collections.emptyList();
    }

    @Override
    protected Map<LiteralCacheKey, Optional<Literal>> queryAll(
        Repository repository, Iterable<? extends LiteralCacheKey> keys
    ) {
        // short path: if there are no IRIs to be looked up, return the empty map
        if (Iterables.isEmpty(keys)) {
            return Collections.emptyMap();
        }


        Map<String, List<LiteralCacheKey>> batchesByLang = new HashMap<>();
        keys.forEach(key -> {
            var batchLangTag = key.getLanguageTag();
            if (!batchesByLang.containsKey(batchLangTag)) {
                batchesByLang.put(batchLangTag, new ArrayList<>());
            }
            var batch = batchesByLang.get(batchLangTag);
            batch.add(key);
        });
        Map<LiteralCacheKey, Optional<Literal>> results = Maps.newConcurrentMap();
        ExecutorService executorService = createExecutorService();
        try {
            for (var entry : batchesByLang.entrySet()) {
                executorService.execute(() -> results.putAll(
                        queryAllBatched(entry.getKey(), entry.getValue())
                ));
            }
        } finally {
            executorService.shutdown();
            try {
                executorService.awaitTermination(30, TimeUnit.SECONDS);
            } catch (InterruptedException e1) {
                executorService.shutdownNow();
                throw new RuntimeException("Timeout while querying remote service for literals", e1);
            }
        }
        // add negative result for all unresolved literals
        for (LiteralCacheKey key : keys) {
            if (!results.containsKey(key)) {
                results.put(key, Optional.empty());
            }
        }
        return results;
    }

    /**
     * Create ExecutorService for the parallel/batched requests.
     * @return ExecutorService
     */
    protected ExecutorService createExecutorService() {
        // TODO create this only once and keep it for the lifetime of the service
        int numberOfThreads = 5;
        ExecutorService executorService = Executors.newFixedThreadPool(numberOfThreads,
                new ThreadFactoryBuilder().setNameFormat("remote-resource-fetch-%d").build());
        return executorService;
    }

    /**
     * Request labels for LiteralCacheKeys from the batch
     * Where the batch is a set of keys grouped by the preferredLanguage
     * @param batchPreferredLanguage
     * @param batch
     * @return
     */
    protected Map<LiteralCacheKey, Optional<Literal>> queryAllBatched(
        String batchPreferredLanguage,
        Iterable<LiteralCacheKey> batch
    ) {
        JSONArray jsonArray = new JSONArray();
        for (var key : batch) {
            jsonArray.add(key.getIri().stringValue());
        }
        logger.trace("Fetching {} labels from {} with preferred language '{}'",
                jsonArray.size(), config.getRemoteUrl(), batchPreferredLanguage);
        try {
            Entity<String> entity = Entity.entity(jsonArray.toJSONString(), MediaType.APPLICATION_JSON);
            Response response = this.config.getTarget()
                    .queryParam("repository", this.config.getTargetRepository())
                    .queryParam("preferredLanguage", batchPreferredLanguage)
                    .request()
                    .header("Accept", MediaType.APPLICATION_JSON)
                    .build(HttpMethod.POST, entity).invoke();

            final StatusType status = response.getStatusInfo();
            if (!Family.SUCCESSFUL.equals(status.getFamily())) {
                String reason = response.getStatusInfo().getReasonPhrase();
                logger.warn("Failed to fetch labels for " + jsonArray.size() + "IRIs with '" + batchPreferredLanguage
                        + "' preferred language from " + this.config.getRemoteUrl() + ": HTTP " + status.getStatusCode()
                        + ": " + reason);
                throw new HttpException(reason);
            }

            Map<LiteralCacheKey, Optional<Literal>> resultMap = new HashMap<>();
            Map<String, String> remoteResult = response.readEntity(new GenericType<>() {});
            if (remoteResult != null) {
                logger.trace("Successfully fetched {} labels", remoteResult.size());
                for (LiteralCacheKey key : batch) {
                    var text = remoteResult.get(key.getIri().stringValue());
                    var literal = Optional.ofNullable(Strings.isNullOrEmpty(text) ? null : vf.createLiteral(text));
                    resultMap.put(key, literal);
                }
            }
            return resultMap;
        } catch (Exception e) {
            logger.error("Failed to fetch literals from remote service {}: {}", config.getRemoteUrl(), e.getMessage());
            logger.debug("Details:", e);
            Map<LiteralCacheKey, Optional<Literal>> emptyMap = new HashMap<>();
            batch.forEach(iri -> emptyMap.put(iri, Optional.empty()));
            return emptyMap;
        }
    }
}
