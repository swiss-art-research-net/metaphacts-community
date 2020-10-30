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
package com.metaphacts.sparql.visitors;

import org.eclipse.rdf4j.model.Value;
import org.eclipse.rdf4j.query.Binding;
import org.eclipse.rdf4j.query.BindingSet;
import org.eclipse.rdf4j.query.algebra.*;
import org.eclipse.rdf4j.query.algebra.helpers.AbstractQueryModelVisitor;
import org.eclipse.rdf4j.query.algebra.helpers.TupleExprs;
import org.eclipse.rdf4j.query.impl.MapBindingSet;
import org.eclipse.rdf4j.query.impl.SimpleBinding;
import org.eclipse.rdf4j.query.parser.ParsedQuery;
import org.eclipse.rdf4j.query.parser.ParsedTupleQuery;

import java.util.*;

/**
 * Rewrites a query to bind values for specified parameters without changing output
 * binding names of the query.
 *
 * <p>Example:</p>
 * <pre><code>
 *     ParsedQuery query = parseQuery("SELECT ?s ?o WHERE { ?s ?p ?o }")
 *     // parameters is a map { "p": IRI("some:iri") }
 *     query.getTupleExpr().visit(new ParametrizeVisitor(parameters))
 *     render(query) // -> "SELECT ?s ?o WHERE { ?s &lt;some:iri&gt; ?p }"
 * </code></pre>
 */
public class ParametrizeVisitor extends AbstractQueryModelVisitor<RuntimeException> {
    private final Map<String, Value> parameters;

    public ParametrizeVisitor(Map<String, Value> parameters) {
        this.parameters = parameters;
    }

    @Override
    public void meet(ProjectionElemList node) throws RuntimeException {
        super.meet(node);

        for (ProjectionElem elem : node.getElements()) {
            String sourceName = elem.getSourceName();
            if (sourceName != null && parameters.containsKey(sourceName)) {
                Value value = parameters.get(sourceName);
                elem.setSourceName(elem.getTargetName());
                elem.setSourceExpression(
                    new ExtensionElem(TupleExprs.createConstVar(value), sourceName)
                );
            }
        }
    }

    @Override
    public void meet(Var node) throws RuntimeException {
        super.meet(node);
        if (!node.isAnonymous() && !node.hasValue()) {
            Value parameter = parameters.get(node.getName());
            if (parameter != null) {
                node.setValue(parameter);
            }
        }
    }
}
