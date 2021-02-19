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
package com.metaphacts.sail.rest.graphscope;

import java.io.InputStream;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.model.Statement;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.model.vocabulary.RDF;
import org.eclipse.rdf4j.query.BindingSet;
import org.eclipse.rdf4j.query.algebra.StatementPattern;
import org.eclipse.rdf4j.query.algebra.Var;
import org.eclipse.rdf4j.query.impl.MapBindingSet;
import org.eclipse.rdf4j.rio.RDFFormat;
import org.eclipse.rdf4j.rio.RDFHandler;
import org.eclipse.rdf4j.rio.RDFHandlerException;
import org.eclipse.rdf4j.rio.RDFParser;
import org.eclipse.rdf4j.rio.Rio;
import org.eclipse.rdf4j.rio.helpers.AbstractRDFHandler;
import org.eclipse.rdf4j.sail.SailException;

import com.google.common.collect.Lists;
import com.metaphacts.sail.rest.AbstractRESTWrappingSailConnection;
import com.metaphacts.sail.rest.AbstractServiceWrappingSail;
import com.metaphacts.sail.rest.AbstractServiceWrappingSailConnection;

public class GraphScopeLookupSailConnection extends AbstractRESTWrappingSailConnection {

    private static final ValueFactory VF = SimpleValueFactory.getInstance();

    public static final IRI HAS_KEYWORD = VF.createIRI("http://ns.graphscope.io/hasKeyword");

    public GraphScopeLookupSailConnection(AbstractServiceWrappingSail sailBase) {
        super(sailBase);
    }

    @Override
    protected RESTParametersHolder extractInputsAndOutputs(List<StatementPattern> stmtPatterns)
            throws SailException {
        RESTParametersHolder res = new RESTParametersHolder();

        Optional<StatementPattern> optKeywordPattern = stmtPatterns.stream()
                .filter(stmtPattern -> stmtPattern.getPredicateVar().hasValue()
                        && stmtPattern.getPredicateVar().getValue().equals(HAS_KEYWORD))
                .findFirst();
        if (!optKeywordPattern.isPresent()) {
            throw new SailException(
                    "The search token was not provided, must be passed via the reserved <"
                            + HAS_KEYWORD.stringValue() + "> property.");
        }

        StatementPattern keywordPattern = optKeywordPattern.get();

        if (!keywordPattern.getObjectVar().hasValue()
                || !(keywordPattern.getObjectVar().getValue() instanceof Literal)) {
            throw new SailException("The search token must be provided explicitly as a literal.");
        }

        String keyword = keywordPattern.getObjectVar().getValue().stringValue();
        res.getInputParameters().put("q", keyword);

        Var searchLiteralVar = keywordPattern.getSubjectVar();
        if (searchLiteralVar.hasValue()) {
            throw new SailException(
                    "The subject of <" + HAS_KEYWORD.stringValue() + "> must be a variable.");
        }
        res.getOutputVariables().put(HAS_KEYWORD, searchLiteralVar.getName());

        Optional<StatementPattern> optMainPattern = stmtPatterns.stream()
                .filter(stmtPattern -> stmtPattern.getObjectVar().equals(searchLiteralVar))
                .findFirst();

        if (!optMainPattern.isPresent()) {
            throw new SailException("The search predicate is not provided.");
        }
        StatementPattern mainPattern = optMainPattern.get();
        if (!mainPattern.getPredicateVar().hasValue()) {
            throw new SailException("The search predicate is not provided.");
        }
        res.getInputParameters().put("prop",
                mainPattern.getPredicateVar().getValue().stringValue());

        if (mainPattern.getSubjectVar().hasValue()) {
            throw new SailException("The entity to search for must be a variable.");
        }
        Var subjectVar = mainPattern.getSubjectVar();

        res.setSubjVarName(subjectVar.getName());

        Optional<StatementPattern> optTypePattern = stmtPatterns.stream()
                .filter(stmtPattern -> stmtPattern.getSubjectVar().equals(subjectVar)
                        && stmtPattern.getPredicateVar().hasValue()
                        && stmtPattern.getPredicateVar().getValue().equals(RDF.TYPE)
                        && stmtPattern.getObjectVar().hasValue())
                .findFirst();

        if (optTypePattern.isPresent()) {
            StatementPattern typePattern = optTypePattern.get();
            if (!(typePattern.getObjectVar().getValue() instanceof IRI)) {
                throw new SailException("Provided type must be an IRI");
            }
            res.getInputParameters().put("type",
                    typePattern.getObjectVar().getValue().stringValue());
        }

        return res;
    }

    @Override
    protected Collection<BindingSet> convertStream2BindingSets(InputStream inputStream,
            RESTParametersHolder parametersHolder) throws SailException {
        
        RDFParser parser = Rio.createParser(RDFFormat.NTRIPLES);
        
        String subjectVarName = parametersHolder.getSubjVarName();
        String searchLiteralVarName = parametersHolder.getOutputVariables().get(HAS_KEYWORD);
        List<BindingSet> resultSet = Lists.newArrayList();
        
        RDFHandler handler = new AbstractRDFHandler() {

            @Override
            public void handleStatement(Statement st) throws RDFHandlerException {
                MapBindingSet bs = new MapBindingSet();
                bs.addBinding(subjectVarName, st.getSubject());
                bs.addBinding(searchLiteralVarName, st.getObject());
                resultSet.add(bs);
            }
            
        };
        
        parser.setRDFHandler(handler);
        try {
            parser.parse(inputStream, "");
            return resultSet;
        } catch (Exception e) {
            throw new SailException(e);
        }
    }

    @Override
    public boolean pendingRemovals() {
        return false;
    }
    
}
