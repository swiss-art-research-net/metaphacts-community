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

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.vocabulary.RDF;
import org.eclipse.rdf4j.repository.RepositoryException;

import com.metaphacts.data.rdf.PointedGraph;
import com.metaphacts.repository.MpRepositoryProvider;
import com.metaphacts.vocabulary.PLATFORM;

/**
 * Per-user container for {@link SetContainer set of resources}.
 *
 * <p>This container would be created from client-side on a first access (see {@code LDPSetService.ts}) with
 * a default {@link SetContainer set} (for uncategorized items).</p>
 *
 * <p>See {@link UserSetRootContainer} for the IRI generation for this container.</p>
 *
 * @see com.metaphacts.rest.endpoint.SetManagementEndpoint
 * @see com.metaphacts.templates.helper.SetManagementHelperSource
 *
 * @author Johannes Trame <jt@metaphacts.com>
 * @author Alexey Morozov
 */
@LDPR(iri = SetRootContainer.IRI_STRING)
public class SetRootContainer extends AbstractLDPContainer {
    public static final String IRI_STRING = "http://www.metaphacts.com/ontologies/platform#setContainer";
    public static final IRI IRI = vf.createIRI(IRI_STRING);

    public SetRootContainer(IRI iri, MpRepositoryProvider repositoryProvider) {
        super(iri, repositoryProvider);
    }

    @Override
    public IRI getResourceType() {
        return PLATFORM.SET_TYPE;
    }

    @Override
    public IRI add(PointedGraph pointedGraph)
            throws RepositoryException {
        IRI setType = PLATFORM.SET_TYPE;
        if(pointedGraph.getGraph().filter(null, RDF.TYPE, setType).subjects().isEmpty()){
            Model m = pointedGraph.getGraph();
            m.add(vf.createStatement(pointedGraph.getPointer(), RDF.TYPE, setType));
            pointedGraph.setGraph(m);
        }
        return super.add(pointedGraph);
    }
}
