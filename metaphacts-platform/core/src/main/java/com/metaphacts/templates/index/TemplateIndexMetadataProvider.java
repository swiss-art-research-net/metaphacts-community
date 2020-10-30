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

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Model;
import org.jsoup.nodes.Document;

/**
 * Interface defining a provider for metadata for a given page.
 * 
 * @author Andreas Schwarte
 *
 */
public interface TemplateIndexMetadataProvider {

    public static class Context {

        final IRI pageIri;
        final String templateSource;
        final String renderedHandlebarsContent;
        final Document parsedDocument;

        public Context(IRI pageIri, String templateSource, String renderedHandlebarsContent, Document parsedDocument) {
            super();
            this.pageIri = pageIri;
            this.templateSource = templateSource;
            this.renderedHandlebarsContent = renderedHandlebarsContent;
            this.parsedDocument = parsedDocument;
        }

        /**
         * 
         * @return the identifier of the resource
         */
        public IRI getPageIri() {
            return pageIri;
        }

        /**
         * 
         * @return rendered HTML content of the template (potentially with resolved
         *         includes)
         */
        public String getRenderedHandlebarsContent() {
            return renderedHandlebarsContent;
        }

        /**
         * 
         * @return a parsed JSoup {@link Document} of the raw HTML content,
         *         <code>null</code> if it cannot be rendered
         */
        public Document getParsedDocument() {
            return parsedDocument;
        }

        /**
         * 
         * @return the raw HTML source of the give template
         */
        public String getTemplateSource() {
            return templateSource;
        }
    }

    /**
     * Extract additional metatadata for the given resource and add it to the target
     * model.
     * 
     * @param pageIri the resource for which to extract metadata
     * @param context the {@link Context}
     * @return the extracted {@link Model}, <code>null</code> or empty if the
     *         provider cannot contribute any metadata
     */
    public Model extractMetadata(IRI pageIri, Context context);
}
