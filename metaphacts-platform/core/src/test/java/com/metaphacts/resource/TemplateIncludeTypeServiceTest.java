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

import static org.eclipse.rdf4j.model.util.Statements.statement;
import static org.eclipse.rdf4j.model.util.Values.iri;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.emptyIterable;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.junit.Assert.assertNotNull;

import java.util.Collections;
import java.util.List;

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.vocabulary.RDF;
import org.junit.Rule;
import org.junit.Test;

import com.google.inject.Inject;
import com.metaphacts.config.UnknownConfigurationException;
import com.metaphacts.junit.AbstractRepositoryBackedIntegrationTest;
import com.metaphacts.junit.NamespaceRule;
import com.metaphacts.junit.PlatformStorageRule;
import com.metaphacts.junit.TestPlatformStorage;

public class TemplateIncludeTypeServiceTest extends AbstractRepositoryBackedIntegrationTest {

	private final static String NAMESPACE = "http://example.com/";

	private final static IRI IRI1 = iri(NAMESPACE + "s1");
	private final static IRI IRI2 = iri(NAMESPACE + "s2");

	private final static IRI TYPE1 = iri(NAMESPACE + "Type1");
	private final static IRI TYPE2 = iri(NAMESPACE + "Type2");
	private final static IRI TYPE2A = iri(NAMESPACE + "Type2a");

	private final static IRI EXAMPLE_INSTANCEOF = iri("http://example.com/InstanceOf");

	@Inject
	@Rule
	public NamespaceRule namespaceRule;

	@Inject
	@Rule
	public PlatformStorageRule storageRule;

	@Inject
	TemplateIncludeTypeService typeService;

	@Test
	public void testSingleIri_SingleType_RdfType() throws Exception {
		addStatement(statement(IRI1, RDF.TYPE, TYPE1, null));

		Iterable<IRI> types = typeService.getTypes(IRI1, repositoryRule.getRepository());
		assertNotNull(types);
		assertThat(types, is(not(emptyIterable())));
		IRI type = types.iterator().next();
		assertThat(type, is(equalTo(TYPE1)));
	}

	@Test
	public void testSingleIri_SingleType_OtherType() throws Exception {
		setTemplateIncludeQueryForType(EXAMPLE_INSTANCEOF);
		addStatement(statement(IRI1, EXAMPLE_INSTANCEOF, TYPE1, null));

		Iterable<IRI> types = typeService.getTypes(IRI1, repositoryRule.getRepository());
		assertNotNull(types);
		assertThat(types, is(not(emptyIterable())));
		IRI type = types.iterator().next();
		assertThat(type, is(equalTo(TYPE1)));
	}

	@Test
	public void testSingleIri_MultipleTypes_OtherType() throws Exception {
		setTemplateIncludeQueryForType(EXAMPLE_INSTANCEOF);
		addStatement(statement(IRI2, EXAMPLE_INSTANCEOF, TYPE2, null));
		addStatement(statement(IRI2, EXAMPLE_INSTANCEOF, TYPE2A, null));

		Iterable<IRI> types = typeService.getTypes(IRI2, repositoryRule.getRepository());
		assertNotNull(types);
		assertThat(types, is(not(emptyIterable())));
		assertThat(types, containsInAnyOrder(TYPE2, TYPE2A));
	}

	protected void setTemplateIncludeQueryForType(IRI preferredType) {
		setTemplateIncludeQuery("SELECT ?type WHERE { ?? <" + preferredType + "> ?type }");
	}

	protected void setTemplateIncludeQuery(String query) {
		setUIConfigurationParameter("templateIncludeQuery", Collections.singletonList(query));
	}

	protected void setUIConfigurationParameter(String name, List<String> values) {
		try {
			config.getUiConfig().setParameter(name, values, TestPlatformStorage.STORAGE_ID);
		} catch (UnknownConfigurationException e) {
			throw new RuntimeException(e);
		}
	}
}
