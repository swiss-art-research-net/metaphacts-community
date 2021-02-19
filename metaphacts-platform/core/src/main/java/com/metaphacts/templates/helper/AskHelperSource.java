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
package com.metaphacts.templates.helper;

import static com.google.common.base.Preconditions.checkNotNull;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.rdf4j.query.BooleanQuery;
import org.eclipse.rdf4j.query.MalformedQueryException;
import org.eclipse.rdf4j.query.QueryEvaluationException;
import org.eclipse.rdf4j.repository.RepositoryConnection;
import org.eclipse.rdf4j.repository.RepositoryException;

import com.github.jknack.handlebars.Options;
import com.github.jknack.handlebars.helper.IfHelper;
import com.metaphacts.api.sparql.SparqlOperationBuilder;
import com.metaphacts.templates.TemplateContext;

/**
 * Handlebars helper to execute SPARQL ASK queries. Helper will return either
 * "true" or an empty string (for false). The reason is that the {@link AskHelper}
 * helper is primarily to be used as subexpression in {@link IfHelper}, which
 * has special logic for comparing different primitive types. However, since
 * helper functions can only return {@link CharSequence} we need to return an
 * empty string for false. <br>
 * <strong>Subexpression Example:</strong> <br>
 * <code>
 * [[#if (ask "ASK {?a ?b ?c}) ]]
 *  true branch
 * [[else]]
 *  false branch
 * [[/if]]
 * </code><br>
 * <strong>Stand-alone</strong><br>
 * <code>
 * Is this true ?: [[#ask "ASK {?a ?b ?c} ]]
 * </code>
 * 
 * @author Johannes Trame <jt@metaphacts.com>
 *
 */
public class AskHelperSource {
    
    private static final Logger logger = LogManager.getLogger(AskHelperSource.class);

    public String ask(String param0, Options options) {
        TemplateContext context =  (TemplateContext) options.context.model();
        String queryString = checkNotNull(param0);
        try (RepositoryConnection con =context.getRepository().getConnection()) {
            SparqlOperationBuilder<BooleanQuery> tqb = HelperUtil.contextualizeSparqlOperation(SparqlOperationBuilder.<BooleanQuery>create(queryString, BooleanQuery.class), context);
            context.getNamespaceRegistry().map( ns -> tqb.setNamespaces(ns.getPrefixMap()));
            BooleanQuery op = tqb.build(con);
            if (!(op instanceof BooleanQuery))
                throw new IllegalArgumentException(
                        "Only SPARQL ASK queries are not supported in SPARQL "
                                + options.helperName + " Template Helper Function.");

            logger.trace("Evaluating SPARQL ASK query in SPARQL " + options.helperName
                    + " Template Helper: " + queryString);
            boolean b = ((BooleanQuery) op).evaluate();
            return b ? "true" : ""; // handlebars requires empty string for
                                    // false, if not native boolean
        } catch (RepositoryException e) {
            throw new RuntimeException(
                    "Repository Exception while evaluating query in SPARQL "
                            + options.helperName + " Template Helper: " + queryString, e);
        } catch (MalformedQueryException e) {
            throw new IllegalArgumentException("Malformed Query in SPARQL "
                    + options.helperName + "  Template Helper: \""+queryString +"\" .\nDetails: "+e.getMessage(), e);
        } catch (QueryEvaluationException e) {
            throw new RuntimeException(
                    "Error while evaluating query in SPARQL " + options.helperName
                            + " Template Helper: " + queryString, e);
        }
    }
}