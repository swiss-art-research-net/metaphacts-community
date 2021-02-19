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

import javax.inject.Inject;

import org.apache.commons.configuration2.HierarchicalConfiguration;
import org.apache.logging.log4j.Level;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;

import com.metaphacts.junit.AbstractIntegrationTest;
import com.metaphacts.junit.Log4jRule;
import com.metaphacts.junit.PlatformStorageRule;
import com.metaphacts.services.storage.api.ObjectKind;

public class PageViewConfigSettingsTest extends AbstractIntegrationTest {

    static final ValueFactory vf = SimpleValueFactory.getInstance();

    @Inject
    private PageViewConfigSettings pageRenderConfig;

    @Inject
    @Rule
    public PlatformStorageRule platformStorageRule;
    
    @Rule
    public Log4jRule log4j = Log4jRule.create(Level.TRACE);

    @Before
    public void before() throws Exception {
        String appStorage = "metaphacts-platform";

        platformStorageRule.getPlatformStorage().addStorage(appStorage);

        platformStorageRule.storeContentFromResource(
                ObjectKind.CONFIG.resolve(PageViewConfigSettings.CONFIG_FILE_NAME),
                "/com/metaphacts/templates/pageViewConfig.ini", appStorage);

        platformStorageRule.storeContentFromResource(
                ObjectKind.CONFIG.resolve(PageViewConfigSettings.CONFIG_FILE_NAME),
                "/com/metaphacts/templates/pageViewConfigOverride.ini", "runtime");

        pageRenderConfig.reloadConfiguration();
    }

    @Test
    public void testCombinedConfig() throws Exception {

        // 1. defined only in metaphacts-platform
        HierarchicalConfiguration<?> c1 = pageRenderConfig
                .configFor("Template:http://www.w3.org/2000/01/rdf-schema#Resource").get();
        Assert.assertEquals(PageViewConfigBuilder.TEMPLATE_GRAPH_RESOURCE,
                c1.getString(PageViewConfigSettings.PROPERTY_GRAPH_VIEW_TEMPLATE_IRI));
        
        // 2. defined in runtime only
        HierarchicalConfiguration<?> c2 = pageRenderConfig
                .configFor("Template:http://www.metaphacts.com/resource/OnlyRuntime").get();
        Assert.assertEquals("http://www.metaphacts.com/resource/graph/OnlyRuntimeGraph",
                c2.getString(PageViewConfigSettings.PROPERTY_GRAPH_VIEW_TEMPLATE_IRI));

        // 3. defined in metaphacts-platform, setting graphViewTemplate defined in
        // runtime
        HierarchicalConfiguration<?> c3 = pageRenderConfig
                .configFor("Template:http://www.metaphacts.com/resource/Combine").get();
        Assert.assertEquals("true", c3.getString(PageViewConfigSettings.PROPERTY_SHOW_KNOWLEDGE_GRAPH_BAR));
        Assert.assertEquals("http://www.metaphacts.com/resource/graph/CombineGraph",
                c3.getString(PageViewConfigSettings.PROPERTY_GRAPH_VIEW_TEMPLATE_IRI));

        // 4. defined in metapahcts-platform, setting graphViewTemplate overridden in
        // runtime
        HierarchicalConfiguration<?> c4 = pageRenderConfig
                .configFor("Template:http://www.metaphacts.com/resource/Override").get();
        Assert.assertEquals("http://www.metaphacts.com/resource/graph/OverrideGraph",
                c4.getString(PageViewConfigSettings.PROPERTY_GRAPH_VIEW_TEMPLATE_IRI));

    }

    @Test
    public void testApplyConfiguration_NoSpecialConfig() throws Exception {

        IRI currentResource = vf.createIRI("urn:someResource");
        PageViewConfig pInfo = PageViewConfigBuilder.createDefault(currentResource, pageRenderConfig).build();

        // applies rdfs resource
        pageRenderConfig.applyConfiguration(pInfo, currentResource);

        Assert.assertEquals(PageViewConfigBuilder.TEMPLATE_DEFAULT_RESOURCE, pInfo.getPageViewTemplateIri());
    }

    @Test
    public void testApplyConfiguration_NonExisting() throws Exception {

        IRI currentResource = vf.createIRI("urn:non-existing");
        PageViewConfig pInfo = PageViewConfigBuilder.createDefault(currentResource, pageRenderConfig).build();

        // applies rdfs resource
        pageRenderConfig.applyConfiguration(pInfo, currentResource);

        Assert.assertEquals(PageViewConfigBuilder.TEMPLATE_DEFAULT_RESOURCE, pInfo.getPageViewTemplateIri());
    }

    @Test
    public void testApplyConfiguration_Ontology() throws Exception {

        IRI currentResource = vf.createIRI("urn:myOntology");
        String pageViewTemplate = "Template:http://www.w3.org/2002/07/owl#Ontology";
        PageViewConfig pInfo = PageViewConfigBuilder.createDefault(currentResource, pageRenderConfig)
                .withPageViewTemplateIri(pageViewTemplate).build();

        // applies ontology configuration
        pageRenderConfig.applyConfiguration(pInfo, currentResource);

        Assert.assertEquals(pageViewTemplate, pInfo.getPageViewTemplateIri());
        Assert.assertEquals("http://www.metaphacts.com/resource/graph/Ontology", pInfo.getGraphViewTemplateIri());
        Assert.assertEquals(PageViewConfigBuilder.TEMPLATE_STATEMENTS_RESOURCE, pInfo.getStatementsViewTemplateIri());
        Assert.assertEquals(true, pInfo.isShowKnowledgeGraphBar());
        Assert.assertEquals(false, pInfo.isEditable());
        Assert.assertEquals("graph", pInfo.getDefaultView()); // overridden in runtime
    }

    @Test
    public void testApplyConfiguration_FullyCustomized() throws Exception {

        IRI currentResource = vf.createIRI("urn:someResource");
        String pageViewTemplate = "Template:http://www.metaphacts.com/resource/FullyCustomized";
        PageViewConfig pInfo = PageViewConfigBuilder.createDefault(currentResource, pageRenderConfig)
                .withPageViewTemplateIri(pageViewTemplate).build();

        // applies ontology configuration
        pageRenderConfig.applyConfiguration(pInfo, currentResource);

        Assert.assertEquals(pageViewTemplate, pInfo.getPageViewTemplateIri());
        Assert.assertEquals("http://www.metaphacts.com/resource/graph/FullyCustomized",
                pInfo.getGraphViewTemplateIri());
        Assert.assertEquals("http://www.metaphacts.com/resource/statements/FullyCustomized",
                pInfo.getStatementsViewTemplateIri());
        Assert.assertEquals("http://www.metaphacts.com/resource/header/FullyCustomized",
                pInfo.getKnowledgeGraphBarTemplateIri());
        Assert.assertEquals("PanelTemplate:http://www.metaphacts.com/resource/FullyCustomized",
                pInfo.getKnowledgePanelTemplateIri());
        Assert.assertEquals(false, pInfo.isShowKnowledgeGraphBar());
        Assert.assertEquals(false, pInfo.isEditable());
        Assert.assertEquals("graph", pInfo.getDefaultView());
    }
}
