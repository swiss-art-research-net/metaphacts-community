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

import static org.eclipse.rdf4j.model.util.Values.iri;

import org.eclipse.rdf4j.model.IRI;

/**
 * Additional DASH properties and values.
 * 
 * @author Wolfgang Schell <ws@metaphacts.com>
 * @see http://datashapes.org/propertyroles.html
 */
public class DASH extends org.eclipse.rdf4j.model.vocabulary.DASH {
    public static final IRI propertyRole = iri(NAMESPACE + "propertyRole");
    public static final IRI KeyInfoRole = iri(NAMESPACE + "KeyInfoRole");
    public static final IRI IDRole = iri(NAMESPACE + "IDRole");
    public static final IRI LabelRole = iri(NAMESPACE + "LabelRole");
    public static final IRI DescriptionRole = iri(NAMESPACE + "DescriptionRole");
    public static final IRI DepictionRole = iri(NAMESPACE + "DepictionRole");
    public static final IRI IconRole = iri(NAMESPACE + "IconRole");
}
