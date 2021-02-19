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

import com.metaphacts.lookup.model.LookupCandidate;
import com.metaphacts.lookup.model.LookupQuery;
import com.metaphacts.lookup.model.LookupRequest;
import com.metaphacts.lookup.model.LookupResponse;

import java.util.List;

/**
 * Entry class for {@link LookupResponseCache}
 */
public class LookupResponseCacheEntry {
    private final String queryId;
    private final LookupQuery query;
    private final List<LookupCandidate> candidates;

    public LookupResponseCacheEntry(
        LookupRequest request,
        LookupResponse response
    ) {
        this(request.getQueryId(), request.getQuery(), response.getResult());
    }

    public LookupResponseCacheEntry(
        String queryId,
        LookupQuery query,
        List<LookupCandidate> candidates
    ) {
        this.queryId = queryId;
        this.query = query;
        this.candidates = candidates;
    }

    /**
     * Get id of the original request used to create this query.
     * @return query id
     */
    public String getQueryId() {
        return queryId;
    }

    /**
     * Get original request used to create this query.
     * @return lookup query
     */
    public LookupQuery getQuery() {
        return query;
    }

    /**
     * Get cache results from original query.
     * @return cached lookup candidates
     */
    public List<LookupCandidate> getCandidates() {
        return candidates;
    }

    /**
     * Get number of cached lookup candidates.
     * @return number of cached lookup candidates
     */
    public int getCandidateCount() {
        return candidates.size();
    }
}

