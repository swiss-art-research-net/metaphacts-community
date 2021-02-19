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
package com.metaphacts.lookup.api;

import java.util.Collections;
import java.util.List;

import com.metaphacts.lookup.model.LookupEntityType;
import com.metaphacts.lookup.model.LookupRequest;
import com.metaphacts.lookup.model.LookupResponse;

/**
 * A LookupService provides capabilities for evaluating {@link LookupRequest}s.
 */
public interface LookupService {
    
    /**
    * Provides ability to search for candidates by queries. Where the query is an object which
    * contains following set of fields:
    *
    * query - A query string, consisting of a non-empty string, which is mandatory.
    * By supplying such a string, a client intends to search for entities with similar names.
    * The specifics of how this similarity is defined are determined by the service.
    *
    * type - Optionally, a list of types. Supplying such types allows users to restrict the search
    * to entities which bear those types. Whether this restriction should be a hard constraint or
    * simply induce a change on the lookup scores can be determined by the service.
    * In particular, services MAY return candidates which do not belong to any of the supplied types;
    *
    * limit - Optionally, a limit on the number of candidates to return, which must be a positive integer;
    *
    * properties - Optionally, a map from property identifiers to a list of property values
    * (or list of property values). These are used to further filter the set of candidates
    * (similar to a WHERE clause in SQL), by allowing clients to specify other attributes of
    * entities that should match, beyond their name in the query field. How lookup services
    * handle this further restriction ("must match all properties" or "should match some") and
    * how it affects the score, is up to the service;
    *
    * type_strict -  Optionally, a type strictness parameter, which can be one of the strings
    * "should", "all" or "any".
    * */
    LookupResponse lookup(LookupRequest request) throws LookupProcessingException;

    /**
     * This function provides a list of available entity types which can be passed as parts of LookupQueries.
     */
    default List<LookupEntityType> getAvailableEntityTypes() throws EntityTypesFetchingException {
        return Collections.emptyList();
    }
}
