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
 * Copyright (C) 2015-2020, metaphacts GmbH
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
package com.metaphacts.data.rdf.container;

import java.util.Collections;

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.impl.LinkedHashModel;
import org.eclipse.rdf4j.model.vocabulary.RDF;
import org.eclipse.rdf4j.model.vocabulary.RDFS;
import org.eclipse.rdf4j.model.vocabulary.SP;
import org.eclipse.rdf4j.repository.Repository;
import org.eclipse.rdf4j.repository.RepositoryConnection;
import org.eclipse.rdf4j.repository.RepositoryException;

import com.google.common.collect.Sets;
import com.metaphacts.data.rdf.PointedGraph;
import com.metaphacts.repository.MpRepositoryProvider;
import com.metaphacts.vocabulary.LDP;

/**
 * Representation of the platform root container.
 * @author Johannes Trame <jt@metaphacts.com>
 *
 */
@LDPR(iri=RootContainer.IRI_STRING)
public class RootContainer extends AbstractLDPContainer {
    public static final String IRI_STRING = "http://www.metaphacts.com/ontologies/platform#rootContainer";
    public static final IRI IRI = vf.createIRI(IRI_STRING);
    
    public RootContainer(IRI iri, MpRepositoryProvider repositoryProvider) {
        super(iri, repositoryProvider);
    }
    
    public RootContainer(MpRepositoryProvider repositoryProvider) {
        super(IRI, repositoryProvider);
    }
    
    @Override
    public Model getModel() throws RepositoryException {
        // we don't need to call super, since the root container does only exists virtually
        Model m = new LinkedHashModel();
        m.add(this.getResourceIRI(), RDF.TYPE, LDP.Container);
        m.add(this.getResourceIRI(), RDFS.LABEL, vf.createLiteral("Platform Root Container"));
        // we get the membership relations from the repository i.e. they are not
        // stored in the root container context but being part of the individual containers
        m.addAll(getReadConnection().getOutgoingStatements(this.getResourceIRI()));
        return m;
    }
    
    @Override
    public void initialize() throws RepositoryException {
        if (!getReadConnection().hasOutgoingStatements(this.getResourceIRI())) {
            LinkedHashModel m = new LinkedHashModel();
            m.add(vf.createStatement(this.getResourceIRI(), RDF.TYPE, LDP.Container));
            m.add(vf.createStatement(this.getResourceIRI(), RDF.TYPE, LDP.Resource));
            m.add(vf.createStatement(this.getResourceIRI(), RDFS.LABEL,
                    vf.createLiteral("Root Container")));
            try (RepositoryConnection connection = getRepository().getConnection()) {
                connection.add(m, getContextIRI());
            }
        }
    }

    @Override
    public IRI add(PointedGraph pointedGraph) throws RepositoryException {
        if(!isLDPContainer(pointedGraph))
            throw new IllegalArgumentException("Only LDP Container can be added to the Platform Root Container");
        return super.add(pointedGraph);
    }
    
    private boolean isLDPContainer(PointedGraph pg){
        return !Collections.disjoint(pg.getTypes(), Sets.newHashSet(LDP.Container, LDP.BasicContainer, LDP.DirectContainer));
    }
    
    @Override
    public void delete() throws RepositoryException {
        throw new IllegalArgumentException("Platform Root Container can not be deleted.");
    }
    
    @Override
    public IRI getResourceType() {
        return LDP.Container;
    }
}