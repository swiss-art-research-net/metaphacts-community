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
package com.metaphacts.vocabulary;

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;

/**
 * @author ArtemKozlov <ak@metaphacts.com>
 */
public class FIELDS {
    
    public static final String NAMESPACE = "http://www.metaphacts.com/ontology/fields#";

    /**
     * Types
     */
    public static final IRI FIELD_TYPE;

    /**
     * Predicates
     */
    public static final IRI MIN_OCCURS;
    public static final IRI MAX_OCCURS;
    public static final IRI XSD_DATATYPE;
    public static final IRI DOMAIN;
    public static final IRI RANGE;
    public static final IRI DEFAULT_VALUE;
    public static final IRI SELECT_PATTERN;
    public static final IRI INSERT_PATTERN;
    public static final IRI DELETE_PATTERN;
    public static final IRI ASK_PATTERN;
    public static final IRI AUTOSUGGESTION_PATTERN;
    public static final IRI VALUE_SET_PATTERN;
    public static final IRI TREE_PATTERNS;
    public static final IRI ORDERED_WITH;

    public static final IRI INDEX_PROPERTY;

    static {
        ValueFactory vf = SimpleValueFactory.getInstance();
        FIELD_TYPE = vf.createIRI(NAMESPACE, "Field");
        MIN_OCCURS = vf.createIRI(NAMESPACE, "minOccurs");
        MAX_OCCURS = vf.createIRI(NAMESPACE, "maxOccurs");
        XSD_DATATYPE = vf.createIRI(NAMESPACE, "xsdDatatype");
        DOMAIN = vf.createIRI(NAMESPACE, "domain");
        RANGE = vf.createIRI(NAMESPACE, "range");
        DEFAULT_VALUE = vf.createIRI(NAMESPACE, "defaultValue");
        SELECT_PATTERN = vf.createIRI(NAMESPACE, "selectPattern");
        INSERT_PATTERN = vf.createIRI(NAMESPACE, "insertPattern");
        DELETE_PATTERN = vf.createIRI(NAMESPACE, "deletePattern");
        ASK_PATTERN = vf.createIRI(NAMESPACE, "askPattern");
        AUTOSUGGESTION_PATTERN = vf.createIRI(NAMESPACE, "autosuggestionPattern");
        VALUE_SET_PATTERN = vf.createIRI(NAMESPACE, "valueSetPattern");
        TREE_PATTERNS = vf.createIRI(NAMESPACE, "treePatterns");
        ORDERED_WITH = vf.createIRI(NAMESPACE, "orderedWith");
        INDEX_PROPERTY = vf.createIRI(NAMESPACE, "indexProperty");
    }

}
