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
package com.metaphacts.lookup.impl;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import javax.inject.Inject;

import org.apache.commons.lang3.StringUtils;
import org.eclipse.rdf4j.common.iteration.Iterations;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.model.vocabulary.RDFS;
import org.eclipse.rdf4j.query.BindingSet;
import org.eclipse.rdf4j.query.TupleQuery;
import org.eclipse.rdf4j.query.TupleQueryResult;
import org.eclipse.rdf4j.repository.Repository;
import org.eclipse.rdf4j.repository.RepositoryConnection;
import org.eclipse.rdf4j.sail.lucene.LuceneSail;

import com.google.common.collect.Lists;
import com.google.common.collect.Maps;
import com.google.common.collect.Sets;
import com.metaphacts.lookup.api.LookupProcessingException;
import com.metaphacts.lookup.api.LookupService;
import com.metaphacts.lookup.model.LookupCandidate;
import com.metaphacts.lookup.model.LookupDataset;
import com.metaphacts.lookup.model.LookupEntityType;
import com.metaphacts.lookup.model.LookupQuery;
import com.metaphacts.lookup.model.LookupRequest;
import com.metaphacts.lookup.model.LookupResponse;
import com.metaphacts.lookup.util.LookupSparqlQueryBuilder;
import com.metaphacts.repository.RepositoryManager;
import com.metaphacts.templates.index.TemplateIndexManager;
import com.metaphacts.templates.index.TemplateIndexManager.TemplateIndexVocabulary;

/**
 * A {@link LookupService} to search contents indexed through
 * {@link TemplateIndexManager}.
 * 
 * <p>
 * The service sends a SPARQL query with RDF4J {@link LuceneSail} syntax to the
 * repository {@link TemplateIndexManager#METADATA_REPOSITORY_ID} which is
 * populated by the {@link TemplateIndexManager}.
 * </p>
 * 
 * <p>
 * This implementation provides special logic for aggregating matches on a given
 * resource, and applies rules for defining an aggregated score.
 * </p>
 * 
 * @author Andreas Schwarte
 *
 */
public class TemplateLookupService extends AbstractLookupService<RepositoryBasedLookupConfig> {

    private static final ValueFactory vf = SimpleValueFactory.getInstance();

    @Inject
    private RepositoryManager repositoryManager;

    public TemplateLookupService(RepositoryBasedLookupConfig config) {
        super(config);
    }

    @Override
    protected LookupResponse doLookup(LookupRequest request) throws LookupProcessingException {

        List<LookupCandidate> candidates = evaluateQuery(request.getQuery());

        return new LookupResponse(request.getQueryId(), candidates);
    }

    protected List<LookupCandidate> evaluateQuery(LookupQuery query) throws LookupProcessingException {

        List<LookupCandidate> res = Lists.newArrayList();
        
        List<BindingSet> results = sendTupleQuery(query);
        
        List<MatchedPage> matchedPages = aggregateToMatches(results, query);
        
        for (MatchedPage matchedPage : matchedPages) {
            String id = matchedPage.getId();
            String name = matchedPage.getLabel();
            String description = matchedPage.getMatchSnippet();
            double score = matchedPage.aggregatedScore();
            List<LookupEntityType> types = matchedPage.getTypes().stream()
                    .map(i -> new LookupEntityType(i.stringValue(), i.getLocalName())).collect(Collectors.toList());
            boolean match = true;
            LookupDataset dataset = null;
            LookupCandidate c = new LookupCandidate(id, name, types, score, match, dataset, description);
            res.add(c);
        }
        
        return res;
    }

    /**
     * Sends a {@link LuceneSail} compatible query to the repository to match
     * results as requested by the {@link LookupQuery}.
     * 
     * <p>
     * Note that this method explicitly supports exact matches and wildcard matches
     * (by sending a UNION of the search queries), however, exact matches are ranked
     * higher.
     * </p>
     * 
     * @param query
     * @return
     */
    protected List<BindingSet> sendTupleQuery(LookupQuery query) {
        
        String typeBlock;
        if (query.getType() != null) {
            typeBlock = " ?subject a <" + query.getType() + "> . ?subject a ?type . ";
        } else {
            typeBlock = " OPTIONAL { ?subject a ?type } ";
        }
        String queryPattern = "PREFIX search: <http://www.openrdf.org/contrib/lucenesail#> \n" + 
                "SELECT ?subject ?type ?label ?match ?prop ?score WHERE { \n" 
                + "  {\n" 
                + "    ?subject search:matches [ search:query ?__token__ ; search:property ?prop; search:snippet ?match ; search:score ?scoreInternal] \n"
                + "    BIND((10 + ?scoreInternal) AS ?score)\n" 
                + "  } UNION {\n"
                + "    ?subject search:matches [ search:query ?__tokenWildcard__ ; search:property ?prop; search:snippet ?match ; search:score ?score] \n"
                + "  }\n" 
                + typeBlock 
                + " OPTIONAL { ?subject <" + RDFS.LABEL + "> ?label } "
                +
                "} ORDER BY DESC(?score)";
        
        Repository repo = getTargetRepository();

        try (RepositoryConnection conn = repo.getConnection()) {

            TupleQuery tq = conn.prepareTupleQuery(queryPattern);

            tq.setBinding("__token__", vf.createLiteral(query.getQuery()));
            tq.setBinding("__tokenWildcard__", vf.createLiteral(tokenizeQuery(query.getQuery())));

            try (TupleQueryResult tqr = tq.evaluate()) {
                return Iterations.asList(tqr);
            }
        }
    }

    /**
     * Returns an ordered list of {@link MatchedPage}s from the raw query result,
     * where order is defined by an aggregated score.
     * 
     * <p>
     * This method applies aggregation logics and combines individual matches on a
     * resource for different properties.
     * </p>
     * 
     * @param queryRes
     * @return
     */
    protected List<MatchedPage> aggregateToMatches(List<BindingSet> queryRes, LookupQuery query) {

        Map<IRI, MatchedPage> iriToMatch = Maps.newHashMap();

        for (BindingSet bs : queryRes) {
            
            IRI pageIri = (IRI) bs.getValue("subject");
            MatchedPage matchedPage = iriToMatch.get(pageIri);
            if (matchedPage == null) {
                matchedPage = new MatchedPage(pageIri);
                matchedPage.label = bs.hasBinding("label") ? bs.getValue("label").stringValue()
                        : pageIri.getLocalName();
                iriToMatch.put(pageIri, matchedPage);
            }

            IRI matchProperty = (IRI) bs.getValue("prop");
            String matchSnippet = bs.getValue("match").stringValue();
            double score = Double.valueOf(bs.getValue("score").stringValue());

            matchedPage.matches.add(new Match(matchProperty, matchSnippet, score, query.getQuery()));
            
            if (bs.hasBinding("type")) {
                matchedPage.types.add((IRI) bs.getValue("type"));
            }
        }
        
        // sort matches on different properties insides a page
        iriToMatch.values().forEach(MatchedPage::sortMatches);
        
        // sort on aggregated score, highest score first
        return iriToMatch.values().stream().sorted(Comparator.comparingDouble(MatchedPage::aggregatedScore).reversed())
                .collect(Collectors.toList());
    }
    
    private String tokenizeQuery(String query) {
        return LookupSparqlQueryBuilder.splitAppend.apply(query, "*");
    }
    
    protected Repository getTargetRepository() {
        return Optional.ofNullable(config.getTargetRepository())
                .map(repoId -> {
                    // avoid potential round trips through ephedra or proxies
                    if (RepositoryManager.DEFAULT_REPOSITORY_ID.equals(repoId)) {
                        return repositoryManager.getDefaultTargetRepository();
                    }
                    return repositoryManager.getRepository(repoId);
                })
            .orElse(repositoryManager.getDefaultTargetRepository());
    }

    static class MatchedPage {
        private final IRI iri;
        private String label;

        private final List<Match> matches = Lists.newArrayList();
        private final Set<IRI> types = Sets.newHashSet();

        MatchedPage(IRI iri) {
            super();
            this.iri = iri;
        }

        public String getId() {
            return iri.stringValue();
        }

        public String getLabel() {
            return this.label;
        }

        public String getMatchSnippet() {
            Match bestMatch = matches.get(0);
            // prefer match on content
            String matchSnippet = matches.stream().filter(m -> m.property.equals(TemplateIndexVocabulary.CONTENT))
                    .findFirst()
                    .orElse(bestMatch).match;
            return matchSnippet;
        }

        public Set<IRI> getTypes() {
            return this.types;
        }

        public double aggregatedScore() {
            return matches.iterator().next().getScore();
        }

        public void sortMatches() {
            matches.sort((m1, m2) -> {
                // reverse: larger scores should be first
                return Double.compare(m2.getScore(), m1.getScore());
            });
        }
    }

    static class Match {
        private final IRI property;
        private final String match;
        private final double luceneScore;
        private final String searchQuery;

        Match(IRI property, String match, double score, String searchQuery) {
            super();
            this.property = property;
            this.match = match;
            this.luceneScore = score;
            this.searchQuery = searchQuery;
        }

        public double getScore() {
            if (property.equals(RDFS.LABEL)) {
                // boost the score if the match contains all search terms
                String[] searchTerms = searchQuery.split(" ");
                boolean containsAll = true;
                for (String searchTerm : searchTerms) {
                    if (!StringUtils.containsIgnoreCase(match, searchTerm)) {
                        containsAll = false;
                        break;
                    }
                }
                if (containsAll) {
                    return luceneScore * 2; // boost matches in label
                }
            }
            return luceneScore;
        }
    }
}
