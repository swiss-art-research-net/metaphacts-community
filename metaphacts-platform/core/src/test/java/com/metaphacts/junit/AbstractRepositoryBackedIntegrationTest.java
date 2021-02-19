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
package com.metaphacts.junit;

import java.io.InputStream;
import java.util.Arrays;
import java.util.List;

import org.eclipse.rdf4j.model.Statement;
import org.eclipse.rdf4j.repository.Repository;
import org.eclipse.rdf4j.repository.RepositoryConnection;
import org.eclipse.rdf4j.rio.RDFFormat;
import org.eclipse.rdf4j.rio.Rio;

import com.github.jsonldjava.shaded.com.google.common.base.Throwables;

/**
 * Base class for tests that require a backing repository. For now, the class
 * extends {@link AbstractIntegrationTest} by helper methods to e.g. conveniently
 * add statements to the repository.
 * 
 * @author Michael Schmidt <ms@metaphacts.com>
 */
public abstract class AbstractRepositoryBackedIntegrationTest extends AbstractIntegrationTest {

    /**
     * Add a single statement to the repository.
     * 
     * @param stmt
     */
    final public void addStatement(final Statement stmt) throws Exception {
        try( RepositoryConnection con = repositoryRule.getRepository().getConnection()){
            con.add(stmt);
        }
    }

    final public void addStatements(final List<Statement> stmts) throws Exception  {
        try( RepositoryConnection con = repositoryRule.getRepository().getConnection()){
            con.add(stmts);
        } 
    }

    final public void addAssetStatements(Statement ...statements) throws Exception {
        try (RepositoryConnection con = repositoryRule.getAssetRepository().getConnection()) {
            con.add(Arrays.asList(statements));
        }
    }

	/**
	 * Load a RDF file from a named resource
	 * 
	 * @param resources array of resource names. Each resource name may be relative
	 *                  to the current class or absolute
	 */
	public void addStatementsFromResources(String... resources) {
        addStatementsFromResources(repositoryRule.getRepository(), getClass(), resources);
	}

    /**
     * Load a RDF file from a named resource
     * 
     * @param repository    repository to which to add statements
     * @param resourceClass class which is used to load specified resource
     * @param resources     array of resource names. Each resource name may be
     *                      relative to {@code resourceClass} or absolute
     */
    public static void addStatementsFromResources(Repository repository, Class<?> resourceClass, String... resources) {
		try (RepositoryConnection connection = repository.getConnection()) {
			Arrays.asList(resources).forEach(file -> {
				RDFFormat format = Rio.getParserFormatForFileName(file).orElse(RDFFormat.TURTLE);
                try (InputStream data = resourceClass.getResourceAsStream(file)) {
					connection.add(data, format);
				} catch (Exception e) {
					Throwables.throwIfUnchecked(e);
					throw new RuntimeException(e);
				}
			});
		}
	}
}