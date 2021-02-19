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
 * <p>
 * Vocabulary for Web Annotation Data Model (previously Open Annotation).
 * </p>
 * Prefix:<br/>
 *  {@code oa: <http://www.w3.org/ns/oa#>}
 *
 * @see http://www.w3.org/TR/annotation-model/
 * 
 * @author ArtemKozlov <ak@metaphacts.com>
 */
public class OA {

    public static String NAMESPACE = "http://www.w3.org/ns/oa#";

    public static final IRI ANNOTATION_CLASS;

    public static final IRI HAS_BODY_PROPERTY;
    public static final IRI HAS_SOURCE_PROPERTY;
    public static final IRI HAS_TARGET_PROPERTY;
    public static final IRI TEXT_PROPERTY;
    public static final IRI HAS_SELECTOR_PROPERTY;
    public static final IRI SPECIFIC_RESOURCE_CLASS;
    public static final IRI SVG_SELECTOR_CLASS;
    public static final IRI FRAGMENT_SELECTOR_CLASS;

    static {
        ValueFactory f = SimpleValueFactory.getInstance();
        ANNOTATION_CLASS = f.createIRI(NAMESPACE, "Annotation");

        HAS_SOURCE_PROPERTY = f.createIRI(NAMESPACE, "hasSource");
        HAS_BODY_PROPERTY = f.createIRI(NAMESPACE, "hasBody");
        HAS_TARGET_PROPERTY = f.createIRI(NAMESPACE, "hasTarget");
        TEXT_PROPERTY = f.createIRI(NAMESPACE, "text");
        HAS_SELECTOR_PROPERTY = f.createIRI(NAMESPACE, "hasSelector");
        SPECIFIC_RESOURCE_CLASS = f.createIRI(NAMESPACE, "SpecificResource");
        SVG_SELECTOR_CLASS = f.createIRI(NAMESPACE, "SvgSelector");
        FRAGMENT_SELECTOR_CLASS = f.createIRI(NAMESPACE, "FragmentSelector");
    }

}
