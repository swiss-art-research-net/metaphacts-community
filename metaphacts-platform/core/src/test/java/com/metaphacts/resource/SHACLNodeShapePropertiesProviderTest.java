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

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.is;
import static org.junit.Assert.assertFalse;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import javax.inject.Inject;

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.vocabulary.FOAF;
import org.eclipse.rdf4j.model.vocabulary.RDFS;
import org.eclipse.rdf4j.repository.Repository;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;

import com.google.inject.Injector;
import com.metaphacts.junit.AbstractRepositoryBackedIntegrationTest;

public class SHACLNodeShapePropertiesProviderTest extends AbstractRepositoryBackedIntegrationTest
        implements ResourcesTestData {

    private SHACLNodeShapePropertiesProvider provider;

    @Inject
    private Injector injector;

    @Before
    public void setUp() throws Exception {
        this.provider = new SHACLNodeShapePropertiesProvider();
        injector.injectMembers(this.provider);

        // load test data
        addStatementsFromResources(TEST_ONTOLOGY_FILE, TEST_DATA_FILE);
    }

    @Test
    public void testDescriptionProperties_NormalUse() throws Exception {
        Repository repository = repositoryRule.getRepository();
        Optional<List<PropertyDescription>> descriptionPropertiesHolder = provider.getDescriptionProperties(repository,
                EXAMPLE_PERSON);
        Assert.assertTrue("There should be description properties for type ex:Person",
                descriptionPropertiesHolder.isPresent());
        List<PropertyDescription> descriptionProperties = descriptionPropertiesHolder.get();
        assertFalse("description properties should not be empty", descriptionProperties.isEmpty());
        List<String> descriptionPropertyNames = descriptionProperties.stream().map(prop -> prop.getProjectionName())
                .collect(Collectors.toList());
        List<IRI> descriptionPropertyIRIs = descriptionProperties.stream().map(prop -> prop.getPropertyIRI())
                .collect(Collectors.toList());
        String[] expectedDescriptionPropertyNames = { "dateOfBirth", "dateOfDeath", "occupation", "placeOfBirth",
                "marriedTo" };
        IRI[] expectedDescriptionPropertyIRIs = { EXAMPLE_OCCUPATION, EXAMPLE_DEATHDATE, EXAMPLE_BIRTHDATE,
                EXAMPLE_BIRTHPLACE, EXAMPLE_MARRIEDTO };
        assertThat(descriptionProperties.size(), is(equalTo(expectedDescriptionPropertyNames.length)));
        assertThat(descriptionPropertyNames, containsInAnyOrder(expectedDescriptionPropertyNames));
        assertThat(descriptionPropertyIRIs, containsInAnyOrder(expectedDescriptionPropertyIRIs));
    }

    @Test
    public void testDescriptionProperties_ImplicitTargetClass() throws Exception {
        Repository repository = repositoryRule.getRepository();
        Optional<List<PropertyDescription>> descriptionPropertiesHolder = provider.getDescriptionProperties(repository,
                EXAMPLE_PROJECT);
        Assert.assertTrue("There should be description properties for type ex:Project",
                descriptionPropertiesHolder.isPresent());
        List<PropertyDescription> descriptionProperties = descriptionPropertiesHolder.get();
        assertFalse("description properties should not be empty", descriptionProperties.isEmpty());
        List<String> descriptionPropertyNames = descriptionProperties.stream().map(prop -> prop.getProjectionName())
                .collect(Collectors.toList());
        List<IRI> descriptionPropertyIRIs = descriptionProperties.stream().map(prop -> prop.getPropertyIRI())
                .collect(Collectors.toList());
        String[] expectedDescriptionPropertyNames = { "belongsTo", "label" };
        IRI[] expectedDescriptionPropertyIRIs = { EXAMPLE_BELONGSTO, RDFS.LABEL };
        assertThat(descriptionProperties.size(), is(equalTo(expectedDescriptionPropertyNames.length)));
        assertThat(descriptionPropertyNames, containsInAnyOrder(expectedDescriptionPropertyNames));
        assertThat(descriptionPropertyIRIs, containsInAnyOrder(expectedDescriptionPropertyIRIs));
    }

    @Test
    public void testDescriptionProperties_NothingDefined() throws Exception {
        Repository repository = repositoryRule.getRepository();
        Optional<List<PropertyDescription>> descriptionPropertiesHolder = provider.getDescriptionProperties(repository,
                FOAF.PERSON);
        Assert.assertTrue("There should be no description properties for type foad:Person",
                descriptionPropertiesHolder.isEmpty());
    }
}
