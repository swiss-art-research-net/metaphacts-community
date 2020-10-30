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
package com.metaphacts.sparql.keyword.algebra;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.eclipse.rdf4j.query.algebra.OrderElem;
import org.eclipse.rdf4j.query.algebra.QueryModelVisitor;
import org.eclipse.rdf4j.query.algebra.TupleExpr;
import org.eclipse.rdf4j.query.algebra.Var;
import org.eclipse.rdf4j.sail.federation.algebra.AbstractNaryTupleOperator;

import com.google.common.collect.Lists;
import com.google.common.collect.Sets;

/**
 * A SPARQL algebra element that represents a keyword-search clause in a 
 * backend-independent way. 
 * Rendering as the actual set of SPARQL expressions will have to be realized depending on the 
 * processing triple store.
 * The parameters of the keyword search are expressed using {@link KeywordSearchPattern}. 
 * 
 * @author Andriy Nikolov <an@metaphacts.com>
 *
 */
public class KeywordSearchGroupTupleExpr extends AbstractNaryTupleOperator implements TupleExpr {

    private static final long serialVersionUID = -8532042481359321563L;
    private KeywordSearchPattern keywordSearchPattern;
    
    protected List<OrderElem> orderElements = Lists.newArrayList();
    
    protected long limit = -1;
    
    public KeywordSearchPattern getKeywordSearchPattern() {
        return keywordSearchPattern;
    }

    public void setKeywordSearchPattern(KeywordSearchPattern keywordSearchPattern) {
        this.keywordSearchPattern = keywordSearchPattern;
    }

    @Override
    public <X extends Exception> void visit(QueryModelVisitor<X> visitor) throws X {
        visitor.meetOther(this);
    }

    @Override
    public Set<String> getBindingNames() {
        return getAssuredBindingNames();
    }

    @Override
    public Set<String> getAssuredBindingNames() {
        Set<String> assuredBindings = Sets.newHashSet();
        if (keywordSearchPattern.getSubjectVar() != null 
                && !keywordSearchPattern.getSubjectVar().hasValue()) {
            assuredBindings.add(keywordSearchPattern.getSubjectVar().getName());
        }
        if (keywordSearchPattern.getScoreVar() != null 
                && !keywordSearchPattern.getScoreVar().hasValue()) {
            assuredBindings.add(keywordSearchPattern.getScoreVar().getName());
        }
        
        return assuredBindings;
    }
    
    protected <X extends Exception> void visitIfNotNull(
            Var var, QueryModelVisitor<X> visitor) throws X {
        if ( var != null) {
            var.visit(visitor);
        }
    }

    @Override
    public <X extends Exception> void visitChildren(QueryModelVisitor<X> visitor) throws X {
        if (keywordSearchPattern == null) {
            return;
        }
        visitIfNotNull(keywordSearchPattern.getSubjectVar(), visitor);
        for (Var predicateVar : keywordSearchPattern.getPredicateVars()) {
            predicateVar.visit(visitor);
        }
        visitIfNotNull(keywordSearchPattern.getMatchVar(), visitor);
        visitIfNotNull(keywordSearchPattern.getValueVar(), visitor);
        visitIfNotNull(keywordSearchPattern.getScoreVar(), visitor);
        visitIfNotNull(keywordSearchPattern.getSnippetVar(), visitor);
        for (Var typeVar : keywordSearchPattern.getTypeVars()) {
            typeVar.visit(visitor);
        }
        
        super.visitChildren(visitor);
    }

    @Override
    public KeywordSearchGroupTupleExpr clone() {
        KeywordSearchGroupTupleExpr cloned = new KeywordSearchGroupTupleExpr();
        cloned.keywordSearchPattern = this.keywordSearchPattern.clone();
        cloned.orderElements = orderElements.stream().map(
            elem -> elem.clone()).collect(Collectors.toList());
        cloned.limit = limit;
        return cloned;
    }
    
    /**
     * @return the limit
     */
    public long getLimit() {
        return limit;
    }

    /**
     * @param limit the limit to set
     */
    public void setLimit(long limit) {
        this.limit = limit;
    }
    
    public List<OrderElem> getOrderElements() {
        return orderElements;
    }
}