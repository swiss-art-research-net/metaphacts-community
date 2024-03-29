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

public class SHACL {
    
    public static final String NAMESPACE = "http://www.w3.org/ns/shacl#";

    public static final IRI declare;
    public static final IRI message;
    public static final IRI namespace;
    public static final IRI nodeValidator;
    public static final IRI prefix;
    public static final IRI prefixes;
    public static final IRI propertyValidator;
    public static final IRI select;
    public static final IRI sparql;
    public static final IRI targetObjectsOf;
    public static final IRI validator;
    
    public static final IRI NodeShape;
    public static final IRI PropertyShape;
    public static final IRI ValidationReport;
    public static final IRI ValidationResult;

    
    static {
        ValueFactory VF = SimpleValueFactory.getInstance();
        
        declare = VF.createIRI(NAMESPACE, "declare");
        message = VF.createIRI(NAMESPACE, "message");
        namespace = VF.createIRI(NAMESPACE, "namespace");
        nodeValidator = VF.createIRI(NAMESPACE, "nodeValidator");
        prefix = VF.createIRI(NAMESPACE, "prefix");
        prefixes = VF.createIRI(NAMESPACE, "prefixes");
        propertyValidator = VF.createIRI(NAMESPACE, "propertyValidator");
        select = VF.createIRI(NAMESPACE, "select");
        sparql = VF.createIRI(NAMESPACE, "sparql");
        targetObjectsOf = VF.createIRI(NAMESPACE, "targetObjectsOf");
        validator = VF.createIRI(NAMESPACE, "validator");
        
        NodeShape = VF.createIRI(NAMESPACE, "NodeShape");
        PropertyShape = VF.createIRI(NAMESPACE, "PropertyShape");
        ValidationReport = VF.createIRI(NAMESPACE, "ValidationReport");
        ValidationResult = VF.createIRI(NAMESPACE, "ValidationResult");
    }
    
    private SHACL() {
        // TODO Auto-generated constructor stub
    }

}
