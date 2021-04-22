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
import static org.eclipse.rdf4j.model.util.Values.literal;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.sameInstance;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import javax.inject.Inject;
import javax.xml.datatype.DatatypeFactory;
import javax.xml.datatype.XMLGregorianCalendar;

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.model.Value;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.repository.Repository;
import org.junit.Rule;
import org.junit.Test;

import com.metaphacts.junit.AbstractIntegrationTest;
import com.metaphacts.junit.PlatformStorageRule;
import com.metaphacts.junit.TestPlatformStorage;
import com.metaphacts.services.storage.api.StoragePath;
import com.metaphacts.templates.TemplateUtil;
import com.metaphacts.vocabulary.DASH;

public class HandlebarsDescriptionRendererTest extends AbstractIntegrationTest implements ResourcesTestData {

    @Inject
    public HandlebarsDescriptionRenderer renderer;

    @Inject
    @Rule
    public PlatformStorageRule platformStorageRule;

    @Test
    public void testSimpleRender() throws Exception {
        // set up test template
        String descriptionTemplate = "[[[label]]] ([[[type]]]): [[occupation.0.value]] ([[date-formatYear dateOfBirth.0.value]])[[#if marriedTo]], married to [[marriedTo.0.value]][[/if]]";
        StoragePath descriptionTemplatePath = DescriptionTemplateByIriLoader
                .descriptionTemplatePathFromIri(iri(TemplateUtil.convertResourceToTemplateIdentifier(EXAMPLE_PERSON)));
        platformStorageRule.storeContent(descriptionTemplatePath, descriptionTemplate, TestPlatformStorage.STORAGE_ID);

        Repository repository = repositoryRule.getRepository();
        ResourceDescription instanceDescription = createInstanceDescription();

        Optional<String> description = renderer.renderTemplate(instanceDescription, repository, LANG);
        assertTrue(description.isPresent());
        assertThat(description.get(), equalTo("Alice (Person): Researcher (1980), married to Charlie"));
    }

    protected DefaultResourceDescription createInstanceDescription() {
        Set<IRI> propertyRoles = Set.of(DASH.DescriptionRole);
        // description properties
        DefaultPropertyDescription occupation = new DefaultPropertyDescription(EXAMPLE_OCCUPATION, "occupation",
                propertyRoles);
        DefaultPropertyDescription birthdate = new DefaultPropertyDescription(EXAMPLE_BIRTHDATE, "dateOfBirth",
                propertyRoles);
        DefaultPropertyDescription marriedTo = new DefaultPropertyDescription(EXAMPLE_MARRIEDTO, "marriedTo",
                propertyRoles);
        List<PropertyDescription> properties = Arrays.asList(occupation, birthdate);
        TypeDescription typeDescription = new DefaultTypeDescription(EXAMPLE_PERSON)
                .withProperties(properties);

        // property values
        DefaultPropertyValue occupationValue = new DefaultPropertyValue(ALICE, occupation,
                Collections.singletonList(literal("Researcher")));
        DefaultPropertyValue birthdayValue = new DefaultPropertyValue(ALICE, birthdate,
                Collections.singletonList(dateLiteral(1980, 06, 14)));
        DefaultPropertyValue marriedToValue = new DefaultPropertyValue(ALICE, marriedTo,
                Collections.singletonList(CHARLIE));
        List<PropertyValue> values = Arrays.asList(occupationValue, birthdayValue, marriedToValue);

        return new DefaultResourceDescription(ALICE)
                .withTypeDescription(typeDescription).withLabel("Alice")
                .withDescriptionProperties(values);
    }

    // TODO implement more test cases

    @Test
    public void testConvertValues_stringLiteralsWithLanguageTags() throws Exception {
        Repository repository = repositoryRule.getRepository();

        List<Value> values = Arrays.asList(langLiteral("ru"), langLiteral("de-ch"),
                langLiteral("en"));
        List<Value> convertedValues = renderer.convertValues(values, repository, "de-CH");
        assertNotNull(convertedValues);
        assertThat(convertedValues, is(not(empty())));
        assertThat(convertedValues.size(), is(1));
        Literal literal = (Literal) convertedValues.get(0);
        assertThat(literal.stringValue(), is(equalTo("value-de-ch")));
    }

    @Test
    public void testConvertValues_mixedLiterals() throws Exception {
        Repository repository = repositoryRule.getRepository();

        List<Value> values = Arrays.asList(literal("value"), literal(true), literal("other-value"), literal(1.2345),
                literal(42L));
        List<Value> convertedValues = renderer.convertValues(values, repository, "de-CH");
        assertNotNull(convertedValues);
        assertThat(convertedValues, is(not(empty())));
        assertThat(convertedValues.size(), is(values.size()));
        assertThat(convertedValues, contains(values.toArray()));
        assertThat(convertedValues, sameInstance(values));
    }

    @Test
    public void testConvertValues_mixedLiteralsAndIRI() throws Exception {
        Repository repository = repositoryRule.getRepository();

        List<Value> values = Arrays.asList(CHARLIE, literal(true), literal(1.2345), literal(42L), literal("value"),
                langLiteral("value", "de"), literal("other-value"));
        List<Value> convertedValues = renderer.convertValues(values, repository, "de-CH");
        assertNotNull(convertedValues);
        assertThat(convertedValues, is(not(empty())));
        assertThat(convertedValues.size(), is(values.size()));
        Literal charlie = (Literal) convertedValues.get(0);
        assertTrue("Charlie should be a literal", charlie.isLiteral());
        // as we have no labels for Charlie this would return his local name
        assertThat(charlie.stringValue(), is(equalTo(CHARLIE.getLocalName())));
    }

    static Literal langLiteral(String language) {
        return langLiteral("value-" + language, language);
    }

    static Literal langLiteral(String lexicalValue, String language) {
        // there is no Values.literal() method accepting a string and lanugage tag...
        return SimpleValueFactory.getInstance().createLiteral(lexicalValue, language);
    }

    static Literal dateLiteral(final int year, final int month, final int day) {
        XMLGregorianCalendar cal = DatatypeFactory.newDefaultInstance().newXMLGregorianCalendarDate(year, month, day,
                0);
        return literal(cal);
    }

    static Literal dateTimeLiteral(final int year, final int month, final int day, final int hour, final int minute,
            final int second) {
        XMLGregorianCalendar cal = DatatypeFactory.newDefaultInstance().newXMLGregorianCalendar(year, month, day,
                hour, minute, second, 0, 0);
        return literal(cal);
    }
}
