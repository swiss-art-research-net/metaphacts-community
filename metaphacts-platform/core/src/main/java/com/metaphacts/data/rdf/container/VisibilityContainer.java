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

import com.google.common.base.Throwables;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.impl.LinkedHashModel;
import org.eclipse.rdf4j.model.util.ModelException;
import org.eclipse.rdf4j.model.util.Models;
import org.eclipse.rdf4j.model.vocabulary.RDF;
import org.eclipse.rdf4j.repository.RepositoryException;

import com.metaphacts.data.rdf.ModelUtils;
import com.metaphacts.data.rdf.PointedGraph;
import com.metaphacts.repository.MpRepositoryProvider;
import com.metaphacts.vocabulary.LDP;

/**
 * @author Artem Kozlov <ak@metaphacts.com>
 * @author Johannes Trame <jt@metaphacts.com>
 */
@LDPR(iri = VisibilityContainer.IRI_STRING)
public class VisibilityContainer extends DefaultLDPContainer {
    
    private static final Logger logger = LogManager.getLogger(VisibilityContainer.class);
    
    public static final String IRI_STRING = "http://www.metaphacts.com/ontologies/platform#visibilityContainer";
    public static final IRI IRI = vf.createIRI(IRI_STRING);
    
    private static final IRI visibilityMemberPredicate = vf.createIRI("http://www.metaphacts.com/ontologies/platform#visibilityItem");
    
    public VisibilityContainer(IRI iri, MpRepositoryProvider repositoryProvider) {
        super(iri, repositoryProvider);
    }
    
    public void initialize() {
        if (!getReadConnection().hasOutgoingStatements(this.getResourceIRI())) {
            LinkedHashModel m = new LinkedHashModel();
            m.add(vf.createStatement(IRI, RDF.TYPE, LDP.Container));
            m.add(vf.createStatement(IRI, RDF.TYPE, LDP.Resource));
            try {
                getRootContainer().add(new PointedGraph(IRI, m));
            } catch (RepositoryException e) {
                throw Throwables.propagate(e);
            }
        }
    }
    
    @Override
    public IRI add(PointedGraph pointedGraph) throws RepositoryException {
        IRI visibilityItem = null;
        
        try {
            visibilityItem = Models.objectIRI(pointedGraph.getGraph().filter(pointedGraph.getPointer(), visibilityMemberPredicate, null)).orElseThrow(
            () ->  new IllegalArgumentException("Visiblitiy item to be added must be linked from an auxiliary note with the predicate "+visibilityMemberPredicate ));
        } catch (ModelException|IllegalArgumentException e) {
           throw Throwables.propagate(e);
        }
        logger.trace("Checking whether identical visibility item has already been created for current user.");
        IRI existingItem = checkForExistingItem(visibilityItem, visibilityMemberPredicate, true);
        if(existingItem!=null){
            logger.trace("Same visibility item has already been stored by the same user: "+existingItem +". Updating item.");
            Model newModel = ModelUtils.replaceSubjectAndObjects(pointedGraph.getGraph(), pointedGraph.getPointer(), existingItem);
            // if same item already exists on clipboard for current user, just update item (i.e. update of creation date)
            PointedGraph pg = new PointedGraph(existingItem, newModel);
            update(pg);
            return existingItem;
        }else{
            return super.add(pointedGraph);
        }
    }

}