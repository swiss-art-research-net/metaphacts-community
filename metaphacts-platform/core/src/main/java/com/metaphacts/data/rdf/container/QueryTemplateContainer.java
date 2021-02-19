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
package com.metaphacts.data.rdf.container;

import javax.inject.Inject;

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.impl.LinkedHashModel;
import org.eclipse.rdf4j.model.vocabulary.RDF;
import org.eclipse.rdf4j.model.vocabulary.RDFS;
import org.eclipse.rdf4j.model.vocabulary.SPIN;
import org.eclipse.rdf4j.repository.RepositoryException;

import com.google.common.base.Throwables;
import com.metaphacts.cache.QueryTemplateCache;
import com.metaphacts.data.rdf.PointedGraph;
import com.metaphacts.repository.MpRepositoryProvider;
import com.metaphacts.vocabulary.LDP;

import java.util.Collections;

@LDPR(iri = QueryTemplateContainer.IRI_STRING)
public class QueryTemplateContainer extends AbstractLDPContainer {
    public static final String IRI_STRING = "http://www.metaphacts.com/ontologies/platform#queryTemplateContainer";
    public static final IRI IRI = vf.createIRI(IRI_STRING);

    @Inject
    protected QueryTemplateCache queryTemplateCache; 
    
    @Inject
    public QueryTemplateContainer(IRI iri, MpRepositoryProvider repositoryProvider) {
        super(iri, repositoryProvider);
    }
    
    @Override
    public IRI getResourceType() {
        return SPIN.TEMPLATE_CLASS;
    }

    @Override
    public void initialize() throws RepositoryException {
        if (!getReadConnection().hasOutgoingStatements(this.getResourceIRI())) {
            LinkedHashModel m = new LinkedHashModel();
            m.add(vf.createStatement(IRI, RDF.TYPE, LDP.Container));
            m.add(vf.createStatement(IRI, RDF.TYPE, LDP.Resource));
            m.add(vf.createStatement(IRI, RDFS.LABEL, vf.createLiteral("Query Template Container")));
            m.add(vf.createStatement(IRI, RDFS.COMMENT, vf.createLiteral("Container to store sp:QueryTemplate instances.")));
            try {
                getRootContainer().add(new PointedGraph(IRI, m));
            } catch (RepositoryException e) {
                throw Throwables.propagate(e);
            }
        }
    }

    @Override
    public org.eclipse.rdf4j.model.IRI add(PointedGraph pointedGraph) throws RepositoryException {
        queryTemplateCache.invalidate(Collections.singleton(this.getResourceIRI()));
        return super.add(pointedGraph);
    }

    @Override
    public void update(PointedGraph pointedGraph) throws RepositoryException {
        queryTemplateCache.invalidate(Collections.singleton(this.getResourceIRI()));
        super.update(pointedGraph);
    }

    @Override
    public void delete() throws RepositoryException {
        queryTemplateCache.invalidate(Collections.singleton(this.getResourceIRI()));
        super.delete();
    }
    
    
    

}
