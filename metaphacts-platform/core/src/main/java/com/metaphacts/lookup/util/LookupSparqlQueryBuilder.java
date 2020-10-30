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
package com.metaphacts.lookup.util;

import static com.metaphacts.lookup.impl.AbstractSPARQLSearchLookupService.SCORE_BINDING_VARIABLE;
import static com.metaphacts.lookup.impl.AbstractSPARQLSearchLookupService.SUBJECT_BINDING_VARIABLE;
import static com.metaphacts.lookup.impl.AbstractSPARQLSearchLookupService.TYPES_BINDING_VARIABLE;

import java.util.LinkedHashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.BiFunction;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.model.Value;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;

import com.metaphacts.lookup.model.LookupDataProperty;
import com.metaphacts.lookup.model.LookupObjectProperty;
import com.metaphacts.lookup.model.LookupObjectPropertyLink;
import com.metaphacts.lookup.model.LookupProperty;
import com.metaphacts.lookup.model.LookupPropertyStrictType;
import com.metaphacts.lookup.model.LookupQuery;

/**
 * Set of functions and classes which make it easier to convert {@link LookupQuery} to the respective SPARQL search
 * queries for various databases such as Blazegraph.
 *
 * <h3>queryTemplate</h3>
 * <code>
 * SELECT
 *     ?candidate
 *     (GROUP_CONCAT(DISTINCT ?type ; separator=",") as ?types)
 *     (MAX(?score_private) as ?score)
 * WHERE {
 *     {{type_block}}
 *     {{search_block}}
 *     {{properties_block}}
 * } GROUP BY ?candidate ORDER BY DESC(?score) {{limit_block}}
 * </code>
 *
 * <h3>searchBlockTemplate</h3>
 * <code>
 * ?candidate a ?type.
 * ?candidate ?keyProp ?key.
 * FILTER ISLITERAL(?key)
 * BIND(IF(
 *      STRLEN(?key) > STRLEN(?__token__),
 *      STRLEN(?__token__) - STRLEN(?key),
 *      IF(
 *          STRLEN(?key) < STRLEN(?__token__),
 *          STRLEN(?key) - STRLEN(?__token__),
 *          "0"
 *      )
 * )  as ?score_private)
 * FILTER REGEX(LCASE(?key), LCASE(?__token__), "i").
 * </code>
 *
 * <h3>searchBlockTemplate (Blazegraph)</h3>
 * <code>
 * ?candidate a ?type.
 * ?candidate ?keyProp ?key.
 * FILTER ISLITERAL(?key)
 * SERVICE <http://www.bigdata.com/rdf/search#search> {
 *      ?key <http://www.bigdata.com/rdf/search#search> ?__token__;
 *      <http://www.bigdata.com/rdf/search#relevance> ?score_private ;
 *      <http://www.bigdata.com/rdf/search#minRelevance> "0.1";
 *      <http://www.bigdata.com/rdf/search#matchAllTerms> "true".
 * }
 * </code>
 *
 * <h3>typeBlockTemplate</h3>
 * <code>
 * ?candidate a ?__type__.
 * </code>
 *
 * <h3>objectPropertyBlockTemplate</h3>
 * <code>
 * ?candidate ?__property__ ?__object__.
 * </code>
 *
 * <h3>dataPropertyBlockTemplate</h3>
 * <code>
 * ?candidate ?__property__ ?value{{static_uuid}}.
 * FILTER ISLITERAL(?value{{static_uuid}})
 * FILTER (STR(?value{{static_uuid}}) = STR(?__literal__))
 * </code>
 */
public class LookupSparqlQueryBuilder {
    private static final ValueFactory vf = SimpleValueFactory.getInstance();
    protected static final double BLAZEGRAPH_MIN_RELEVANCE = 0.1;

    public static final String TOKEN_VARIABLE_NAME = "__token__";
    public static final String TOKEN_VARIABLE = "?" + TOKEN_VARIABLE_NAME;

    protected static final String TYPE_VARIABLE_NAME = "__type__";
    protected static final String TYPE_VARIABLE = "?" + TYPE_VARIABLE_NAME;

    protected static final String PROPERTY_TYPE_VARIABLE_NAME = "__property__";
    protected static final String PROPERTY_TYPE_VARIABLE = "?" + PROPERTY_TYPE_VARIABLE_NAME;

    protected static final String OBJECT_PROPERTY_VARIABLE_NAME = "__object__";
    protected static final String OBJECT_PROPERTY_VARIABLE = "?" + OBJECT_PROPERTY_VARIABLE_NAME;

    protected static final String DATA_PROPERTY_VARIABLE_NAME = "__literal__";
    protected static final String DATA_PROPERTY_VARIABLE = "?" + DATA_PROPERTY_VARIABLE_NAME;

    protected static final String STATIC_UUID_PLACEHOLDER = "{{static_uuid}}";
    protected static final String SEARCH_BLOCK_PLACEHOLDER = "{{search_block}}";
    protected static final String PROPERTIES_BLOCK_PLACEHOLDER = "{{properties_block}}";
    protected static final String LIMIT_BLOCK_PLACEHOLDER = "{{limit_block}}";
    protected static final String TYPE_BLOCK_PLACEHOLDER = "{{type_block}}";

    //@formatter:off
    public static final SparqlQueryTemplate DEFAULT_QUERY_TEMPLATE = new SparqlQueryTemplate(
            // query template
            "SELECT\n"
             + SUBJECT_BINDING_VARIABLE + "\n"
             + "(GROUP_CONCAT(DISTINCT ?type ; separator=\",\") as " + TYPES_BINDING_VARIABLE + ")\n"
             + "(MAX(?score_private) as " + SCORE_BINDING_VARIABLE + ")\n"
             + "WHERE {\n"
             +     TYPE_BLOCK_PLACEHOLDER
             // TODO this should be covered by TYPE_BLOCK_PLACEHOLDER
             // e.g. for wikidata we require wdt:P31
             +      SEARCH_BLOCK_PLACEHOLDER
             +      PROPERTIES_BLOCK_PLACEHOLDER
             + "\n} GROUP BY " + SUBJECT_BINDING_VARIABLE + " "
             +     "ORDER BY DESC(" + SCORE_BINDING_VARIABLE + ")"
             +     LIMIT_BLOCK_PLACEHOLDER,

            // search block template
            SUBJECT_BINDING_VARIABLE + " a ?type.\n"
             + SUBJECT_BINDING_VARIABLE + " ?keyProp ?key.\n"
             + "FILTER ISLITERAL(?key)\n"
             + "BIND(IF(STRLEN(?key) > STRLEN(" + TOKEN_VARIABLE + "),"
             +       "STRLEN(" + TOKEN_VARIABLE + ") - STRLEN(?key),"
             +       "IF(STRLEN(?key) < STRLEN(" + TOKEN_VARIABLE + "),"
             +           "STRLEN(?key) - STRLEN(" + TOKEN_VARIABLE + "),"
             +           "\"0\""
             +        ")"
             +      ")  as ?score_private)\n"
             + "FILTER REGEX(LCASE(STR(?key)), LCASE(" + TOKEN_VARIABLE + "), \"i\").",

            // type block template
            SUBJECT_BINDING_VARIABLE + " a " + TYPE_VARIABLE + ".\n",

            // object propertyy block template
            SUBJECT_BINDING_VARIABLE + " " + PROPERTY_TYPE_VARIABLE + " " + OBJECT_PROPERTY_VARIABLE + ".",

            // data property block template
            SUBJECT_BINDING_VARIABLE + " " + PROPERTY_TYPE_VARIABLE + " ?value" + STATIC_UUID_PLACEHOLDER + "."
             + "FILTER ISLITERAL(?value" + STATIC_UUID_PLACEHOLDER + ")\n" 
             + "FILTER (STR(?value" + STATIC_UUID_PLACEHOLDER + ") = STR(" + DATA_PROPERTY_VARIABLE + "))"
    );

    public static final SparqlQueryTemplate BLAZEGRAPH_QUERY_TEMPLATE = new SparqlQueryTemplate(
            DEFAULT_QUERY_TEMPLATE.queryTemplate,

            // search block template
            SUBJECT_BINDING_VARIABLE + " a ?type.\n"
             + SUBJECT_BINDING_VARIABLE + " ?keyProp ?key.\n"
             + "FILTER ISLITERAL(?key)\n"
             + "SERVICE <http://www.bigdata.com/rdf/search#search> {\n"
             +   "?key <http://www.bigdata.com/rdf/search#search> " + TOKEN_VARIABLE + ";\n"
             +        "<http://www.bigdata.com/rdf/search#relevance> ?score_private ;\n"
             +        "<http://www.bigdata.com/rdf/search#minRelevance> \"" + BLAZEGRAPH_MIN_RELEVANCE + "\";\n"
             +        "<http://www.bigdata.com/rdf/search#matchAllTerms> \"true\".\n"
             + "}",
            DEFAULT_QUERY_TEMPLATE.typeBlockTemplate,
            DEFAULT_QUERY_TEMPLATE.objectPropertyBlockTemplate,
            DEFAULT_QUERY_TEMPLATE.dataPropertyBlockTemplate
    );
    //@formatter:on

    /**
     * Query conversion function that tokenizes the input {@code q} by splitting on whitespace and appending each string
     * token with a the supplied wildcard string {@code w}.
     * 
     * Examples:
     * <ul>
     * <li>splitAppend("foo", "*") -> "foo*"
     * <li>splitAppend("foo bar", ".*") -> "foo.* bar.*"
     * </ul>
     */
    public static final BiFunction<String, String, String> splitAppend = (q, w) -> {
        final StringBuilder tokenizedStringBuilder = new StringBuilder();
        for (String token : q.split(" ")) {
            tokenizedStringBuilder.append(token);
            if (!token.endsWith(w)) {
                tokenizedStringBuilder.append(w);
            }
            tokenizedStringBuilder.append(" ");
        }
        return tokenizedStringBuilder.toString().trim();
    };

    /**
     * Transforms the supplied {@link LookupQuery} to a SPARQL query to execute over the backing SAIL store.
     * 
     * @param query         the {@link LookupQuery} to transform to a SPARQL query.
     * @param queryTemplate the {@link SparqlQueryTemplate} to use for the transformation.
     * @return a {@link QueryPart} that encapsulates a corresponding SPARQL query for the supplied {@link LookupQuery}
     */
    public static QueryPart parseQuery(LookupQuery query, SparqlQueryTemplate queryTemplate) {
        return new ParsedQuery(query, queryTemplate, null);
    }

    /**
     * Transforms the supplied {@link LookupQuery} to a SPARQL query to execute over the backing SAIL store.
     * 
     * @param query                   the {@link LookupQuery} to transform to a SPARQL query.
     * @param queryTemplate           the {@link SparqlQueryTemplate} to use for the transformation.
     * @param queryConversionFunction a function that converts the query string from the supplied {@link LookupQuery} to
     *                                a suitable query token literal for inclusion in the SPARQL template. This function
     *                                can be used to tokenize the query string, and introduce wildcards, as appropriate
     *                                for the underlying service that evaluates the SPARQL query. If set to {@code null}
     *                                or if {@link LookupQuery#isTokenizeQueryString()} is {@code false}, the input
     *                                query string is included in the SPARQL query as-is.
     * @return a {@link QueryPart} that encapsulates a corresponding SPARQL query for the supplied {@link LookupQuery}
     */
    public static QueryPart parseQuery(LookupQuery query, SparqlQueryTemplate queryTemplate,
            Function<String, Literal> queryConversionFunction) {
        return new ParsedQuery(query, queryTemplate, queryConversionFunction);
    }

    /**
     * Transforms the supplied {@link LookupQuery} to a SPARQL query using the {@link #DEFAULT_QUERY_TEMPLATE} to
     * execute over the backing SAIL store.
     * 
     * @param query the {@link LookupQuery} to transform to a SPARQL query.
     * @return a {@link QueryPart} that encapsulates a corresponding SPARQL query for the supplied {@link LookupQuery}
     */
    public static QueryPart parseRegexQuery(LookupQuery query) {
        return new ParsedQuery(query, DEFAULT_QUERY_TEMPLATE, (q) -> vf.createLiteral(splitAppend.apply(q, ".*")));
    }

    /**
     * Transforms the supplied {@link LookupQuery} to a SPARQL query using the {@link #BLAZEGRAPH_QUERY_TEMPLATE} to
     * execute over the backing SAIL store.
     * 
     * @param query the {@link LookupQuery} to transform to a SPARQL query.
     * @return a {@link QueryPart} that encapsulates a corresponding SPARQL query for the supplied {@link LookupQuery}
     */
    public static QueryPart parseQueryForBlazegraph(LookupQuery query) {
        return new ParsedQuery(query, BLAZEGRAPH_QUERY_TEMPLATE, (q) -> vf.createLiteral(splitAppend.apply(q, "*")));
    }

    protected static class ParsedQuery extends QueryPart {
        protected SparqlQueryTemplate template;
        protected LookupQuery query;
        protected QueryPart searchPart;
        protected QueryPart typePart;
        protected List<QueryPart> propertyParts;

        public ParsedQuery(LookupQuery query, SparqlQueryTemplate template,
                Function<String, Literal> queryConversionFunction) {
            this.query = query;
            this.template = template;
            this.typePart = new TypeQueryPart(query, template);
            this.searchPart = new SearchQueryPart(query, template, queryConversionFunction);
            this.propertyParts = new LinkedList<>();
            if (query.getProperties() != null) {
                for (LookupProperty<?> property : query.getProperties()) {
                    propertyParts.add(new PropertyPart(property, template));
                }
            }
        }

        @Override
        public String getAsString() {
            LookupPropertyStrictType mergingMode = this.query.getStrictType();

            String typeBlock = this.typePart.getAsString();
            String searchBlock = this.searchPart.getAsString();
            String propertiesBlock = "";
            if (this.propertyParts.size() > 0 && mergingMode != LookupPropertyStrictType.any) {
                String separator = mergingMode == LookupPropertyStrictType.all ? "\n" : "\n} UNION {\n";
                propertiesBlock = "\n{\n" + 
                        String.join(
                                separator, 
                                this.propertyParts.stream().map(property -> property.getAsString()).collect(Collectors.toList())
                        ) + 
                        "\n}";
            }
            String limitBlock = (this.query.getLimit() != null ? " LIMIT " + this.query.getLimit() : "");

            return this.template.queryTemplate
                    .replaceAll(Pattern.quote(STATIC_UUID_PLACEHOLDER), this.uuid)
                    .replaceAll(Pattern.quote(TYPE_BLOCK_PLACEHOLDER), typeBlock)
                    .replaceAll(Pattern.quote(SEARCH_BLOCK_PLACEHOLDER), searchBlock)
                    .replaceAll(Pattern.quote(PROPERTIES_BLOCK_PLACEHOLDER), propertiesBlock)
                    .replaceAll(Pattern.quote(LIMIT_BLOCK_PLACEHOLDER), limitBlock);
        }

        @Override
        public Map<String, Value> getBindings() {
            Map<String, Value> bindings = this.searchPart.getBindings();
            bindings.putAll(this.typePart.getBindings());
            for (QueryPart part : this.propertyParts) {
                bindings.putAll(part.getBindings());
            }
            return bindings;
        }
    }

    protected static class SearchQueryPart extends QueryPart {
        protected LookupQuery query;
        protected SparqlQueryTemplate template;

        private final Function<String, Literal> queryConversionFunction;

        /**
         * Create a new {@link SearchQueryPart} with the supplied lookup query, sparql query template.
         * 
         * @param query    a {@link LookupQuery}
         * @param template a {@link SparqlQueryTemplate}
         */
        public SearchQueryPart(LookupQuery query, SparqlQueryTemplate template) {
            this(query, template, null);
        }

        /**
         * Create a new {@link SearchQueryPart} with the supplied lookup query, SPARQL query template, and query
         * conversion function
         * 
         * @param query                   a {@link LookupQuery}
         * @param template                a {@link SparqlQueryTemplate}
         * @param queryConversionFunction a function that converts the query string from the supplied
         *                                {@link LookupQuery} to a suitable query token literal for inclusion in the
         *                                SPARQL template. This function can be used to tokenize the query string, and
         *                                introduce wildcards, as appropriate for the underlying service that evaluates
         *                                the SPARQL query. If set to {@code null} or if
         *                                {@link LookupQuery#isTokenizeQueryString()} is {@code false}, the input query
         *                                string is included in the SPARQL query as-is.
         */
        public SearchQueryPart(LookupQuery query, SparqlQueryTemplate template,
                Function<String, Literal> queryConversionFunction) {
            this.query = query;
            this.template = template;

            if (queryConversionFunction == null || (query.isTokenizeQueryString() != null && !query.isTokenizeQueryString())) {
                this.queryConversionFunction = vf::createLiteral;
            }
            else {
                this.queryConversionFunction = queryConversionFunction;
            }
        }

        @Override
        public String getAsString() {
            return this.template.searchBlockTemplate.replaceAll(Pattern.quote(STATIC_UUID_PLACEHOLDER), this.uuid);
        }

        @Override
        public Map<String, Value> getBindings() {
            Map<String, Value> bindings = new LinkedHashMap<>();

            bindings.put(TOKEN_VARIABLE_NAME, queryConversionFunction.apply(query.getQuery()));
            return bindings;
        }
    }

    protected static class TypeQueryPart extends QueryPart {
        protected LookupQuery query;
        protected SparqlQueryTemplate template;

        public TypeQueryPart(LookupQuery query, SparqlQueryTemplate template) {
            this.query = query;
            this.template = template;
        }

        @Override
        public String getAsString() {
            return (query.getType() != null
                    ? template.typeBlockTemplate.replaceAll(Pattern.quote(STATIC_UUID_PLACEHOLDER), this.uuid)
                    : "");
        }

        @Override
        public Map<String, Value> getBindings() {
            Map<String, Value> bindings = new LinkedHashMap<>();
            if (query.getType() != null) {
                bindings.put(TYPE_VARIABLE_NAME, vf.createIRI(query.getType()));
            }
            return bindings;
        }
    }

    protected static class PropertyPart extends QueryPart {
        protected LookupProperty<?> property;
        protected SparqlQueryTemplate template;

        public PropertyPart(LookupProperty<?> property, SparqlQueryTemplate template) {
            this.property = property;
            this.template = template;
        }

        @Override
        public String getAsString() {
            if (this.property instanceof LookupObjectProperty) {
                return this.getRelationPart();
            } else if (this.property instanceof LookupDataProperty) {
                return this.createDataPropertyBlock();
            } else {
                throw new IllegalArgumentException("Property value can be only a link to the object: "
                        + "{ id: 'http://example.com' }\n " + "or String.");
            }
        }

        protected String createDataPropertyBlock() {
            String propertyVariable = this.getUniqueVariable(PROPERTY_TYPE_VARIABLE_NAME);
            String literalVariable = this.getUniqueVariable(DATA_PROPERTY_VARIABLE_NAME);
            return this.template.dataPropertyBlockTemplate.replaceAll(Pattern.quote(STATIC_UUID_PLACEHOLDER), this.uuid)
                    .replaceAll(Pattern.quote(PROPERTY_TYPE_VARIABLE), propertyVariable)
                    .replaceAll(Pattern.quote(DATA_PROPERTY_VARIABLE), literalVariable);

        }

        protected String getRelationPart() {
            String propertyVariable = this.getUniqueVariable(PROPERTY_TYPE_VARIABLE_NAME);
            String objectVariable = this.getUniqueVariable(OBJECT_PROPERTY_VARIABLE_NAME);
            return this.template.objectPropertyBlockTemplate
                    .replaceAll(Pattern.quote(STATIC_UUID_PLACEHOLDER), this.uuid)
                    .replaceAll(Pattern.quote(PROPERTY_TYPE_VARIABLE), propertyVariable)
                    .replaceAll(Pattern.quote(OBJECT_PROPERTY_VARIABLE), objectVariable);
        }

        @Override
        public Map<String, Value> getBindings() {
            Map<String, Value> bindings = new LinkedHashMap<>();
            bindings.put(this.getUniqueBinding(PROPERTY_TYPE_VARIABLE_NAME), vf.createIRI(this.property.getPid()));
            if (this.property instanceof LookupObjectProperty) {
                bindings.put(this.getUniqueBinding(OBJECT_PROPERTY_VARIABLE_NAME),
                        vf.createIRI(((LookupObjectPropertyLink) this.property.getValue()).getId()));
            } else {
                bindings.put(getUniqueBinding(DATA_PROPERTY_VARIABLE_NAME),
                        vf.createLiteral((String) this.property.getValue()));
            }
            return bindings;
        }
    }

    public static abstract class QueryPart {
        protected String uuid;

        public QueryPart() {
            this.uuid = UUID.randomUUID().toString().replaceAll("[\\s\\-()]", "");
        }

        protected String getUniqueVariable(String varName) {
            return "?" + varName + this.uuid;
        }

        protected String getUniqueBinding(String varName) {
            return varName + this.uuid;
        }

        public abstract Map<String, Value> getBindings();

        public abstract String getAsString();
    }

    public static class SparqlQueryTemplate {
        public String queryTemplate;
        public String searchBlockTemplate;
        public String typeBlockTemplate;
        public String objectPropertyBlockTemplate;
        public String dataPropertyBlockTemplate;

        public SparqlQueryTemplate(String queryTemplate, String searchBlockTemplate, String typeBlockTemplate,
                String objectPropertyBlockTemplate, String dataPropertyBlockTemplate) {
            this.queryTemplate = queryTemplate;
            this.searchBlockTemplate = searchBlockTemplate;
            this.typeBlockTemplate = typeBlockTemplate;
            this.objectPropertyBlockTemplate = objectPropertyBlockTemplate;
            this.dataPropertyBlockTemplate = dataPropertyBlockTemplate;
        }
    }
}
