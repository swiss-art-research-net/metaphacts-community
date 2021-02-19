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

import java.util.Set;

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Resource;
import org.eclipse.rdf4j.repository.RepositoryException;

import com.metaphacts.data.rdf.PointedGraph;

/**
 * <p>
 * Interface for common operations to be performed on {@link LDPContainer}.
 * Every container is at the same time a {@link LDPResource}.
 * </p>
 * 
 * Please never implement {@link LDPContainer} directly, but extend
 * {@link AbstractLDPContainer} instead.
 *
 * @author Johannes Trame <jt@metaphacts.com>
 *
 */
public interface LDPContainer extends LDPResource {
    /**
     * @param pointedGraph {@link PointedGraph} where the pointer identifies the root node of the resource to be created
     * @return {@link IRI} of the created node
     * @throws RepositoryException
     */
    public IRI add(PointedGraph pointedGraph) throws RepositoryException;
    
    /**
     * @param pointedGraph  {@link PointedGraph} where the pointer identifies the root node of the resource to be added
     * @throws RepositoryException
     */
    public void update(PointedGraph pointedGraph) throws RepositoryException;
    
    /**
     * Initialize will be called explicitly <b>after</b> creating the {@link LDPContainer} object.
     * @throws RepositoryException
     */
    public void initialize() throws RepositoryException;
    
    /**
     * Returns all resources explicitly contained within the container via the lpd:contains relation.
     * @return set of resources that are contained in the container or empty set otherwise
     * @throws RepositoryException 
     */
    public Set<Resource> getContainedResources() throws RepositoryException;
    
    /**
     * Whether the container contains the specified resource via a direct lpd:contains relation.
     */
    public boolean containsLDPResource(Resource resource);
    
    /**
     * Type of the resource that can be stored in the container.
     */
    IRI getResourceType();
}