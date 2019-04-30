/*
 * Copyright (C) 2015-2019, metaphacts GmbH
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

import java.io.IOException;
import java.util.*;
import java.util.Map.Entry;
import java.util.function.Function;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.google.common.collect.*;
import com.metaphacts.services.fields.FieldsBasedSearch;
import com.metaphacts.services.fields.SearchConfigMerger;
import com.metaphacts.services.fields.SearchRelation;
import com.metaphacts.templates.TemplateContext;
import org.apache.commons.lang3.StringEscapeUtils;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.model.Value;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.query.BindingSet;
import org.eclipse.rdf4j.queryrender.RenderUtils;

import com.github.jknack.handlebars.Handlebars;
import com.github.jknack.handlebars.Options;
import com.metaphacts.cache.LabelCache;
import com.metaphacts.data.json.JsonUtil;
import com.metaphacts.data.rdf.container.FieldDefinitionContainer;
import com.metaphacts.repository.RepositoryManager;
import com.metaphacts.templates.helper.HelperUtil.QueryResult;
import org.eclipse.rdf4j.rio.ntriples.NTriplesUtil;

import static java.util.stream.Collectors.toList;

/**
 * Helper function that reads field definitions from the database and returns them as properly JSON
 * and HTML encoded JSON object array string.
 *
 * @author Johannes Trame <jt@metaphacts.com>
 *
 */
public class FieldDefinitionSource {
    private static String FIELD_BINDING_VARIABLE = "field";
    private static String FIELD_ALIAS_BINDING_VARIABLE = "alias";

    private static final Logger logger = LogManager.getLogger(FieldDefinitionSource.class);

    private final RepositoryManager repositoryManager;
    private final FieldsBasedSearch fieldsBasedSearch;

    private final LabelCache labelCache;

    public FieldDefinitionSource(
        RepositoryManager repositoryManager,
        FieldsBasedSearch fieldsBasedSearch,
        LabelCache labelCache
    ) {
        this.repositoryManager = repositoryManager;
        this.fieldsBasedSearch = fieldsBasedSearch;
        this.labelCache = labelCache;
    }

    /**
     * Handlebars helper function that expects mapping between field alias and IRI.
     *
     * <p>Example:</p>
     * <pre><code>
     *     <!-- Read all the fields -->
     *     [[fieldDefinitions]]
     *
     *     <!-- Read specific field definitions -->
     *     [[fieldDefinitions
     *       alias1="http://www.example.com/fields/field1"
     *       alias2="http://www.example.com/fields/field2"]]
     * </code></pre>
     */
    public String fieldDefinitions(Options options) {
        return this.generateFieldDefinitons(options.hash, options);
    }

    /**
     * Handlebars helper function takes a sparql select query with `field` projection variable,
     * and then retrieves field definitions for the corresponding fields.
     * <p>Optionally, query can project `alias` variable, that can be used as a shorthand for the field URI.</p>
     *
     * <p>Example:</p>
     * <pre><code>
     *     [[fieldDefinitionsFromQuery "SELECT ?field WHERE {...}"]]
     *     [[fieldDefinitionsFromQuery "SELECT ?field ?alias WHERE {...}"]]
     * </code></pre>
     */
    public String fieldDefinitionsFromQuery(String param0, Options options) {
        QueryResult result =
            HelperUtil.evaluateSelectQuery(param0, options, logger, repositoryManager.getAssetRepository());
        if (!result.bindingNames.contains(FIELD_BINDING_VARIABLE)) {
            throw new IllegalArgumentException("Binding variable " + FIELD_BINDING_VARIABLE + " does not exist in query result.");
        }

        Map<String, Object> aliasMap = new LinkedHashMap<>();
        for (BindingSet b: result.bindings) {
            String field = b.getBinding(FIELD_BINDING_VARIABLE).getValue().stringValue();
            String alias = b.hasBinding(FIELD_ALIAS_BINDING_VARIABLE)
                ? b.getBinding(FIELD_ALIAS_BINDING_VARIABLE).getValue().stringValue() : field;
            aliasMap.put(alias, field);
        }

        if (aliasMap.isEmpty()) {
            return "[]";
        } else {
            return this.generateFieldDefinitons(aliasMap, options);
        }
    }

    private String generateFieldDefinitons(Map<String, Object> aliasMap, Options options) {
        String valuesClause = "";
        if (!aliasMap.isEmpty()) {
            StringBuilder sb = new StringBuilder();
            sb.append("VALUES (?field ?alias ?order){");
            int i = 0;
            for (Entry<String, Object> e: aliasMap.entrySet()) {
                if (e.getValue() instanceof String) {
                    sb.append("(<");
                    sb.append(e.getValue());
                    sb.append(">");
                    sb.append(" \"");
                    sb.append(e.getKey());
                    sb.append("\" ");
                    sb.append(i);
                    sb.append(")");
                }
                i++;
            }
            sb.append("}");
            valuesClause = sb.toString();
        }

        String queryString = makeFieldDefinitionQuery(valuesClause);
        logger.trace("Query for reading field definitions: {}", queryString);

        List<Object> result = new ArrayList<>();
        JsonFromSparqlSelectSource.enumerateQueryTuples(queryString, options, Optional.of(repositoryManager.getAssetRepository()), (tuple, last) -> {
            Map<String, Object> values = new HashMap<>();
            values.putAll(Maps.transformValues(tuple, v -> {
                if (v instanceof Literal) {
                    Literal literal = (Literal)v;
                    IRI datatype = literal.getDatatype();
                    if (datatype.stringValue().equals(JsonFromSparqlSelectSource.SYNTHETIC_JSON_DATATYPE)) {
                        ObjectMapper mapper = JsonUtil.getDefaultObjectMapper();
                        try {
                            return mapper.readTree(literal.stringValue());
                        } catch (IOException ex) {
                            throw new RuntimeException(ex);
                        }
                    }
                }
                return v.stringValue();
            }));

            String label = this.getFieldDefinitionLabel(values.get("iri").toString(), options);
            values.put("label", label);

            result.add(values);
        });
        String resultJson = JsonUtil.prettyPrintJson(result);
        return HelperUtil.escapeIfRequested(resultJson, options);
    }

    /**
     * Handlebars helper function to generate search configuration (as JSON) from fields returned by
     * the specified query.
     *
     * <p>Example:</p>
     * <pre><code>
     *     [[searchConfigForFieldsFromQuery "SELECT ?field WHERE {...}"]]
     * </code></pre>
     */
    public String searchConfigForFieldsFromQuery(String param0, Options options) throws IOException {
        QueryResult result =
            HelperUtil.evaluateSelectQuery(param0, options, logger, repositoryManager.getAssetRepository());
        if (!result.bindingNames.contains(FIELD_BINDING_VARIABLE)) {
            throw new IllegalArgumentException("Binding variable " + FIELD_BINDING_VARIABLE + " does not exist in query result.");
        }

        ImmutableList<String> fields = ImmutableList.copyOf(
            result.bindings.stream()
                .map(b -> b.getBinding(FIELD_BINDING_VARIABLE).getValue().stringValue())
                .collect(toList())
        );
        return generateSearchConfigForFields(fields, options);
    }

    /**
     * Handlebars helper function that generates semantic-search config based on field definitions.
     * <p>Expects varargs list of field IRIs.</p>
     *
     * <p>Example:</p>
     * <pre><code>
     *     [[searchConfigForFields
     *       "http://www.example.com/fields/field1"
     *       "http://www.example.com/fields/field2"]]
     * </code></pre>
     */
    public String searchConfigForFields(String param0, Options options) throws IOException {
        List<String> fields = new ArrayList<>();
        if (param0 != null) {
            fields.add(param0);
            for (Object param : options.params) {
                fields.add((String)param);
            }
        }
        return generateSearchConfigForFields(fields, options);
    }

    /**
     * Handlebars helper function that generates semantic-search config based on field definitions.
     * Expects varargs list of field IRIs.
     */
    private String generateSearchConfigForFields(List<String> fields, Options options) {
        String queryString = makeQueryForFieldDefinitions(fields);

        Map<String, SearchRelation> relations = new LinkedHashMap<>();
        JsonFromSparqlSelectSource.enumerateQueryTuples(queryString, options, Optional.of(repositoryManager.getAssetRepository()), (tuple, last) -> {
            Map<String, String> values = new HashMap<>();
            values.putAll(Maps.transformValues(tuple, v -> v.stringValue()));
            if (values.get("id") == null) {
                return;
            }

            String label = this.getFieldDefinitionLabel(values.get("iri"), options);
            values.put("label", label);

            SearchRelation relation = this.fieldsBasedSearch.relationFromJsonTuple(values);
            if (!relation.domain.isEmpty() && !relation.range.isEmpty()) {
                relations.put(NTriplesUtil.toNTriplesString(relation.id), relation);
            } else {
                throw new RuntimeException("Domain or Range is unknown for the field - " + relation.id);
            }
        });

        TemplateContext context = TemplateContext.fromHandlebars(options.context);
        Map<String, Object> result = this.fieldsBasedSearch.generateSearchConfig(relations, context);

        String searchConfigJson = JsonUtil.prettyPrintJson(result);
        return HelperUtil.escapeIfRequested(searchConfigJson, options);
    }

    /**
     * Handlebars helper function to partially override search configuration.
     *
     * <p>Example:</p>
     * <pre><code>
     *     [[mergeSearchConfig
     *       (searchConfigForFields
     *         "http://www.example.com/fields/field1"
     *         "http://www.example.com/fields/field2"
     *         escape=false)
     *       '{"categories": {"&lt;example:category1&gt;": [ {"kind": "numeric-range"} ]}}'
     *       '{"searchProfile": {"relations": [ {"iri": "&lt;example:override1&gt;", "hasRange": "&lt;example:range1&gt;"} ]}}'
     *     ]]
     * </code></pre>
     */
    public String mergeSearchConfig(String baseConfig, Options options) throws IOException {
        ObjectMapper mapper = JsonUtil.getDefaultObjectMapper();
        SearchConfigMerger merger = new SearchConfigMerger();

        ObjectNode config = JsonUtil.toObjectNode(mapper.readTree(baseConfig));
        for (Object configOverride : options.params) {
            ObjectNode override = JsonUtil.toObjectNode(mapper.readTree((String)configOverride));
            config = merger.mergeJson(config, override);
        }
        String configJson = mapper.writerWithDefaultPrettyPrinter().writeValueAsString(config);
        return HelperUtil.escapeIfRequested(configJson, options);
    }

    private String makeFieldDefinitionQuery(String valuesClause) {
        String jsonDatatype = JsonFromSparqlSelectSource.SYNTHETIC_JSON_DATATYPE;
        return String.join("\n",
            "PREFIX field: <http://www.metaphacts.com/ontology/fields#> ",
            "PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>",
            "PREFIX sp: <http://spinrdf.org/sp#>",
            "SELECT DISTINCT ?id",
            "(SAMPLE(?description) AS ?description)",
            "(SAMPLE(?minOccurs) AS ?minOccurs)",
            "(SAMPLE(?maxOccurs) AS ?maxOccurs)",
            "(STRDT(",
            "  IF(COUNT(?defaultValue) > 0,",
            "    CONCAT(\"[\\\"\",",
            "      GROUP_CONCAT(?defaultValue; separator=\"\\\", \\\"\"),",
            "      \"\\\"]\"",
            "    ),",
            "    \"[]\"",
            "  ),",
            "  <" + jsonDatatype + ">",
            ") AS ?defaultValues)",
            "(STRDT(",
            "  IF(COUNT(?domain) > 0,",
            "    CONCAT(\"[\\\"\",",
            "      GROUP_CONCAT(?domain; separator=\"\\\", \\\"\"),",
            "      \"\\\"]\"",
            "    ),",
            "    \"[]\"",
            "  ),",
            "  <" + jsonDatatype + ">",
            ") AS ?domain)",
            "(SAMPLE(?xsdDatatype) AS ?xsdDatatype)",
            "(STRDT(",
            "  IF(COUNT(?range) > 0,",
            "    CONCAT(\"[\\\"\",",
            "      GROUP_CONCAT(?range; separator=\"\\\", \\\"\"),",
            "      \"\\\"]\"",
            "    ),",
            "    \"[]\"",
            "  ),",
            "  <" + jsonDatatype + ">",
            ") AS ?range)",
            "(SAMPLE(?insertPattern) AS ?insertPattern)",
            "(SAMPLE(?deletePattern) AS ?deletePattern)",
            "(SAMPLE(?selectPattern) AS ?selectPattern)",
            "(SAMPLE(?askPattern) AS ?askPattern)",
            "(SAMPLE(?autosuggestionPattern) AS ?autosuggestionPattern)",
            "(SAMPLE(?valueSetPattern) AS ?valueSetPattern)",
            "(SAMPLE(?treePatterns) AS ?treePatterns)",
            "(SAMPLE(?order) as ?order)",
            "(SAMPLE(?iri) as ?iri)",
            "WHERE {",
            "<" + FieldDefinitionContainer.IRI_STRING + "> <http://www.w3.org/ns/ldp#contains> ?field.",
            "?field a field:Field.",
            "?field field:insertPattern [ sp:text ?insertPattern].",
            "OPTIONAL{?field field:selectPattern [ sp:text ?selectPattern]}.",
            "OPTIONAL{?field field:deletePattern [ sp:text ?deletePattern]}.",
            "OPTIONAL{?field field:valueSetPattern [ sp:text ?valueSetPattern]}.",
            "OPTIONAL{?field field:autosuggestionPattern [ sp:text ?autosuggestionPattern]}.",
            "OPTIONAL{?field field:minOccurs ?minOccurs.}.",
            "OPTIONAL{?field field:domain ?domain.}.",
            "OPTIONAL{?field field:xsdDatatype ?xsdDatatype.}.",
            "OPTIONAL{?field field:range ?range.}.",
            "OPTIONAL{?field field:maxOccurs ?maxOccurs.}.",
            "OPTIONAL { ?field field:defaultValue ?defaultValue . } .",
            "OPTIONAL{?field rdfs:comment ?description.}.",
            "OPTIONAL{?field field:askPattern [ sp:text ?askPattern]}.",
            "OPTIONAL { ?field field:treePatterns ?treePatterns }",
            valuesClause,
            "BIND(COALESCE(?alias, ?field) as ?id)",
            "BIND(?field as ?iri)",
            "}",
            "GROUP BY ?id",
            "ORDER BY ?order ?id"
        );
    }

    private String makeQueryForFieldDefinitions(List<String> definitionIds) {
        ValueFactory vf = SimpleValueFactory.getInstance();
        String valuesClause = definitionIds.size() > 0 ? renderValuesClause(
            "?field", definitionIds,
            param -> ImmutableList.of(vf.createIRI(param))
        ) : "";
        String query = makeFieldDefinitionQuery(valuesClause);
        logger.trace("Query for reading field definitions: {}", query);
        return query;
    }

    private static <T> String renderValuesClause(
        String rowSpecification,
        Collection<T> values,
        Function<T, List<Value>> rowMapper
    ) {
        StringBuilder builder = new StringBuilder();
        builder.append("VALUES (").append(rowSpecification).append(") {\n");
        for (T value : values) {
            builder.append("(");
            for (Value item : rowMapper.apply(value)) {
                RenderUtils.toSPARQL(item, builder).append(" ");
            }
            builder.append(")");
        }
        builder.append("}");
        return builder.toString();
    }

    private String getFieldDefinitionLabel(String fieldIriValue, Options options) {
        ValueFactory vf = SimpleValueFactory.getInstance();
        IRI fieldIri = vf.createIRI(fieldIriValue);

        TemplateContext context = TemplateContext.fromHandlebars(options.context);
        Optional<Literal> label = labelCache.getLabel(
            fieldIri, repositoryManager.getAssetRepository(), context.getPreferredLanguage().orElse(null)
        );

        return LabelCache.resolveLabelWithFallback(label, fieldIri);
    }
}
