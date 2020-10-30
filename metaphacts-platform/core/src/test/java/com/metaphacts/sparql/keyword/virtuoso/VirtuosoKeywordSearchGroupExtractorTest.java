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
package com.metaphacts.sparql.keyword.virtuoso;

import java.util.List;
import java.util.Map;

import com.google.common.collect.Maps;
import org.eclipse.rdf4j.model.vocabulary.RDFS;
import org.eclipse.rdf4j.query.BindingSet;
import org.eclipse.rdf4j.query.Dataset;
import org.eclipse.rdf4j.query.algebra.Projection;
import org.eclipse.rdf4j.query.algebra.QueryModelNode;
import org.eclipse.rdf4j.query.algebra.TupleExpr;
import org.eclipse.rdf4j.query.algebra.evaluation.QueryOptimizer;
import org.eclipse.rdf4j.query.algebra.helpers.AbstractQueryModelVisitor;
import org.eclipse.rdf4j.query.impl.MapBindingSet;
import org.eclipse.rdf4j.query.parser.ParsedQuery;
import org.eclipse.rdf4j.query.parser.sparql.SPARQLParser;
import org.junit.Assert;
import org.junit.Test;

import com.google.common.collect.Lists;
import com.metaphacts.sparql.keyword.algebra.KeywordSearchGroupTupleExpr;
import com.metaphacts.sparql.keyword.algebra.KeywordSearchPattern;

public class VirtuosoKeywordSearchGroupExtractorTest {

    protected static class KeywordSearchPatternCollector
            extends AbstractQueryModelVisitor<RuntimeException> implements QueryOptimizer {

        List<KeywordSearchPattern> keywordSearchPatterns = Lists.newArrayList();

        public KeywordSearchPatternCollector() {

        }

        @Override
        public void optimize(TupleExpr tupleExpr, Dataset dataset, BindingSet bindings) {
            keywordSearchPatterns.clear();
            tupleExpr.visit(this);
        }

        @Override
        public void meetOther(QueryModelNode node) throws RuntimeException {
            if (node instanceof KeywordSearchGroupTupleExpr) {
                KeywordSearchPattern pattern = ((KeywordSearchGroupTupleExpr) node)
                        .getKeywordSearchPattern();
                keywordSearchPatterns.add(pattern);
            } else {
                super.meetOther(node);
            }
        }

        public List<KeywordSearchPattern> getKeywordSearchPatterns() {
            return keywordSearchPatterns;
        }

    }

    SPARQLParser parser = new SPARQLParser();
    KeywordSearchPatternCollector patternCollector = new KeywordSearchPatternCollector();

    public VirtuosoKeywordSearchGroupExtractorTest() {

    }

    protected TupleExpr parseAndOptimize(String query,
            VirtuosoKeywordSearchGroupExtractor extractor) {
        ParsedQuery parsedQuery = parser.parseQuery(query, null);
        extractor.optimize(parsedQuery.getTupleExpr(), null, new MapBindingSet());
        return extractor.getTupleExpr();
    }

    @Test
    public void testSingleGroupWithProperty() {
        String query = "PREFIX rdfs: <" + RDFS.NAMESPACE + "> \n" + "SELECT * WHERE { \n"
                + "  ?entity rdfs:comment ?comment . \n" + "  ?entity rdfs:label ?label . \n"
                + "  FILTER(STRSTARTS(STR(?entity), \"http://\")) . \n"
                + "  ?label <bif:contains> \"token\" . \n" + "  ?label <bif:score> ?thescore . \n"
                + "}";

        VirtuosoKeywordSearchGroupExtractor extractor = new VirtuosoKeywordSearchGroupExtractor();
        Projection res = (Projection) parseAndOptimize(query, extractor);
        Assert.assertTrue(extractor.containsKeywordClauses());
        patternCollector.optimize(res, null, null);
        Assert.assertEquals(1, patternCollector.getKeywordSearchPatterns().size());
        KeywordSearchPattern pattern = patternCollector.getKeywordSearchPatterns().iterator()
                .next();
        Assert.assertEquals(1, pattern.getPredicateVars().size());
        Assert.assertEquals(0, pattern.getTypeVars().size());
        Assert.assertEquals(RDFS.LABEL, pattern.getFirstPredicateVar().getValue());
        Assert.assertEquals("entity", pattern.getSubjectVar().getName());
        Assert.assertEquals("label", pattern.getMatchVar().getName());
        Assert.assertEquals("thescore", pattern.getScoreVar().getName());
        Assert.assertEquals("token", pattern.getValueVar().getValue().stringValue());
    }

    @Test
    public void testSingleGroupWithMultipleProperties() {
        String query = "PREFIX rdfs: <" + RDFS.NAMESPACE + "> \n" + "SELECT * WHERE { \n"
                + "  ?entity rdfs:label|rdfs:comment ?label . \n"
                + "  FILTER(STRSTARTS(STR(?entity), \"http://\")) . \n"
                + "  ?label <bif:contains> \"token\" . \n" + "  ?label <bif:score> ?thescore . \n"
                + "}";

        VirtuosoKeywordSearchGroupExtractor extractor = new VirtuosoKeywordSearchGroupExtractor();
        Projection res = (Projection) parseAndOptimize(query, extractor);
        Assert.assertTrue(extractor.containsKeywordClauses());
        patternCollector.optimize(res, null, null);
        Assert.assertEquals(1, patternCollector.getKeywordSearchPatterns().size());
        KeywordSearchPattern pattern = patternCollector.getKeywordSearchPatterns().iterator()
                .next();
        Assert.assertEquals(2, pattern.getPredicateVars().size());
        Assert.assertEquals(0, pattern.getTypeVars().size());
        Assert.assertEquals("entity", pattern.getSubjectVar().getName());
        Assert.assertEquals("label", pattern.getMatchVar().getName());
        Assert.assertEquals("thescore", pattern.getScoreVar().getName());
        Assert.assertEquals("token", pattern.getValueVar().getValue().stringValue());
    }

    @Test
    public void testTwoGroupsWithMultipleProperties() {
        String query = "PREFIX rdfs: <" + RDFS.NAMESPACE + "> \n" + "SELECT * WHERE { \n"
                + "  ?entity rdfs:label ?label . \n"
                + "  FILTER(STRSTARTS(STR(?entity), \"http://\")) . \n"
                + "  ?label <bif:contains> \"token\" . \n" 
                + "  ?label <bif:score> ?thescore . \n"
                + "  ?entity2 rdfs:seeAlso ?entity . \n" 
                + "  ?entity2 rdfs:label|rdfs:comment ?label2 . \n"
                + "  ?label2 <bif:contains> \"token2\" . \n"
                + "  ?label2 <bif:score> ?thescore2 . \n" 
                + "}";

        VirtuosoKeywordSearchGroupExtractor extractor = new VirtuosoKeywordSearchGroupExtractor();
        Projection res = (Projection) parseAndOptimize(query, extractor);
        Assert.assertTrue(extractor.containsKeywordClauses());
        patternCollector.optimize(res, null, null);
        Assert.assertEquals(2, patternCollector.getKeywordSearchPatterns().size());

        Map<String, KeywordSearchPattern> map = Maps.newHashMap();
        patternCollector.getKeywordSearchPatterns().stream()
                .forEach(pattern -> map.put(pattern.getSubjectVar().getName(), pattern));
        
        KeywordSearchPattern pattern = map.get("entity");
        Assert.assertEquals(1, pattern.getPredicateVars().size());
        Assert.assertEquals(RDFS.LABEL, pattern.getFirstPredicateVar().getValue());
        Assert.assertEquals(0, pattern.getTypeVars().size());
        Assert.assertEquals("entity", pattern.getSubjectVar().getName());
        Assert.assertEquals("label", pattern.getMatchVar().getName());
        Assert.assertEquals("thescore", pattern.getScoreVar().getName());
        Assert.assertEquals("token", pattern.getValueVar().getValue().stringValue());
        
        pattern = map.get("entity2");
        Assert.assertEquals(2, pattern.getPredicateVars().size());
        Assert.assertEquals(0, pattern.getTypeVars().size());
        Assert.assertEquals("entity2", pattern.getSubjectVar().getName());
        Assert.assertEquals("label2", pattern.getMatchVar().getName());
        Assert.assertEquals("thescore2", pattern.getScoreVar().getName());
        Assert.assertEquals("token2", pattern.getValueVar().getValue().stringValue());
        
    }

}
