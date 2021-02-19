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

import java.io.InputStreamReader;
import java.io.Reader;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import javax.inject.Inject;
import javax.inject.Singleton;

import org.apache.commons.configuration2.CombinedConfiguration;
import org.apache.commons.configuration2.HierarchicalConfiguration;
import org.apache.commons.configuration2.INIConfiguration;
import org.apache.commons.configuration2.ex.ConfigurationRuntimeException;
import org.apache.commons.configuration2.tree.OverrideCombiner;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.rdf4j.model.IRI;

import com.metaphacts.services.storage.api.ObjectKind;
import com.metaphacts.services.storage.api.PlatformStorage;
import com.metaphacts.services.storage.api.PlatformStorage.FindResult;
import com.metaphacts.services.storage.api.StorageException;

/**
 * Extensible configuration for page rendering information.
 * <p>
 * This configuration can be used to define the defaults for
 * {@link PageViewConfig} as well as to apply specialized settings for groups of
 * selected templates (e.g. for ontologies).
 * </p>
 * 
 * <p>
 * Configuration is loaded using the {@link PlatformStorage} API from the path
 * <i>config/pageRenderInfo</i>. Note that such files are loaded in override
 * order, i.e. the settings can be added or overridden in apps.
 * </p>
 * 
 * <p>
 * Example pageViewConfig.ini</i>
 * 
 * <pre>
 * [defaults]
 *  pageViewTemplateIri = Template:http://www.w3.org/2000/01/rdf-schema#Resource
 *  statementsViewTemplateIri = http://www.metaphacts.com/resource/statements/Resource
 *    graphViewTemplateIri = http://www.metaphacts.com/resource/graph/Resource
 *    knowledgeGraphBarTemplateIri = http://www.metaphacts.com/resource/header/Resource
 *    showKnowledgeGraphBar = true
 *    editable = true
 *    defaultView = page
 * 
 * [Template:http://www.w3.org/2000/01/rdf-schema#Resource]
 *   pageViewTemplateIri = Template:http://www.w3.org/2000/01/rdf-schema#Resource
 *   statementsViewTemplateIri = http://www.metaphacts.com/resource/statements/Resource
 *   graphViewTemplateIri = http://www.metaphacts.com/resource/graph/Resource
 *   knowledgeGraphBarTemplateIri = http://www.metaphacts.com/resource/header/Resource
 *   showKnowledgeGraphBar = true
 *   editable = true
 *   defaultView = page
 * 
 * [Template:http://www.w3.org/2002/07/owl#Ontology]
 *   graphViewTemplateIri = http://www.metaphacts.com/resource/graph/Ontology
 *   showKnowledgeGraphBar = true
 *   editable = false
 *   defaultView = page
 * </pre>
 * 
 * @author Andreas Schwarte
 * @see PageViewConfig
 * @see PageViewConfigBuilder
 *
 */
@Singleton
public class PageViewConfigSettings {

    private static final Logger logger = LogManager.getLogger(PageViewConfigSettings.class);

    public static final String CONFIG_FILE_NAME = "pageViewConfig.ini";

    static final String PROPERTY_PAGE_VIEW_TEMPLATE_IRI = "pageViewTemplateIri";
    static final String PROPERTY_STATEMENTS_VIEW_TEMPLATE_IRI = "statementsViewTemplateIri";
    static final String PROPERTY_GRAPH_VIEW_TEMPLATE_IRI = "graphViewTemplateIri";
    static final String PROPERTY_KNOWLEDGE_GRAPH_BAR_TEMPLATE_IRI = "knowledgeGraphBarTemplateIri";
    static final String PROPERTY_KNOWLEDGE_PANEL_TEMPLATE_IRI = "knowledgePanelTemplateIri";
    static final String PROPERTY_BREADCRUMBS_TEMPLATE_IRI = "breadcrumbsTemplateIri";
    static final String PROPERTY_SHOW_KNOWLEDGE_GRAPH_BAR = "showKnowledgeGraphBar";
    static final String PROPERTY_EDITABLE = "editable";
    static final String PROPERTY_DEFAULT_VIEW = "defaultView";

    private final PlatformStorage platformStorage;

    private CombinedConfiguration config;

    @Inject
    public PageViewConfigSettings(PlatformStorage platformStorage) {
        this.platformStorage = platformStorage;
        initialize();
    }


    private void initialize() {

        CombinedConfiguration combined = new CombinedConfiguration(new OverrideCombiner());
        List<FindResult> l;
        try {
            l = platformStorage.findOverrides(ObjectKind.CONFIG.resolve(CONFIG_FILE_NAME));
            // use inverted order [...override2, override1, base] for OverrideCombiner
            Collections.reverse(l);
        } catch (StorageException e1) {
            throw new RuntimeException(e1);
        }


        for (FindResult fr : l) {
            logger.trace("Initializing page render configuration from app {}", fr.getAppId());
            try {
                try (Reader r = new InputStreamReader(fr.getRecord().getLocation().readContent())) {
                    INIConfiguration iniConfig = new INIConfiguration();
                    iniConfig.read(r);
                    combined.addConfiguration(iniConfig, fr.getAppId());
                }
            } catch (Exception e) {
                logger.warn("Failed to initialize page render configuration from app {}: {}", fr.getAppId(),
                        e.getMessage());
                logger.debug("Details:", e);
            }
        }

        this.config = combined;
    }

    /**
     * Reload the configuration from the configuration files available in the
     * {@link PlatformStorage}
     * 
     */
    public void reloadConfiguration() {
        initialize();
    }
    
    /**
     * Applies the defaults configuration from the config.
     * 
     * <p>
     * It is expected that <i>pageRenderInfo.ini</i> contains a section
     * <i>defaults</i> which defines the initial default values.
     * </p>
     * 
     * <p>
     * Example:
     * </p>
     * 
     * <pre>
     * [defaults]
     *  pageViewTemplateIri = Template:http://www.w3.org/2000/01/rdf-schema#Resource
     *  statementsViewTemplateIri = http://www.metaphacts.com/resource/statements/Resource
     *    graphViewTemplateIri = http://www.metaphacts.com/resource/graph/Resource
     *    knowledgeGraphBarTemplateIri = http://www.metaphacts.com/resource/header/Resource
     *    showKnowledgeGraphBar = true
     *    editable = true
     *    defaultView = page
     * </pre>
     * 
     * @param pInfo
     * @param currentResource
     * @throws ConfigurationRuntimeException if the configuration does not provide a
     *                                       default section or misses a value
     */
    public void applyDefaultsFromConfig(PageViewConfig pInfo, IRI currentResource) throws ConfigurationRuntimeException {
        
        String defaultSection = "defaults";
        
        HierarchicalConfiguration<?> defaults = this.config.configurationAt(defaultSection);
        pInfo.setPageViewTemplateIri(defaults.getString(PROPERTY_PAGE_VIEW_TEMPLATE_IRI));
        pInfo.setGraphViewTemplateIri(defaults.getString(PROPERTY_GRAPH_VIEW_TEMPLATE_IRI));
        pInfo.setStatementsViewTemplateIri(defaults.getString(PROPERTY_STATEMENTS_VIEW_TEMPLATE_IRI));
        pInfo.setKnowledgeGraphBarTemplateIri(defaults.getString(PROPERTY_KNOWLEDGE_GRAPH_BAR_TEMPLATE_IRI));
        pInfo.setKnowledgePanelTemplateIri(defaults.getString(PROPERTY_KNOWLEDGE_PANEL_TEMPLATE_IRI));
        pInfo.setDefaultView(defaults.getString(PROPERTY_DEFAULT_VIEW));
        pInfo.setShowKnowledgeGraphBar(Boolean.valueOf(defaults.getString(PROPERTY_SHOW_KNOWLEDGE_GRAPH_BAR)));
        pInfo.setEditable(Boolean.valueOf(defaults.getString(PROPERTY_EDITABLE)));
    }

    /**
     * Apply the configuration to the provided {@link PageViewConfig}. This is: if
     * there exists a corresponding configuration section inside the combined INI
     * configuration.
     * 
     * <p>
     * Note that the override order is respected such that sections and specific
     * configurations for sections in apps can override settings from the platform
     * app.</p
     * 
     * @param pInfo
     * @param currentResource
     */
    public void applyConfiguration(PageViewConfig pInfo, IRI currentResource) {

        Optional<HierarchicalConfiguration<?>> optSection = configFor(pInfo.getPageViewTemplateIri());
        if (!optSection.isPresent()) {
            return;
        }

        HierarchicalConfiguration<?> section = optSection.get();
        if (section.containsKey(PROPERTY_PAGE_VIEW_TEMPLATE_IRI)) {
            pInfo.setPageViewTemplateIri(section.getString(PROPERTY_PAGE_VIEW_TEMPLATE_IRI));
        }
        if (section.containsKey(PROPERTY_STATEMENTS_VIEW_TEMPLATE_IRI)) {
            pInfo.setStatementsViewTemplateIri(section.getString(PROPERTY_STATEMENTS_VIEW_TEMPLATE_IRI));
        }
        if (section.containsKey(PROPERTY_GRAPH_VIEW_TEMPLATE_IRI)) {
            pInfo.setGraphViewTemplateIri(section.getString(PROPERTY_GRAPH_VIEW_TEMPLATE_IRI));
        }
        if (section.containsKey(PROPERTY_KNOWLEDGE_GRAPH_BAR_TEMPLATE_IRI)) {
            pInfo.setKnowledgeGraphBarTemplateIri(section.getString(PROPERTY_KNOWLEDGE_GRAPH_BAR_TEMPLATE_IRI));
        }
        if (section.containsKey(PROPERTY_KNOWLEDGE_PANEL_TEMPLATE_IRI)) {
            pInfo.setKnowledgePanelTemplateIri(section.getString(PROPERTY_KNOWLEDGE_PANEL_TEMPLATE_IRI));
        }
        if (section.containsKey(PROPERTY_BREADCRUMBS_TEMPLATE_IRI)) {
            String breadcrumbsIri = section.getString(PROPERTY_BREADCRUMBS_TEMPLATE_IRI);
            if ("null".equals(breadcrumbsIri)) {
                pInfo.setBreadcrumbsTemplateIri(null);
            } else {
                pInfo.setBreadcrumbsTemplateIri(breadcrumbsIri);
            }
        }
        if (section.containsKey(PROPERTY_SHOW_KNOWLEDGE_GRAPH_BAR)) {
            pInfo.setShowKnowledgeGraphBar(Boolean.valueOf(section.getString(PROPERTY_SHOW_KNOWLEDGE_GRAPH_BAR)));
        }
        if (section.containsKey(PROPERTY_EDITABLE)) {
            pInfo.setEditable(Boolean.valueOf(section.getString(PROPERTY_EDITABLE)));
        }
        if (section.containsKey(PROPERTY_DEFAULT_VIEW)) {
            pInfo.setDefaultView(section.getString(PROPERTY_DEFAULT_VIEW));
        }
    }

    /**
     * The configuration for the given page, if any. Resolved internally from all
     * configurations in different storages.
     * 
     * @param pageViewTemplateIri
     * @return
     */
    protected Optional<HierarchicalConfiguration<?>> configFor(String pageViewTemplateIri) {

        String key = toKey(pageViewTemplateIri);

        try {
            return Optional.of(this.config.configurationAt(key));
        } catch (ConfigurationRuntimeException e) {
            logger.trace("No section found for {}. Details: {}", pageViewTemplateIri, e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * Transform the {@link PageViewConfig#getPageViewTemplateIri()} to the key
     * understood by the {@link CombinedConfiguration}. Note that sections of the
     * ini file become path elements where the "." character is escaped with another
     * "." character
     * 
     * @param pageViewTemplateIri
     * @return
     */
    protected String toKey(String pageViewTemplateIri) {
        // section: [Template:http://www.w3.org/2000/01/rdf-schema#Resource]
        //
        // Template:http://www..w3..org/2000/01/rdf-schema#Resource.pageViewTemplateIri
        return pageViewTemplateIri.replace(".", "..");
    }
}
