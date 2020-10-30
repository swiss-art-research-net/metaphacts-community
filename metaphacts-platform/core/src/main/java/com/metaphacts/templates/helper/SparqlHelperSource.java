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
package com.metaphacts.templates.helper;

import static com.google.common.base.Preconditions.checkNotNull;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.model.Value;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.model.vocabulary.RDFS;
import org.eclipse.rdf4j.model.vocabulary.XMLSchema;
import org.eclipse.rdf4j.query.QueryLanguage;
import org.eclipse.rdf4j.query.parser.ParsedQuery;
import org.eclipse.rdf4j.query.parser.QueryParserUtil;
import org.eclipse.rdf4j.rio.ntriples.NTriplesUtil;

import com.github.jknack.handlebars.Options;
import com.metaphacts.api.dto.querytemplate.QueryArgument;
import com.metaphacts.api.dto.querytemplate.QueryTemplate;
import com.metaphacts.api.dto.querytemplate.UpdateQueryTemplate;
import com.metaphacts.cache.QueryTemplateCache;
import com.metaphacts.sparql.visitors.ParametrizeVisitor;
import com.metaphacts.util.QueryUtil;

public class SparqlHelperSource {

    private static final Logger logger = LogManager.getLogger(SparqlHelperSource.class);
    private static final ValueFactory VF = SimpleValueFactory.getInstance();

    private final QueryTemplateCache queryTemplateCache;

    public SparqlHelperSource(QueryTemplateCache queryTemplateCache) {
        this.queryTemplateCache = queryTemplateCache;
    }

    /**
     * Substitutes values to query variables.
     *
     * <p>
     * Example:
     * </p>
     *
     * <pre>
     * <code>
     *     [[setQueryBindings
     *       'SELECT ?s WHERE { ?s ?predicate ?obj }'
     *       predicate='<some:iri>' obj='"OBJ"']]
     * </code>
     * </pre>
     */
    public String setQueryBindings(String param0, Options options) throws Exception {
        String query = checkNotNull(param0, "Query string must not be null.");
        ParsedQuery parsedQuery = QueryParserUtil.parseQuery(QueryLanguage.SPARQL, query, null);

        Map<String, Value> parameters = retrieveParameters(options.hash);
        return renderWithParameters(parsedQuery, parameters);
    }

    protected Map<String, Value> retrieveParameters(Map<String, Object> queryParams) {
        Map<String, Value> parameters = new HashMap<>();
        for (Entry<String, Object> entry : queryParams.entrySet()) {
            String value = HelperUtil.toString(entry.getValue());
            if (value != null) {
                Value paramValue = NTriplesUtil.parseValue(value, VF);
                parameters.put(entry.getKey(), paramValue);
            }
        }
        return parameters;
    }

    protected String renderWithParameters(ParsedQuery parsedQuery, Map<String, Value> parameters)
            throws Exception {
        parsedQuery.getTupleExpr().visit(new ParametrizeVisitor(parameters));
        String renderedQuery = QueryUtil.toSPARQL(parsedQuery);
        return renderedQuery;
    }

    /**
     * Renders a query template from the query catalog, setting the parameters if necessary.
     *
     * <p>
     * Example:
     * </p>
     *
     * <pre>
     * <code>
     *    [[getQueryString "http://my.host.uri/container/Query_Template_Container/test_query_template" parameter1='<http://www.example.org/parameter1_value>']]
     * </code>
     * </pre>
     */
    public String getQueryString(Object param0, Options options) throws Exception {
        IRI queryTemplateId = HelperUtil.toIRI(checkNotNull(param0, "Query template IRI must not be null."));

        QueryTemplate<?> queryTemplate = queryTemplateCache
                .getQueryTemplate(queryTemplateId);

        if (queryTemplate instanceof UpdateQueryTemplate) {
            throw new IllegalArgumentException("Update operations are not supported");
        }

        List<QueryArgument> args = queryTemplate.getArguments();
        Map<String, Value> passedParams = retrieveParameters(options.hash);

        try {
            interpretParameters(args, passedParams);
        } catch (IllegalArgumentException e) {
            logger.warn("Illegal assignment of query template parameters: " + e.getMessage());
            throw e;
        }

        ParsedQuery parsedQuery = (ParsedQuery) queryTemplate.getQuery().getQuery();
        return renderWithParameters(parsedQuery, passedParams);
    }

    private void interpretParameters(List<QueryArgument> args, Map<String, Value> parameters)
            throws IllegalArgumentException {
        for (QueryArgument arg : args) {
            String predicate = arg.getPredicate();
            if (arg.isRequired()) {
                if (!parameters.containsKey(predicate) && !arg.getDefaultValue().isPresent()) {
                    throw new IllegalArgumentException(
                            "No value provided for the \"" + arg.getLabel() + "\" parameter");
                }
            }

            Value val = parameters.get(predicate);
            if (val != null) {
                if (arg.getValueType() != null) {
                    if (arg.getValueType().equals(XMLSchema.ANYURI) || arg.getValueType().equals(RDFS.RESOURCE)) {
                        val = (val instanceof IRI) ? val : VF.createIRI(val.stringValue());
                        parameters.put(predicate, VF.createIRI(val.stringValue()));
                    } else {
                        if (val instanceof Literal) {
                            Literal litVal = (Literal) val;
                            if (!litVal.getLanguage().isPresent()) {
                                IRI actual = litVal.getDatatype();
                                if (!arg.getValueType().equals(actual)) {
                                    // If the literal value does not correspond
                                    // to the argument valueType,
                                    // convert it.
                                    litVal = VF.createLiteral(litVal.stringValue(), arg.getValueType());
                                }
                            }
                            parameters.put(predicate, litVal);
                        } else {
                            throw new IllegalArgumentException(
                                    "Incompatible parameter type: a resource " + val.stringValue()
                                            + " passed where <" + arg.getValueType().stringValue()
                                            + "> expected.");
                        }
                    }
                } else {
                    // No value type in the argument: we can pass anything "as is".
                    parameters.put(predicate, val);
                }
            } else if (arg.getDefaultValue().isPresent()) {
                parameters.put(predicate, arg.getDefaultValue().get());
            }
        }

    }
}
