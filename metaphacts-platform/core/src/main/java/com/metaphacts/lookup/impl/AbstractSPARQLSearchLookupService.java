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

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import javax.inject.Inject;

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.model.Value;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.query.Binding;
import org.eclipse.rdf4j.query.BindingSet;
import org.eclipse.rdf4j.query.TupleQuery;
import org.eclipse.rdf4j.query.TupleQueryResult;
import org.eclipse.rdf4j.repository.Repository;
import org.eclipse.rdf4j.repository.RepositoryConnection;
import org.eclipse.rdf4j.repository.RepositoryException;

import com.metaphacts.api.sparql.SparqlOperationBuilder;
import com.metaphacts.cache.DescriptionService;
import com.metaphacts.cache.LabelService;
import com.metaphacts.config.NamespaceRegistry;
import com.metaphacts.lookup.api.LookupService;
import com.metaphacts.lookup.model.LookupCandidate;
import com.metaphacts.lookup.model.LookupDataset;
import com.metaphacts.lookup.model.LookupEntityType;
import com.metaphacts.lookup.model.LookupQuery;
import com.metaphacts.lookup.model.LookupRequest;
import com.metaphacts.lookup.model.LookupResponse;
import com.metaphacts.repository.RepositoryManager;

/**
 * Base implementation for {@link LookupService} for SPARQL
 * repositories. Specific implementations need to define the
 * {@link #createQuery(LookupQuery, RepositoryConnection)}
 *
 * It's expected to have following set of output variables in the query
 * created by $createQuery function:
 * ?candidate, ?score, ?types, (optionally) ?label
 *
 * <p>
 * It's possible to configure target repository using following parameter:
 * <i>-Dconfig.lookup.experimental.targetRepository</i>
 * </p>
 */
public abstract class AbstractSPARQLSearchLookupService extends AbstractLookupService<SparqlQueryLookupConfig> {

    static final ValueFactory vf = SimpleValueFactory.getInstance();
    public static final String SUBJECT_BINDING_NAME = "candidate";
    public static final String SUBJECT_BINDING_VARIABLE = "?" + SUBJECT_BINDING_NAME;
    public static final String LABEL_BINDING_NAME = "label";
    public static final String SCORE_BINDING_NAME = "score";
    public static final String SCORE_BINDING_VARIABLE = "?" + SCORE_BINDING_NAME;

    public static final String TYPES_BINDING_NAME = "types";
    public static final String TYPES_BINDING_VARIABLE = "?" + TYPES_BINDING_NAME;

    public static final String DATASET_BINDING_NAME = "dataset";
    public static final String DATASET_LABEL_BINDING_NAME = "datasetLabel";

    public static final String REFERENCE_BINDING_NAME = "reference";

    public static final String TYPE_BINDING_NAME = "type";
    protected static final String DEFAULT_ENTITY_TYPES_QUERY = "SELECT ?" + TYPE_BINDING_NAME + " WHERE {\n" +
        "{SELECT DISTINCT ?" + TYPE_BINDING_NAME + " WHERE {\n" +
            "?subject a ?" + TYPE_BINDING_NAME + " .\n" +
        "}}\n" +
        "FILTER ISIRI(?" + TYPE_BINDING_NAME + ")\n" +
    "}";

    @Inject
    protected LabelService labelCache;

    @Inject
    protected DescriptionService descriptionCache;

    @Inject
    protected RepositoryManager repositoryManager;

    @Inject
    protected NamespaceRegistry namespaceRegistry;

    public AbstractSPARQLSearchLookupService(SparqlQueryLookupConfig config) {
        super(config);
    }

    @Override
    public List<LookupEntityType> getAvailableEntityTypes() {
        String query = config.getEntityTypesQuery();

        SparqlOperationBuilder<TupleQuery> builder = SparqlOperationBuilder.create(
            query != null ? query : DEFAULT_ENTITY_TYPES_QUERY, TupleQuery.class
        );

        Repository targetRepository = this.getTargetRepository();
        List<IRI> entityTypes = new LinkedList<>();
        try (RepositoryConnection con = targetRepository.getConnection()) {
            TupleQuery tupleQuery = builder.build(con);
            try (TupleQueryResult tupleResult = tupleQuery.evaluate()) {
                while (tupleResult.hasNext()) {
                    BindingSet next = tupleResult.next();
                    entityTypes.add((IRI)next.getBinding("type").getValue());
                }
            }
        }

        Map<IRI, Optional<Literal>> labels = this.labelCache.getLabels(
            entityTypes, targetRepository, globalConfig.getUiConfig().resolvePreferredLanguage(null)
        );

        return labels.entrySet().stream().map(entry -> new LookupEntityType(
            entry.getKey().stringValue(),
            LabelService.resolveLabelWithFallback(entry.getValue(), entry.getKey())
        )).collect(Collectors.toList());
    }

    @Override
    protected LookupResponse doLookup(LookupRequest request) {
        Map<String, IRI> idToIri = new LinkedHashMap<>();
        Repository targetRepository = this.getTargetRepository();

        Set<IRI> irisToFetchLabels = new LinkedHashSet<>();
        Set<IRI> irisToFetchDescriptions = new LinkedHashSet<>();
        Map<String, LookupEntityType> entityTypes = new LinkedHashMap<>();
        List<LookupCandidate> candidates = new LinkedList<>();

        try (RepositoryConnection con = targetRepository.getConnection()) {
            TupleQuery tupleQuery = this.createQuery(request.getQuery(), con);
            try (TupleQueryResult tupleResult = tupleQuery.evaluate()) {
                for (BindingSet bindings : tupleResult) {
                    Value subject = bindings.getValue(SUBJECT_BINDING_NAME);
                    if (subject instanceof IRI) {
                        IRI subjectIri = (IRI) subject;

                        LookupCandidate candidate = this.createCandidate(bindings, entityTypes);
                        idToIri.put(subjectIri.stringValue(), subjectIri);
                        if (candidate.getName() == null) {
                            irisToFetchLabels.add(idToIri.get(candidate.getId()));
                        }
                        irisToFetchDescriptions.add(subjectIri);
                        candidates.add(candidate);
                    }
                }
            }
        }

        // Collect entity types to fetch labels
        for(LookupEntityType entityType : entityTypes.values()) {
            IRI entityTypeIri = vf.createIRI(entityType.getId());
            idToIri.put(entityType.getId(), entityTypeIri);
            irisToFetchLabels.add(entityTypeIri);
        }

        Map<String, LookupDataset> datasets = this.findAndSetDatasets(candidates);
        // Collect datasets to fetch labels
        for(LookupDataset dataset : datasets.values()) {
            if (dataset.getName() == null) {
                IRI datasetIri = vf.createIRI(dataset.getId());
                idToIri.put(dataset.getId(), datasetIri);
                irisToFetchLabels.add(datasetIri);
            }
        }

        // Fetch labels for candidates, entity types and datasets
        Map<IRI, Optional<Literal>> labelMap = this.labelCache.getLabels(
            irisToFetchLabels, targetRepository, request.getQuery().getPreferredLanguage()
        );

        // Fetch descriptions for candidates
        Map<IRI, Optional<Literal>> descriptionMap = this.descriptionCache.getDescriptions(
            irisToFetchDescriptions, targetRepository, request.getQuery().getPreferredLanguage()
        );

        // Set entity type labels
        for (LookupEntityType entityType : entityTypes.values()) {
            IRI entityTypeIri = idToIri.get(entityType.getId());
            entityType.setName(LabelService.resolveLabelWithFallback(labelMap.get(entityTypeIri), entityTypeIri));
        }

        // Set dataset labels
        for (LookupDataset dataset : datasets.values()) {
            if (dataset.getName() == null) {
                IRI datasetIri = idToIri.get(dataset.getId());
                dataset.setName(LabelService.resolveLabelWithFallback(labelMap.get(datasetIri), datasetIri));
            }
        }

        // Set candidate labels and descriptions
        for (LookupCandidate candidate : candidates) {
            IRI candidateIri = idToIri.get(candidate.getId());
            if (candidate.getName() == null) {
                candidate.setName(LabelService.resolveLabelWithFallback(labelMap.get(candidateIri), candidateIri));
            }
            Literal description = descriptionMap.get(candidateIri).orElse(null);
            if (description != null) {
                candidate.setDescription(description.stringValue());
            }
        }

        return new LookupResponse(request.getQueryId(), candidates);
    }

    /**
     * Translates the {@link LookupQuery} into a {@link TupleQuery}.
     * <p>
     * The provided {@link RepositoryConnection} must not be closed as it will be
     * used for query execution.
     * </p>
     *
     * @param query - LookupQuery to execute
     * @param con   - RepositoryConnection (Must not close after executing).
     * @return executable TupleQuery.
     */
    protected abstract TupleQuery createQuery(LookupQuery query, RepositoryConnection con);

    protected SparqlQueryLookupConfig getSparqlQueryConfig() {
        return config;
    }

    protected Repository getTargetRepository() throws RepositoryException {
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

    protected boolean isRelevantScore(double score) {
        return score >= 0.5;
    }

    protected LookupCandidate createCandidate(BindingSet binding, Map<String, LookupEntityType> entityTypesRegistry) {
        Binding subjectBinding = binding.getBinding(SUBJECT_BINDING_NAME);
        Binding scoreBinding = binding.getBinding(SCORE_BINDING_NAME);

        Binding typeBinding = binding.getBinding(TYPES_BINDING_NAME);
        Binding labelBinding = binding.getBinding(LABEL_BINDING_NAME);

        Binding referenceBinding = binding.getBinding(REFERENCE_BINDING_NAME);

        if (subjectBinding == null || scoreBinding == null) {
            throw new IllegalArgumentException("Query result doesn't contain all necessary fields: candidate, score.");
        }

        List<LookupEntityType> types = new LinkedList<>();
        if (typeBinding != null) {
            String[] strings = typeBinding.getValue().stringValue().split(",");
            for (String type : strings) {
                if (!entityTypesRegistry.containsKey(type)) {
                    entityTypesRegistry.put(type, new LookupEntityType(type, null));
                }
                types.add(entityTypesRegistry.get(type));
            }
        }
        double score = Double.parseDouble(
            scoreBinding.getValue().stringValue()
        );
        LookupCandidate candidate = new LookupCandidate(
            subjectBinding.getValue().stringValue(),
            (labelBinding != null ? labelBinding.getValue().stringValue() : null),
            types,
            score,
            this.isRelevantScore(score),
            null,
            null
        );
        if (referenceBinding != null) {
            candidate.setReference(referenceBinding.getValue().stringValue());
        }
        return candidate;
    }

    protected Map<String, LookupDataset> findAndSetDatasets(List<LookupCandidate> candidates) {
        Map<String, LookupDataset> datasets = new LinkedHashMap<>();
        if (candidates.size() == 0) { return datasets; }

        // If DatasetQuery is not defined we try to use predefined datasetId
        String query = config.getDatasetQuery();
        if (query == null) {
            IRI datasetId = config.getDatasetId();
            if (datasetId != null) {
                LookupDataset dataset = new LookupDataset(datasetId.stringValue(), config.getDatasetLabel());
                for (LookupCandidate candidate : candidates) {
                    candidate.setDataset(dataset);
                }
                datasets.put(dataset.getId(), dataset);
            }
            return datasets;
        }

        // If DatasetQuery is not defined we execute it with list of candidates
        Map<String, LookupCandidate> idToCandidate = new LinkedHashMap<>();
        String valuesBody = "";
        for (LookupCandidate candidate : candidates) {
            idToCandidate.put(candidate.getId(), candidate);
            valuesBody += "(<" + candidate.getId() + ">)";
        }
        query += "VALUES (" + SUBJECT_BINDING_VARIABLE + ") {" +
            valuesBody +
        "}";

        SparqlOperationBuilder<TupleQuery> builder = SparqlOperationBuilder.create(query, TupleQuery.class);

        Repository targetRepository = this.getTargetRepository();
        try (RepositoryConnection con = targetRepository.getConnection()) {
            TupleQuery tupleQuery = builder.build(con);
            try (TupleQueryResult tupleResult = tupleQuery.evaluate()) {
                while (tupleResult.hasNext()) {
                    BindingSet next = tupleResult.next();
                    String candidateId = next.getBinding(SUBJECT_BINDING_NAME).getValue().stringValue();
                    String datasetId = next.getBinding(DATASET_BINDING_NAME).getValue().stringValue();
                    LookupCandidate candidate = idToCandidate.get(candidateId);
                    if (!datasets.containsKey(datasetId)) {
                        Binding nameBinding = next.getBinding(DATASET_LABEL_BINDING_NAME);
                        String datasetLabel = nameBinding == null ? null : nameBinding.getValue().stringValue();
                        datasets.put(datasetId, new LookupDataset(datasetId, datasetLabel));
                    }
                    candidate.setDataset(datasets.get(datasetId));
                }
            }
        }
       return datasets;
    }
}
