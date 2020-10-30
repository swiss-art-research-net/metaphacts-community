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
package com.metaphacts.templates.index;

import java.util.List;

import javax.inject.Inject;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.model.impl.TreeModel;
import org.jsoup.Jsoup;
import org.jsoup.safety.Whitelist;

import com.google.common.collect.Lists;
import com.metaphacts.config.Configuration;
import com.metaphacts.config.ConfigurationParameter.VisibilityLevel;
import com.metaphacts.templates.index.TemplateIndexManager.TemplateIndexVocabulary;

/**
 * A {@link TemplateIndexMetadataProvider} for adding the {@link Configuration}
 * documentation (i.e. name and description) as additional indexable contents to
 * the {@link #SYSTEM_CONFIGURATION_PAGE_IRI} resource.
 * 
 * <p>
 * This provider only provides metadata for the system configuration resource.
 * </p>
 * 
 * <p>
 * Basic information includes:
 * </p>
 * 
 * <ul>
 * <li>{@link TemplateIndexVocabulary#SPECIAL_CONTENT} (if any)</li>
 * </ul>
 * 
 * @author Andreas Schwarte
 *
 */
public class SystemConfigurationMetadataProvider implements TemplateIndexMetadataProvider {

    private static final Logger logger = LogManager.getLogger(SystemConfigurationMetadataProvider.class);

    private static final ValueFactory VF = SimpleValueFactory.getInstance();

    private static final VisibilityLevel MAX_VISIBILITY_LEVEL = VisibilityLevel.advanced;

    public static final IRI SYSTEM_CONFIGURATION_PAGE_IRI = VF
            .createIRI("http://help.metaphacts.com/resource/BasicSystemConfiguration");

    @Inject
    private Configuration systemConfig;

    @Override
    public Model extractMetadata(IRI pageIri, Context context) {

        if (!SYSTEM_CONFIGURATION_PAGE_IRI.equals(pageIri)) {
            return null;
        }

        Model m = new TreeModel();
        List<String> defaultConfigGroups = Lists.newArrayList("environment", "global", "ui", "cache", "dataQuality");
        for (String configGroup : defaultConfigGroups) {

            try {
                systemConfig.listParamsInGroups(configGroup).forEach((name, configParamValues) -> {
                    // check if this setting is actually visible
                    if (configParamValues.getVisibilityLevel().ordinal() > MAX_VISIBILITY_LEVEL.ordinal()) {
                        return;
                    }

                    String indexableContent = name + " : " + configParamValues.getDescription();

                    // make sure to remove HTML markup
                    indexableContent = Jsoup.clean(indexableContent, Whitelist.none());

                    m.add(pageIri, TemplateIndexVocabulary.SPECIAL_CONTENT, VF.createLiteral(indexableContent));

                });
            } catch (Exception e) {
                logger.warn("Failed to retrieve metadata for configuration group {}: {}", configGroup, e.getMessage());
                logger.debug("Details:", e);
            }
        }
                
        return m;
    }

}
