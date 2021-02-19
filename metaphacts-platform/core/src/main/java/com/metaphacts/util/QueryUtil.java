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
package com.metaphacts.util;

import org.eclipse.rdf4j.model.Value;
import org.eclipse.rdf4j.query.algebra.TupleExpr;
import org.eclipse.rdf4j.query.parser.ParsedOperation;
import org.eclipse.rdf4j.repository.sparql.query.QueryStringUtil;

import com.metaphacts.sparql.renderer.MpSparqlQueryRenderer;

/**
 * Utility functions for rendering RDF4J algebra objects and model values as SPARQL strings.
 *
 * @author Jeen Broekstra <jb@metaphacts.com>
 */
@SuppressWarnings("deprecation")
public class QueryUtil {

    /**
     * render the supplied {@link TupleExpr} as a SPARQL string.
     *
     * @param value the value to render
     * @return a SPARQL string representation of the supplied {@link TupleExpr}
     */
    public static String toSPARQL(TupleExpr tupleExpression) throws Exception {
        return new MpSparqlQueryRenderer().render(tupleExpression);
    }

    /**
     * render the supplied {@link ParsedOperation} as a SPARQL string.
     *
     * @param value the value to render
     * @return a SPARQL string representation of the supplied {@link ParsedOperation}.
     */
    public static String toSPARQL(ParsedOperation operation) throws Exception {
        return new MpSparqlQueryRenderer().render(operation);
    }

    /**
     * render the supplied {@link Value} as a SPARQL string.
     *
     * @param value the value to render
     * @return a SPARQL string representation of the supplied value (e.g.
     *         &lt;http://example.org/&gt; in case of an IRI)
     * @throws IllegalArgumentException if Value is a BNode
     */
    public static String toSPARQL(Value value) {
        return QueryStringUtil.valueToString(value);
    }
}
