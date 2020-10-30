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
package com.metaphacts.api.dto.query;

import java.util.HashMap;
import java.util.Map;

import org.eclipse.rdf4j.model.Resource;
import org.eclipse.rdf4j.query.MalformedQueryException;
import org.eclipse.rdf4j.query.parser.ParsedOperation;

import com.metaphacts.api.dto.InconsistentDtoException;
import com.metaphacts.api.dto.base.DTOBase;
import com.metaphacts.api.sparql.SparqlUtil;

/**
 * Abstract base class representing a query template, including information about the query itself
 * and the template parameters. Instantiated by concrete classes for the different SPARQL query
 * forms such as ASK, DESCRIBE, SELECT, and CONSTRUCT.
 *
 * Template parameter T is the type of the query.
 *
 * @author msc
 */
public abstract class Query<T extends ParsedOperation> extends DTOBase {

    private static final long serialVersionUID = -8716679499142458548L;

    // the query string
    String queryString;
    Map<String, String> standardPrefixes = new HashMap<>();

    public Query(final Resource id, final String label, final String description,
            final String queryString) {

        super(id, label, description);

        this.queryString = queryString;
    }

    public Query(final Resource id, final String label, final String description,
            final String queryString, Map<String, String> standardPrefixes) {

        this(id, label, description, queryString);
        this.standardPrefixes = standardPrefixes;
    }

    public T getQuery() throws InconsistentDtoException {

        try {
            return getQueryInternal();
        } catch (MalformedQueryException e) {

            throw new InconsistentDtoException(this.getClass(),
                    "Query object could not be parsed: " + e, getId());

        } catch (ClassCastException e) {
            throw new InconsistentDtoException(this.getClass(),
                    "Query object could not be cast to target type: " + e, getId());
        }
    }

    protected abstract T getQueryInternal() throws MalformedQueryException, ClassCastException;

    public String getQueryString() {
        return queryString;
    }

    public void setQueryString(String queryString) {
        this.queryString = queryString;
    }

    @Override
    public void assertConsistency() throws InconsistentDtoException {

        super.assertConsistency();

        // only the ID is mandatory
        if (queryString == null) {
            throw new InconsistentDtoException(this.getClass(), "queryString is null", getId());
        }

        getQuery(); // validate syntax
    }

    protected String prependPrefixes() {
        // Note: the utility class makes sure to not pre-pend already defined prefixes
        return SparqlUtil.prependPrefixes(this.queryString, this.standardPrefixes);
    }

}
