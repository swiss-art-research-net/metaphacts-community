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
package com.metaphacts.api.transform;

import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

import org.apache.commons.lang3.NotImplementedException;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.Statement;
import org.eclipse.rdf4j.model.Value;
import org.eclipse.rdf4j.model.vocabulary.RDF;
import org.eclipse.rdf4j.model.vocabulary.RDFS;
import org.eclipse.rdf4j.model.vocabulary.SP;

import com.metaphacts.api.dto.InconsistentDtoException;
import com.metaphacts.api.dto.query.AskQuery;
import com.metaphacts.api.dto.query.ConstructQuery;
import com.metaphacts.api.dto.query.DescribeQuery;
import com.metaphacts.api.dto.query.Query;
import com.metaphacts.api.dto.query.SelectQuery;
import com.metaphacts.api.dto.query.UpdateQuery;

/**
 * Transformation from {@link Model} to {@link Query} and back.
 * 
 * @author msc
 */
public class ModelToQueryTransformer implements ModelToDtoTransformer<Query<?>> {

    protected Map<String, String> standardPrefixes = new HashMap<>();

    public ModelToQueryTransformer() {

    }

    public ModelToQueryTransformer(Map<String, String> standardPrefixes) {
        this.standardPrefixes = standardPrefixes;
    }

    @Override
    public Query<?> modelToDto(final Model model) throws InvalidQueryModelException {

        if (model == null) {
            return null;
        }

        final Iterator<Statement> modelIterator = model.iterator();

        /**
         * This is a naive implementation for now, but at the time being we don't expect any
         * performance problems here.
         */
        IRI queryId = null;
        IRI queryType = null;
        String label = null;
        String description = null;
        String queryString = null;
        while (modelIterator.hasNext()) {

            final Statement stmt = modelIterator.next();
            final IRI predicate = stmt.getPredicate();
            final Value object = stmt.getObject();

            if (predicate.equals(RDF.TYPE)) {

                // TODO: proper handling of ill-typed schema, for
                // now let's keep it simple and just report the last
                // found type (in case this is the query type)
                if (object.equals(SP.SELECT_CLASS) || object.equals(SP.ASK_CLASS)
                        || object.equals(SP.CONSTRUCT_CLASS) || object.equals(SP.DESCRIBE_CLASS)
                        || object.equals(SP.UPDATE_CLASS)) {

                    queryId = (IRI) stmt.getSubject();
                    queryType = (IRI) object;
                }

            } else if (predicate.equals(RDFS.LABEL)) {

                label = object.stringValue();

            } else if (predicate.equals(RDFS.COMMENT)) {

                description = object.stringValue();

            } else if (predicate.equals(SP.TEXT_PROPERTY)) {

                queryString = object.stringValue();

            }

        }

        // sanity checks
        if (queryId == null) {
            throw new InvalidQueryModelException("No query id set in model.", null /* cause */);
        }

        if (queryType == null) {
            throw new InvalidQueryModelException(
                    "No query type specified in model for query " + queryId, null /* cause */);
        }

        if (queryString == null) {
            throw new InvalidQueryModelException(
                    "No query string specified in model for query " + queryId, null /* cause */);
        }

        // construct DTOs
        Query<?> ret = null;
        if (queryType.equals(SP.SELECT_CLASS)) {

            ret = new SelectQuery(queryId, label, description, queryString, standardPrefixes);

        } else if (queryType.equals(SP.ASK_CLASS)) {

            ret = new AskQuery(queryId, label, description, queryString, standardPrefixes);

        } else if (queryType.equals(SP.CONSTRUCT_CLASS)) {

            ret = new ConstructQuery(queryId, label, description, queryString, standardPrefixes);

        } else if (queryType.equals(SP.DESCRIBE_CLASS)) {

            ret = new DescribeQuery(queryId, label, description, queryString, standardPrefixes);

        } else if (queryType.equals(SP.UPDATE_CLASS)) {

            ret = new UpdateQuery(queryId, label, description, queryString, standardPrefixes);
        }

        if (ret == null)
            return null; // fallback

        try {
            ret.assertConsistency();
        } catch (InconsistentDtoException e) {
            throw new InvalidQueryModelException("Dto for model of " + queryId + " is inconsistent",
                    e);
        }

        return ret;
    }

    @Override
    public Model dtoToModel(final Query<?> dto) {
        throw new NotImplementedException(
                Query.class.getName() + " dtoToModel() is not yet implemented.");
    }

}