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

import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import javax.inject.Inject;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import com.google.common.collect.Lists;
import com.metaphacts.lookup.api.LookupProcessingException;
import com.metaphacts.lookup.api.LookupService;
import com.metaphacts.lookup.api.LookupServiceManager;
import com.metaphacts.lookup.model.LookupCandidate;
import com.metaphacts.lookup.model.LookupRequest;
import com.metaphacts.lookup.model.LookupResponse;
import com.metaphacts.lookup.spi.LookupServiceConfigException;

/**
 * LookupService delegating to a federated set of LookupServices.
 * 
 * @author Wolfgang Schell <ws@metaphacts.com>
 */
public class FederatedLookupService extends AbstractLookupService<FederatedLookupConfig> {
    private static final Logger logger = LogManager.getLogger(FederatedLookupService.class);
    
    @Inject
    protected LookupServiceManager lookupServiceManager;

    public FederatedLookupService(FederatedLookupConfig config) {
        super(config);
    }
    
    @Override
    protected String getDefaultLookupCacheConfig() {
        // do not perform caching by default, rely on caches from related services
        return AbstractLookupService.CACHE_SPEC_NOCACHE;
    }

    /**
     * This implementation performs a lookup on all known LookupServices and combines all results.
     */
    @Override
    protected LookupResponse doLookup(LookupRequest request) throws LookupProcessingException {
        List<Throwable> errors = Lists.newCopyOnWriteArrayList();
        Collection<Map.Entry<LookupServiceMember, LookupService>> lookupEntries = getLookupServices().entrySet();
        if (lookupEntries == null || lookupEntries.isEmpty()) {
            // no services, return empty result
            return new LookupResponse(request.getQueryId(), Collections.emptyList());
        }
        if (lookupEntries.size() == 1) {
            // only one service, simply pass through
            Map.Entry<LookupServiceMember, LookupService> entry = lookupEntries.iterator().next();
            LookupServiceMember member = entry.getKey();
            LookupService singleLookupService = entry.getValue();
            LookupResponse memberResponse = singleLookupService.lookup(request);
            return this.adjustScoresForSpecificService(memberResponse, member);
        }
        // process all lookup requests in parallel using system ForkJoin pool (parallel stream)
        List<LookupResponse> results = lookupEntries.parallelStream()
            // skip any federated services to avoid cycles
            .filter(entry -> !(entry.getValue() instanceof FederatedLookupService))
            .map(entry -> {
                LookupService service = entry.getValue();

                try {
                    return this.adjustScoresForSpecificService(service.lookup(request), entry.getKey());
                } catch (LookupProcessingException e) {
                    logger.warn("Failed to lookup data from service {}: {}", service, e.getMessage());
                    logger.debug("Details:",  e);
                    errors.add(e);
                    // null will be filtered below and ignored
                    return null;
                }
            })
            .filter(result -> result != null)
            .collect(Collectors.toList());
        return combineResults(request, results, errors);
    }

    /**
     * Adjust scores per member.
     * <p>
     * NOTE: any local score adjustments on the merged scores are done in addition to the per-member score adjustment!
     * </p>
     * 
     * @param response response to adjust
     * @param serviceMember member the results of which to adjust
     * @return adjusted response
     * @throws LookupProcessingException
     */
    protected LookupResponse adjustScoresForSpecificService(LookupResponse response, LookupServiceMember serviceMember) throws LookupProcessingException {
        LookupScoreOptions localScoreOptions = serviceMember.getLookupScoreOptions();
        if (localScoreOptions == null) {
            return response;
        } else {
            return adjustResponseScores(response, localScoreOptions);
        }
    }

    protected LookupResponse combineResults(LookupRequest request, List<LookupResponse> results, List<Throwable> errors) {
        // collect all candidates in one list
        List<LookupCandidate> allCandidates = results.stream()
                                                    .flatMap(result -> result.getResult().stream())
                                                    .collect(Collectors.toList());
        
        // TODO make all aspects of combining result customizable using a pluggable strategy
        // TODO improve naive approach of simply combining all results
        // TODO handle overall limit 
        // TODO handle errors
        
        return new LookupResponse(request.getQueryId(), allCandidates);
    }

    protected Map<LookupServiceMember, LookupService> getLookupServices() {
        List<LookupServiceMember> serviceMembers = config.getServiceMembers();
        if (serviceMembers != null && !serviceMembers.isEmpty()) {
            // collect explicitly configured service members
            return serviceMembers.stream()
                .collect(Collectors.toMap(member -> member,
                    member -> lookupServiceManager.getLookupServiceByName(member.getName())
                        .orElseThrow(() -> new LookupServiceConfigException("No such LookupService: " + member.getName()))));
        }
        // use all lookup services
        return lookupServiceManager.getLookupServices().entrySet().stream()
            .collect(Collectors.toMap(entry -> new LookupServiceMember(entry.getKey()), entry -> entry.getValue()));
    }
}
