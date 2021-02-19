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
package com.metaphacts.rest.endpoint;

import javax.inject.Inject;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.Status;

import org.apache.logging.log4j.Level;
import org.apache.shiro.SecurityUtils;
import org.apache.shiro.authc.UsernamePasswordToken;
import org.apache.shiro.subject.Subject;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.model.vocabulary.FOAF;
import org.eclipse.rdf4j.model.vocabulary.RDF;
import org.eclipse.rdf4j.repository.Repository;
import org.eclipse.rdf4j.repository.RepositoryConnection;
import org.glassfish.jersey.server.ResourceConfig;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;

import com.github.sdorra.shiro.SubjectAware;
import com.metaphacts.cache.CacheManager;
import com.metaphacts.config.Configuration;
import com.metaphacts.junit.Log4jRule;
import com.metaphacts.junit.MetaphactsJerseyTest;
import com.metaphacts.junit.MetaphactsShiroRule;
import com.metaphacts.junit.PlatformStorageRule;
import com.metaphacts.services.storage.api.ObjectKind;
import com.metaphacts.services.storage.api.StoragePath;
import com.metaphacts.templates.PageViewConfig;
import com.metaphacts.templates.PageViewConfigBuilder;
import com.metaphacts.templates.PageViewConfigManager;
import com.metaphacts.templates.PageViewConfigSettings;
import com.metaphacts.templates.TemplateByIriLoader;

public class TemplateEndpointTest extends MetaphactsJerseyTest {
    private final String templatePermissionShiroFile = "classpath:com/metaphacts/security/shiro-templates-rights.ini";
    
    private static final ValueFactory vf = SimpleValueFactory.getInstance();

    @Inject
    public Configuration configuration;

    @Inject
    @Rule
    public PlatformStorageRule platformStorageRule;

    @Inject
    private CacheManager cacheManager;
    
    @Inject
    private PageViewConfigSettings pageRenderConfig;

    @Rule
    public Log4jRule log4j = Log4jRule.create(Level.INFO);

    @Before
    public void before() throws Exception {

        platformStorageRule.storeContentFromResource(
                ObjectKind.CONFIG.resolve(PageViewConfigSettings.CONFIG_FILE_NAME),
                "/com/metaphacts/templates/pageViewConfig.ini");

        pageRenderConfig.reloadConfiguration();
    }

    @Rule
    public MetaphactsShiroRule rule = new MetaphactsShiroRule(() -> configuration)
            .withCacheManager(() -> cacheManager)
            .withPlatformStorageRule(() -> platformStorageRule);

    @Override
    protected void register(ResourceConfig resourceConfig) {
        resourceConfig.register(TemplateEndpoint.class);
    }

    @Test
    @SubjectAware(
            username="admin",
            password="admin",
            configuration = templatePermissionShiroFile
    )
    public void testRegexPermission() throws Exception {
        Response resp = target("template/html").queryParam("iri", "http://www.metaphacts.com/resource/admin/SomeAdminPage").request().get();
        Assert.assertEquals(Status.OK, resp.getStatusInfo());
        resp = target("template/source").queryParam("iri", "http://www.metaphacts.com/resource/admin/SomeAdminPage").request().get();
        Assert.assertEquals(Status.FORBIDDEN, resp.getStatusInfo());
        resp = target("template/source").queryParam("iri", "http://www.metaphacts.com/resource/test/test").request().get();
        Assert.assertEquals(Status.OK, resp.getStatusInfo());
    }
    
    @Test
    @SubjectAware(
            username="admin",
            password="admin",
            configuration = templatePermissionShiroFile
    )
    public void testPageRenderInfo_StaticPage_NoConfig() throws Exception {

        // static page without RDF statements

        IRI currentResource = vf.createIRI("http://www.metaphacts.com/resource/SomeStaticPage");
        savePage(currentResource, "This is a static page");

        PageViewConfig pInfo = requestPageRenderInfo(currentResource);
        Assert.assertEquals(currentResource.stringValue(), pInfo.getPageViewTemplateIri());
        Assert.assertEquals(PageViewConfigBuilder.VIEW_PAGE, pInfo.getDefaultView());
        Assert.assertEquals(false, pInfo.isShowKnowledgeGraphBar());
        Assert.assertEquals(false, pInfo.isShowKnowledgeGraphBarToggle());
        Assert.assertEquals(PageViewConfigBuilder.TEMPLATE_KNOWLEDGE_GRAPH_HEADER,
                pInfo.getKnowledgeGraphBarTemplateIri());
        Assert.assertEquals(PageViewConfigBuilder.TEMPLATE_GRAPH_RESOURCE, pInfo.getGraphViewTemplateIri());
        Assert.assertEquals(PageViewConfigBuilder.TEMPLATE_STATEMENTS_RESOURCE, pInfo.getStatementsViewTemplateIri());
        Assert.assertEquals(null, pInfo.getBreadcrumbsTemplateIri());
    }

    @Test
    @SubjectAware(username = "admin", password = "admin", configuration = templatePermissionShiroFile)
    public void testPageRenderInfo_StaticPageNotExist_NoConfig() throws Exception {

        // static page without RDF statements which does not exist

        IRI currentResource = vf.createIRI("http://www.metaphacts.com/resource/NonExistingPage");

        PageViewConfig pInfo = requestPageRenderInfo(currentResource);
        Assert.assertEquals(PageViewConfigBuilder.TEMPLATE_EMPTY_RESOURCE, pInfo.getPageViewTemplateIri());
        Assert.assertEquals(PageViewConfigBuilder.VIEW_PAGE, pInfo.getDefaultView());
        Assert.assertEquals(false, pInfo.isShowKnowledgeGraphBar());
        Assert.assertEquals(false, pInfo.isShowKnowledgeGraphBarToggle());
        Assert.assertEquals(PageViewConfigBuilder.TEMPLATE_KNOWLEDGE_GRAPH_HEADER,
                pInfo.getKnowledgeGraphBarTemplateIri());
        Assert.assertEquals(PageViewConfigBuilder.TEMPLATE_GRAPH_RESOURCE, pInfo.getGraphViewTemplateIri());
        Assert.assertEquals(PageViewConfigBuilder.TEMPLATE_STATEMENTS_RESOURCE, pInfo.getStatementsViewTemplateIri());
        // breadcrumbs defined inside the page
        Assert.assertEquals(null, pInfo.getBreadcrumbsTemplateIri());
    }

    @Test
    @SubjectAware(username = "admin", password = "admin", configuration = templatePermissionShiroFile)
    public void testPageRenderInfo_StaticRDFNodePage_NoConfig() throws Exception {

        // resource with RDF statements with an existing page for that resource
        // Note: the page is not a template

        IRI currentResource = vf.createIRI("http://www.metaphacts.com/resource/bob");
        IRI personPanelTemplate = vf.createIRI("PanelTemplate:" + FOAF.PERSON.stringValue());
        addType(currentResource, FOAF.PERSON);
        savePage(currentResource, "This is the static page of bob");
        savePage(personPanelTemplate, "Panel Template for foaf:Person");

        PageViewConfig pInfo = requestPageRenderInfo(currentResource);
        Assert.assertEquals(currentResource.stringValue(), pInfo.getPageViewTemplateIri());
        Assert.assertEquals(PageViewConfigBuilder.VIEW_PAGE, pInfo.getDefaultView());
        Assert.assertEquals(false, pInfo.isShowKnowledgeGraphBar());
        Assert.assertEquals(true, pInfo.isShowKnowledgeGraphBarToggle());
        Assert.assertEquals(PageViewConfigBuilder.TEMPLATE_KNOWLEDGE_GRAPH_HEADER,
                pInfo.getKnowledgeGraphBarTemplateIri());
        Assert.assertEquals(PageViewConfigBuilder.TEMPLATE_GRAPH_RESOURCE, pInfo.getGraphViewTemplateIri());
        Assert.assertEquals(PageViewConfigBuilder.TEMPLATE_STATEMENTS_RESOURCE, pInfo.getStatementsViewTemplateIri());
        Assert.assertEquals(personPanelTemplate.stringValue(),
                pInfo.getKnowledgePanelTemplateIri());
        Assert.assertEquals(null, pInfo.getBreadcrumbsTemplateIri());
    }

    @Test
    @SubjectAware(username = "admin", password = "admin", configuration = templatePermissionShiroFile)
    public void testPageRenderInfo_PersonInstance_TemplateExists() throws Exception {

        // person instance + template foaf:Person exists

        IRI currentResource = vf.createIRI("http://www.metaphacts.com/resource/bob");
        IRI personTemplate = vf.createIRI("Template:" + FOAF.PERSON.stringValue());
        IRI personPanelTemplate = vf.createIRI("PanelTemplate:" + FOAF.PERSON.stringValue());
        savePage(personTemplate, "Template for foaf:Person");
        savePage(personPanelTemplate, "Panel Template for foaf:Person");
        addType(currentResource, FOAF.PERSON);

        PageViewConfig pInfo = requestPageRenderInfo(currentResource);
        Assert.assertEquals(personTemplate.stringValue(), pInfo.getPageViewTemplateIri());
        Assert.assertEquals(PageViewConfigBuilder.VIEW_PAGE, pInfo.getDefaultView());
        Assert.assertEquals(false, pInfo.isShowKnowledgeGraphBar());
        Assert.assertEquals(true, pInfo.isShowKnowledgeGraphBarToggle());
        Assert.assertEquals(PageViewConfigBuilder.TEMPLATE_KNOWLEDGE_GRAPH_HEADER,
                pInfo.getKnowledgeGraphBarTemplateIri());
        Assert.assertEquals(PageViewConfigBuilder.TEMPLATE_GRAPH_RESOURCE, pInfo.getGraphViewTemplateIri());
        Assert.assertEquals(PageViewConfigBuilder.TEMPLATE_STATEMENTS_RESOURCE, pInfo.getStatementsViewTemplateIri());
        Assert.assertEquals(personPanelTemplate.stringValue(),
                pInfo.getKnowledgePanelTemplateIri());
        Assert.assertEquals(null, pInfo.getBreadcrumbsTemplateIri());
    }

    @Test
    @SubjectAware(username = "admin", password = "admin", configuration = templatePermissionShiroFile)
    public void testPageRenderInfo_PersonInstance_TemplateExists_PanelTemplateNotExists() throws Exception {

        // person instance + template foaf:Person exists, knowledge panel template does
        // not exist

        IRI currentResource = vf.createIRI("http://www.metaphacts.com/resource/bob");
        IRI personTemplate = vf.createIRI("Template:" + FOAF.PERSON.stringValue());
        savePage(personTemplate, "Template for foaf:Person");
        addType(currentResource, FOAF.PERSON);

        PageViewConfig pInfo = requestPageRenderInfo(currentResource);
        Assert.assertEquals(personTemplate.stringValue(), pInfo.getPageViewTemplateIri());
        Assert.assertEquals(PageViewConfigBuilder.VIEW_PAGE, pInfo.getDefaultView());
        Assert.assertEquals(false, pInfo.isShowKnowledgeGraphBar());
        Assert.assertEquals(true, pInfo.isShowKnowledgeGraphBarToggle());
        Assert.assertEquals(PageViewConfigBuilder.TEMPLATE_KNOWLEDGE_GRAPH_HEADER,
                pInfo.getKnowledgeGraphBarTemplateIri());
        Assert.assertEquals(PageViewConfigBuilder.TEMPLATE_GRAPH_RESOURCE, pInfo.getGraphViewTemplateIri());
        Assert.assertEquals(PageViewConfigBuilder.TEMPLATE_STATEMENTS_RESOURCE, pInfo.getStatementsViewTemplateIri());
        Assert.assertEquals(PageViewConfigBuilder.TEMPLATE_KNOWLEDGE_PANEL, pInfo.getKnowledgePanelTemplateIri());
        Assert.assertEquals(null, pInfo.getBreadcrumbsTemplateIri());
    }

    @Test
    @SubjectAware(username = "guest", password = "guest", configuration = templatePermissionShiroFile)
    public void testPageRenderInfo_PersonInstance_TemplateExists_AsGuest() throws Exception {

        // person instance + template foaf:Person exists

        IRI currentResource = vf.createIRI("http://www.metaphacts.com/resource/bob");
        IRI personTemplate = vf.createIRI("Template:" + FOAF.PERSON.stringValue());
        IRI personPanelTemplate = vf.createIRI("PanelTemplate:" + FOAF.PERSON.stringValue());
        savePage(personTemplate, "Template for foaf:Person");
        savePage(personPanelTemplate, "Panel Template for foaf:Person");
        addType(currentResource, FOAF.PERSON);

        PageViewConfig pInfo = requestPageRenderInfo(currentResource);
        Assert.assertEquals(personTemplate.stringValue(), pInfo.getPageViewTemplateIri());
        Assert.assertEquals(PageViewConfigBuilder.VIEW_PAGE, pInfo.getDefaultView());
        Assert.assertEquals(false, pInfo.isShowKnowledgeGraphBar());
        Assert.assertEquals(false, pInfo.isShowKnowledgeGraphBarToggle()); // guest user does not have permission
        Assert.assertEquals(PageViewConfigBuilder.TEMPLATE_KNOWLEDGE_GRAPH_HEADER,
                pInfo.getKnowledgeGraphBarTemplateIri());
        Assert.assertEquals(PageViewConfigBuilder.TEMPLATE_GRAPH_RESOURCE, pInfo.getGraphViewTemplateIri());
        Assert.assertEquals(PageViewConfigBuilder.TEMPLATE_STATEMENTS_RESOURCE, pInfo.getStatementsViewTemplateIri());
        Assert.assertEquals(null, pInfo.getBreadcrumbsTemplateIri());
    }

    @Test
    @SubjectAware(username = "admin", password = "admin", configuration = templatePermissionShiroFile)
    public void testPageRenderInfo_PersonInstance_TemplateNotExists() throws Exception {

        // person instance + template foaf:Person does not exist

        IRI currentResource = vf.createIRI("http://www.metaphacts.com/resource/bob");
        addType(currentResource, FOAF.PERSON);

        PageViewConfig pInfo = requestPageRenderInfo(currentResource);
        Assert.assertEquals(PageViewConfigBuilder.TEMPLATE_DEFAULT_RESOURCE, pInfo.getPageViewTemplateIri());
        Assert.assertEquals(PageViewConfigBuilder.VIEW_PAGE, pInfo.getDefaultView());
        Assert.assertEquals(true, pInfo.isShowKnowledgeGraphBar());
        Assert.assertEquals(false, pInfo.isShowKnowledgeGraphBarToggle());
        Assert.assertEquals(PageViewConfigBuilder.TEMPLATE_KNOWLEDGE_GRAPH_HEADER,
                pInfo.getKnowledgeGraphBarTemplateIri());
        Assert.assertEquals(PageViewConfigBuilder.TEMPLATE_GRAPH_RESOURCE, pInfo.getGraphViewTemplateIri());
        Assert.assertEquals(PageViewConfigBuilder.TEMPLATE_STATEMENTS_RESOURCE, pInfo.getStatementsViewTemplateIri());
        Assert.assertEquals(PageViewConfigManager.DEFAULT_BREADCRUMBS_TEMPLATE, pInfo.getBreadcrumbsTemplateIri());
    }

    @Test
    @SubjectAware(username = "admin", password = "admin", configuration = templatePermissionShiroFile)
    public void testPageRenderInfo_PersonInstance_MultipleTypes_TemplateExists() throws Exception {

        // person instance + template foaf:Person exists, template for second type does
        // not exist

        IRI currentResource = vf.createIRI("http://www.metaphacts.com/resource/bob");
        IRI personTemplate = vf.createIRI("Template:" + FOAF.PERSON.stringValue());
        savePage(personTemplate, "Template for foaf:Person");
        addType(currentResource, vf.createIRI("http://example.org/Person"));
        addType(currentResource, FOAF.PERSON);

        PageViewConfig pInfo = requestPageRenderInfo(currentResource);
        Assert.assertEquals(personTemplate.stringValue(), pInfo.getPageViewTemplateIri());
        Assert.assertEquals(PageViewConfigBuilder.VIEW_PAGE, pInfo.getDefaultView());
        Assert.assertEquals(false, pInfo.isShowKnowledgeGraphBar());
        Assert.assertEquals(true, pInfo.isShowKnowledgeGraphBarToggle());
        Assert.assertEquals(PageViewConfigBuilder.TEMPLATE_KNOWLEDGE_GRAPH_HEADER,
                pInfo.getKnowledgeGraphBarTemplateIri());
        Assert.assertEquals(PageViewConfigBuilder.TEMPLATE_GRAPH_RESOURCE, pInfo.getGraphViewTemplateIri());
        Assert.assertEquals(PageViewConfigBuilder.TEMPLATE_STATEMENTS_RESOURCE, pInfo.getStatementsViewTemplateIri());
        Assert.assertEquals(null, pInfo.getBreadcrumbsTemplateIri());
    }

    @Test
    @SubjectAware(username = "admin", password = "admin", configuration = templatePermissionShiroFile)
    public void testPageRenderInfo_FromConfiguration() throws Exception {

        // static named graph page + provided configuration override

        IRI currentResource = vf.createIRI("http://www.metaphacts.com/resource/assets/NamedGraph");
        savePage(currentResource, "Template page for named graph");

        PageViewConfig pInfo = requestPageRenderInfo(currentResource);
        Assert.assertEquals(currentResource.stringValue(), pInfo.getPageViewTemplateIri());
        Assert.assertEquals(PageViewConfigBuilder.VIEW_STATEMENTS, pInfo.getDefaultView());
        Assert.assertEquals(true, pInfo.isShowKnowledgeGraphBar());
        Assert.assertEquals(false, pInfo.isShowKnowledgeGraphBarToggle());
        Assert.assertEquals("http://www.metaphacts.com/resource/header/NamedGraph",
                pInfo.getKnowledgeGraphBarTemplateIri());
        Assert.assertEquals("http://www.metaphacts.com/resource/graph/NamedGraph",
                pInfo.getGraphViewTemplateIri());
        Assert.assertEquals("http://www.metaphacts.com/resource/statements/NamedGraph",
                pInfo.getStatementsViewTemplateIri());
        Assert.assertEquals("http://www.metaphacts.com/resource/breadcrumbs/NamedGraph",
                pInfo.getBreadcrumbsTemplateIri());
    }

    @Test
    @SubjectAware(username = "admin", password = "admin", configuration = templatePermissionShiroFile)
    public void testPageRenderInfo_FieldDefinition_RepositoryContextAssets() throws Exception {

        // field definition exists in assets repository

        IRI currentResource = vf.createIRI("http://www.metaphacts.com/fieldDefinition/EmailAddress");
        IRI fieldType = vf.createIRI("http://www.metaphacts.com/ontology/fields#Field");
        IRI fieldTemplate = vf.createIRI("Template:" + fieldType);
        savePage(fieldTemplate, "Template for Field");
        addType(repositoryRule.getAssetRepository(), currentResource, fieldType);

        PageViewConfig pInfo = requestPageRenderInfo(currentResource, "assets");
        Assert.assertEquals(fieldTemplate.stringValue(), pInfo.getPageViewTemplateIri());
        Assert.assertEquals(PageViewConfigBuilder.VIEW_PAGE, pInfo.getDefaultView());
        Assert.assertEquals(false, pInfo.isShowKnowledgeGraphBar());
        Assert.assertEquals(true, pInfo.isShowKnowledgeGraphBarToggle());
        Assert.assertEquals(PageViewConfigBuilder.TEMPLATE_KNOWLEDGE_GRAPH_HEADER,
                pInfo.getKnowledgeGraphBarTemplateIri());
        Assert.assertEquals(PageViewConfigBuilder.TEMPLATE_GRAPH_RESOURCE, pInfo.getGraphViewTemplateIri());
        Assert.assertEquals(PageViewConfigBuilder.TEMPLATE_STATEMENTS_RESOURCE, pInfo.getStatementsViewTemplateIri());
        Assert.assertEquals(null, pInfo.getBreadcrumbsTemplateIri());
    }

    @Test
    @SubjectAware(username = "admin", password = "admin", configuration = templatePermissionShiroFile)
    public void testPageRenderInfo_Caching_And_Permission() throws Exception {

        // person instance + template foaf:Person exists

        IRI currentResource = vf.createIRI("http://www.metaphacts.com/resource/bob");
        IRI personTemplate = vf.createIRI("Template:" + FOAF.PERSON.stringValue());
        savePage(personTemplate, "Template for foaf:Person");
        addType(currentResource, FOAF.PERSON);

        // 1. check resolved page render info for admin
        PageViewConfig pInfo = requestPageRenderInfo(currentResource);
        Assert.assertEquals(personTemplate.stringValue(), pInfo.getPageViewTemplateIri());
        Assert.assertEquals(true, pInfo.isShowKnowledgeGraphBarToggle());

        
        // modify type in the database => cache still returns cached information
        try (RepositoryConnection conn = repositoryRule.getRepository().getConnection()) {
            conn.clear();
        }
        IRI exPerson = vf.createIRI("http://www.example.com/Person");
        IRI exPersonTemplate = vf.createIRI("Template:" + exPerson.stringValue());
        savePage(exPersonTemplate, "Template for ex:Person");
        addType(currentResource, exPerson);
        
        
        // 2) cache is not invalidated, still returns same page info
        pInfo = requestPageRenderInfo(currentResource);
        Assert.assertEquals(personTemplate.stringValue(), pInfo.getPageViewTemplateIri());
        
        
        // 3) invalidate cache => returns new resolved template
        cacheManager.invalidateAll();
        pInfo = requestPageRenderInfo(currentResource);
        Assert.assertEquals(exPersonTemplate.stringValue(), pInfo.getPageViewTemplateIri());
        Assert.assertEquals(true, pInfo.isShowKnowledgeGraphBarToggle());
        
        // 4. check resolved page render info for guest
        // => guest must not have access to knowledge graph bar toggle
        final Subject subject = SecurityUtils.getSubject();
        subject.login(new UsernamePasswordToken("guest", "guest"));
        pInfo = requestPageRenderInfo(currentResource);
        Assert.assertEquals(exPersonTemplate.stringValue(), pInfo.getPageViewTemplateIri());
        Assert.assertEquals(false, pInfo.isShowKnowledgeGraphBarToggle());
    }

    private PageViewConfig requestPageRenderInfo(IRI pageIri) {
        return requestPageRenderInfo(pageIri, null);
    }

    private PageViewConfig requestPageRenderInfo(IRI pageIri, String repository) {
        WebTarget target = target("template/pageViewConfig").queryParam("iri", pageIri.stringValue());
        if (repository != null) {
            target = target.queryParam("repository", repository);
        }
        Response resp = target.request().get();
        Assert.assertEquals(Status.OK, resp.getStatusInfo());

        return resp.readEntity(PageRenderInfoForTest.class);
    }

    private void addType(IRI currentResource, IRI type) {
        addType(repositoryRule.getRepositoryManager().getDefault(), currentResource, type);
    }

    private void addType(Repository repo, IRI currentResource, IRI type) {
        try (RepositoryConnection conn = repo.getConnection()) {
            conn.add(currentResource, RDF.TYPE, type);
        }
    }

    private void savePage(IRI pageIri, String content) {

        StoragePath objectId = TemplateByIriLoader.templatePathFromIri(pageIri);
        platformStorageRule.storeContent(objectId, content, "runtime");
    }

    /**
     * Helper class for deserialization of {@link PageViewConfig} in tests which
     * offers a default constructor.
     *
     */
    static class PageRenderInfoForTest extends PageViewConfig {

        public PageRenderInfoForTest() {
            super(vf.createIRI("urn:dummy"));
        }

    }
}
