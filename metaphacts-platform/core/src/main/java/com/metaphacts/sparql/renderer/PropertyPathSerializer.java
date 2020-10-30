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
package com.metaphacts.sparql.renderer;

import java.util.Stack;

import org.eclipse.rdf4j.query.algebra.ArbitraryLengthPath;
import org.eclipse.rdf4j.query.algebra.ExtensionElem;
import org.eclipse.rdf4j.query.algebra.Join;
import org.eclipse.rdf4j.query.algebra.StatementPattern;
import org.eclipse.rdf4j.query.algebra.Union;
import org.eclipse.rdf4j.query.algebra.Var;
import org.eclipse.rdf4j.query.algebra.ZeroLengthPath;
import org.eclipse.rdf4j.query.algebra.helpers.AbstractQueryModelVisitor;

public class PropertyPathSerializer extends AbstractQueryModelVisitor<RuntimeException> {

    protected StringBuilder builder;
    protected Stack<Var> currentSubjectVarStack = new Stack<Var>();
    protected AbstractSerializableParsedQuery currentQueryProfile;

    public String serialize(ArbitraryLengthPath path, AbstractSerializableParsedQuery currentQueryProfile) {
        this.builder = new StringBuilder();
        this.currentQueryProfile = currentQueryProfile;
        
        Var subjVar = path.getSubjectVar();
        Var objVar = path.getObjectVar();
        
        if (path.getContextVar() != null) {
            builder.append("GRAPH ");
            path.getContextVar().visit(this);
            builder.append(" {");
        }
        subjVar.visit(this);
        builder.append(" ");
        path.visit(this);

        builder.append(" ");
        objVar.visit(this);
        builder.append(" .");
        if (path.getContextVar() != null) {
            builder.append(" }");
        }
        builder.append(" \n");
        return this.builder.toString().trim();
    }

    @Override
    public void meet(ArbitraryLengthPath node) throws RuntimeException {
        currentSubjectVarStack.push(node.getSubjectVar());
        builder.append("(");
        node.getPathExpression().visit(this);
        builder.append(")");
        if (node.getMinLength() == 0) {
            builder.append("*");
        } else {
            builder.append("+");
        }
        currentSubjectVarStack.pop();
        // super.meet(node);
    }

    @Override
    public void meet(Join node) throws RuntimeException {
        builder.append("(");
        node.getLeftArg().visit(this);
        builder.append("/");
        node.getRightArg().visit(this);
        builder.append(")");
    }

    @Override
    public void meet(Union node) throws RuntimeException {
        Var currentSubjectVar = currentSubjectVarStack.peek();
        boolean containsZeroLength = (node.getLeftArg() instanceof ZeroLengthPath);
        if (!containsZeroLength) {
            builder.append("(");
        }
        currentSubjectVarStack.push(currentSubjectVar);
        Var currentObjectVarLeft, currentObjectVarRight;
        node.getLeftArg().visit(this);
        currentObjectVarLeft = currentSubjectVarStack.pop();
        if (!containsZeroLength) {
            builder.append("|");
        }
        currentSubjectVarStack.push(currentSubjectVar);
        node.getRightArg().visit(this);
        currentObjectVarRight = currentSubjectVarStack.pop();
        if (!currentObjectVarLeft.getName().equals(currentObjectVarRight.getName())) {
            throw new RuntimeException(
                    "Error while processing a Union node: "
                    + "object variables for left and right operands are not the same: "
                            + node.toString());
        }
        if (!containsZeroLength) {
            builder.append(")");
        } else {
            builder.append("?");
        }
        currentSubjectVarStack.push(currentObjectVarLeft);
    }

    @Override
    public void meet(StatementPattern node) throws RuntimeException {
        Var subjVar = currentSubjectVarStack.pop();

        Var predicate = node.getPredicateVar();
        if (subjVar.getName().equals(node.getObjectVar().getName())) {
            builder.append("^");
            currentSubjectVarStack.push(node.getSubjectVar());
        } else {
            currentSubjectVarStack.push(node.getObjectVar());
        }

        if (predicate.hasValue()) {
            MpSparqlQueryRendererUtils.writeAsSparqlValue(node.getPredicateVar().getValue(),
                    builder, true);
        } else {
            builder.append("?");
            builder.append(predicate.getName());
        }
    }

    @Override
    public void meet(Var node) throws RuntimeException {
        if (node.hasValue()) {
            MpSparqlQueryRendererUtils.writeAsSparqlValue(node.getValue(), builder, true);
        } else {
            if (node.isAnonymous()) { 
                if (currentQueryProfile.extensionElements.containsKey(node.getName())) {
                    ExtensionElem elem = currentQueryProfile.extensionElements.get(node.getName());
                    elem.getExpr().visit(this); 
                } else {
                    builder.append("_:");
                    builder.append(node.getName());
                }
            } else {
                builder.append("?");
                builder.append(node.getName());
            }
        }

        super.meet(node);
    }

    @Override
    public void meet(ZeroLengthPath node) throws RuntimeException {
        Var subjVar = currentSubjectVarStack.pop();
        currentSubjectVarStack.push(node.getObjectVar());
        
    }
}
