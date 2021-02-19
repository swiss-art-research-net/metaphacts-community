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

import java.util.Set;

import javax.inject.Inject;

import org.apache.commons.lang.StringUtils;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.impl.TreeModel;

import com.metaphacts.config.NamespaceRegistry;
import com.metaphacts.templates.TemplateUtil;
import com.metaphacts.templates.index.TemplateIndexManager.TemplateIndexVocabulary;

/**
 * A {@link TemplateIndexMetadataProvider} for providing the connection between
 * pages (i.e. where a page is included).
 * 
 * <p>
 * Basic information includes:
 * </p>
 * 
 * <ul>
 * <li>{@link TemplateIndexVocabulary#HAS_INCLUDE} (if any)</li>
 * </ul>
 * 
 * @author Andreas Schwarte
 *
 */
public class TemplateGraphMetadataProvider implements TemplateIndexMetadataProvider {

    private static final Logger logger = LogManager.getLogger(TemplateGraphMetadataProvider.class);

    @Inject
    private NamespaceRegistry ns;

    @Override
    public Model extractMetadata(IRI pageIri, Context context) {
        Model m = new TreeModel();

        String templateSource = context.getTemplateSource();
        if (StringUtils.isEmpty(templateSource)) {
            return m;
        }

        try {
            Set<IRI> includes = TemplateUtil.extractIncludeIRIs(templateSource, ns);
            for (IRI include : includes) {
                m.add(pageIri, TemplateIndexVocabulary.HAS_INCLUDE, include);
            }
        } catch (Exception e) {
            // ignore errors for now
            logger.trace("Failed to extract includes for " + pageIri + ": " + e.getMessage(), e);
                  
        }
        return m;
    }

}
