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

import java.io.IOException;

import org.apache.commons.lang3.StringEscapeUtils;
import org.apache.commons.lang3.StringUtils;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.rdf4j.model.Value;
import org.eclipse.rdf4j.query.BindingSet;
import org.eclipse.rdf4j.query.MalformedQueryException;
import org.eclipse.rdf4j.query.Operation;
import org.eclipse.rdf4j.query.QueryEvaluationException;
import org.eclipse.rdf4j.query.TupleQuery;
import org.eclipse.rdf4j.query.TupleQueryResult;
import org.eclipse.rdf4j.repository.RepositoryConnection;
import org.eclipse.rdf4j.repository.RepositoryException;

import com.github.jknack.handlebars.Handlebars;
import com.github.jknack.handlebars.Options;
import com.metaphacts.api.sparql.SparqlOperationBuilder;
import com.metaphacts.templates.TemplateContext;

/**

 * @author Johannes Trame <jt@metaphacts.com>
 *
 */
public class SingleValueFromSelectSource {

    private static final Logger logger = LogManager.getLogger(SingleValueFromSelectSource.class);

    public String singleValueFromSelect(String param0, Options options) throws IOException {
        TemplateContext context =  (TemplateContext) options.context.model();
        String queryString = checkNotNull(param0,"Query string must not be null.");
        String bindingVariable = options.hash("binding");
        
        try (RepositoryConnection con = context.getRepository().getConnection()) {
            SparqlOperationBuilder<Operation> tqb = HelperUtil.contextualizeSparqlOperation(SparqlOperationBuilder.create(queryString), context);
            context.getNamespaceRegistry().map( ns -> tqb.setNamespaces(ns.getPrefixMap()));
            Operation op = tqb.build(con);
            if(!(op instanceof TupleQuery))
                throw new IllegalArgumentException("Only SPARQL SELECT queries are supported in \""+options.helperName+"\" template helper.");
            
                logger.trace("Evaluating SPARQL SELECT in {} Template Helper: {}", options.helperName, queryString);
                try(TupleQueryResult tqr= ((TupleQuery)op).evaluate()){
                    if(!StringUtils.isEmpty(bindingVariable) && !tqr.getBindingNames().contains(bindingVariable)){
                        throw new IllegalArgumentException("Binding variable "+bindingVariable+" does not exist in query result.");
                    }
                    if(StringUtils.isEmpty(bindingVariable)){
                        bindingVariable = tqr.getBindingNames().get(0);
                    }
                    
                    // workaround, we need to iterate over the result entirely otherwise sesame will throw exception
                    // info.aduna.io.UncloseableInputStream.doClose(UncloseableInputStream.java:45)
                    // at org.eclipse.rdf4j.query.resultio.sparqlxml.AbstractSPARQLXMLParser.parseQueryResultInternal(AbstractSPARQLXMLParser.java:155)
                    String stringValue = null;
                    while(tqr.hasNext()){
                        BindingSet b = tqr.next();
                        
                        Value v = b.getValue(bindingVariable);
                        if(v !=null && stringValue == null){
                            //TODO check whether this is safe enough or even to restrictive
                            stringValue = new Handlebars.SafeString(StringEscapeUtils.escapeHtml4(v.stringValue())).toString();
                        }
                       
                    }
                   return stringValue != null ? stringValue : "";
                }
        } catch (RepositoryException e) {
            throw new RuntimeException("Repository Exception while evaluating query in \""+options.helperName+"\" template helper: "+queryString, e);
        } catch (MalformedQueryException e) {
            throw new IllegalArgumentException("Malformed Query in \""+options.helperName+"\" template helper: "+queryString, e);
        } catch (QueryEvaluationException e) {
            throw new RuntimeException("Error while evaluating query in \""+options.helperName+"\" template helper: "+queryString, e);
        }
    }
}