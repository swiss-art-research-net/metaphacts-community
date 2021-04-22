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
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.Set;
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
import com.metaphacts.vocabulary.DASH;

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

        Optional<List<PropertyDescription>> descriptionPropertiesHolder = provider.getPropertiesForRole(repository,
                EXAMPLE_PERSON, DASH.DescriptionRole);
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
                EXAMPLE_PLACEOFBIRTH, EXAMPLE_MARRIEDTO };
        assertThat(descriptionProperties.size(), is(equalTo(expectedDescriptionPropertyNames.length)));
        assertThat(descriptionPropertyNames, containsInAnyOrder(expectedDescriptionPropertyNames));
        assertThat(descriptionPropertyIRIs, containsInAnyOrder(expectedDescriptionPropertyIRIs));

        Optional<PropertyDescription> occupationProperty = descriptionProperties.stream().filter(prop -> EXAMPLE_OCCUPATION.equals(prop.getPropertyIRI()))
                .findFirst();
        assertTrue("There should be a description property ex:occupation for type ex:Person",
                occupationProperty.isPresent());
        assertEquals("description property for ex:occupation should have a projection variable name 'occupation'",
                "occupation", occupationProperty.get().getProjectionName());
    }

    @Test
    public void testProperties_NormalUse() throws Exception {
        Repository repository = repositoryRule.getRepository();

        Optional<List<PropertyDescription>> propertiesHolder = provider.getProperties(repository, EXAMPLE_PERSON);
        Assert.assertTrue("There should be properties for type ex:Person", propertiesHolder.isPresent());
        List<PropertyDescription> properties = propertiesHolder.get();
        assertFalse("properties should not be empty", properties.isEmpty());
        IRI[] expectedPropertyIRIs = { RDFS.LABEL, EXAMPLE_BIRTHDATE, EXAMPLE_DEATHDATE,
                EXAMPLE_OCCUPATION, EXAMPLE_HASHOBBY, EXAMPLE_PLACEOFBIRTH, EXAMPLE_MARRIEDTO, EXAMPLE_PLACEOFDEATH,
                EXAMPLE_HASPREFERREDICECREAMFLAVOR };
        List<IRI> propertyIRIs = properties.stream().map(prop -> prop.getPropertyIRI()).collect(Collectors.toList());
        assertThat(properties.size(), is(equalTo(expectedPropertyIRIs.length)));
        assertThat(propertyIRIs, containsInAnyOrder(expectedPropertyIRIs));

        // additional property roles
        Optional<List<PropertyDescription>> labelPropertiesHolder = provider.getPropertiesForRole(repository,
                EXAMPLE_PERSON, DASH.LabelRole);
        Assert.assertTrue("There should be label properties for type ex:Person", labelPropertiesHolder.isPresent());
        List<PropertyDescription> labelProperties = labelPropertiesHolder.get();
        assertFalse("label properties should not be empty", labelProperties.isEmpty());
        List<IRI> labelPropertyIRIs = labelProperties.stream().map(prop -> prop.getPropertyIRI())
                .collect(Collectors.toList());
        IRI[] expectedLabelPropertyIRIs = { RDFS.LABEL };
        assertThat(labelProperties.size(), is(equalTo(expectedLabelPropertyIRIs.length)));
        assertThat(labelPropertyIRIs, containsInAnyOrder(expectedLabelPropertyIRIs));

        Optional<List<PropertyDescription>> keyInfoPropertiesHolder = provider.getPropertiesForRole(repository,
                EXAMPLE_PERSON, DASH.KeyInfoRole);
        Assert.assertTrue("There should be keyInfo properties for type ex:Person", keyInfoPropertiesHolder.isPresent());
        List<PropertyDescription> keyInfoProperties = keyInfoPropertiesHolder.get();
        assertFalse("keyInfo properties should not be empty", keyInfoProperties.isEmpty());
        List<IRI> keyInfoPropertyIRIs = keyInfoProperties.stream().map(prop -> prop.getPropertyIRI())
                .collect(Collectors.toList());
        IRI[] expectedKeyInfoPropertyIRIs = { EXAMPLE_OCCUPATION };
        assertThat(keyInfoProperties.size(), is(equalTo(expectedKeyInfoPropertyIRIs.length)));
        assertThat(keyInfoPropertyIRIs, containsInAnyOrder(expectedKeyInfoPropertyIRIs));

        // this property should have two roles
        PropertyDescription propertyDescription = keyInfoProperties.get(0);
        Set<IRI> propertyRoles = propertyDescription.getPropertyRoles();
        assertNotNull(propertyRoles);
        IRI[] expectedPropertyRoles = { DASH.DescriptionRole, DASH.KeyInfoRole };
        assertThat(propertyRoles, containsInAnyOrder(expectedPropertyRoles));
    }

    @Test
    public void testProperties_ProjectionVariables() throws Exception {
        Repository repository = repositoryRule.getRepository();

        Optional<List<PropertyDescription>> propertiesHolder = provider.getProperties(repository, EXAMPLE_PERSON);
        Assert.assertTrue("There should be properties for type ex:Person", propertiesHolder.isPresent());
        List<PropertyDescription> properties = propertiesHolder.get();

        Optional<PropertyDescription> hasHobby = findPropertyDescription(properties, EXAMPLE_HASHOBBY);
        assertTrue(hasHobby.isPresent());
        assertNull("ex:hasHobby should not have a projetcion variable name (invalid name provided in ontology)",
                hasHobby.get().getProjectionName());

        Optional<PropertyDescription> placeOfDeath = findPropertyDescription(properties, EXAMPLE_PLACEOFDEATH);
        assertTrue(placeOfDeath.isPresent());
        assertEquals("ex:placeOfDeath should have the property's local name as projection variable name",
                EXAMPLE_PLACEOFDEATH.getLocalName(), placeOfDeath.get().getProjectionName());

        Optional<PropertyDescription> hasPreferredIcecreamFlavor = findPropertyDescription(properties,
                EXAMPLE_HASPREFERREDICECREAMFLAVOR);
        assertTrue(hasPreferredIcecreamFlavor.isPresent());
        assertEquals(
                "ex:hasPreferredIcecreamFlavor should have a name other then the property's local name as projection variable name",
                "preferredIcecreamFlavor", hasPreferredIcecreamFlavor.get().getProjectionName());
    }

    @Test
    public void testProperties_SubClassProperties() throws Exception {
        Repository repository = repositoryRule.getRepository();

        // properties for ex:Person
        Optional<List<PropertyDescription>> personPropertiesHolder = provider.getProperties(repository, EXAMPLE_PERSON);
        Assert.assertTrue("There should be properties for type ex:Person", personPropertiesHolder.isPresent());
        List<PropertyDescription> personProperties = personPropertiesHolder.get();
        assertFalse("properties should not be empty", personProperties.isEmpty());
        List<IRI> expectedPersonPropertyIRIs = Arrays.asList(RDFS.LABEL, EXAMPLE_BIRTHDATE, EXAMPLE_DEATHDATE,
                EXAMPLE_OCCUPATION, EXAMPLE_HASHOBBY, EXAMPLE_PLACEOFBIRTH, EXAMPLE_MARRIEDTO, EXAMPLE_PLACEOFDEATH,
                EXAMPLE_HASPREFERREDICECREAMFLAVOR);
        List<IRI> personPropertyIRIs = personProperties.stream().map(prop -> prop.getPropertyIRI())
                .collect(Collectors.toList());
        assertThat(personPropertyIRIs, containsInAnyOrder(expectedPersonPropertyIRIs.toArray()));
        assertThat(personProperties.size(), is(equalTo(expectedPersonPropertyIRIs.size())));

        // properties for ex:Employee (should contain those of ex:Person as well!)
        Optional<List<PropertyDescription>> employeePropertiesHolder = provider.getProperties(repository,
                EXAMPLE_EMPLOYEE);
        Assert.assertTrue("There should be properties for type ex:Employee", employeePropertiesHolder.isPresent());
        List<PropertyDescription> employeeProperties = employeePropertiesHolder.get();
        assertFalse("properties should not be empty", employeeProperties.isEmpty());
        List<IRI> expectedEmployeePropertyIRIs = new ArrayList<>();
        expectedEmployeePropertyIRIs.addAll(Arrays.asList(EXAMPLE_HASPROJECT, EXAMPLE_WORKSFOR));
        expectedEmployeePropertyIRIs.addAll(expectedPersonPropertyIRIs);
        List<IRI> employeePropertyIRIs = employeeProperties.stream().map(prop -> prop.getPropertyIRI())
                .collect(Collectors.toList());
        assertThat(employeePropertyIRIs, containsInAnyOrder(expectedEmployeePropertyIRIs.toArray()));
        assertThat(employeeProperties.size(), is(equalTo(expectedEmployeePropertyIRIs.size())));

        // properties for ex:Manager (should contain those of ex:Person and ex:Employee as well!)
        Optional<List<PropertyDescription>> managerPropertiesHolder = provider.getProperties(repository,
                EXAMPLE_MANAGER);
        Assert.assertTrue("There should be properties for type ex:Manager", managerPropertiesHolder.isPresent());
        List<PropertyDescription> managerProperties = managerPropertiesHolder.get();
        assertFalse("properties should not be empty", managerProperties.isEmpty());
        List<IRI> expectedManagerPropertyIRIs = new ArrayList<>();
        expectedManagerPropertyIRIs.add(EXAMPLE_HASTEAMMEMBER);
        expectedManagerPropertyIRIs.addAll(expectedEmployeePropertyIRIs);
        List<IRI> managerPropertyIRIs = managerProperties.stream().map(prop -> prop.getPropertyIRI())
                .collect(Collectors.toList());
        assertThat(managerPropertyIRIs, containsInAnyOrder(expectedManagerPropertyIRIs.toArray()));
        assertThat(managerProperties.size(), is(equalTo(expectedManagerPropertyIRIs.size())));
    }

    protected static Optional<PropertyDescription> findPropertyDescription(List<PropertyDescription> properties,
            IRI propertyIRI) {
        return properties.stream().filter(property -> propertyIRI.equals(property.getPropertyIRI())).findFirst();
    }

    @Test
    public void testProperties_NoProperties() throws Exception {
        Repository repository = repositoryRule.getRepository();

        Optional<List<PropertyDescription>> propertiesHolder = provider.getProperties(repository, EXAMPLE_ORGANIZATION);
        Assert.assertFalse("There should be no properties for type ex:Organization", propertiesHolder.isPresent());
    }

    @Test
    public void testProperties_ImplicitTargetClass() throws Exception {
        Repository repository = repositoryRule.getRepository();
        Optional<List<PropertyDescription>> descriptionPropertiesHolder = provider.getPropertiesForRole(repository,
                EXAMPLE_PROJECT, DASH.DescriptionRole);
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
    public void testProperties_NothingDefined() throws Exception {
        Repository repository = repositoryRule.getRepository();
        Optional<List<PropertyDescription>> descriptionPropertiesHolder = provider.getPropertiesForRole(repository,
                FOAF.PERSON, DASH.DescriptionRole);
        Assert.assertTrue("There should be no description properties for type foad:Person",
                descriptionPropertiesHolder.isEmpty());
    }
}
