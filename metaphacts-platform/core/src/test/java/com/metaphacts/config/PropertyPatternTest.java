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
package com.metaphacts.config;

import static org.hamcrest.Matchers.allOf;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;

import org.eclipse.rdf4j.query.MalformedQueryException;
import org.hamcrest.MatcherAssert;
import org.junit.Assert;
import org.junit.Rule;
import org.junit.Test;

import com.google.inject.Inject;
import com.metaphacts.junit.AbstractIntegrationTest;
import com.metaphacts.junit.NamespaceRule;

/**
 * Test cases for {@link PropertyPattern}
 */
public class PropertyPatternTest extends AbstractIntegrationTest {
    final String SOURCE_SUBJECT_NAME = "subject";
    final String SOURCE_VALUE_NAME = "value";
    final String TEST_SUBJECT_NAME = "testSub";
    final String TEST_VALUE_NAME = "testVal";

    @Inject
    @Rule
    public NamespaceRule namespaceRule;

    @Test
    public void testPropertyPathPattern() {
        PropertyPattern pattern = PropertyPattern.parse(
            "{?subject <test:iri>|<another:iri>+ ?value}",
            namespaceRule.getNamespaceRegistry()
        );
        checkIfPatternRenders(pattern);
    }

    @Test
    public void testPatternWithBind() {
        PropertyPattern pattern = PropertyPattern.parse(
            "{?subject <test:hasImage> ?image . " +
            "BIND(CONCAT(" +
                "\"https://commons.wikimedia.org/w/thumb.php?f=\"," +
                "STRAFTER(STR(?image),\"Special:FilePath/\")," +
                "\"&w=100\"" +
            ") as ?value)}",
            namespaceRule.getNamespaceRegistry()
        );
        checkIfPatternRenders(pattern);
    }

    @Test
    public void testPatternWithValues() {
        PropertyPattern pattern = PropertyPattern.parse(
            "{?subject <test:hasImage> ?value . " +
                "VALUES (?value) { (<test:foo>) (<test:bar>) } }",
            namespaceRule.getNamespaceRegistry()
        );
        String formatted = pattern.format(TEST_SUBJECT_NAME, TEST_VALUE_NAME);
        String expected = "{?testSub <test:hasImage> ?testVal . VALUES (?testVal) { (<test:foo>) (<test:bar>)  }  }";
        Assert.assertEquals(
            expected.replaceAll("\\s+", ""),
            formatted.replaceAll("\\s+", "")
        );
    }

    @Test
    public void testPatternWithPrefixedIRIs() {
        PropertyPattern pattern = PropertyPattern.parse(
            "rdfs:label",
            namespaceRule.getNamespaceRegistry()
        );
        checkIfPatternRenders(pattern);
    }

    @Test(expected = IllegalArgumentException.class)
    public void testMissingSubject() {
        PropertyPattern.parse("{?s ?p ?value}", namespaceRule.getNamespaceRegistry());
    }

    @Test(expected = IllegalArgumentException.class)
    public void testMissingValue() {
        PropertyPattern.parse("{?subject ?p ?v}", namespaceRule.getNamespaceRegistry());
    }

    @Test(expected = MalformedQueryException.class)
    public void testInvalidPattern() {
        PropertyPattern.parse("???", namespaceRule.getNamespaceRegistry());
    }

    private void checkIfPatternRenders(PropertyPattern pattern) {
        String formatted = pattern.format(TEST_SUBJECT_NAME, TEST_VALUE_NAME);
        MatcherAssert.assertThat(
            "Pattern.format should replace ?subject -> ?testSub and ?value -> ?testPropVal",
            formatted,
            allOf(
                containsString("?" + TEST_SUBJECT_NAME),
                containsString("?" + TEST_VALUE_NAME),
                not(containsString("?" + SOURCE_SUBJECT_NAME)),
                not(containsString("?" + SOURCE_VALUE_NAME))
            )
        );
    }
}
