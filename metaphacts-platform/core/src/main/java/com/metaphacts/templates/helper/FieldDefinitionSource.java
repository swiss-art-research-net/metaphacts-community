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

import static java.util.stream.Collectors.toList;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import javax.annotation.Nullable;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.model.Value;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.query.BindingSet;
import org.eclipse.rdf4j.rio.ntriples.NTriplesUtil;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.github.jknack.handlebars.Options;
import com.google.common.collect.ImmutableList;
import com.metaphacts.cache.LabelCache;
import com.metaphacts.data.json.JsonUtil;
import com.metaphacts.repository.RepositoryManager;
import com.metaphacts.services.fields.FieldDefinition;
import com.metaphacts.services.fields.FieldDefinitionGeneratorChain;
import com.metaphacts.services.fields.FieldsBasedSearch;
import com.metaphacts.services.fields.SearchConfigMerger;
import com.metaphacts.services.fields.SearchRelation;
import com.metaphacts.templates.TemplateContext;
import com.metaphacts.templates.helper.HelperUtil.QueryResult;

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
    private final FieldDefinitionGeneratorChain fieldDefinitionGenerators;
    private final FieldsBasedSearch fieldsBasedSearch;

    private final LabelCache labelCache;

    public FieldDefinitionSource(
        RepositoryManager repositoryManager,
        FieldDefinitionGeneratorChain fieldDefinitionGenerators,
        FieldsBasedSearch fieldsBasedSearch,
        LabelCache labelCache
    ) {
        this.repositoryManager = repositoryManager;
        this.fieldDefinitionGenerators = fieldDefinitionGenerators;
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
        LinkedHashMap<String, IRI> aliasMap = new LinkedHashMap<>();
        options.hash.forEach((alias, param) -> {
            IRI iri = HelperUtil.toIRI(param);
            if (iri != null) {
                aliasMap.put(alias, iri);
            }
        });
        return this.generateFieldDefinitions(aliasMap.isEmpty() ? null : aliasMap, options);
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

        LinkedHashMap<String, IRI> aliasMap = new LinkedHashMap<>();
        for (BindingSet b: result.bindings) {
            Value field = b.getBinding(FIELD_BINDING_VARIABLE).getValue();
            if (!(field instanceof IRI)) {
                continue;
            }
            String alias = b.hasBinding(FIELD_ALIAS_BINDING_VARIABLE)
                ? b.getBinding(FIELD_ALIAS_BINDING_VARIABLE).getValue().stringValue()
                : field.stringValue();
            aliasMap.put(alias, (IRI)field);
        }

        if (aliasMap.isEmpty()) {
            return "[]";
        } else {
            return this.generateFieldDefinitions(aliasMap, options);
        }
    }

    private String generateFieldDefinitions(@Nullable LinkedHashMap<String, IRI> aliasMap, Options options) {
        Map<IRI, FieldDefinition> fields;
        LinkedHashMap<String, IRI> order;
        if (aliasMap == null) {
            fields = fieldDefinitionGenerators.handleAll(Collections.emptyList());
            order = new LinkedHashMap<>();
            fields.values().stream()
                .sorted(Comparator.comparing(field -> field.getIri().stringValue()))
                .forEach(field -> order.put(field.getIri().stringValue(), field.getIri()));
        } else {
            fields = fieldDefinitionGenerators.handleAll(aliasMap.values());
            order = aliasMap;
        }

        List<Object> jsonDefinitions = new ArrayList<>();
        for (Map.Entry<String, IRI> entry : order.entrySet()) {
            FieldDefinition field = fields.get(entry.getValue());
            if (field == null) {
                continue;
            }

            Map<String, Object> json = field.toJson();
            json.put("id", entry.getKey());
            if (aliasMap != null) {
                json.put("order", jsonDefinitions.size());
            }

            String fieldLabel = this.getFieldDefinitionLabel(field.getIri().stringValue(), options);
            json.put("label", fieldLabel);
            jsonDefinitions.add(json);
        }

        String resultJson = JsonUtil.prettyPrintJson(jsonDefinitions);
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
    public String searchConfigForFields(Object param0, Options options) throws IOException {
        List<String> fields = new ArrayList<>();
        if (param0 != null) {
            fields.add(HelperUtil.toString(param0));
            for (Object param : options.params) {
                if (param != null) {
                    fields.add(HelperUtil.toString(param));
                }
            }
        }
        return generateSearchConfigForFields(fields, options);
    }

    /**
     * Handlebars helper function that generates semantic-search config based on field definitions.
     * Expects varargs list of field IRIs.
     */
    private String generateSearchConfigForFields(List<String> iris, Options options) {
        ValueFactory vf = SimpleValueFactory.getInstance();
        List<IRI> fieldIris = iris.stream().map(vf::createIRI).collect(toList());

        Map<IRI, FieldDefinition> fields = fieldDefinitionGenerators.handleAll(fieldIris);

        Map<String, SearchRelation> relations = new LinkedHashMap<>();
        for (FieldDefinition field : fields.values()) {
            String fieldLabel = this.getFieldDefinitionLabel(field.getIri().stringValue(), options);
            SearchRelation relation = this.fieldsBasedSearch.relationFromField(field, fieldLabel);
            if (!relation.domain.isEmpty() && !relation.range.isEmpty()) {
                relations.put(NTriplesUtil.toNTriplesString(relation.id), relation);
            } else {
                throw new RuntimeException("Domain or Range is unknown for the field - " + relation.id);
            }
        }

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
