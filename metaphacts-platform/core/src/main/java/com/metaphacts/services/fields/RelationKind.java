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
package com.metaphacts.services.fields;

import com.metaphacts.vocabulary.XsdUtils;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.semarglproject.vocab.RDFS;
import org.semarglproject.vocab.XSD;

import javax.annotation.Nullable;

enum RelationKind {
    Resource("resource", null),
    Literal("literal", RDFS.LITERAL),
    Date("date-range", XSD.DATE),
    Numeric("numeric-range", XSD.DECIMAL);

    public final String searchKind;
    public final IRI rangeCategory;

    RelationKind(String searchKind, @Nullable String rangeCategoryIri) {
        this.searchKind = searchKind;
        this.rangeCategory = rangeCategoryIri == null
            ? null : SimpleValueFactory.getInstance().createIRI(rangeCategoryIri);
    }

    public static RelationKind fromFieldDatatype(String fieldId, String xsdDatatype) {
        if (xsdDatatype == null) {
            throw new RuntimeException("Field " + fieldId + " has unknown datatype!");
        } else if (XSD.ANY_URI.equals(xsdDatatype)) {
            return RelationKind.Resource;
        } else if (XsdUtils.isDateOrTimeDatatype(xsdDatatype)) {
            return RelationKind.Date;
        } else if (XsdUtils.isNumericDatatype(xsdDatatype)) {
            return RelationKind.Numeric;
        } else {
            return RelationKind.Literal;
        }
    }
}
