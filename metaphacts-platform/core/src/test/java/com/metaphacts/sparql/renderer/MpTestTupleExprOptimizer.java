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

import java.util.ArrayList;
import java.util.List;

import org.eclipse.rdf4j.query.BindingSet;
import org.eclipse.rdf4j.query.Dataset;
import org.eclipse.rdf4j.query.algebra.Join;
import org.eclipse.rdf4j.query.algebra.QueryModelNode;
import org.eclipse.rdf4j.query.algebra.TupleExpr;
import org.eclipse.rdf4j.query.algebra.evaluation.QueryOptimizer;
import org.eclipse.rdf4j.query.algebra.helpers.AbstractQueryModelVisitor;
import org.eclipse.rdf4j.sail.federation.algebra.NaryJoin;

public class MpTestTupleExprOptimizer implements QueryOptimizer {

    protected class JoinVisitor extends AbstractQueryModelVisitor<RuntimeException> {

        @Override
        public void meetOther(QueryModelNode node) throws RuntimeException {
            if (node instanceof NaryJoin) {
                meetJoin((NaryJoin) node);
            } else {
                super.meetOther(node);
            }
        }

        @Override
        public void meet(Join node) throws RuntimeException {
            meetJoin(node);
        }

        public void meetJoin(TupleExpr node) {
            List<TupleExpr> joinArgs = getJoinArgs(node, new ArrayList<TupleExpr>());

            if (joinArgs.size() > 2) {
                TupleExpr replacement = new NaryJoin(joinArgs);
                if (node != MpTestTupleExprOptimizer.this.getOptimized()) {
                    node.replaceWith(replacement);
                } else {
                    MpTestTupleExprOptimizer.this.setOptimized(replacement);
                }
                
            }
        }

        protected <L extends List<TupleExpr>> L getJoinArgs(TupleExpr tupleExpr, L joinArgs) {
            if (tupleExpr instanceof NaryJoin) {
                NaryJoin join = (NaryJoin) tupleExpr;
                for (TupleExpr arg : join.getArgs()) {
                    getJoinArgs(arg, joinArgs);
                }
            } else if (tupleExpr instanceof Join) {
                Join join = (Join) tupleExpr;
                getJoinArgs(join.getLeftArg(), joinArgs);
                getJoinArgs(join.getRightArg(), joinArgs);
            } else {
                joinArgs.add(tupleExpr);
            }

            return joinArgs;
        }

    }
    
    protected TupleExpr optimized;

    public MpTestTupleExprOptimizer() {

    }

    @Override
    public void optimize(TupleExpr tupleExpr, Dataset dataset, BindingSet bindings) {
        optimized = tupleExpr;
        tupleExpr.visit(new JoinVisitor());
    }

    public TupleExpr getOptimized() {
        return optimized;
    }

    protected void setOptimized(TupleExpr optimized) {
        this.optimized = optimized;
    }

    
    
}
