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

import static org.eclipse.rdf4j.model.util.Values.iri;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

import javax.inject.Inject;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.repository.Repository;

import com.google.common.collect.Iterables;
import com.metaphacts.cache.CacheManager;
import com.metaphacts.cache.PlatformCache;
import com.metaphacts.cache.ResourcePropertyCache;
import com.metaphacts.config.NamespaceRegistry;
import com.metaphacts.config.PropertyPattern;
import com.metaphacts.lookup.api.EntityTypesFetchingException;
import com.metaphacts.lookup.api.LookupProcessingException;
import com.metaphacts.lookup.api.LookupService;
import com.metaphacts.lookup.api.LookupServiceManager;
import com.metaphacts.lookup.impl.AbstractLookupService;
import com.metaphacts.lookup.model.LookupCandidate;
import com.metaphacts.lookup.model.LookupEntityType;
import com.metaphacts.lookup.model.LookupRequest;
import com.metaphacts.lookup.model.LookupResponse;
import com.metaphacts.repository.RepositoryManagerInterface;

public class AggregationLookupService extends AbstractLookupService<AggregationLookupConfig> {
    private static final Logger logger = LogManager.getLogger(AggregationLookupService.class);
    public static final String SAMEAS_CACHE_ID = "repository.AggregationLookupService.SameAsCache";
    public static final String DEFAULT_SAMEAS_PATTERN = "^owl:sameAs";
    public static final int SCORE_REFERENCE_DIGITS = 2;
    public static final int SAME_SCORE_REFERENCE_DIGITS = SCORE_REFERENCE_DIGITS + 4;
    public static final int SCORE_SAME_AS_DIGITS = SAME_SCORE_REFERENCE_DIGITS + 4;
    public static final double SCORE_SAME_AS_OFFSET = 1 / Math.pow(10, SCORE_SAME_AS_DIGITS);

    protected LookupServiceManager lookupServiceManager;
    protected RepositoryManagerInterface repositoryManager;
    protected NamespaceRegistry namespaceRegistry;
    protected List<PropertyPattern> sameAsPatterns;

    protected final ResourcePropertyCache<IRI, Iterable<IRI>> sameAsCache = new ResourcePropertyCache<>(
            SAMEAS_CACHE_ID) {

        @Override
        protected IRI keyToIri(IRI iri) {
            return iri;
        }

        @Override
        protected java.util.Optional<CacheManager> cacheManager() {
            return Optional.ofNullable(cacheManager);
        };

        @Override
        protected Map<IRI, Optional<Iterable<IRI>>> queryAll(Repository repository, Iterable<? extends IRI> iris) {
            if (Iterables.isEmpty(iris)) {
                return Collections.emptyMap();
            }

            try {
                List<PropertyPattern> sameAsPatterns = getSameAsPatterns();

                String queryString = constructPropertyQuery(iris, sameAsPatterns);

                // for each input IRI we map to a list of lists of values, where
                // (1) the outer list represents the property pattern index and
                // (2) the inner list contains the sameAs values for this property pattern index
                // -> note this is done in a single pass (linear time & space w.r.t. result_
                Map<IRI, List<List<IRI>>> iriToPredicateToValue = queryAndExtractProperties(repository, queryString,
                        sameAsPatterns.size(),
                        value -> (value instanceof IRI ? Optional.of((IRI) value) : Optional.empty()));

                // next, we flatten the inner list of list structure into one continuous list,
                // making sure that we have one entry per IRI
                Map<IRI, Optional<Iterable<IRI>>> sameAs = new HashMap<>();
                for (IRI iri : iris) {
                    List<List<IRI>> liriToPredicate = iriToPredicateToValue.get(iri);
                    sameAs.put(iri, Optional.ofNullable(flattenProperties(liriToPredicate)));
                }

                return sameAs;
            } catch (Exception ex) {
                throw new RuntimeException("Failed to query for same-as relationships of IRI(s).", ex);
            }
        }

    };

    public AggregationLookupService(AggregationLookupConfig config) {
        super(config);
    }

    @Inject
    public void setLookupServiceManager(LookupServiceManager lookupServiceManager) {
        this.lookupServiceManager = lookupServiceManager;
    }

    @Inject
    public void setRepositoryManager(RepositoryManagerInterface repositoryManager) {
        this.repositoryManager = repositoryManager;
    }

    @Inject
    public void setNamespaceRegistry(NamespaceRegistry namespaceRegistry) {
        this.namespaceRegistry = namespaceRegistry;
    }

    @Inject
    @Override
    public void setCacheManager(CacheManager cacheManager) {
        super.setCacheManager(cacheManager);
        try {
            cacheManager.register(new PlatformCache() {
                @Override
                public void invalidate() {
                    if (sameAsCache != null) {
                        sameAsCache.invalidate();
                    }
                }

                @Override
                public void invalidate(Set<IRI> iris) {
                    // ignore
                }

                @Override
                public String getId() {
                    return getSameAsCacheId();
                }
            });
        } catch (IllegalStateException e) {
            // this may happen when registration is performed multiple times, e.g.
            // because of multiple dependency injections
            // ignore
            logger.debug("Cache " + cacheId + " is already registered: " + e.getMessage());
        }
    }

    @Override
    protected String getDefaultLookupCacheConfig() {
        // do not perform caching of lookup results by default, rely on caches from
        // related services
        // (note: this is independent of the local same-as cache!)
        return CACHE_SPEC_NOCACHE;
    }

    @Override
    protected void unregisterCache() {
        super.unregisterCache();

        String sameAsCacheId = getSameAsCacheId();
        if (cacheManager != null && cacheManager.isRegistered(sameAsCacheId)) {
            // avoid duplicate registration, e.g. when re-initializing the LookupServices
            cacheManager.deregister(sameAsCacheId);
        }
        if (sameAsCache != null) {
            sameAsCache.invalidate();
        }
    }

    protected String getSameAsCacheId() {
        return this.cacheId + ".SameAsCache";
    }

    protected List<PropertyPattern> getSameAsPatterns() {
        synchronized (this) {
            if (sameAsPatterns == null) {
                List<String> preferredSameAs = Optional.ofNullable(config.getSameAsPatterns())
                        .orElse(Arrays.asList(DEFAULT_SAMEAS_PATTERN));
                sameAsPatterns = preferredSameAs.stream()
                        .map(pattern -> PropertyPattern.parse(pattern, namespaceRegistry))
                        .collect(Collectors.toList());
            }
        }
        return sameAsPatterns;
    }

    public LookupService getDelegate() {
        return Optional.ofNullable(config.getDelegateService())
                .flatMap(repoId -> lookupServiceManager.getLookupServiceByName(repoId))
                .orElseThrow(() -> new IllegalArgumentException(
                        "Delegate LookupService " + config.getDelegateService() + " not available!"));
    }

    @Override
    public List<LookupEntityType> getAvailableEntityTypes() throws EntityTypesFetchingException {
        LookupService delegate = getDelegate();
        return delegate.getAvailableEntityTypes();
    }

    @Override
    protected LookupResponse doLookup(LookupRequest request) throws LookupProcessingException {
        LookupService delegate = getDelegate();
        return delegate.lookup(request);
    }

    @Override
    protected LookupResponse postProcess(LookupRequest request, LookupResponse response)
            throws LookupProcessingException {
        return aggregateCandidates(request, super.postProcess(request, response));
    }
    
    protected LookupResponse aggregateCandidates(LookupRequest request, LookupResponse upstreamResponse) throws LookupProcessingException {
        List<LookupCandidate> upstreamCandidates = upstreamResponse.getResult();

        // lookup same-as references
        // the references have been set in the reference field
        Map<String, SameAsRelationships> sameAsMap = createSameAsMap(upstreamCandidates);

        // sort/aggregate candidates by same-as relationships
        List<LookupCandidate> processedCandidates = aggregateCandidates(request, upstreamResponse, sameAsMap);

        LookupResponse processedResponse = new LookupResponse(upstreamResponse.getQueryId(), processedCandidates);

        return processedResponse;
    }

    protected List<LookupCandidate> aggregateCandidates(LookupRequest request, LookupResponse upstreamResponse,
            Map<String, SameAsRelationships> sameAsMap) {
        List<LookupCandidate> upstreamCandidates = upstreamResponse.getResult();
        List<LookupCandidate> aggregatedCandidates = new ArrayList<>();

        List<LookupCandidate> orderedCandidates = new ArrayList<>(upstreamCandidates);
        orderedCandidates.sort(Comparator.comparingDouble(candidate -> candidate.getScore()));

        Map<String, LookupCandidate> candidateMap = new HashMap<>();
        upstreamCandidates.forEach(candidate -> candidateMap.put(candidate.getId(), candidate));
        
        // set of all primary ids
        Set<String> primaryCandidateIds = sameAsMap.keySet();
        Set<LookupCandidate> primaryCandidates = new HashSet<>();
        // set of all secondary ids
        Set<String> secondaryCandidateIds = sameAsMap.values().stream().flatMap(sameAs -> sameAs.getSameAsIDs().stream()).collect(Collectors.toSet());
        secondaryCandidateIds.removeAll(primaryCandidateIds);
        // set of independent entries which are not part of any same-as relationship
        Set<String> independentCandidates = upstreamCandidates.stream().map(candidate -> candidate.getId())
                .collect(Collectors.toSet());
        independentCandidates.removeAll(primaryCandidateIds);
        independentCandidates.removeAll(secondaryCandidateIds);

        // re-order candidates under their same-as relationships:
        // the order stays the same relatively, only secondary
        // candidates are re-located under their primary entry
        Set<String> aggregatedCandidateIds = new TreeSet<>();
        boolean filterSecondaryResults = config.isFilterSecondaryResults();
        // process in order of score
        for (LookupCandidate candidate : orderedCandidates) {
            String candidateId = candidate.getId();
            if (aggregatedCandidateIds.contains(candidateId)) {
                // this entry was already added to the result
                continue;
            }
            if (secondaryCandidateIds.contains(candidateId)) {
                // ignore secondary results, they
                // will be added below if desired
            } else {
                primaryCandidates.add(candidate);
                // add primary and independent entries to results
                aggregatedCandidates.add(candidate);
                aggregatedCandidateIds.add(candidateId);
            }

            if (filterSecondaryResults) {
                // do not add secondary results
                continue;
            }

            // add all secondary entries after the primary entry
            Set<String> sameAsIDs = Optional.ofNullable(sameAsMap.get(candidateId))
                                        .map(sar -> sar.getSameAsIDs()).orElse(Collections.emptySet());
            for (String sameAsId : sameAsIDs) {
                if (!aggregatedCandidateIds.contains(sameAsId)) {
                    // find corresponding candidate and add it
                    LookupCandidate sameAsCandidate = candidateMap.get(sameAsId);
                    if (sameAsCandidate != null) {
                        candidate.setScore(Math.max(candidate.getScore(), sameAsCandidate.getScore()));
                        sameAsCandidate.setReference(candidateId);
                        aggregatedCandidates.add(sameAsCandidate);
                        aggregatedCandidateIds.add(sameAsId);
                    }
                }
            }
        }

        // Collect candidates of the same score
        Map<Double, List<LookupCandidate>> sameScoreCandidates = new HashMap<>();
        for (LookupCandidate candidate : orderedCandidates) {
            double score = roundScore(candidate.getScore(), SCORE_REFERENCE_DIGITS);
            List<LookupCandidate> sameScoreCandidateList = sameScoreCandidates.containsKey(score) ?
                    sameScoreCandidates.get(score) : new ArrayList<>();
            sameScoreCandidateList.add(candidate);
            sameScoreCandidates.put(score, sameScoreCandidateList);
        }
        
        /**
         * Because of the fact that we order elements by the score parameter,
         * we have to be sure that there is no candidates with the same score
         * (only has matter for the simpleSearch component)
         */
        for (var entry : sameScoreCandidates.entrySet()) {
            double score = entry.getKey();
            List<LookupCandidate> candidates = entry.getValue();
            
            for (int i = 0; i < candidates.size(); i++) {
                LookupCandidate candidate = candidates.get(i);
                double scoreOffset = (candidates.size() - (i + 1)) / Math.pow(10, SAME_SCORE_REFERENCE_DIGITS);
                candidate.setScore(score + scoreOffset);
            }
        }

        /**
         * Because of the fact that we order elements by the score parameter,
         * we have to be sure that all secondary candidates have close score
         * (only has matter for the simpleSearch component)
         */
        for (LookupCandidate sameAsCandidate : aggregatedCandidates) {
            String reference = sameAsCandidate.getReference();
            if (reference != null) {
                LookupCandidate candidate = candidateMap.get(reference);
                if (sameAsCandidate != candidate) {
                    sameAsCandidate.setScore(candidate.getScore() - SCORE_SAME_AS_OFFSET);
                }
            }
        }

        if (!filterSecondaryResults && (upstreamCandidates.size() != aggregatedCandidateIds.size())) {
            logger.debug("The number of lookup result after aggregation doesn't match: original: {}, aggregated: {}!",
                    upstreamCandidates.size(), aggregatedCandidateIds.size());
        }
        else {
            logger.trace("Number of lookup result after aggregation: original: {}, aggregated: {}.",
                    upstreamCandidates.size(), aggregatedCandidateIds.size());
        }

        return aggregatedCandidates;
    }

    protected Repository getTargetRepository() {
        return repositoryManager.getRepository(config.getTargetRepository());
    }

    protected Map<String, SameAsRelationships> createSameAsMap(List<LookupCandidate> candidates) {
        Map<String, SameAsRelationships> sameAsMap = new HashMap<>();

        // Note: as LookupCandidate uses String for ids, most references are also
        // interpreted as Strings and only converted from/to IRI or literals as required

        // create a map from the candidate's id to the corresponding IRI as we need this
        // conversion multiple times
        Map<String, IRI> idMap = candidates.stream().map(candidate -> candidate.getId())
                .collect(Collectors.toMap(id -> id, id -> iri(id)));
        // fetch all candidate IRIs
        Collection<IRI> resourceIRIs = idMap.values();

        // fetch the sameAs IRI of all candidates
        Map<IRI, Optional<Iterable<IRI>>> sameAsReferences = sameAsCache.getAll(getTargetRepository(), resourceIRIs);
        for (LookupCandidate candidate : candidates) {
            String candidateId = candidate.getId();
            IRI candidateIri = idMap.get(candidateId);
            if (candidateIri != null) {
                // get same-as result for this candidate
                Optional<Iterable<IRI>> sameAsHolder = sameAsReferences.get(candidateIri);
                if (sameAsHolder != null && sameAsHolder.isPresent()) {
                    Iterable<IRI> sameAsIRIs = sameAsHolder.get();
                    Iterator<IRI> it = sameAsIRIs.iterator();
                    while (it.hasNext()) {
                        IRI sameAsIRI = it.next();
                        String sameAsId = sameAsIRI.stringValue();

                        // add primary entity and current entity to sameAsMap
                        SameAsRelationships relationships = sameAsMap.computeIfAbsent(sameAsId,
                                iri -> new SameAsRelationships(sameAsId));
                        relationships.withCandidate(candidateId);
                    }
                }
            }
        }

        return sameAsMap;
    }

    public static double roundScore(double value, int places) {
        if (places < 0) throw new IllegalArgumentException();

        BigDecimal bd = BigDecimal.valueOf(value);
        bd = bd.setScale(places, RoundingMode.HALF_UP);
        return bd.doubleValue();
    }
}
