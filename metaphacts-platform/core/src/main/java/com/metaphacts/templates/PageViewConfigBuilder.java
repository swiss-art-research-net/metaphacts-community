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

import org.eclipse.rdf4j.model.IRI;

/**
 * Builder for {@link PageViewConfig} which takes care to initialize fields for
 * the corresponding page rendering case.
 * 
 * <p>
 * Applies configuration from {@link PageViewConfigSettings}.
 * </p>
 * 
 * @author Andreas Schwarte
 *
 */
public class PageViewConfigBuilder {


    public static final String TEMPLATE_DEFAULT_RESOURCE = "Template:http://www.w3.org/2000/01/rdf-schema#Resource";
    public static final String TEMPLATE_EMPTY_RESOURCE = "Template:http://www.metaphacts.com/resource/EmptyPage";
    public static final String TEMPLATE_STATEMENTS_RESOURCE = "http://www.metaphacts.com/resource/statements/Resource";
    public static final String TEMPLATE_GRAPH_RESOURCE = "http://www.metaphacts.com/resource/graph/Resource";
    public static final String TEMPLATE_KNOWLEDGE_GRAPH_HEADER = "http://www.metaphacts.com/resource/header/Resource";
    public static final String TEMPLATE_KNOWLEDGE_PANEL = "PanelTemplate:http://www.w3.org/2000/01/rdf-schema#Resource";

    public static final String VIEW_PAGE = "page";
    public static final String VIEW_STATEMENTS = "statements";
    public static final String VIEW_GRAPH = "graph";

    /**
     * Create a {@link PageViewConfigBuilder} for the current resource initialized
     * with default settings.
     * 
     * @param currentResource
     * @return the {@link PageViewConfigBuilder}
     */
    public static PageViewConfigBuilder createDefault(IRI currentResource, PageViewConfigSettings configuration) {
        return new PageViewConfigBuilder(currentResource).initializeFromConfiguration(configuration)
                .withShowKnowledgeGraphBarToggle(true);
    }

    /**
     * Create a {@link PageViewConfigBuilder} for the current resource initialized
     * with default settings. Moreover the page view template is set to the current
     * static page, and the knowledge graph bar is not shown by default.
     * 
     * @param currentResource
     * @return the {@link PageViewConfigBuilder}
     */
    public static PageViewConfigBuilder forStaticPage(IRI currentResource, PageViewConfigSettings configuration) {
        return createDefault(currentResource, configuration).withPageViewTemplateIri(currentResource)
                .withShowKnowledgeGraphBar(false)
                .withShowKnowledgeGraphBarToggle(false);
    }

    /**
     * Create a {@link PageViewConfigBuilder} for the current resource initialized
     * with default settings. Moreover the page view template is set to
     * {@link #TEMPLATE_EMPTY_RESOURCE} and the knowledge graph bar is not shown
     * 
     * @param currentResource
     * @return the {@link PageViewConfigBuilder}
     */
    public static PageViewConfigBuilder forNonExistingResource(IRI currentResource,
            PageViewConfigSettings configuration) {
        return createDefault(currentResource, configuration).withPageViewTemplateIri(TEMPLATE_EMPTY_RESOURCE)
                .withShowKnowledgeGraphBar(false)
                .withShowKnowledgeGraphBarToggle(false);
    }

    private final PageViewConfig pageRenderInfo;

    private PageViewConfigBuilder(IRI currentResource) {
        this.pageRenderInfo = new PageViewConfig(currentResource);
    }

    protected PageViewConfigBuilder initializeFromConfiguration(PageViewConfigSettings pageRenderConfiguration) {
        pageRenderConfiguration.applyDefaultsFromConfig(pageRenderInfo, pageRenderInfo.getCurrentResource());
        return this;
    }


    public PageViewConfigBuilder withPageViewTemplateIri(IRI pageView) {
        return withPageViewTemplateIri(pageView.stringValue());
    }

    public PageViewConfigBuilder withPageViewTemplateIri(String pageViewTemplateIri) {
        pageRenderInfo.setPageViewTemplateIri(pageViewTemplateIri);
        return this;
    }

    public PageViewConfigBuilder withKnowledgePanelTemplateIri(String knowledgePanelTemplateIri) {
        pageRenderInfo.setKnowledgePanelTemplateIri(knowledgePanelTemplateIri);
        return this;
    }

    public PageViewConfigBuilder withBreadcrumbsTemplateIri(String breadcrumbsTemplateIri) {
        pageRenderInfo.setBreadcrumbsTemplateIri(breadcrumbsTemplateIri);
        return this;
    }

    public PageViewConfigBuilder withShowKnowledgeGraphBar(boolean flag) {
        pageRenderInfo.setShowKnowledgeGraphBar(flag);
        return this;
    }

    public PageViewConfigBuilder withShowKnowledgeGraphBarToggle(boolean showKnowledgeGraphBarToggle) {
        pageRenderInfo.setShowKnowledgeGraphBarToggle(showKnowledgeGraphBarToggle);
        return this;
    }

    /**
     * Applies configuration using
     * {@link PageViewConfigSettings#applyConfiguration(PageViewConfig, IRI)}
     * 
     * @param configuration
     * @return
     * @see PageViewConfigSettings
     */
    public PageViewConfigBuilder applyConfiguration(PageViewConfigSettings configuration) {
        configuration.applyConfiguration(this.pageRenderInfo,
                pageRenderInfo.getCurrentResource());
        return this;
    }

    /**
     * Builds the {@link PageViewConfig}.
     */
    public PageViewConfig build() {
        return pageRenderInfo;
    }

}