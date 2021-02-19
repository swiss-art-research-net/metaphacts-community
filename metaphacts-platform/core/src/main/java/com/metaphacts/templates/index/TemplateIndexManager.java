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
package com.metaphacts.templates.index;

import java.io.IOException;
import java.io.InputStream;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.TimeUnit;

import javax.inject.Inject;
import javax.inject.Singleton;

import org.apache.commons.lang.StringUtils;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.Resource;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.model.vocabulary.RDF;
import org.eclipse.rdf4j.query.QueryResults;
import org.eclipse.rdf4j.repository.Repository;
import org.eclipse.rdf4j.repository.RepositoryConnection;
import org.eclipse.rdf4j.repository.sail.SailRepository;
import org.eclipse.rdf4j.rio.RDFFormat;
import org.eclipse.rdf4j.sail.lucene.LuceneSail;
import org.eclipse.rdf4j.sail.nativerdf.NativeStore;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;

import com.github.jknack.handlebars.HandlebarsException;
import com.github.jknack.handlebars.Template;
import com.github.jknack.handlebars.io.TemplateSource;
import com.google.common.base.Charsets;
import com.google.common.base.Stopwatch;
import com.google.common.collect.Lists;
import com.google.inject.Injector;
import com.metaphacts.cache.LabelService;
import com.metaphacts.config.NamespaceRegistry;
import com.metaphacts.repository.RepositoryManager;
import com.metaphacts.services.storage.api.ObjectKind;
import com.metaphacts.services.storage.api.ObjectRecord;
import com.metaphacts.services.storage.api.PlatformStorage;
import com.metaphacts.services.storage.api.StorageException;
import com.metaphacts.templates.MetaphactsHandlebars;
import com.metaphacts.templates.TemplateByIriLoader;
import com.metaphacts.templates.TemplateContext;
import com.metaphacts.templates.TemplateUtil;
import com.metaphacts.templates.index.TemplateIndexMetadataProvider.Context;


/**
 * Manager class for indexing contents of template pages.
 * 
 * <p>
 * This facility makes use of an existing repository (see
 * {@link #METADATA_REPOSITORY_ID}) that supports full text indexing. In the
 * default case we use an RDF4J {@link NativeStore} repository wrapped in a
 * {@link LuceneSail}. This guarantees that all pages are considered as
 * documents, where datatype properties are being added to the index.
 * </p>
 * 
 * <p>
 * For each template page we are indexing the textual content of the page as
 * well as the page name as label.
 * </p>
 * 
 * @author Andreas Schwarte
 *
 */
@Singleton
public class TemplateIndexManager {

    private static final Logger logger = LogManager.getLogger(TemplateIndexManager.class);
    
    private static final ValueFactory vf = SimpleValueFactory.getInstance();
    
    public static final String METADATA_REPOSITORY_ID = "platformMetadata";

    /**
     * Named graph containing the indexed template statements
     */
    private static final IRI context = SimpleValueFactory.getInstance()
            .createIRI("http://www.metaphacts.com/resource/TemplateIndexGraph");

    @Inject
    private PlatformStorage platformStorage;
    
    @Inject
    private RepositoryManager repositoryManager;
    
    @Inject
    private MetaphactsHandlebars handlebars;

    @Inject
    private NamespaceRegistry ns;

    @Inject
    private LabelService labelCache;

    @Inject
    private Injector injector;

    private List<TemplateIndexMetadataProvider> metadataProviders;

    @Inject
    private void initializeMetadataProviders() {
        this.metadataProviders = Lists.newArrayList();

        this.metadataProviders.add(new DefaultPageMetadataProvider());
        this.metadataProviders.add(new SpecialHelpPageMetadataProvider());
        this.metadataProviders.add(new TemplateGraphMetadataProvider());
        this.metadataProviders.add(new SystemConfigurationMetadataProvider());

        this.metadataProviders.forEach(provider -> {
            injector.injectMembers(provider);
        });
    }

    /**
     * Trigger re-indexing of the template pages.
     * 
     * <p>
     * This routine finds all existing template pages in the {@link PlatformStorage}
     * and makes sure to populate the lucene index. Essentially, all indexable data
     * is added as literal properties attached to the document.
     * </p>
     * 
     * @throws StorageException
     * @throws {@link           RuntimeException} if indexing fails
     */
    public void reindex() throws StorageException {

        logger.info("Re-indexing platform template index.");
        Stopwatch watch = Stopwatch.createStarted();

        List<TemplateIndexInfo> templates = findIndexableTemplates();
        logger.debug("Found {} templates to index.", templates.size());
        
        Repository repository = repositoryManager.getRepository(METADATA_REPOSITORY_ID);

        try (RepositoryConnection conn = repository.getConnection()) {
            
            try {
                conn.begin();

                // remove all previous information from the index
                conn.clear(context);

                // index all templates
                templates.forEach(t -> addToIndex(conn, t));

                // refine specialized types (e.g. include)
                refineSpecializedTypes(conn);

                logger.debug("Committing re-index transaction");
                conn.commit();
                
                // explicitly re-index
                ((LuceneSail) ((SailRepository) repository).getSail()).reindex();

            } catch (Throwable t) {
                logger.warn("Failed to re-index the template index: " + t.getMessage());
                logger.debug("Details: ", t);
                conn.rollback();
                throw new RuntimeException("Failed to re-index the template index", t);
            }

            logger.info("Update of platform template index completed. Duration: {} seconds.",
                    watch.elapsed(TimeUnit.SECONDS));
        }
    }

    /**
     * Bootstrap documentation metadata from the storage.
     * 
     * <p>
     * This method loads a file "data/templates/documentationMetadata.ttl" from the
     * storage into the {@link #METADATA_REPOSITORY_ID}.
     * </p>
     * 
     * @throws StorageException
     */
    public void bootstrapMetadata() throws StorageException {

        Repository repository = repositoryManager.getRepository(METADATA_REPOSITORY_ID);

        Collection<PlatformStorage.FindResult> metadataTtl = platformStorage
                .findOverrides(ObjectKind.TEMPLATE.resolve("documentationMetadata.ttl"));

        for (PlatformStorage.FindResult result : metadataTtl) {
            ObjectRecord record = result.getRecord();

            try (RepositoryConnection conn = repository.getConnection()) {

                IRI bs_context = vf.createIRI("http://www.metaphacts.com/resource/",
                        "documentationMetadata.ttl_" + result.getAppId());
                conn.begin();

                conn.clear(bs_context);

                logger.debug("Loading bootstrap metadata from app {}, path {}", result.getAppId(), record.getPath());
                try (InputStream in = record.getLocation().readContent()) {

                    conn.add(in, "http://www.metaphacts.com/resource", RDFFormat.TURTLE, bs_context);

                    conn.commit();
                } catch (IOException e) {
                    logger.warn("Failed to bootstrap metadata from app {}, path {}: {}", result.getAppId(),
                            record.getPath(), e.getMessage());
                    logger.debug("Details:", e);
                    conn.rollback();
                }
            }
        }
    }

    protected List<TemplateIndexInfo> findIndexableTemplates() throws StorageException {
        Collection<PlatformStorage.FindResult> templateObjects = platformStorage.findAll(ObjectKind.TEMPLATE).values();

        List<TemplateIndexInfo> res = Lists.newArrayList();

        for (PlatformStorage.FindResult result : templateObjects) {
            ObjectRecord record = result.getRecord();

            TemplateByIriLoader.templateIriFromPath(record.getPath())
                    // ignore Template: and PanelTemplate:
                    .filter(iri -> !iri.stringValue().startsWith(TemplateUtil.TEMPLATE_PREFIX))
                    .filter(iri -> !iri.stringValue().startsWith(TemplateUtil.PANEL_TEMPLATE_PREFIX))
                    .map(TemplateIndexInfo::new)
                    .map(res::add);
        }

        return res;
    }

    /**
     * Adds statements for the given template page IRI. Literals are automatically
     * being added to the Lucene index.
     * 
     * <p>
     * This method adds the following information to the index:
     * </p>
     * 
     * <ul>
     * <li>Prepared page content without HTML tags</li>
     * <li>Page label using the first heading of the page, the local name split by
     * camel case as fallback</li>
     * </ul>
     * 
     * <p>
     * All pages are always typed as {@link TemplateIndexVocabulary#PAGE}.
     * Additionally, all occurring includes are linked via
     * {@link TemplateIndexVocabulary#HAS_INCLUDE}
     * </p>
     * 
     * @param conn
     * @param indexInfo
     */
    protected void addToIndex(RepositoryConnection conn, TemplateIndexInfo indexInfo) {

        logger.trace("Indexing template {}", indexInfo.iri);

        // always add the generic type information to ALL pages
        conn.add(vf.createStatement(indexInfo.iri, RDF.TYPE, TemplateIndexVocabulary.PAGE), context);

        Optional<TemplateSource> templateSource = getTemplateSource(indexInfo.iri);
        
        if (!templateSource.isPresent()) {
            logger.debug("Failed to obtain template source for {}", indexInfo.iri);
            return;
        }

        // extract includes
        if (templateSource.isPresent()) {
            try {
                Set<IRI> includes = TemplateUtil.extractIncludeIRIs(templateSource.get().content(Charsets.UTF_8), ns);
                for (IRI include : includes) {
                    conn.add(vf.createStatement(indexInfo.iri, TemplateIndexVocabulary.HAS_INCLUDE, include), context);
                }
            } catch (Exception e) {
                // ignore errors for now
                logger.trace("Failed to extract includes for " + indexInfo.iri + ": " + e.getMessage(),
                        e);
            }
        }
        
        String renderedHandlebarsContent = getRenderedHandlebarsContent(indexInfo.iri, templateSource);
        String templateSourceString = null;
        try {
            templateSourceString = templateSource.get().content(Charsets.UTF_8);
        } catch (IOException e1) {
            logger.warn("Failed to read template source for {}: {}", indexInfo.iri, e1.getMessage());
            logger.debug("Details", e1);
        }
        Document parsedDocument = null;
        if (!StringUtils.isEmpty(renderedHandlebarsContent)) {
            parsedDocument = Jsoup.parse(renderedHandlebarsContent);
        }

        Context indexingContext = new Context(indexInfo.iri, templateSourceString, renderedHandlebarsContent,
                parsedDocument);

        
        for (TemplateIndexMetadataProvider provider : metadataProviders) {
            try {
                Model m = provider.extractMetadata(indexInfo.iri, indexingContext);
                if (m != null && !m.isEmpty()) {
                    conn.add(m, context);
                }
            } catch (Exception e) {
                logger.error("Failed to extract template metadata for {} using provider {}: {}", indexInfo.iri, provider.getClass(), e.getMessage());
                logger.debug("Details:", e);
            }
        }
    }

    private Optional<TemplateSource> getTemplateSource(IRI pageIri) {
        return TemplateUtil.getTemplateSource(handlebars.getLoader(), pageIri.stringValue());
    }

    /**
     * Retrieves the rendered HTML content of the given template
     * <p>
     * In case of {@link HandlebarsException}s while rendering, the given page is
     * not indexed and ignored. This method returns an empty string.
     * </p>
     * 
     * @param pageIri
     * @param templateSource
     * @return the rendered HTML of the given handlebars template or an empty string
     * @throws RuntimeException if an IO error occurs while reading the template
     */
    private String getRenderedHandlebarsContent(IRI pageIri, Optional<TemplateSource> templateSource) {

        if (!templateSource.isPresent()) {
            return "";
        }

        try {
            Template template = handlebars.compile(templateSource.get());
            TemplateContext tc = new TemplateContext(pageIri, repositoryManager.getRepository(METADATA_REPOSITORY_ID), null, null);
            tc.setNamespaceRegistry(ns);
            tc.setLabelCache(labelCache);
            return template.apply(tc);
        } catch (HandlebarsException e) {
            logger.trace("Ignoring page {}, parsing error while rendering page: {}", pageIri, e.getMessage());
            return "";
        } catch (IOException e) {
            throw new RuntimeException("Failed to read content for " + pageIri + ": " + e.getMessage(), e);
        }
    }




    /**
     * Modify RDF Type information for resources:
     * <ul>
     * <li>All includes get typed as
     * {@link TemplateIndexVocabulary#INCLUDE_PAGE}</li>
     * <li>For include pages the help page type is removed</li></li>
     * 
     * @param conn
     */
    private void refineSpecializedTypes(RepositoryConnection conn) {
        
        Model model = QueryResults.asModel(conn.getStatements(null, RDF.TYPE, TemplateIndexVocabulary.PAGE, context));

        for (Resource subject : model.subjects()) {

            if (!conn.hasStatement(subject, TemplateIndexVocabulary.HAS_INCLUDE, null, false, context)) {
                continue;
            }

            // type all includes as IncludePage
            // Note: as we are in a single context we don't have to take care for duplicates
            conn.getStatements(subject, TemplateIndexVocabulary.HAS_INCLUDE, null, false, context).stream()
                    .map(st -> (IRI) st.getObject()).forEach(include -> {
                        conn.add(include, RDF.TYPE, TemplateIndexVocabulary.INCLUDE_PAGE, context);
                    });

            // remove Help page type from include pages (if any)
            conn.getStatements(null, RDF.TYPE, TemplateIndexVocabulary.INCLUDE_PAGE, context).stream()
                    .map(st -> (IRI) st.getSubject()).forEach(include -> {
                        conn.remove(include, RDF.TYPE, TemplateIndexVocabulary.HELP_PAGE, context);
                    });
        }

    }

    private static class TemplateIndexInfo {

        private final IRI iri;

        private TemplateIndexInfo(IRI iri) {
            super();
            this.iri = iri;
        }
    }

    /**
     * Vocabulary for indexing
     * 
     * @author Andreas Schwarte
     *
     */
    public static class TemplateIndexVocabulary {

        private static final ValueFactory vf = SimpleValueFactory.getInstance();

        public static final String NAMESPACE = "http://www.metaphacts.com/platform/ontology/";

        public static final IRI CONTENT = vf.createIRI(NAMESPACE, "hasContent");

        public static final IRI SPECIAL_CONTENT = vf.createIRI(NAMESPACE, "hasSpecialContent");

        public static final IRI HAS_INCLUDE = vf.createIRI(NAMESPACE, "hasInclude");

        public static final IRI numberOfExamples = vf.createIRI(NAMESPACE, "numberOfExamples");

        public static final IRI containsConfigurationDocumentation = vf.createIRI(NAMESPACE,
                "containsConfigurationDocumentation");

        // types of pages
        public static final IRI HELP_PAGE = vf.createIRI(NAMESPACE, "HelpPage");

        /**
         * Type of generic page
         */
        public static final IRI PAGE = vf.createIRI(NAMESPACE, "Page");

        /**
         * Type of generic page
         */
        public static final IRI INCLUDE_PAGE = vf.createIRI(NAMESPACE, "IncludePage");
    }

}
