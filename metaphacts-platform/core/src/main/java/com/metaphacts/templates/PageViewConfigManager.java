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
package com.metaphacts.templates;

import java.util.LinkedHashSet;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ExecutionException;

import javax.annotation.Nullable;
import javax.inject.Inject;
import javax.validation.constraints.NotNull;

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.query.BooleanQuery;
import org.eclipse.rdf4j.repository.Repository;
import org.eclipse.rdf4j.repository.RepositoryConnection;

import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import com.metaphacts.cache.CacheManager;
import com.metaphacts.cache.PlatformCache;
import com.metaphacts.cache.TemplateIncludeCache;
import com.metaphacts.config.Configuration;
import com.metaphacts.config.NamespaceRegistry;
import com.metaphacts.repository.RepositoryManager;

/**
 * Manager for PageViewConfig which describes how a given page for a resource
 * shall be rendered.
 * 
 * @author Wolfgang Schell <ws@metaphacts.com>
 */
public class PageViewConfigManager implements PlatformCache {
    public static final String DEFAULT_BREADCRUMBS_TEMPLATE =
            "http://www.metaphacts.com/resource/breadcrumbs/Resource";

    public static final String CACHE_ID = "platform.PageViewConfigCache";

    /**
     * Cache key is defined in {@link #createCacheKey(IRI, Repository)}
     */
    private Cache<String, PageViewConfig> cache;

    private NamespaceRegistry ns;

    private RepositoryManager repositoryManager;

    private TemplateIncludeCache includeCache;

    private MetaphactsHandlebars handlebars;

    private Configuration configuration;

    private PageViewConfigSettings pageRenderConfiguration;

    @Inject
    public PageViewConfigManager(NamespaceRegistry ns,
            RepositoryManager repositoryManager,
            TemplateIncludeCache includeCache,
            MetaphactsHandlebars handlebars,
            Configuration configuration,
            CacheManager cacheManager,
            PageViewConfigSettings pageRenderConfiguration) {
        this.ns = ns;
        this.repositoryManager = repositoryManager;
        this.includeCache = includeCache;
        this.handlebars = handlebars;
        this.configuration = configuration;
        this.pageRenderConfiguration = pageRenderConfiguration;
        this.cache = initializeCache();
        cacheManager.register(this);
    }

    public PageViewConfig getPageViewConfig(@NotNull IRI iri, Optional<String> repositoryId) throws ExecutionException {
        return getPageViewConfig(iri, resolveRepository(repositoryId));
    }

    public PageViewConfig getPageViewConfig(@NotNull IRI iri, @Nullable Repository repository)
            throws ExecutionException {
        if (repository == null) {
            repository = repositoryManager.getDefault();
        }
        Repository _repo = repository;
        String cacheKey = createCacheKey(iri, repository);
        return cache.get(cacheKey, () -> computePageRenderInfo(iri, _repo));
    }

    protected Repository resolveRepository(Optional<String> repositoryId) {
        return repositoryId.map(repId -> repositoryManager.getRepository(repId)).orElse(repositoryManager.getDefault());
    }

    public void reloadConfiguration() {
        pageRenderConfiguration.reloadConfiguration();
        invalidate();
    }

    private Cache<String, PageViewConfig> initializeCache() {
        String spec = configuration.getCacheConfig().getPageViewConfigCacheSpec();
        return CacheBuilder.from(spec).build();
    }
    
    public PageViewConfig computePageRenderInfo(IRI iri, Optional<String> repositoryId) {
        Repository repository = resolveRepository(repositoryId);
        return computePageRenderInfo(iri, repository);
    }

    public PageViewConfig computePageRenderInfo(IRI iri, Repository repository) {

        TemplateContext tc = new TemplateContext(
                iri, repository,
                null, null
                );
        tc.setNamespaceRegistry(this.ns);

        // check whether IRI represents an RDF node (subj, pred, or obj)
        boolean isRDFNode = isRDFNode(iri, repository);

        // 1. is IRI representing a static page
        boolean isStaticPage = TemplateUtil.getTemplateSource(handlebars.getLoader(), iri.stringValue()).isPresent();
        if (isStaticPage) {

            if (isRDFNode) {
                // a static page with RDF content, we want to allow toggling the knowledge graph bar
                PageViewConfigBuilder builder = PageViewConfigBuilder.forStaticPage(iri, pageRenderConfiguration)
                        .withShowKnowledgeGraphBarToggle(true);

                // resolve the knowledge panel template to be used (if exist) and find the first
                // existing panel template
                Optional<String> firstExistingPanelTemplate = resolveKnowledgePanelTemplateIfExist(iri, tc);

                // apply the panel template to the config
                if (firstExistingPanelTemplate.isPresent()) {
                    builder.withKnowledgePanelTemplateIri(firstExistingPanelTemplate.get());
                }

                return builder
                        .applyConfiguration(pageRenderConfiguration).build();
            } else {
                // a static page without RDF content (e.g. an admin page)
                return PageViewConfigBuilder.forStaticPage(iri, pageRenderConfiguration)
                        .applyConfiguration(pageRenderConfiguration).build();
            }
        }


        // 2. IRI does not represent an RDF node
        if (!isRDFNode) {
            return PageViewConfigBuilder.forNonExistingResource(iri, pageRenderConfiguration)
                    .applyConfiguration(pageRenderConfiguration)
                    .build();
        }

        // IRI represents an RDF node
        // now check if IRI is a typed node => used template include identifiers
        LinkedHashSet<String> resourceTemplates = TemplateUtil.getRdfTemplateIncludeIdentifiers(iri, tc, includeCache);

        // find the first existing template
        Optional<String> firstExistingTemplate = TemplateUtil.findFirstExistingTemplate(handlebars.getLoader(),
                resourceTemplates);

        PageViewConfigBuilder builder = PageViewConfigBuilder.createDefault(iri, pageRenderConfiguration);
        // if template exists, take it. Otherwise use initialize template from defaults
        if (firstExistingTemplate.isPresent()) {
            builder.withPageViewTemplateIri(firstExistingTemplate.get());
        } else {
            builder.withBreadcrumbsTemplateIri(DEFAULT_BREADCRUMBS_TEMPLATE);
        }

        // resolve the knowledge panel template to be used (if exist) and find the first
        // existing panel template
        Optional<String> firstExistingPanelTemplate = resolveKnowledgePanelTemplateIfExist(iri, tc);

        // apply the panel template to the config
        if (firstExistingPanelTemplate.isPresent()) {
            builder.withKnowledgePanelTemplateIri(firstExistingPanelTemplate.get());
        }

        return builder
                .withShowKnowledgeGraphBar(!firstExistingTemplate.isPresent())
                .applyConfiguration(pageRenderConfiguration)
                .build();
    }
    
    protected boolean isRDFNode(IRI iri, Repository repository) {

        // TODO consider checking for graph as well
        // Note: might not work in all databases (e.g. wikidata)
        String askQuery = "ASK { { ?iri ?p ?o } UNION { ?s ?iri ?o} UNION {?s ?p ?iri} }";

        try (RepositoryConnection conn = repository.getConnection()) {
            BooleanQuery bq = conn.prepareBooleanQuery(askQuery);
            bq.setBinding("iri", iri);
            return bq.evaluate();
        }
    }


    protected Optional<String> resolveKnowledgePanelTemplateIfExist(IRI iri, TemplateContext tc) {

        // compute the knowledge panel template to be used (if exist)
        LinkedHashSet<String> knowledgePanelTemplates = TemplateUtil.getRdfKnowledgePanelTemplateIncludeIdentifiers(iri,
                tc, includeCache);

        // find the first existing panel template
        return TemplateUtil.findFirstExistingTemplate(handlebars.getLoader(), knowledgePanelTemplates);
    }

    @Override
    public void invalidate() {
        cache.invalidateAll();
        // create a new instance to allow changing cache configuration at runtime
        cache = initializeCache();
    }

    @Override
    public void invalidate(Set<IRI> iris) {
        cache.invalidateAll();
    }

    @Override
    public String getId() {
        return CACHE_ID;
    }

    String createCacheKey(IRI iri, @Nullable Repository repository) {
        return iri.stringValue() + "--" + createRepositoryId(repository);
    }

    String createRepositoryId(@Nullable Repository repository) {
        if (repository == null) {
            return "default";
        }
        return repository.getClass().getSimpleName() + "-" + System.identityHashCode(repository);
    }
}