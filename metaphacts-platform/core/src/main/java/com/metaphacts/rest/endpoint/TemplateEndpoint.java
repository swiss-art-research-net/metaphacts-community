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
package com.metaphacts.rest.endpoint;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URI;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoField;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Date;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ExecutionException;
import java.util.stream.Collectors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import javax.inject.Inject;
import javax.inject.Named;
import javax.inject.Singleton;
import javax.servlet.http.HttpServletResponse;
import javax.validation.constraints.NotNull;
import javax.ws.rs.Consumes;
import javax.ws.rs.DELETE;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.PUT;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.WebApplicationException;
import javax.ws.rs.core.CacheControl;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.EntityTag;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Request;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.Status;
import javax.ws.rs.core.StreamingOutput;
import javax.ws.rs.core.UriBuilder;
import javax.ws.rs.core.UriInfo;

import org.apache.commons.io.IOUtils;
import org.apache.commons.lang3.StringUtils;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.shiro.authz.annotation.RequiresAuthentication;
import org.apache.shiro.authz.annotation.RequiresPermissions;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.model.vocabulary.RDFS;
import org.eclipse.rdf4j.query.BooleanQuery;
import org.eclipse.rdf4j.query.QueryEvaluationException;
import org.eclipse.rdf4j.repository.Repository;
import org.eclipse.rdf4j.repository.RepositoryConnection;
import org.eclipse.rdf4j.repository.RepositoryException;
import org.eclipse.rdf4j.sail.SailException;
import org.glassfish.jersey.server.ResourceConfig;

import com.google.common.base.Throwables;
import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import com.google.common.collect.Sets;
import com.metaphacts.cache.CacheManager;
import com.metaphacts.cache.LabelCache;
import com.metaphacts.cache.PlatformCache;
import com.metaphacts.cache.TemplateIncludeCache;
import com.metaphacts.config.Configuration;
import com.metaphacts.config.NamespaceRegistry;
import com.metaphacts.repository.RepositoryManager;
import com.metaphacts.rest.feature.CacheControl.NoCache;
import com.metaphacts.security.PermissionUtil;
import com.metaphacts.security.Permissions.PAGES;
import com.metaphacts.security.Permissions.PAGE_CONFIG;
import com.metaphacts.services.storage.StorageUtils;
import com.metaphacts.services.storage.api.ObjectKind;
import com.metaphacts.services.storage.api.ObjectMetadata;
import com.metaphacts.services.storage.api.ObjectRecord;
import com.metaphacts.services.storage.api.ObjectStorage;
import com.metaphacts.services.storage.api.PlatformStorage;
import com.metaphacts.services.storage.api.StorageException;
import com.metaphacts.services.storage.api.StoragePath;
import com.metaphacts.templates.MetaphactsHandlebars;
import com.metaphacts.templates.PageViewConfig;
import com.metaphacts.templates.PageViewConfigBuilder;
import com.metaphacts.templates.PageViewConfigSettings;
import com.metaphacts.templates.TemplateByIriLoader;
import com.metaphacts.templates.TemplateContext;
import com.metaphacts.templates.TemplateUtil;
import com.metaphacts.ui.templates.ST;
import com.metaphacts.ui.templates.ST.TEMPLATES;

import io.swagger.v3.oas.annotations.Hidden;

/**
 * @author Johannes Trame <jt@metaphacts.com>
 */
@Path("template")
@Singleton
@Hidden
public class TemplateEndpoint extends ResourceConfig {

    private static final Logger logger = LogManager.getLogger(TemplateEndpoint.class);

    private static final String Template_MIME_TYPE = "text/html";

    private static final IRI DEFAULT_TEMPLATE = RDFS.RESOURCE;

    private static final StoragePath PAGE_RENDER_INFO_STORAGE_PATH = ObjectKind.CONFIG
            .resolve(PageViewConfigSettings.CONFIG_FILE_NAME);

    protected static final String DEFAULT_BREADCRUMBS_TEMPLATE = "http://www.metaphacts.com/resource/breadcrumbs/Resource";

    @Inject
    private ST st;

    @Inject
    private LabelCache labelCache;

    @Inject
    private PageViewConfigSettings pageRenderConfiguration;

    @Inject @Named("ASSETS_MAP")
    private Map<String, String> assetsMap;

    @Context
    private UriInfo uriInfo;

    @Context
    private HttpServletResponse servletResponse;

    private final NamespaceRegistry ns;
    private final RepositoryManager repositoryManager;
    private final TemplateIncludeCache includeCache;
    private final PlatformStorage platformStorage;

    private static final ValueFactory vf = SimpleValueFactory.getInstance();
    private final MetaphactsHandlebars handlebars;
    private final Configuration config;
    private final PageViewConfigCache pageViewConfigCache;

    @Inject
    public TemplateEndpoint(
        NamespaceRegistry ns,
        RepositoryManager repositoryManager,
        TemplateIncludeCache includeCache,
        PlatformStorage platformStorage,
        MetaphactsHandlebars handlebars,
        Configuration configuration,
        CacheManager cacheManager
    ) {
        this.ns = ns;
        this.repositoryManager=repositoryManager;
        this.includeCache = includeCache;
        this.platformStorage = platformStorage;

        this.handlebars = handlebars;

        this.config = configuration;

        this.pageViewConfigCache = new PageViewConfigCache();
        cacheManager.register(pageViewConfigCache);
    }

    public static class RenderedTemplate {
        private String templateHtml;

        public RenderedTemplate(String templateHtml) {
            this.templateHtml = templateHtml;
        }

        /**
         * We overwrite hash code here, to use the hash code of the actual content i.e. the compiled
         * HTML string, as eTag for caching
         *
         * @see java.lang.Object#hashCode()
         */
        @Override
        public int hashCode() {
            return this.templateHtml.hashCode();
        };

        public String getTemplateHtml() {
            return this.templateHtml;
        }

        public static String getCompiledHtml(
            IRI pageId,
            TemplateContext tc,
            MetaphactsHandlebars handlebars,
            TemplateIncludeCache includeCache) throws IOException {

            if (!(tc.getValue() instanceof IRI)) {
                throw new IllegalArgumentException("Currently only browsing IRIs is supported.");
            }

            LinkedHashSet<String> rdfTemplateIncludes = Sets.newLinkedHashSet();
            // add the IRI itself as first entry
            rdfTemplateIncludes.add(pageId.stringValue());

            // add the template includes
            rdfTemplateIncludes.addAll(TemplateUtil.getRdfTemplateIncludeIdentifiers(pageId, tc, includeCache));

            // add default Template:rdfs:Resource as last option
            // TODO might need to be configurable in the future
            rdfTemplateIncludes.add(TemplateUtil.convertResourceToTemplateIdentifier(DEFAULT_TEMPLATE));

            return TemplateUtil.compileAndReturnFirstExistingTemplate(tc, rdfTemplateIncludes, handlebars).orElse(
                    "<i>It seems that the current resource \"" + pageId.stringValue()
                    + "\" does not identify any application or template page as well as none of the applicable template pages is instantiated.</i>"
                   );
        }
    }




    /**
     * For caching purpose every new build of the platform has unique name for vendor bundle.
     * So we need to expose vendor js script through stable URL when we want to embed the platform
     * into 3-rd party application, to make sure that it continues to work when the platform is updated.
     * This endpoint always redirects to the latest version of the vendor js bundle.
     */
    @GET
    @Path("vendor")
    @NoCache
    public Response getVendorScript() {
        URI uri = UriBuilder.fromPath(assetsMap.get("vendor")).build();
        return Response.status(Status.FOUND).location(uri).build();
    }

    @GET()
    @Path("pageViewConfig")
    @Produces(MediaType.APPLICATION_JSON)
    public PageViewConfig getPageViewConfig(
            @NotNull @QueryParam("iri") IRI iri,
            @QueryParam("repository") Optional<String> repositoryId
            ) {
        try {
            String cacheKey = pageViewConfigCache.createCacheKey(iri, repositoryId);
            return pageViewConfigCache.cache.get(cacheKey, () -> computePageRenderInfo(iri, repositoryId));
        } catch (ExecutionException e) {
            logger.warn("Error while computing page render information: " + e.getMessage());
            logger.debug("Details:", e);
            Throwable cause = e.getCause();
            Throwables.throwIfInstanceOf(cause, RuntimeException.class);
            throw new RuntimeException(cause);
        }
    }

    protected PageViewConfig computePageRenderInfo(IRI iri, Optional<String> repositoryId) {

        TemplateContext tc = new TemplateContext(
                iri, repositoryId.map(repId -> repositoryManager.getRepository(repId))
                        .orElse(repositoryManager.getDefault()),
                uriInfo, null
                );
        tc.setLabelCache(labelCache);
        tc.setNamespaceRegistry(this.ns);
        
        // check whether IRI represents an RDF node (subj, pred, or obj)
        boolean isRDFNode = isRDFNode(iri, repositoryId);

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

    protected boolean isRDFNode(IRI iri, Optional<String> repositoryId) {
        
        // TODO consider checking for graph as well
        // Note: might not work in all databases (e.g. wikidata)
        String askQuery = "ASK { { ?iri ?p ?o } UNION { ?s ?iri ?o} UNION {?s ?p ?iri} }";

        Repository repo = repositoryId.map(repId -> repositoryManager.getRepository(repId))
                .orElse(repositoryManager.getDefault());
        try (RepositoryConnection conn = repo.getConnection()) {
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

    @GET
    @Path("pageViewConfig/{storage}")
    @Produces(MediaType.TEXT_PLAIN)
    @RequiresAuthentication
    @RequiresPermissions(PAGE_CONFIG.READ_PAGE_VIEW_CONFIG)
    public Response getPageViewConfigFromStorage(@PathParam("storage") String storage) throws StorageException {
        ObjectStorage storageObj = platformStorage.getStorage(storage);
        Optional<ObjectRecord> object = storageObj.getObject(PAGE_RENDER_INFO_STORAGE_PATH, null);

        return object.map(obj -> {
            try {
                return Response.ok(obj.getLocation().readContent());
            } catch (IOException e) {
                logger.warn("Error reading PageRenderInfo from " + storage, e);
                return Response.serverError();
            }
        }).orElse(Response.noContent()).build();
    }

    @PUT
    @Path("pageViewConfig/{storage}")
    @Consumes(MediaType.TEXT_PLAIN)
    @RequiresAuthentication
    @RequiresPermissions(PAGE_CONFIG.WRITE_PAGE_VIEW_CONFIG)
    public Response savePageViewConfig(@PathParam("storage") String storage, String source) {

        Optional<String> author = StorageUtils.currentUsername();

        byte[] bytes = source.getBytes(StandardCharsets.UTF_8);
        InputStream newContent = new ByteArrayInputStream(bytes);
        try {
            platformStorage.getStorage(storage).appendObject(PAGE_RENDER_INFO_STORAGE_PATH,
                    new ObjectMetadata(author.get(), null), newContent, bytes.length);
            reloadPageViewConfigs();
            return Response.ok().build();
        } catch (StorageException e) {
            logger.error("Failed to write to storage while saving PageRenderInfo", e);
            return Response.status(Status.INTERNAL_SERVER_ERROR)
                    .entity("Unknown error while saving PageRenderInfo to storage").build();
        }
    }

    @DELETE
    @Path("pageViewConfig/{storage}")
    @RequiresAuthentication
    @RequiresPermissions(PAGE_CONFIG.WRITE_PAGE_VIEW_CONFIG)
    public Response deletePageRenderInfoConfig(@PathParam("storage") String storage) {
        try {
            platformStorage.getStorage(storage).deleteObject(PAGE_RENDER_INFO_STORAGE_PATH,
                    platformStorage.getDefaultMetadata());
            reloadPageViewConfigs();
            return Response.ok().build();
        } catch (StorageException e) {
            logger.error("Failed to delete PageRenderInfo from storage", e);
            return Response.status(Status.INTERNAL_SERVER_ERROR)
                    .entity("Unknown error while deleting PageRenderInfo from storage").build();
        }
    }

    private void reloadPageViewConfigs() {
        pageRenderConfiguration.reloadConfiguration();
        pageViewConfigCache.invalidate();
    }

    /**
     * Renders a resource page by applying all applicable template includes and
     * expanding server-side Handlebars markup. Returns a generic
     * "no defined template" page if no applicable templates found for a given resource.
     */
    @GET()
    @Path("html")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getResourceHtml(
            @NotNull @QueryParam("iri") IRI iri,
            @QueryParam("context") Optional<IRI> context,
            @QueryParam("repository") Optional<String> repositoryId,
            @QueryParam("preferredLanguage") Optional<String> preferredLanguage,
            @Context UriInfo uriInfo,
            @Context Request request
    ) throws IOException {
        // by default the context equals the requested IRI, however, clients may overwrite it
        IRI templateContextIri = context.orElse(iri);
        logger.trace("Requesting page for resource \"{}\"", iri.stringValue());
        
        if (!PermissionUtil.hasTemplateActionPermission(iri, PAGES.Action.VIEW)) {
            return Response.status(Status.FORBIDDEN).entity(
                    "No permission to view the page for the resource " + iri.stringValue())
                    .build();
        }
        
        try {
            Repository repo = repositoryManager.getRepository(repositoryId).orElse(repositoryManager.getDefault());
            TemplateContext tc = new TemplateContext(
                templateContextIri, repo, uriInfo, preferredLanguage.orElse(null)
            );
            tc.setLabelCache(labelCache);
            tc.setNamespaceRegistry(this.ns);
            RenderedTemplate template = new RenderedTemplate(
                    RenderedTemplate.getCompiledHtml(iri, tc, handlebars, includeCache));

            return withETagCacheControl(request, template, iri).build();
        } catch (IllegalArgumentException e) {
            return Response.serverError().entity(e.getMessage()).build();
        } catch (QueryEvaluationException | RepositoryException | SailException e){
            return Response.serverError().entity("Problem with database backend.").build();
        }catch (Exception e) {
            return Response.serverError().entity("Unknown error while compiling template.").build();
        }
    }

    /**
     * Renders the knowledge panel for a resource page by retrieving the template
     * identifier from the {@link PageViewConfig#getKnowledgePanelTemplateIri()}
     */
    @GET()
    @Path("knowledgePanel/html")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getResourceKnowledgePanelHtml(@NotNull @QueryParam("iri") IRI iri,
            @QueryParam("context") Optional<IRI> context, @QueryParam("repository") Optional<String> repositoryId,
            @QueryParam("preferredLanguage") Optional<String> preferredLanguage, @Context UriInfo uriInfo,
            @Context Request request) throws IOException {
        // by default the context equals the requested IRI, however, clients may
        // overwrite it
        logger.trace("Requesting knowledge panel page for resource \"{}\"", iri);

        if (!PermissionUtil.hasTemplateActionPermission(iri, PAGES.Action.VIEW)) {
            return Response.status(Status.FORBIDDEN)
                    .entity("No permission to view the knowledge panel page for the resource " + iri.stringValue())
                    .build();
        }
        
        PageViewConfig pageViewConfig = getPageViewConfig(iri, repositoryId);
        IRI knowledgePanelTemplateIRI = SimpleValueFactory.getInstance()
                .createIRI(pageViewConfig.getKnowledgePanelTemplateIri());
        return getResourceHtml(knowledgePanelTemplateIRI, context, repositoryId, preferredLanguage, uriInfo, request);
    }

    private Response.ResponseBuilder withETagCacheControl(Request request, RenderedTemplate template, IRI templateIri) {
        // evaluate eTag precondition
        CacheControl cc = new CacheControl();
        EntityTag etag = new EntityTag(String.valueOf(template.hashCode()));
        Response.ResponseBuilder rb = request.evaluatePreconditions(etag);

        if (rb != null) {
            logger.trace("Returning 304: Compiled template {} with eTag {} seems to be cached by browser.", templateIri, etag.getValue());
            return rb.cacheControl(cc);
        }

        // tell the client that the response is stale
        // setting both "Cache-Control: max-age=0, must-revalidate" and "Cache-Control: no-cache" due to different browser interpretations
        // c.f. http://stackoverflow.com/questions/1046966/whats-the-difference-between-cache-control-max-age-0-and-no-cache
        //  SHOULD revalidate the response
        cc.setMaxAge(0);
        cc.setMustRevalidate(true);
        // MUST revalidate
        cc.setNoCache(true);

        return Response.ok(template, MediaType.APPLICATION_JSON).cacheControl(cc).tag(etag);
    }

    /**
     * Returns raw source of the resource (template) with expanded Handlebars markup.
     * If there is no defined template with the specified IRI, returns "not found" status.
     */
    @GET()
    @Path("pageHtml")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getTemplateHtml(
        @NotNull @QueryParam("iri") IRI iri,
        @QueryParam("repository") Optional<String> repositoryId,
        @QueryParam("preferredLanguage") Optional<String> preferredLanguage,
        @Context UriInfo uriInfo,
        @Context Request request
    ) throws IOException {
        try {
            Repository repo = repositoryManager.getRepository(repositoryId).orElse(repositoryManager.getDefault());
            TemplateContext tc = new TemplateContext(iri, repo, uriInfo, preferredLanguage.orElse(null));
            tc.setLabelCache(labelCache);
            tc.setNamespaceRegistry(this.ns);

            LinkedHashSet<String> templateIncludes = Sets.newLinkedHashSet();
            templateIncludes.add(iri.stringValue());

            Optional<String> content = TemplateUtil.compileAndReturnFirstExistingTemplate(tc, templateIncludes, handlebars);
            if (!content.isPresent()) {
                return Response.status(Status.NOT_FOUND).build();
            }

            RenderedTemplate template = new RenderedTemplate(content.get());
            return withETagCacheControl(request, template, iri).build();
        } catch (IllegalArgumentException e) {
            return Response.serverError().entity(e.getMessage()).build();
        } catch (Exception e) {
            return Response.serverError().entity("Unknown error while compiling template.").build();
        }
    }

    @GET
    @NoCache // never cache the source i.e. if content is to be edited
    @Path("source")
    @Produces(MediaType.APPLICATION_JSON)
    @RequiresAuthentication
    public Response getSource(
        @NotNull @QueryParam("iri") IRI iri,
        @QueryParam("repository") Optional<String> repositoryId
    ) throws IOException {
        if (!PermissionUtil.hasTemplateActionPermission(iri, PAGES.Action.EDIT_VIEW)) {
            return Response.status(Status.FORBIDDEN).entity(
                    "No permission to view the source for the template " + iri.stringValue())
                    .build();
        }
        
        StoragePath objectId = TemplateByIriLoader.templatePathFromIri(iri);
        List<PlatformStorage.FindResult> overrides =
            platformStorage.findOverrides(objectId);

        String templateContent = "";
        String appId = null;
        String revision = null;

        if (overrides.size() > 0) {
            PlatformStorage.FindResult result = overrides.get(overrides.size() - 1);
            templateContent = StorageUtils.readTextContent(result.getRecord());
            appId = result.getAppId();
            revision = result.getRecord().getRevision();
        }

        List<String> definedByApps = overrides.stream()
            .map(r -> r.getAppId())
            .collect(Collectors.toList());

        Set<IRI> includes = Sets.newLinkedHashSet();
        try {
            includes.addAll(TemplateUtil.extractIncludeIRIs(templateContent,ns));
        } catch (IllegalArgumentException e) {
            logger.error("Problem while trying to extract handlebars includes from template source code:"+ e.getMessage());
        }
        Repository repo = repositoryManager.getRepository(repositoryId).orElse(repositoryManager.getDefault());
        TemplateContext tc = new TemplateContext(iri, repo, uriInfo, null);
        tc.setLabelCache(labelCache);
        tc.setNamespaceRegistry(this.ns);

        LinkedHashSet<String> orderedSetOfLocations = TemplateUtil.getRdfTemplateIncludeIdentifiers(iri, tc,
                includeCache);
        String appliedTemplate = TemplateUtil.findFirstExistingTemplate(this.handlebars.getLoader(), orderedSetOfLocations).orElse(
                        StringUtils.isEmpty(templateContent)
                        ? TemplateUtil.convertResourceToTemplateIdentifier(DEFAULT_TEMPLATE) // this should only be shown if no other template is applied
                        : null
        );

        RawTemplate rawTemplate = new RawTemplate(
            appId,
            revision,
            templateContent,
            definedByApps,
            orderedSetOfLocations,
            includes,
            appliedTemplate
        );

        // set etag, currently without CC headers (not chaching needed here)
        // clients may use the etag as reference and post it again on PUT i.e. to detect concurrent modifications
        String etag = (appId == null || revision == null) ? "" : (appId + "-" + revision);
        return Response.ok(rawTemplate)
            .tag(new EntityTag(etag))
            .build();
    }

    public static class RawTemplate {
        private String appId;
        private String revision;
        private String source;
        private List<String> definedByApps;
        private Set<String> applicableTemplates;
        private String appliedTemplate;
        private Set<IRI> includes;

        public RawTemplate(
            String appId,
            String revision,
            String source,
            List<String> definedByApps,
            Set<String> applicableTemplates,
            Set<IRI> includes,
            String appliedTemplate
        ) {
            this.appId = appId;
            this.revision = revision;
            this.source = source;
            this.definedByApps = definedByApps;
            this.applicableTemplates = applicableTemplates;
            this.includes = includes;
            this.appliedTemplate= appliedTemplate;
        }

        public String getAppId() {
            return appId;
        }

        public String getRevision() {
            return revision;
        }

        public String getSource() {
            return source;
        }

        public List<String> getDefinedByApps() {
            return definedByApps;
        }

        public Set<String> getApplicableTemplates() {
            return applicableTemplates;
        }

        public Set<IRI> getIncludes() {
            return includes;
        }

        public String getAppliedTemplate() {
            return appliedTemplate;
        }
    }

    @PUT
    @Path("source")
    @Consumes(Template_MIME_TYPE)
    @RequiresAuthentication
    public Response save(
        @QueryParam("iri") IRI iri,
        @QueryParam("targetAppId") String targetAppId,
        @QueryParam("sourceAppId") String sourceAppId,
        @QueryParam("sourceRevision") String sourceRevision,
        String pageSource
    ) throws Exception {
        if (logger.isTraceEnabled()) {
            logger.trace("Saving Page: " + iri);
        }
        
        if (!PermissionUtil.hasTemplateActionPermission(iri, PAGES.Action.EDIT_SAVE)) {
            return Response.status(Status.FORBIDDEN).entity(
                    "No permission to save the template " + iri.stringValue())
                    .build();
        }

        StoragePath objectId = TemplateByIriLoader.templatePathFromIri(iri);

        if (sourceAppId != null && sourceRevision != null) {
            // content revision before saving
            PlatformStorage.FindResult current = platformStorage
                .findObject(objectId).orElse(null);

            boolean templateHasChanged = current == null
                || !current.getAppId().equals(sourceAppId)
                || !current.getRecord().getRevision().equals(sourceRevision);

            if (templateHasChanged) {
                logger.warn("Concurrent modification of page {}", iri.stringValue());
                String msg = "Concurrent modification of page source. "
                        + "It seems that you or another user modified the page in the meantime. "
                        + "Please copy the code and resolve the conflict manually or overwrite it"
                        + " i.e. copy the code, refresh the page, replace the code and save it again.";
                return Response.status(Status.CONFLICT).entity(msg).build();
            }
        }

        Optional<String> author = StorageUtils.currentUsername();
        if (!author.isPresent()) {
            return Response.status(Status.FORBIDDEN)
                .entity("Sign In is required to save the changes to the page")
                .build();
        }

        // proactively invalidate the page render cache
        pageViewConfigCache.invalidate();

        // preserve old behavior to delete template if it's empty
        if (pageSource.length() == 0) {
            try {
                platformStorage.getStorage(targetAppId).deleteObject(
                    objectId, platformStorage.getDefaultMetadata());
                return Response.ok().build();
            } catch (StorageException e) {
                logger.error("Failed to delete from storage while saving template", e);
                return Response.status(Status.INTERNAL_SERVER_ERROR)
                    .entity("Unknown error while deleting template from storage")
                    .build();
            }
        } else {
            byte[] bytes = pageSource.getBytes(StandardCharsets.UTF_8);
            InputStream newContent = new ByteArrayInputStream(bytes);
            try {
                platformStorage.getStorage(targetAppId).appendObject(
                    objectId,
                    new ObjectMetadata(author.get(), null),
                    newContent,
                    bytes.length
                );
                return Response.created(new URI(iri.stringValue())).build();
            } catch (StorageException e) {
                logger.error("Failed to write to storage while saving template", e);
                return Response.status(Status.INTERNAL_SERVER_ERROR)
                    .entity("Unknown error while saving template to storage")
                    .build();
            }
        }
    }

    @GET
    @NoCache
    @Path("getAllInfo")
    @Produces(MediaType.APPLICATION_JSON)
    @RequiresAuthentication
    public List< TemplateInfo> getAllInfo() throws IOException, URISyntaxException {
        
        Collection<PlatformStorage.FindResult> templateObjects =
            platformStorage.findAll(ObjectKind.TEMPLATE).values();

        List<TemplateInfo> list = new ArrayList<>();

        for (PlatformStorage.FindResult result : templateObjects) {
            ObjectRecord record = result.getRecord();
            ObjectMetadata metadata = record.getMetadata();
            Optional<IRI> iri = TemplateByIriLoader.templateIriFromPath(record.getPath());
            if (!iri.isPresent()) {
                continue;
            }
            
            if (!PermissionUtil.hasTemplateActionPermission(iri.get(), PAGES.Action.INFO_VIEW)) {
                continue;
            }
            
            String creationDate = null;
            if (metadata.getCreationDate() != null) {
                Instant roundedToSeconds = metadata.getCreationDate().with(ChronoField.NANO_OF_SECOND, 0);
                creationDate = DateTimeFormatter.ISO_INSTANT.format(roundedToSeconds);
            }
            TemplateInfo info = new TemplateInfo(
                result.getAppId(),
                iri.get().stringValue(),
                record.getRevision(),
                metadata.getAuthor(),
                creationDate
            );
            list.add(info);
        }

        return list;
    }

    public static class TemplateInfo {
        public final String appId;
        public final String iri;
        public final String revision;
        public final String author;
        public final String date;

        public TemplateInfo(
            String appId,
            String iri,
            String revision,
            String author,
            String date
        ) {
            this.appId = appId;
            this.iri = iri;
            this.revision = revision;
            this.author = author;
            this.date = date;
        }
    }

    @POST
    @Path("exportRevisions")
    @Consumes("application/json")
    @Produces("application/zip")
    @RequiresAuthentication
    public Response exportRevisions(List<RevisionInfo> selected) throws IOException {
        if (selected.isEmpty()) {
            return Response.status(Status.NOT_ACCEPTABLE).build();
        }
        StreamingOutput stream = new StreamingOutput() {
            @Override
            public void write(OutputStream output) throws IOException, WebApplicationException {
                try(ZipOutputStream zos = new ZipOutputStream(output)){
                    for (RevisionInfo info : selected) {
                        IRI iri = vf.createIRI(info.iri);
                        if (!PermissionUtil.hasTemplateActionPermission(iri, PAGES.Action.INFO_EXPORT)) {
                            throw new SecurityException("No permission to export the " + info.iri + " template");
                        }
                        
                        StoragePath objectId = TemplateByIriLoader.templatePathFromIri(iri);

                        String path = platformStorage.getPathMapping()
                            .mapForward(objectId).get().toString();
                        ZipEntry entry = new ZipEntry(path);
                        zos.putNextEntry(entry);

                        Optional<ObjectRecord> record = platformStorage.getStorage(info.appId)
                                .getObject(objectId, info.revision);

                        byte[] bytes;
                        if (record.isPresent()) {
                            try (InputStream content = record.get().getLocation().readContent()) {
                                bytes = IOUtils.toByteArray(content);
                            }
                        } else {
                            bytes = StandardCharsets.UTF_8.encode("").array();
                        }

                        zos.write(bytes);
                        zos.closeEntry();
                    }
                    zos.finish();
                    zos.flush();
                } catch (Exception e) {
                    logger.error("Error while exporting template pages: ", e);
                    throw new WebApplicationException(e.getMessage(), e);
                }
            }
        };
        return Response.ok(stream).header("Content-Disposition","attachment; filename="+getExportFileName()).build();
    }

    public static class RevisionInfo {
        public String appId;
        public String iri;
        public String revision;

        /** Default constructor for deserialization */
        public RevisionInfo() {}

        public RevisionInfo(String appId, String iri, String revision) {
            this.appId = appId;
            this.iri = iri;
            this.revision = revision;
        }
    }

    private String getExportFileName(){
        return "pageExport_" +  new SimpleDateFormat("yyyy-MM-dd_hh-mm-ss").format(new Date())+".zip";
    }

    @DELETE
    @Path("deleteRevisions")
    @Consumes("application/json")
    @RequiresAuthentication
    public void deleteRevisions(List<RevisionInfo> selected) throws IOException, WebApplicationException {
        for (RevisionInfo info : selected) {
            IRI iri = vf.createIRI(info.iri);
            if (!PermissionUtil.hasTemplateActionPermission(iri, PAGES.Action.INFO_DELETE)) {
                throw new WebApplicationException("No permission to delete the template: " + iri.stringValue(), Status.FORBIDDEN);
            }
        }
        
        for (RevisionInfo info : selected) {
            IRI iri = vf.createIRI(info.iri);
            StoragePath objectId = TemplateByIriLoader.templatePathFromIri(iri);
            ObjectStorage storage = platformStorage.getStorage(info.appId);
            if (!storage.isMutable()) {
                throw new WebApplicationException("Failed to delete page '" + info.iri + "': storage is read only",
                        Status.INTERNAL_SERVER_ERROR);
            }
            storage.deleteObject(
                objectId, platformStorage.getDefaultMetadata());
        }

        // invalidate the page render cache
        pageViewConfigCache.invalidate();
    }

    @GET
    @Path("storageStatus")
    @Produces(MediaType.APPLICATION_JSON)
    @RequiresAuthentication
    public Response getStorageStatus() throws IOException {
        List<PlatformStorage.StorageStatus> writableApps =
            platformStorage.getStorageStatusFor(ObjectKind.TEMPLATE);
        return Response.ok(writableApps).build();
    }

    @GET()
    @Path("header")
    @Produces(MediaType.TEXT_HTML)
    @RequiresAuthentication
    public String getHeader() throws IOException {
        return st.renderPageLayoutTemplate(TEMPLATES.HEADER);
    }

    @GET()
    @Path("footer")
    @Produces(MediaType.TEXT_HTML)
    @RequiresAuthentication
    public String getFooter() throws IOException {
        return st.renderPageLayoutTemplate(TEMPLATES.FOOTER);
    }

    @GET()
    @Path("noPermissionsPage")
    @Produces(MediaType.TEXT_HTML)
    @RequiresAuthentication
    public String getNoPermissionsPage() throws IOException {
        return st.renderPageLayoutTemplate(TEMPLATES.NO_PERMISSIONS_PAGE);
    }

    public class PageViewConfigCache implements PlatformCache {

        public static final String CACHE_ID = "platform.PageViewConfigCache";

        /**
         * Cache key is defined in {@link #createCacheKey(IRI, Optional)}
         */
        private Cache<String, PageViewConfig> cache;

        public PageViewConfigCache() {
            this.cache = initializeCache();
        }

        private Cache<String, PageViewConfig> initializeCache() {
            String spec = TemplateEndpoint.this.config.getCacheConfig().getPageViewConfigCacheSpec();
            return CacheBuilder.from(spec).build();
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

        String createCacheKey(IRI iri, Optional<String> repositoryId) {
            return iri.stringValue() + "--" + repositoryId.orElse("default");
        }
    }
}
