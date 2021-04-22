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

import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.Callable;
import java.util.stream.Collectors;

import javax.inject.Inject;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.shiro.subject.Subject;

import com.google.common.collect.Lists;
import com.metaphacts.lookup.api.LookupProcessingException;
import com.metaphacts.lookup.api.LookupService;
import com.metaphacts.lookup.api.LookupServiceManager;
import com.metaphacts.lookup.model.LookupCandidate;
import com.metaphacts.lookup.model.LookupRequest;
import com.metaphacts.lookup.model.LookupResponse;
import com.metaphacts.lookup.spi.LookupServiceConfigException;
import com.metaphacts.security.SecurityService;

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

        List<LookupServiceWithConfig> lookupServices = getLookupServices();
        if (lookupServices == null || lookupServices.isEmpty()) {
            // no services, return empty result
            return new LookupResponse(request.getQueryId(), Collections.emptyList());
        }
        if (lookupServices.size() == 1) {
            // only one service, simply pass through
            LookupServiceWithConfig l = lookupServices.iterator().next();
            return executeRequest(request, l.lookupService, l.memberConfig);
        }

        return executeRequests(request, lookupServices);
    }

    /**
     * Execute the given {@link LookupRequest} at the supplied relevant services
     * 
     * <p>
     * The default implementation executes the request at all lookup services in
     * parallel and simply combines all results.
     * </p>
     * 
     * @param request        the request
     * @param lookupServices a list with more than one lookup service
     * @return the combined lookup results
     */
    protected LookupResponse executeRequests(LookupRequest request, List<LookupServiceWithConfig> lookupServices) {

        List<Throwable> errors = Lists.newCopyOnWriteArrayList();
        
        // obtain the current context's subject
        final Optional<Subject> subject = SecurityService.getSubject();

        // process all lookup requests in parallel using system ForkJoin pool (parallel stream)
        // Note: we explicitly make sure to associate all threads with the current subject
        // (if the subject is available in the current context)
        List<LookupResponse> results = lookupServices.parallelStream()
            // skip any federated services to avoid cycles
            .filter(item -> !(item.lookupService instanceof FederatedLookupService))
            .map(item -> {
                
                Callable<LookupResponse> action = () -> {
                        return executeRequest(request, item.lookupService, item.memberConfig);
                };
            
                if (subject.isPresent()) {
                    action = subject.get().associateWith(action);
                }
                try {
                    return action.call();
                } catch (Exception e) {
                    logger.warn("Failed to lookup data from service {}: {}", item.memberConfig.getName(),
                            e.getMessage());
                    logger.debug("Details:", e);
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
     * Execute the given {@link LookupRequest} in the provide {@link LookupService}.
     * <p>
     * This method is used to execute the request in a single member of the
     * federated lookup. Results are combined by the caller.
     * </p>
     * 
     * <p>
     * Note that this method is responsible for adjusting scores, see
     * {@link #adjustScoresForSpecificService(LookupResponse, LookupServiceMember)}.
     * </p>
     * 
     * @param request
     * @param lookupService
     * @param memberConfig
     * @return the lookup result for the given service
     * @throws LookupProcessingException
     */
    protected LookupResponse executeRequest(LookupRequest request, LookupService lookupService,
            LookupServiceMember memberConfig)
            throws LookupProcessingException {
        LookupResponse lookupResponse = lookupService.lookup(request);
        return this.adjustScoresForSpecificService(lookupResponse, memberConfig);
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

    protected List<LookupServiceWithConfig> getLookupServices() {
        List<LookupServiceMember> serviceMembers = config.getServiceMembers();
        if (serviceMembers != null && !serviceMembers.isEmpty()) {
            // collect explicitly configured service members
            return serviceMembers.stream().map(memberConfig -> {
                LookupService lookupService = lookupServiceManager.getLookupServiceByName(memberConfig.getName())
                        .orElseThrow(() -> new LookupServiceConfigException(
                                "No such LookupService: " + memberConfig.getName()));
                return new LookupServiceWithConfig(memberConfig, lookupService);
            }).collect(Collectors.toList());
        }
        // use all lookup services
        return lookupServiceManager.getLookupServices().entrySet().stream().map(entry -> {
            LookupServiceMember memberConfig = new LookupServiceMember(entry.getKey());
            LookupService lookupService = entry.getValue();
            return new LookupServiceWithConfig(memberConfig, lookupService);
        }).collect(Collectors.toList());
    }

    protected static class LookupServiceWithConfig {
        public final LookupServiceMember memberConfig;
        public final LookupService lookupService;

        public LookupServiceWithConfig(LookupServiceMember memberConfig, LookupService lookupService) {
            super();
            this.memberConfig = memberConfig;
            this.lookupService = lookupService;
        }
    }
}
