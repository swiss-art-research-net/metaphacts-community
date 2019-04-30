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

package com.metaphacts.services.fields;

import com.google.common.base.Throwables;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.Maps;
import com.metaphacts.cache.LabelCache;
import com.metaphacts.config.NamespaceRegistry;
import com.metaphacts.repository.RepositoryManager;
import com.metaphacts.sparql.renderer.MpSparqlQueryRenderer;
import com.metaphacts.sparql.visitors.VarRenameVisitor;
import com.metaphacts.templates.TemplateContext;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.query.MalformedQueryException;
import org.eclipse.rdf4j.query.QueryLanguage;
import org.eclipse.rdf4j.query.algebra.*;
import org.eclipse.rdf4j.query.parser.QueryParserUtil;
import org.eclipse.rdf4j.rio.ntriples.NTriplesUtil;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;

import javax.annotation.Nullable;
import javax.inject.Inject;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import java.io.IOException;

public class FieldsBasedSearch {
    private static final Logger logger = LogManager.getLogger(FieldsBasedSearch.class);

    private final NamespaceRegistry namespaceRegistry;
    private final RepositoryManager repositoryManager;
    private final LabelCache labelCache;

    @Inject
    public FieldsBasedSearch(
        NamespaceRegistry namespaceRegistry,
        RepositoryManager repositoryManager,
        LabelCache labelCache
    ) {
        this.namespaceRegistry = namespaceRegistry;
        this.repositoryManager = repositoryManager;
        this.labelCache = labelCache;
    }

    public Map<String, Object> generateSearchConfig(
        Map<String, SearchRelation> relations,
        TemplateContext context
    ) {
        Collection<SearchRelation> allRelations = relations.values();
        Set<IRI> categoryIris = Stream.concat(
            allRelations.stream().map(relation -> relation.domain),
            allRelations.stream()
                .filter(relation -> relation.kind == RelationKind.Resource)
                .map(relation -> relation.range)
        ).flatMap(Collection::stream).collect(Collectors.toSet());

        Map<IRI, Optional<Literal>> categoryLabels = labelCache.getLabels(
            categoryIris,
            this.repositoryManager.getAssetRepository(),
            context.getPreferredLanguage().orElse(null)
        );

        Map<String, List<Object>> configCategories = new HashMap<>();
        relations.forEach((key, relation) ->
            relation.range.forEach(range -> {
                String categoryKey = NTriplesUtil.toNTriplesString(range);
                if (configCategories.containsKey(categoryKey)) { return; }
                if (relation.kind == RelationKind.Resource && relation.rangePattern != null) {
                    Map<String, Object> category = ImmutableMap.of(
                        "kind", "resource",
                        "queryPattern", relation.rangePattern
                    );
                    configCategories.put(categoryKey, ImmutableList.of(category));
                }
            })
        );

        Map<String, List<Object>> configRelations = Maps.transformValues(relations, relation -> {
            Map<String, Object> json = new HashMap<>();
            json.put("kind", relation.kind.searchKind);
            json.put("queryPattern", relation.queryPattern);
            if (relation.kind != RelationKind.Resource) {
                json.put("datatype", relation.xsdDatatype.stringValue());
            }
            return ImmutableList.of(json);
        });

        List<Object> profileCategories = categoryIris.stream()
            .map(category -> {
                String label = LabelCache.resolveLabelWithFallback(
                    categoryLabels.get(category), category);
                return ImmutableMap.of(
                    "iri", NTriplesUtil.toNTriplesString(category),
                    "label", label
                );
            })
            .collect(Collectors.toList());

        List<Object> profileRelations = relations.values().stream()
            .map(relation ->
                relation.domain.stream().map(domain ->
                    relation.range.stream().map(range -> ImmutableMap.of(
                        "iri", NTriplesUtil.toNTriplesString(relation.id),
                        "label", relation.label,
                        "hasDomain", NTriplesUtil.toNTriplesString(domain),
                        "hasRange", NTriplesUtil.toNTriplesString(range)
                    )).collect(Collectors.toList())
                ).flatMap(List::stream).collect(Collectors.toList())
            )
            .flatMap(List::stream)
            .collect(Collectors.toList());

        for (RelationKind kind : RelationKind.values()) {
            if (kind == RelationKind.Resource) { continue; }
            boolean hasKind = relations.values().stream().anyMatch(r -> r.kind == kind);
            if (hasKind) {
                String key = NTriplesUtil.toNTriplesString(kind.rangeCategory);
                configCategories.put(key, ImmutableList.of(ImmutableMap.of("kind", kind.searchKind)));
                profileCategories.add(ImmutableMap.of("iri", key,"label", kind.toString()));
            }
        }

        Map<String, Object> result = ImmutableMap.of(
            "categories", configCategories,
            "relations", configRelations,
            "searchProfile", ImmutableMap.of(
                "categories", profileCategories,
                "relations", profileRelations
            ),
            "selectorMode", "dropdown"
        );

        return result;
    }

    public SearchRelation relationFromJsonTuple(Map<String, String> tuple) {
        String xsdDatatype = tuple.get("xsdDatatype");
        RelationKind kind = RelationKind.fromFieldDatatype(tuple.get("id"), xsdDatatype);

        String queryPattern;
        String rangePattern = null;
        try {
            queryPattern = transformFieldInsertQueryToRelationPattern(kind, tuple.get("insertPattern"));
            String selectQuery = tuple.get("selectPattern");
            if (selectQuery != null) {
                rangePattern = transformFieldSelectQueryToCategoryPattern(selectQuery);
            }
        } catch (MalformedQueryException ex) {
            String message = String.format(
                "Error transforming queries of field definition <%s>", tuple.get("id"));
            logger.error(message, ex);
            throw new RuntimeException(message, ex);
        }

        ValueFactory vf = SimpleValueFactory.getInstance();

        Set<IRI> domain;
        Set<IRI> range;
        ObjectMapper mapper = new ObjectMapper();
        try {
            Set<String> domainValues = mapper.readValue(tuple.get("domain"), new TypeReference<Set<String>>(){});
            domain = domainValues.stream().map(vf::createIRI).collect(Collectors.toSet());
            if (kind.rangeCategory == null) {
                Set<String> rangeValues = mapper.readValue(tuple.get("range"), new TypeReference<Set<String>>(){});
                range = rangeValues.stream().map(vf::createIRI).collect(Collectors.toSet());
            } else {
                range = new HashSet<>();
                range.add(kind.rangeCategory);
            }
        } catch (IOException ex) {
            throw new RuntimeException(ex);
        }

        SearchRelation relation = new SearchRelation();
        relation.id = vf.createIRI(tuple.get("id"));
        relation.kind = kind;
        relation.label = tuple.get("label");
        relation.domain = domain;
        relation.range = range;
        relation.xsdDatatype = iriOrNull(xsdDatatype);
        relation.queryPattern = queryPattern;
        relation.rangePattern = rangePattern;
        return relation;
    }

    private IRI iriOrNull(@Nullable String iri) {
        return iri == null ? null : SimpleValueFactory.getInstance().createIRI(iri);
    }

    private String transformFieldInsertQueryToRelationPattern(RelationKind kind, String insertQuery) {
        String query = namespaceRegistry.prependSparqlPrefixes(insertQuery);

        List<UpdateExpr> updates = QueryParserUtil.parseUpdate(QueryLanguage.SPARQL, query, null)
            .getUpdateExprs();
        if (!(updates.size() == 1 && updates.get(0) instanceof Modify)) {
            throw new RuntimeException("Insert query should contain only single modify operation");
        }

        TupleExpr insert = ((Modify)updates.get(0)).getInsertExpr();
        TupleExpr mapped = mapRelationPattern(kind, insert.clone());
        return renderTupleExpression(mapped);
    }

    private TupleExpr mapRelationPattern(RelationKind kind, TupleExpr pattern) {
        if (kind == RelationKind.Resource) {
            pattern.visit(new VarRenameVisitor("value", "__value__"));
            return pattern;
        } else if (kind == RelationKind.Literal) {
            pattern.visit(new VarRenameVisitor("value", "__literal__"));
            return pattern;
        } else if (kind == RelationKind.Date) {
            ValueExpr beginCondition =
                new Compare(new Var("value"), new Var("__dateBeginValue__"), Compare.CompareOp.GE);
            ValueExpr endCondition =
                new Compare(new Var("value"), new Var("__dateEndValue__"), Compare.CompareOp.LE);
            return new Filter(new Filter(pattern, beginCondition), endCondition);
        } else if (kind == RelationKind.Numeric) {
            ValueExpr beginCondition =
                new Compare(new Var("value"), new Var("__numericRangeBeginValue__"), Compare.CompareOp.GE);
            ValueExpr endCondition =
                new Compare(new Var("value"), new Var("__numericRangeEndValue__"), Compare.CompareOp.LE);
            return new Filter(new Filter(pattern, beginCondition), endCondition);
        } else {
            throw new IllegalArgumentException("Unsupported relation kind " + kind);
        }
    }

    private String transformFieldSelectQueryToCategoryPattern(String selectQuery) {
        String query = namespaceRegistry.prependSparqlPrefixes(selectQuery);
        TupleExpr queryExpr = QueryParserUtil.parseQuery(QueryLanguage.SPARQL, query, null).getTupleExpr();
        queryExpr.visit(new VarRenameVisitor("value", "__value__"));
        return renderTupleExpression(queryExpr);
    }

    private static String renderTupleExpression(TupleExpr expr) {
        try {
            String rendered = new MpSparqlQueryRenderer().render(expr);
            return rendered;
        } catch (Exception ex) {
            throw Throwables.propagate(ex);
        }
    }
}
