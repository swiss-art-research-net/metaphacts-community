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

import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

import javax.annotation.Nullable;
import javax.validation.constraints.NotNull;

import org.apache.commons.lang3.StringUtils;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.repository.Repository;

import com.google.common.collect.Iterables;
import com.google.common.collect.Maps;
import com.google.common.util.concurrent.ThreadFactoryBuilder;
import com.google.inject.Inject;
import com.metaphacts.config.NamespaceRegistry;
import com.metaphacts.config.PropertyPattern;
import com.metaphacts.config.groups.UIConfiguration;

/**
 * Extraction and caching logics for batched access to literals.
 * The literal cache maps IRIs to Optional<Literal>. As it is not
 * guaranteed that a literal for a given
 * IRI is present in the repo (i.e., the Optional may be not present),
 * the caller should use the the LiteralCache's method
 * {@link LiteralCache#resolveLiteralWithFallback(Optional, IRI)} in order to
 * safely get a literal for a given Optional + the IRI.
 */
public abstract class LiteralCache extends ResourcePropertyCache<LiteralCacheKey, Literal> {
    private static final ValueFactory vf = SimpleValueFactory.getInstance();
    private NamespaceRegistry namespaceRegistry;

    @Inject
    public LiteralCache(
        String cacheId,
        NamespaceRegistry namespaceRegistry
    ) {
        super(cacheId);
        this.namespaceRegistry = namespaceRegistry;
    }

    @Override
    protected IRI keyToIri(LiteralCacheKey key) {
        return key.getIri();
    }

    protected abstract List<String> getPreferredProperties();

    /**
     * Function which accepts preferredLanguage and returns a list of language tags.
     * Merges the provided language with system preferred languages attached.
     * 
     * @param preferredLanguage A language tag (or comma-separated list of language
     *                          tags with decreasing order of preference) of the
     *                          preferred language(s). A language tag consists of
     *                          the language and optionally variant, e.g.
     *                          <code>de</code> or <code>de-CH</code>. See <a href=
     *                          "https://tools.ietf.org/html/rfc4647">RFC4647</a>
     *                          for details.
     * @return languageTags the list of languages with at least one item
     */
    protected abstract @NotNull List<String> resolvePreferredLanguages(@Nullable String preferredLanguage);


    /**
     * Extracts the preferred labels for a given IRI according to the specs
     * in {@link UIConfiguration#getPreferredLabels()} and
     * {@link UIConfiguration#getPreferredLanguages()}.
     *
     * @param repository the repository in which the literal is extracted
     * @param keys (IRI, languageTag) tuples for which the literal is extracted
     * @return the list of preferred literals, where index positions correspond
     *          to the index positions of the labels in the incoming list
     */
    @Override
    protected Map<LiteralCacheKey, Optional<Literal>> queryAll(
            Repository repository, Iterable<? extends LiteralCacheKey> keys) {
        // note: preferredLabels must not be empty by check in UIConfiguration.assertConsistency()

        // short path: if there are no IRIs to be looked up, return the empty map
        if (Iterables.isEmpty(keys)) {
            return Collections.emptyMap();
        }

        int batchSize = 1000;
        int numberOfThreads = 5;

        // if less than batch size items are requested, immediately execute
        if (keys instanceof Collection<?> && ((Collection<?>) keys).size() <= batchSize) {
            return queryAllBatched(repository, keys);
        }

        Map<LiteralCacheKey, Optional<Literal>> res = Maps.newConcurrentMap();
        ExecutorService executorService = Executors.newFixedThreadPool(numberOfThreads,
                new ThreadFactoryBuilder().setNameFormat("resource-fetch-%d").build());
        try {
            StreamSupport.stream(Iterables.partition(keys, batchSize).spliterator(), false).forEach(batch -> {
                executorService.execute(() -> res.putAll(queryAllBatched(repository, batch)));
            });
        } finally {
            executorService.shutdown();
            try {
                executorService.awaitTermination(30, TimeUnit.SECONDS);
            } catch (InterruptedException e1) {
                logger.warn("Failed to wait for literal computation: " + e1.getMessage());
                executorService.shutdownNow();
                throw new RuntimeException("Timeout while querying repository for labels", e1);
            }
        }

        return res;
    }

    /**
     * Batched variant of {@link #queryAll(Repository, Iterable)}.
     *
     * @param repository
     * @param keys
     * @return
     * @see #queryAll(Repository, Iterable)
     */
    private Map<LiteralCacheKey, Optional<Literal>> queryAllBatched(Repository repository,
            Iterable<? extends LiteralCacheKey> keys) {
        List<String> preferredLabels = this.getPreferredProperties();
        try {
            // convert to IRI list (filtering out invalid IRIs)
            List<PropertyPattern> labelPatterns = preferredLabels.stream()
                    .map(pattern -> PropertyPattern.parse(pattern, namespaceRegistry))
                    .collect(Collectors.toList());

            Iterable<IRI> iris = Iterables.transform(keys, key -> key.getIri());
            String queryString = constructPropertyQuery(iris, labelPatterns);

            // for each input IRI we map to a list of lists of literal, where
            // (1) the outer list represents the predicate index and
            // (2) the inner list contains the labels for this predicate index
            // -> note this is done in a single pass (linear time & space w.r.t. result_
            Map<IRI, List<List<Literal>>> iriToListList = queryAndExtractProperties(
                    repository, queryString, preferredLabels.size(),
                    value -> value instanceof Literal ? Optional.of((Literal)value) : Optional.empty());

            // next, we flatten the inner list of list structure into one continuous list,
            // making sure that we have one entry per IRI
            Map<LiteralCacheKey, List<Literal>> literalByKey = new HashMap<>();
            for (LiteralCacheKey key : keys) {
                List<List<Literal>> literals = iriToListList.get(key.getIri());
                literalByKey.put(key, flattenProperties(literals));
            }

            // extract the preferred literals based on language tag information
            return chooseLiteralsWithPreferredLanguage(literalByKey);

        } catch (Exception e) {
            throw new RuntimeException("Failed to query for literal of IRI(s).", e);
        }
    }

    /**
     * Wrapper that applies chooseLabelWithPreferredLanguage method to every member
     * of a literal list list, reducing each of the list to the literal with the best
     * matching literal.
     */
    private Map<LiteralCacheKey, Optional<Literal>> chooseLiteralsWithPreferredLanguage(
            Map<LiteralCacheKey, List<Literal>> labelCandidates
    ) {
        Map<LiteralCacheKey, Optional<Literal>> chosenLabels = new HashMap<>(labelCandidates.size());

        labelCandidates.forEach((key, literals) -> {
            Optional<Literal> chosen = chooseLabelWithPreferredLanguage(
                    literals, key.getLanguageTag(), key.getPreferredLanguages());
            chosenLabels.put(key, chosen);
        });

        return chosenLabels;
    }

    /**
     * Chooses, from the incoming list of literals the literal with the preferred
     * language as per {@link UIConfiguration#getPreferredLanguages()}. The
     * choice is defined by the following algorithm:
     *
     * 0.) Make languages ranking list equal to concat(selectedLanguage, preferredLanguages).
     *
     * 1.) We iterate over the languages ranking list in order. The first literal
     * in the list matching the current language tag is returned.
     *
     * 2.) If no hash map entry exists for any of the languages in the list, as
     * a fall back solution we return a non-language tag literal, if present
     * (as we assume this to be most specific).
     *
     * 3.) If if no such literal exists, we return the first one (thus making a
     * non-deterministic) random choice.
     *
     * 4.) If no literal exists at all, null is returned.
     *
     * @return the most appropriate literal in the list according to the selected language
     *         and the preferred language configuration
     */
    public static Optional<Literal> chooseLabelWithPreferredLanguage(
            List<Literal> literals,
            @NotNull String selectedLanguage,
            @NotNull List<String> otherPreferredLanguages
    ) {
        if (literals.isEmpty()) { // fast path: no labels detected
            return Optional.empty();
        }

        Map<String, Integer> languageToRank = new HashMap<>();
        languageToRank.put(selectedLanguage, 0);

        int nextRank = 1; // lower rank means better, best rank is zero
        for (String language : otherPreferredLanguages) {
            if (!languageToRank.containsKey(language)) { // filters out duplicate
                languageToRank.put(language, nextRank++);
            }
        }

        // as a fallback, watch out for non-language tagged literals (which are
        // identified by the empty string ""); note that we only use this as
        // a fallback if the empty string is not explicitly a member of the
        // preferredLanguages configuration
        if (!languageToRank.containsKey("")) {
            languageToRank.put("", nextRank++);
        }

        Literal bestObserved = null;                // init: none
        int bestObservedRank = Integer.MAX_VALUE;   // init: none
        for (Literal literal : literals) {
            Optional<String> language = literal.getLanguage();

            String languageNonOptional = language.orElse("");

            int curRank = languageToRank.getOrDefault(
                    languageNonOptional,
                    Integer.MAX_VALUE - 1 /* better than uninitialized*/
            );

            if (curRank==0) { // optimal match found

                return Optional.of(literal);

            } else if (curRank<bestObservedRank) { // remember best match thus far

                bestObservedRank = curRank;
                bestObserved = literal;

            } // else: continue scanning

        }

        return Optional.ofNullable(bestObserved); // no optimal match
    }

    /**
     * Extracts literal of specified resource from specified repository.
     *
     * @param resourceIri IRI of resource to extract descriptions for.
     * @return Description of resource if found in the specified repository;
     * otherwise {@link Optional#empty}.
     */
    public Optional<Literal> getLiteral(
            IRI resourceIri,
            Repository repository,
            @Nullable String preferredLanguage
    ) {
        return getLiterals(
                Collections.singletonList(resourceIri), repository, preferredLanguage
        ).get(resourceIri);
    }

    /**
     * Extracts descriptions of specified resources from specified repository.
     *
     * @param resourceIris IRIs of resources to extract descriptions for.
     * @return Immutable map from IRI to literal. If literal was not found
     * it would be still present as {@link Optional#empty}.
     */
    public Map<IRI, Optional<Literal>> getLiterals(
            Iterable<? extends IRI> resourceIris,
            Repository repository,
            @Nullable String preferredLanguage
    ) {
        List<String> preferredLanguages = this.resolvePreferredLanguages(preferredLanguage);

        Iterable<LiteralCacheKey> keys = StreamSupport
                .stream(resourceIris.spliterator(), false)
                .map(iri -> new LiteralCacheKey(iri, preferredLanguages))
                .collect(Collectors.toList());

        Map<IRI, Optional<Literal>> result = new HashMap<>();
        this.getAll(repository, keys).forEach(
                (key, literal) -> result.put(key.getIri(), literal)
        );
        return result;
    }

    /**
     * Returns the defined literal for the IRI if the literal in the optional is present, otherwise
     * computing a fall back literal. The fallback is the IRI's local name and if local name is empty,
     * it simply returns the full IRI as a string.
     *
     * @param literalIfDefined
     *            the Optional literal (not necessarily present)
     * @param iri
     *            the IRI (used for fallback computation)
     *
     * @return the literal
     * @throws IllegalArgumentException
     *             if the literal is undefined and the IRI is null
     */
    public static Literal resolveLiteralWithFallback(
            final Optional<Literal> literalIfDefined, final IRI iri) {

        if (literalIfDefined.isPresent()) {
            return literalIfDefined.get();
        } else {

            if (iri==null) {
                throw new IllegalArgumentException("IRI must not be null");
            }

            final String localName = iri.getLocalName();
            if(!StringUtils.isEmpty(localName)){
                return vf.createLiteral(localName);
            }
            return vf.createLiteral(iri.stringValue());
        }
    }
}
