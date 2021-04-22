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
package com.metaphacts.resource;

import static org.eclipse.rdf4j.model.util.Values.iri;

import org.eclipse.rdf4j.model.IRI;

/**
 * Shared test data for {@link ResourceDescriptionService} and related
 * components.
 * 
 * @author Wolfgang Schell <ws@metaphacts.com>
 */
public interface ResourcesTestData {
    static final String EXAMPLE_NS = "http://example.org/";
    static final IRI EXAMPLE_PERSON = iri(EXAMPLE_NS + "Person");
    static final IRI EXAMPLE_EMPLOYEE = iri(EXAMPLE_NS + "Employee");
    static final IRI EXAMPLE_MANAGER = iri(EXAMPLE_NS + "Manager");
    static final IRI EXAMPLE_PROJECT = iri(EXAMPLE_NS + "Project");
    static final IRI EXAMPLE_ORGANIZATION = iri(EXAMPLE_NS + "Organization");
    static final IRI ALICE = iri(EXAMPLE_NS + "Alice");
    static final IRI BOB = iri(EXAMPLE_NS + "Bob");
    static final IRI CHARLIE = iri(EXAMPLE_NS + "Charlie");
    static final IRI DONALD = iri(EXAMPLE_NS + "Donald");

    static final IRI EXAMPLE_OCCUPATION = iri(EXAMPLE_NS + "occupation");
    static final IRI EXAMPLE_DEATHDATE = iri(EXAMPLE_NS + "dateOfDeath");
    static final IRI EXAMPLE_BIRTHDATE = iri(EXAMPLE_NS + "dateOfBirth");
    static final IRI EXAMPLE_PLACEOFBIRTH = iri(EXAMPLE_NS + "placeOfBirth");
    static final IRI EXAMPLE_PLACEOFDEATH = iri(EXAMPLE_NS + "placeOfDeath");
    static final IRI EXAMPLE_MARRIEDTO = iri(EXAMPLE_NS + "marriedTo");
    static final IRI EXAMPLE_BELONGSTO = iri(EXAMPLE_NS + "belongsTo");
    static final IRI EXAMPLE_HASHOBBY = iri(EXAMPLE_NS + "hasHobby");
    static final IRI EXAMPLE_HASPREFERREDICECREAMFLAVOR = iri(EXAMPLE_NS + "hasPreferredIcecreamFlavor");

    static final IRI EXAMPLE_WORKSFOR = iri(EXAMPLE_NS + "worksFor");
    static final IRI EXAMPLE_HASPROJECT = iri(EXAMPLE_NS + "hasProject");
    static final IRI EXAMPLE_HASTEAMMEMBER = iri(EXAMPLE_NS + "hasTeamMember");

    public static final String LANG = "en";

    public static final String TEST_ONTOLOGY_FILE = "test-ontology.ttl";
    public static final String TEST_DATA_FILE = "test-data.ttl";

}
