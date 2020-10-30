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
package com.metaphacts.templates.helper;

import static com.google.common.base.Preconditions.checkNotNull;

import java.util.List;

import org.apache.commons.lang3.StringEscapeUtils;
import org.apache.logging.log4j.Logger;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Value;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.query.BindingSet;
import org.eclipse.rdf4j.query.MalformedQueryException;
import org.eclipse.rdf4j.query.Operation;
import org.eclipse.rdf4j.query.QueryEvaluationException;
import org.eclipse.rdf4j.query.QueryResults;
import org.eclipse.rdf4j.query.TupleQuery;
import org.eclipse.rdf4j.query.TupleQueryResult;
import org.eclipse.rdf4j.repository.Repository;
import org.eclipse.rdf4j.repository.RepositoryConnection;
import org.eclipse.rdf4j.repository.RepositoryException;

import com.github.jknack.handlebars.Options;
import com.metaphacts.api.sparql.SparqlOperationBuilder;
import com.metaphacts.templates.TemplateContext;

/**
 * @author Johannes Trame <jt@metaphacts.com>
 *
 */
public class HelperUtil {
    private static final String ESCAPE_RESULT_FLAG = "escape";

    /**
     * Takes the {@link TemplateContext} to resolve the current resource
     * (?__this__) and the user (?__useruri__) on the supplied
     * {@link SparqlOperationBuilder}.
     * @param <E>
     * @param <T>
     *
     * @param builder
     * @param context
     * @return
     * @return
     */
    public static <T extends Operation> SparqlOperationBuilder<T> contextualizeSparqlOperation(SparqlOperationBuilder<T> builder, TemplateContext context){
        builder.resolveThis((IRI)context.getValue());
        if(context.getNamespaceRegistry().isPresent()){
            builder.resolveUser(context.getNamespaceRegistry().get().getUserIRI());
        }
        return builder;
    }

    public static class QueryResult {
	public List<BindingSet> bindings;
	public List<String> bindingNames;

        public QueryResult(List<BindingSet> bindings, List<String> bindingNames) {
	    this.bindings = bindings;
	    this.bindingNames = bindingNames;
	}
    }

    public static QueryResult evaluateSelectQuery(
        String param0, Options options, Logger logger
    ) {
        TemplateContext context =  (TemplateContext) options.context.model();
	return evaluateSelectQuery(param0, options, logger, context.getRepository());
    }

    public static QueryResult evaluateSelectQuery(
        String param0, Options options, Logger logger, Repository repository
    ) {
        TemplateContext context =  (TemplateContext) options.context.model();
        String queryString = checkNotNull(param0, "Query string must not be null.");
        try (RepositoryConnection con = repository.getConnection()) {
            SparqlOperationBuilder<Operation> tqb = HelperUtil.contextualizeSparqlOperation(SparqlOperationBuilder.create(queryString), context);
            context.getNamespaceRegistry().map( ns -> tqb.setNamespaces(ns.getPrefixMap()));
            Operation op = tqb.build(con);
            if (!(op instanceof TupleQuery)) {
                throw new IllegalArgumentException("Only SPARQL SELECT queries are supported in "+options.helperName+" template helper.");
            }
            logger.trace("Evaluating SPARQL SELECT in {} Template Helper: {}", options.helperName, queryString);
            try (TupleQueryResult tqr = ((TupleQuery)op).evaluate()){
                return new QueryResult(QueryResults.asList(tqr), tqr.getBindingNames());
            }
        } catch (RepositoryException e) {
            throw new RuntimeException("Repository Exception while evaluating query in \""+options.helperName+"\" template helper: "+queryString, e);
        } catch (MalformedQueryException e) {
            throw new IllegalArgumentException("Malformed Query in \""+options.helperName+"\" template helper: \""+queryString +"\" .\nDetails: "+e.getMessage(), e);
        } catch (QueryEvaluationException e) {
            throw new RuntimeException("Error while evaluating query in \""+options.helperName+"\" template helper: "+queryString, e);
        }
    }

    public static String escapeIfRequested(String result, Options options) {
        return options.isFalsy(options.hash.getOrDefault(ESCAPE_RESULT_FLAG, "true"))
            ? result : StringEscapeUtils.escapeHtml4(result);
    }

    /**
     * Converts a helper parameter to {@code String}.
     * 
     * @param param to convert
     * @return the parameter as string or {@code null} if the input is {@code null}.
     */
    public static String toString(Object param) {
        return param != null ? param.toString() : null;
    }

    /**
     * Converts the helper parameter to {@link IRI}.
     * 
     * @param param to convert
     * @return parsed {@link IRI}. {@code null} if input is {@code null} or is a
     *         {@link TemplateContext} but no IRI.
     */
    public static IRI toIRI(Object param) {
        if (param == null) {
            return null;
        } else if (param instanceof TemplateContext) {
            Value value = ((TemplateContext) param).getValue();
            return value instanceof IRI ? (IRI) value : null;
        } else {
            String string = toString(param);
            return SimpleValueFactory.getInstance().createIRI(string);
        }
    }
}
