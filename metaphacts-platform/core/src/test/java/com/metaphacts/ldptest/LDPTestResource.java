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
package com.metaphacts.ldptest;

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.model.util.ModelException;
import org.eclipse.rdf4j.model.util.Models;
import org.eclipse.rdf4j.model.vocabulary.FOAF;
import org.eclipse.rdf4j.repository.RepositoryException;

import com.metaphacts.data.rdf.container.AbstractLDPResource;
import com.metaphacts.data.rdf.container.LDPR;
import com.metaphacts.data.rdf.container.LDPResource;
import com.metaphacts.repository.MpRepositoryProvider;

/**
 * This is a test implementation of a {@link LDPResource} being located in a
 * different package other than the default implementations.
 * 
 *
 * @author Johannes Trame <jt@metaphacts.com>
 *
 */
@LDPR(iri=LDPTestResource.iriString)
public class LDPTestResource extends AbstractLDPResource {
    public static final String iriString = "http://xmlns.com/foaf/0.1/Person";
    public static final IRI uri = vf.createIRI(iriString);
    public LDPTestResource(IRI iri, MpRepositoryProvider repositoryProvider) {
        super(iri, repositoryProvider);
    }
    
    public Literal getPersonName() throws ModelException, RepositoryException{
        return Models.objectLiteral(this.getModel().filter(this.getResourceIRI(), FOAF.NAME, null)).get();
    }

}