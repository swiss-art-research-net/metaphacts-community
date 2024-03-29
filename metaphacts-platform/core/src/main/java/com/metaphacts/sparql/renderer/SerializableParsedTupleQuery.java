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
package com.metaphacts.sparql.renderer;

import java.util.ArrayList;
import java.util.List;

import org.eclipse.rdf4j.query.algebra.Filter;
import org.eclipse.rdf4j.query.algebra.Group;
import org.eclipse.rdf4j.query.algebra.Order;
import org.eclipse.rdf4j.query.algebra.Projection;
import org.eclipse.rdf4j.query.algebra.ProjectionElem;
import org.eclipse.rdf4j.query.parser.ParsedTupleQuery;

/**
 * The SerializableParsedTupleQuery class is an intermediate structure holding main parts of a query
 * or a subquery: projection, WHERE clause, GROUP BY clause, ORDER BY clause, LIMIT element, HAVING
 * clause, and BINDINGS clause. These fields are extracted from the {@link ParsedTupleQuery} tree,
 * which doesn't follow the structure of a SPARQL query.
 * 
 * @author Andriy Nikolov <an@metaphacts.com>
 */
public class SerializableParsedTupleQuery extends AbstractSerializableParsedQuery {

    public static enum QueryModifier {
        DISTINCT, REDUCED
    }

    public Projection projection = null;
    public Group groupBy = null;
    public Order orderBy = null;
    public Filter having = null;
    public QueryModifier modifier = null;

    public SerializableParsedTupleQuery() {
        super();
    }

    /**
     * Returns the names of the variables projected by this query (as strings).
     * 
     * @return list of projected variable names
     */
    public List<String> getProjectionResultVars() {
        List<String> res = new ArrayList<String>(
                projection.getProjectionElemList().getElements().size());

        for (ProjectionElem elem : projection.getProjectionElemList().getElements()) {
            res.add(elem.getTargetName());
        }

        return res;
    }

}
