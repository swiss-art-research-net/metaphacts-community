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

import java.util.Arrays;

import org.apache.commons.lang.StringUtils;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.model.impl.TreeModel;
import org.eclipse.rdf4j.model.vocabulary.RDF;
import org.eclipse.rdf4j.model.vocabulary.RDFS;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.safety.Whitelist;

import com.metaphacts.config.NamespaceRegistry;
import com.metaphacts.templates.index.TemplateIndexManager.TemplateIndexVocabulary;

/**
 * A {@link TemplateIndexMetadataProvider} that provides basic information to a
 * page.
 * 
 * <p>
 * Basic information includes:
 * </p>
 * 
 * <ul>
 * <li>RDF.type (e.g. HelpPage)</li>
 * <li>Label (extracted from the first heading of the template, from the local
 * name otherwise)</li>
 * <li>{@link TemplateIndexVocabulary#CONTENT} (the indexable content)</li>
 * </ul>
 * 
 * 
 * @author Andreas Schwarte
 * @see TemplateIndexManager
 */
public class DefaultPageMetadataProvider implements TemplateIndexMetadataProvider {


    private static final ValueFactory VF = SimpleValueFactory.getInstance();

    @Override
    public Model extractMetadata(IRI pageIri, Context context) {
        Model stmts = new TreeModel();

        String label = extractLabel(pageIri, context);
        stmts.add(VF.createStatement(pageIri, RDFS.LABEL, VF.createLiteral(label)));

        // If we have more information about the type, we can add it
        IRI specificType = extractType(pageIri);
        if (specificType != null) {
            stmts.add(VF.createStatement(pageIri, RDF.TYPE, specificType));
        }

        if (!StringUtils.isEmpty(context.getRenderedHandlebarsContent())) {
            String pageContent = getContent(pageIri, context);
            stmts.add(VF.createStatement(pageIri, TemplateIndexVocabulary.CONTENT, VF.createLiteral(pageContent)));
        }

        return stmts;
    }

    /**
     * Prepare the content for indexing.
     * 
     * <p>
     * All HTML elements including attributes are removed from the page content.
     * </p>
     * 
     * <p>
     * Note that if the page contains a <i>div.page</i>, it is used as content
     * </p>
     * 
     * @param pageIri
     * @param rawContent
     * @return the prepared content
     */
    private String getContent(IRI pageIri, Context context) {

        String rawContent = context.getRenderedHandlebarsContent();
        Element el = context.getParsedDocument().select("div.page").first();
        if (el != null) {
            rawContent = el.html();
        }

        // strip all HTML tags
        String strippedContent = Jsoup.clean(rawContent, Whitelist.none());

        return strippedContent;
    }

    /**
     * Extract the type of the template.
     * <p>
     * If the page is in the {@link NamespaceRegistry#DFLT_HELP_NAMESPACE}, we use
     * {@link TemplateIndexVocabulary#HELP_PAGE}. Otherwise we use
     * {@link TemplateIndexVocabulary#PAGE}.
     * </p>
     * 
     * @param pageIri
     * @return
     */
    private IRI extractType(IRI pageIri) {

        if (pageIri.stringValue().startsWith(NamespaceRegistry.DFLT_HELP_NAMESPACE)) {
            return TemplateIndexVocabulary.HELP_PAGE;
        }

        // we do not have any further information
        return null;
    }

    /**
     * Extract the label of the template.
     * <p>
     * If the page has a h1 (h2,h3) level heading, the first found element is used
     * as label. Otherwise we use a camel case split string of the the template's
     * local name.
     * </p>
     * 
     * @param pageIri
     * @param context
     * @return
     */
    private String extractLabel(IRI pageIri, Context context) {

        Document document = context.getParsedDocument();
        if (document != null) {
            for (String elname : Arrays.asList("h1", "h2", "h3")) {
                Element el = context.getParsedDocument().select(elname).first();
                if (el != null) {
                    // Note: clean escapes HTML entities => we want to keep & as-is
                    String cleanedLabel = Jsoup.clean(el.text(), Whitelist.none()).replaceAll("&amp;", "&");

                    if (!StringUtils.isEmpty(cleanedLabel)) {
                        return cleanedLabel;
                    }
                }
            }
        }

        // split page name to words, e.g. StructuredSearch => Structured Search
        String pageName = pageIri.getLocalName();
        String label = StringUtils.join(StringUtils.splitByCharacterTypeCamelCase(pageName), " ");
        return label;
    }
}
