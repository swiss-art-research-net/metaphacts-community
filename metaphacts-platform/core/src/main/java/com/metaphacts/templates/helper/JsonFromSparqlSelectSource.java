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
package com.metaphacts.templates.helper;

import static com.google.common.base.Preconditions.checkNotNull;

import java.io.IOException;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Optional;
import java.util.function.BiConsumer;

import org.apache.commons.lang3.StringEscapeUtils;
import org.apache.commons.lang3.StringUtils;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.model.Value;
import org.eclipse.rdf4j.query.BindingSet;
import org.eclipse.rdf4j.repository.Repository;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.jknack.handlebars.Handlebars;
import com.github.jknack.handlebars.Options;
import com.google.common.collect.Lists;
import com.google.common.collect.Maps;
import com.metaphacts.templates.helper.HelperUtil.QueryResult;

/**
 * @author Johannes Trame <jt@metaphacts.com>
 *
 */
public class JsonFromSparqlSelectSource {
    private static final Logger logger = LogManager.getLogger(JsonFromSparqlSelectSource.class);

    public static final String SYNTHETIC_JSON_DATATYPE = "http://www.metaphacts.com/ontologies/platform#syntheticJson";

    /**
     * Same helper as {@link SingleValueFromSelectSource}, however, everything properly HTML and JSON escaped.
     */
    public String jsonValueFromSelect(String param0, Options options) throws IOException {
        logger.trace("Evaluating {} Template Helper by delegating to singleValueFromSelectSource.", options.helperName);
        String result = StringEscapeUtils.escapeHtml4(
            StringEscapeUtils.escapeJson(
                new SingleValueFromSelectSource().singleValueFromSelect(param0, options)
            )
        );
        return StringUtils.isEmpty(result) ? "null" :"\""+result+"\"";
    }

    public String jsonArrayFromSelect(String param0, Options options) {
        QueryResult result = HelperUtil.evaluateSelectQuery(param0, options, logger);
        String bindingVariable = options.hash("binding");

        StringBuilder sb = new StringBuilder();
        if (!StringUtils.isEmpty(bindingVariable) && !result.bindingNames.contains(bindingVariable)) {
            throw new IllegalArgumentException("Binding variable "+bindingVariable+" does not exist in query result");
        }
        if (StringUtils.isEmpty(bindingVariable)) {
            bindingVariable = result.bindingNames.get(0);
        }
        sb.append("[");
        Iterator<BindingSet> iter = result.bindings.iterator();
        while (iter.hasNext()) {
            BindingSet binding = iter.next();
            Value value = binding.getValue(bindingVariable);
            if (value != null) {
                sb.append("\"");
                sb.append(StringEscapeUtils.escapeJson(value.stringValue()));
                sb.append("\"");
                if (iter.hasNext()) {
                    sb.append(",");
                }
            }
        }
        sb.append("]");
        //TODO check whether this is safe enough or even to restrictive
        return new Handlebars.SafeString(StringEscapeUtils.escapeHtml4(sb.toString())).toString();
    }

    public String jsonObjectArrayFromSelect(String param0, Options options) throws IOException {
        String queryString = checkNotNull(param0,"Query string must not be null.");
        return new Handlebars.SafeString(StringEscapeUtils.escapeHtml4(
            JsonFromSparqlSelectSource.transformTupleQueryResultToJSON(queryString, options, Optional.empty()))
        ).toString();
    }

    /**
     * <p>
     * Transforms a SPARQL Select query into JSON object array, whereas each result tuple will be
     * one object with projection variables of the query being the keys and result values the
     * corresponding values of the object.<b>If used by handlebars helper functions, functions must
     * take care for proper HTML escaping for returning.</b>
     * </p>
     *
     * <b>Example:</b><br>
     * The query
     * <pre><code>SELECT ?param1 ?param2 WHERE {
     *  VALUES(?param1 ?param2){
     *      (<http://metaphacts.com/1> "metaphacts1"^^xsd:string)
     *      (<http://metaphacts.com/2> "metaphacts2"^^xsd:string)
     *      (<http://metaphacts.com/j> "[1, 2, \"foo\"]"^^&lt;datatype:json&gt;)
     *  }
     * }</code></pre>
     * will return two result tuples:
     *
     * <pre>
     *  ?param1                  |  ?param2
     *  -----------------------------------------------------
     * &lt;http://metaphacts.com/1&gt; |  "metaphacts1"^^xsd:string
     * &lt;http://metaphacts.com/2&gt; |  "metaphacts2"^^xsd:string
     * &lt;http://metaphacts.com/j&gt; |  "[1, 2, \"foo\"]"^^&lt;datatype:json&gt;
     * </pre>
     *
     * will be transformed into the following JSON array of objects:
     *
     * <pre>
     * [
     *   {
     *     "param1": "http://metaphacts.com/1",
     *     "param2": "metaphacts1"
     *   },
     *   {
     *     "param1": "http://metaphacts.com/2",
     *     "param2": "metaphacts2"
     *   },
     *   {
     *     "param1": "http://metaphacts.com/j",
     *     "param2": [1, 2, "foo"]
     *   }
     * ]
     * </pre>
     */
    static String transformTupleQueryResultToJSON(final String selectQueryString, Options options, Optional<Repository> repository){
        // TODO replace with proper Jackson builder
        StringBuilder sb = new StringBuilder();
        sb.append("[");

        enumerateQueryTuples(selectQueryString, options, repository, (tuple, last) -> {
            sb.append("{");
            java.util.Iterator<Entry<String, Value>> e = tuple.entrySet().iterator();
            while(e.hasNext()){
                Entry<String, Value> v = e.next();
                sb.append("\"");
                sb.append(StringEscapeUtils.escapeJson(v.getKey()));
                sb.append("\"");
                sb.append(":");

                Value value = v.getValue();
                boolean isAlreadyJson = false;

                if (value instanceof Literal) {
                    Literal literal = (Literal)value;
                    IRI datatype = literal.getDatatype();
                    if (datatype.stringValue().equals(SYNTHETIC_JSON_DATATYPE)) {
                        if (!isValidJson(literal.stringValue())) {
                            throw new RuntimeException(String.format(
                                "Tuple value with synthetic JSON datatype is not a valid json: %s",
                                literal.stringValue()));
                        }
                        isAlreadyJson = true;
                    }
                }

                if (isAlreadyJson) {
                    sb.append(value.stringValue());
                } else {
                    sb.append("\"");
                    sb.append(StringEscapeUtils.escapeJson(value.stringValue()));
                    sb.append("\"");
                }

                if(e.hasNext()){
                    sb.append(",");
                }
            }
            sb.append("}");
            if (!last) {
                sb.append(",");
            }
        });

        sb.append("]");
        //TODO check whether this is safe enough or even to restrictive
        return sb.toString();
    }

    private static boolean isValidJson(String potentialJson) {
        ObjectMapper mapper = new ObjectMapper();
        try {
            mapper.readTree(potentialJson);
            return true;
        } catch (JsonProcessingException ex) {
            return false;
        }
    }

    public static void enumerateQueryTuples(
        String selectQueryString,
        Options options,
        Optional<Repository> repository,
        BiConsumer<Map<String, Value>, Boolean> tupleConsumer
    ) {
        QueryResult queryResult;
        if (repository.isPresent()) {
            queryResult = HelperUtil.evaluateSelectQuery(selectQueryString, options, logger, repository.get());
        } else {
            queryResult = HelperUtil.evaluateSelectQuery(selectQueryString, options, logger);
        }
        List<Map<String, Value>> objects = Lists.newArrayList();
        Iterator<BindingSet> iter = queryResult.bindings.iterator();
        while (iter.hasNext()) {
            Map<String, Value> map = Maps.newHashMap();
            BindingSet binding = iter.next();
            for (String bindingVariable : queryResult.bindingNames) {
                Value value = binding.getValue(bindingVariable);
                if (value != null) {
                    map.put(bindingVariable, value);
                }
            }
            objects.add(map);
        }
        if (!objects.isEmpty()) {
            java.util.Iterator<Map<String, Value>> it = objects.iterator();
            while (it.hasNext()) {
                Map<String, Value> tuple = it.next();
                boolean isLast = !it.hasNext();
                tupleConsumer.accept(tuple, isLast);
            }
        }
    }
}
