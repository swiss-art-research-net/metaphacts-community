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
package com.metaphacts.templates;

import org.apache.shiro.SecurityUtils;
import org.eclipse.rdf4j.model.IRI;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.metaphacts.security.Permissions;
import com.metaphacts.security.Permissions.UI;
import com.metaphacts.security.WildcardPermission;

/**
 * Information for the client side on how a given page for a resource shall be
 * rendered.
 * 
 * 
 * @author Andreas Schwarte
 *
 */
public class PageViewConfig {


    @JsonIgnore
    private final IRI currentResource;

    private String pageViewTemplateIri;
    private String statementsViewTemplateIri;
    private String graphViewTemplateIri;
    private String knowledgeGraphBarTemplateIri;
    private String breadcrumbsTemplateIri;
    private String knowledgePanelTemplateIri;
    private boolean showKnowledgeGraphBar;
    private boolean showKnowledgeGraphBarToggle;
    private boolean editable;
    private String defaultView;

    public PageViewConfig(IRI currentResource) {
        this.currentResource = currentResource;
    }

    @JsonIgnore
    public IRI getCurrentResource() {
        return currentResource;
    }

    /**
     * 
     * @return the resolved template IRI used for the page view
     */
    public String getPageViewTemplateIri() {
        return pageViewTemplateIri;
    }

    public void setPageViewTemplateIri(String pageViewTemplateIri) {
        this.pageViewTemplateIri = pageViewTemplateIri;
    }

    /**
     * 
     * @return the resolved template IRI used for the statement view
     */
    public String getStatementsViewTemplateIri() {
        return statementsViewTemplateIri;
    }

    public void setStatementsViewTemplateIri(String statementsViewTemplateIri) {
        this.statementsViewTemplateIri = statementsViewTemplateIri;
    }

    /**
     * 
     * @return the resolved template IRI used for the graph view
     */
    public String getGraphViewTemplateIri() {
        return graphViewTemplateIri;
    }

    public void setGraphViewTemplateIri(String graphViewTemplateIri) {
        this.graphViewTemplateIri = graphViewTemplateIri;
    }

    /**
     * 
     * @return the resolved template IRI used for the knowledge graph bar
     */
    public String getKnowledgeGraphBarTemplateIri() {
        return knowledgeGraphBarTemplateIri;
    }

    public void setKnowledgeGraphBarTemplateIri(String knowledgeGraphBarTemplateIri) {
        this.knowledgeGraphBarTemplateIri = knowledgeGraphBarTemplateIri;
    }

    /**
     * 
     * @return the resolved template IRI used for the knowledge panel
     */
    public String getKnowledgePanelTemplateIri() {
        return knowledgePanelTemplateIri;
    }

    public void setKnowledgePanelTemplateIri(String knowledgePanelTemplateIri) {
        this.knowledgePanelTemplateIri = knowledgePanelTemplateIri;
    }

    /**
     * 
     * @return whether the knowledge graph is shown for the given resource
     */
    public boolean isShowKnowledgeGraphBar() {
        return showKnowledgeGraphBar;
    }

    public void setShowKnowledgeGraphBar(boolean showKnowledgeGraphBar) {
        this.showKnowledgeGraphBar = showKnowledgeGraphBar;
    }

    /**
     * Whether the knowledge graph bar toggle should be shown. This can only return
     * {@code true} if the user has the permission
     * {@link UI#KNOWLEDGE_GRAPH_BAR_TOGGLE}.
     * 
     * Note: this method is <b>not</b> a simple getter but applied logic. This is
     * required to make the cached information independent of the current user.
     */
    public boolean isShowKnowledgeGraphBarToggle() {
        // eensure toggle is not shown if bar is shown
        if (showKnowledgeGraphBarToggle) {
            if (showKnowledgeGraphBar || !checkPermission(Permissions.UI.KNOWLEDGE_GRAPH_BAR_TOGGLE)) {
                return false;
            }
        }
        return showKnowledgeGraphBarToggle;
    }

    public void setShowKnowledgeGraphBarToggle(boolean showKnowledgeGraphBarToggle) {
        this.showKnowledgeGraphBarToggle = showKnowledgeGraphBarToggle;
    }

    public void setBreadcrumbsTemplateIri(String breadcrumbsTemplateIri) {
        this.breadcrumbsTemplateIri = breadcrumbsTemplateIri;
    }

    public String getBreadcrumbsTemplateIri() {
        return breadcrumbsTemplateIri;
    }

    /**
     * 
     * @return whether the page is generally meant to editable (i.e. whether the
     *         edit button is shown)
     */
    public boolean isEditable() {
        return editable;
    }

    public void setEditable(boolean editable) {
        this.editable = editable;
    }

    /**
     * 
     * @return the default view, one of {@link PageViewConfigBuilder#VIEW_PAGE},
     *         {@link PageViewConfigBuilder#VIEW_GRAPH} or
     *         {@link PageViewConfigBuilder#VIEW_STATEMENTS}
     */
    public String getDefaultView() {
        return defaultView;
    }

    public void setDefaultView(String defaultView) {
        this.defaultView = defaultView;
    }

    private boolean checkPermission(String permission) {
        return SecurityUtils.getSubject().isPermitted(new WildcardPermission(permission));
    }
}