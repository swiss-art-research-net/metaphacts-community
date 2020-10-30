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
 * Copyright (C) 2015-2020, metaphacts GmbH
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
package com.metaphacts.lookup.model;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.metaphacts.lookup.api.LookupService;
import com.metaphacts.lookup.util.LookupPropertyDeserializer;
import com.metaphacts.lookup.util.LookupPropertyStrictTypeDeserializer;

/**
 * Description of a query being provided in a {@link LookupRequest}.
 * <p>
 * Specified in the OpenRefine Reconciliation API, see documentation:
 * https://reconciliation-api.github.io/specs/latest/)
 * </p>
 * 
 * <p>
 * It contains the key-word query and all related limitations and filters.
 * </p>
 * 
 * <p>
 * Processing of this query is defined by the {@link LookupService}.
 * </p>
 */
public class LookupQuery {
    private String query;
    private String type;
    private Integer limit;
    @JsonProperty("type_strict")
    @JsonDeserialize(using = LookupPropertyStrictTypeDeserializer.class)
    private LookupPropertyStrictType strictType;

    @JsonDeserialize(using = LookupPropertyDeserializer.class)
    private List<LookupProperty<?>> properties;

    private Boolean tokenizeQueryString;

    public LookupQuery() {
    }

    public LookupQuery(String query, Integer limit, String type, LookupPropertyStrictType strictType,
            List<LookupProperty<?>> properties) {
        this(query, limit, type, strictType, null, properties);
    }

    public LookupQuery(String query, Integer limit, String type,
            LookupPropertyStrictType strictType,
            Boolean tokenizeQueryString, List<LookupProperty<?>> properties) {
        this.query = query;
        this.type = type;
        this.limit = limit;
        this.properties = properties;
        this.strictType = strictType;
        this.tokenizeQueryString = tokenizeQueryString;
    }

    public String getQuery() {
        return query;
    }

    public void setQuery(String query) {
        this.query = query;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public Integer getLimit() {
        return limit;
    }

    public void setLimit(Integer limit) {
        this.limit = limit;
    }

    public List<LookupProperty<?>> getProperties() {
        return properties;
    }

    public void setProperties(List<LookupProperty<?>> properties) {
        this.properties = properties;
    }

    public LookupPropertyStrictType getStrictType() {
        return strictType;
    }

    public void setStrictType(LookupPropertyStrictType strictType) {
        this.strictType = strictType;
    }

    public void setTokenizeQueryString(Boolean tokenizeQueryString) {
        this.tokenizeQueryString = tokenizeQueryString;
    }

    /**
     * Checks if the query string should be tokenized using wildcards. May return {@code null} to indicate it is up to
     * the service implementation to decide.
     * 
     * @return {@code true} if the query string should be tokenized, {@code false} if not, {@code null} if unspecified.
     */
    public Boolean isTokenizeQueryString() {
        return tokenizeQueryString;
    }


}
