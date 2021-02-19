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
package com.metaphacts.lookup.impl;

import java.io.IOException;
import java.net.URISyntaxException;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import javax.inject.Inject;
import javax.servlet.http.HttpServletResponse;

import org.apache.http.HttpResponse;
import org.apache.http.client.HttpClient;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.client.utils.URIBuilder;
import org.apache.http.util.EntityUtils;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.model.vocabulary.OWL;
import org.eclipse.rdf4j.query.TupleQuery;
import org.eclipse.rdf4j.query.TupleQueryResult;
import org.eclipse.rdf4j.repository.Repository;
import org.eclipse.rdf4j.repository.RepositoryConnection;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.common.collect.Lists;
import com.google.common.collect.Maps;
import com.google.common.collect.Sets;
import com.metaphacts.cache.LabelService;
import com.metaphacts.lookup.api.LookupProcessingException;
import com.metaphacts.lookup.api.LookupService;
import com.metaphacts.lookup.model.LookupCandidate;
import com.metaphacts.lookup.model.LookupDataProperty;
import com.metaphacts.lookup.model.LookupDataset;
import com.metaphacts.lookup.model.LookupEntityType;
import com.metaphacts.lookup.model.LookupObjectProperty;
import com.metaphacts.lookup.model.LookupProperty;
import com.metaphacts.lookup.model.LookupQuery;
import com.metaphacts.lookup.model.LookupRequest;
import com.metaphacts.lookup.model.LookupResponse;
import com.metaphacts.repository.RepositoryManager;


/**
 * An implementation of {@link LookupService} that performs an entity search
 * using the Wikidata API.
 * 
 * <p>
 * Example request:
 * </p>
 * 
 * <pre>
 * https://www.wikidata.org/w/api.php?action=wbsearchentities&search=abc&language=en
 * </pre>
 * 
 * @author Andreas Schwarte
 *
 */
public class WikidataLookupService extends AbstractLookupService<RepositoryBasedLookupConfig> {

    private static final String WIKIDATA_API_URL = "https://www.wikidata.org/w/api.php";
    private static final int DEFAULT_LIMIT = 100;
    private static final ValueFactory vf = SimpleValueFactory.getInstance();

    private static final Logger logger = LogManager.getLogger(WikidataLookupService.class);

    @Inject
    private RepositoryManager repositoryManager;

    @Inject
    private LabelService labelCache;

    public WikidataLookupService(RepositoryBasedLookupConfig config) {
        super(config);
    }

    // for test setup
    WikidataLookupService(String repositoryId, RepositoryManager repositoryManager, LabelService labelCache) {
        super(new RepositoryBasedLookupConfig(WikidataLookupServiceFactory.LOOKUP_TYPE));
        this.config.setTargetRepository(repositoryId);
        this.repositoryManager = repositoryManager;
        this.labelCache = labelCache;
    }
    
    @Override
    protected LookupResponse doLookup(LookupRequest request) throws LookupProcessingException {
        
        List<LookupCandidate> candidates = evaluateQuery(request.getQuery());

        return new LookupResponse(request.getQueryId(), candidates);
    }
    
    private String getPreferredLanguage() {
        // TODO ideally we get the preferred language from the user context
        return "en";
    }

    protected List<LookupCandidate> evaluateQuery(LookupQuery query) throws LookupProcessingException {
        
        try {
            int limit = query.getLimit() == null ? DEFAULT_LIMIT : query.getLimit();
            JsonNode result = sendRequest(query.getQuery(), limit);
            
            List<LookupCandidate> candidates = Lists.newArrayList();

            if (result.get("search").size() == 0) {
                return candidates;
            }

            int i = 0;
            for (JsonNode node : result.get("search")) {
                String id = node.get("concepturi").asText();
                String name = node.get("label").asText();
                String description = node.has("description") ? node.get("description").asText() : null;
                double score = (double) (limit - i++) / limit;
                // use a temporary generic type here, types are properly determined below
                List<LookupEntityType> types = Lists
                        .newArrayList(new LookupEntityType(OWL.THING.stringValue(), "Thing"));
                boolean match = true;
                LookupDataset dataset = null;

                candidates.add(new LookupCandidate(id, name, types, score, match, dataset, description));
            }

            // obtain type information and set them to the candidates
            determineAndSetTypes(candidates);
            
            // if the lookup query contains a type as filter, apply it as filter
            if (query.getType() != null) {
                logger.trace("Filtering candiates for type {}", query.getType());
                candidates = candidates.stream()
                        .filter(c -> c.getTypes().stream().anyMatch(t -> t.getId().equals(query.getType())))
                        .collect(Collectors.toList());
            }

            // filter candidates on LookupProperty as provided in the query
            if (query.getProperties() != null && !query.getProperties().isEmpty()) {
                candidates = filterCandidatesForProperties(candidates, query.getProperties());
            }

            return candidates;
        } catch (IOException e) {
            throw new LookupProcessingException("I/O error while sending query to the Wikidata API: " + e.getMessage());
        } catch (Exception e) {
            throw new LookupProcessingException("Failed to send query via HTTP: " + e.getMessage(), e);
        }
    }
    
    
    /**
     * Send a keyword search query to the Wikidata API
     * 
     * <pre>
     * https://www.wikidata.org/w/api.php?action=wbsearchentities&search=abc&language=en
     * </pre>
     * 
     * @param searchToken
     * @param limit
     * @return the result as {@link JsonNode}
     * @throws IOException
     * @throws URISyntaxException
     */
    protected JsonNode sendRequest(String searchToken, int limit) throws IOException, URISyntaxException {

        HttpClient client = repositoryManager.getHttpClient();

        URIBuilder builder = new URIBuilder(WIKIDATA_API_URL);
            builder
            .setParameter("action", "wbsearchentities")
            .setParameter("format", "json")
            .setParameter("type", "item")
            .setParameter("search", searchToken)
            .setParameter("language", getPreferredLanguage())
            .setParameter("limit",  Integer.toString(limit)); 
        
        HttpGet request = new HttpGet(builder.build());

        
        
        HttpResponse resp = client.execute(request);
        try {
            int statusCode = resp.getStatusLine().getStatusCode();
            if (statusCode != HttpServletResponse.SC_OK) {
                throw new RuntimeException("Unexpected response: " + statusCode);
            }

            ObjectMapper mapper = new ObjectMapper();
            return mapper.readTree(EntityUtils.toString(resp.getEntity()));
        } finally {
            if (resp instanceof CloseableHttpResponse) {
                ((CloseableHttpResponse)resp).close();
            }
        }
        
    }

    /**
     * Determines the types by invoking a query to the underlying {@link Repository}
     * identified as {@link #repositoryId}. Type display names are retrieved in the
     * preferred language from the {@link LabelService}.
     * 
     * @param candidates the candidates with supplied {@link LookupEntityType}s
     */
    protected void determineAndSetTypes(List<LookupCandidate> candidates) {

        StringBuilder sb = new StringBuilder();

        sb.append("SELECT ?id ?type WHERE { ");
        sb.append(" VALUES ?id { ");
        candidates.forEach(c -> sb.append("<").append(c.getId()).append("> "));
        sb.append(" } ");
        sb.append("?id <http://www.wikidata.org/prop/direct/P31> ?type . FILTER (isIRI(?type))");
        sb.append("}");
        
        Repository repo = getTargetRepository();
        Map<String, List<IRI>> candidateToTypes = Maps.newHashMap();
        try (RepositoryConnection conn = repo.getConnection()) {
            
            TupleQuery tq = conn.prepareTupleQuery(sb.toString());
            try (TupleQueryResult tqr = tq.evaluate()) {
                tqr.forEach(b -> {
                    String id = b.getValue("id").stringValue();
                    List<IRI> types = candidateToTypes.get(id);
                    if (types == null) {
                        types = Lists.newArrayList();
                        candidateToTypes.put(id, types);
                    }
                    types.add((IRI) b.getValue("type"));
                });
            }
        }

        // optimization: collect display names for all types in single request
        Set<IRI> allTypes = Sets.newHashSet();
        candidateToTypes.values().forEach(l -> allTypes.addAll(l));
        Map<IRI, Optional<Literal>> typeToDisplayName = labelCache.getLabels(allTypes, repo, getPreferredLanguage());

        for (LookupCandidate candidate : candidates) {

            List<IRI> types = candidateToTypes.get(candidate.getId());
            if (types == null) {
                logger.trace("No types found for lookup candidate " + candidate.getId());
                continue;
            }

            // set types to candidate and fetch display name for types using LabelCache
            candidate.setTypes(types.stream().map(type -> {
                Optional<Literal> name = typeToDisplayName.get(type);
                if (name == null || !name.isPresent()) {
                    name = Optional.of(vf.createLiteral(type.getLocalName()));
                }
                return new LookupEntityType(type.stringValue(), name.get().stringValue());
            }).collect(Collectors.toList()));
        }
    }

    /**
     * Filter the candidates such that all constraints provided
     * {@link LookupProperty}s are fulfilled, which is that all respective datatype
     * and object properties for the candidate must exist. This check is done using
     * a query against the main database.
     * 
     * @param candidates
     * @param properties
     * @return the filtered candidates
     */
    protected List<LookupCandidate> filterCandidatesForProperties(List<LookupCandidate> candidates,
            List<LookupProperty<?>> properties) {

        StringBuilder sb = new StringBuilder();
        sb.append("SELECT ?id WHERE { ");
        sb.append("VALUES ?id { ");
        candidates.forEach(c -> sb.append("<").append(c.getId()).append("> "));
        sb.append("} ");
        sb.append(" FILTER EXISTS { ");
        for (LookupProperty<?> prop : properties) {
            String object;
            if (prop instanceof LookupDataProperty) {
                LookupDataProperty _prop = (LookupDataProperty) prop;
                object = vf.createLiteral(_prop.getValue()).toString();
            } else if (prop instanceof LookupObjectProperty) {
                LookupObjectProperty _prop = (LookupObjectProperty) prop;
                object = "<" + _prop.getValue().getId() + ">";
            } else {
                logger.warn("Unknown LookupProperty class '{}', value {}", prop.getClass(), prop.getValue());
                continue;
            }
            sb.append(" ?id <").append(prop.getPid()).append("> ").append(object);
        }
        sb.append(" } }");

        Repository repo = getTargetRepository();
        Set<String> filteredCandidates = Sets.newHashSet();
        try (RepositoryConnection conn = repo.getConnection()) {

            TupleQuery tq = conn.prepareTupleQuery(sb.toString());
            try (TupleQueryResult tqr = tq.evaluate()) {
                tqr.forEach(b -> {
                    String id = b.getValue("id").stringValue();
                    filteredCandidates.add(id);
                });
            }
        }

        candidates = candidates.stream().filter(c -> filteredCandidates.contains(c.getId()))
                .collect(Collectors.toList());

        return candidates;
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
}
