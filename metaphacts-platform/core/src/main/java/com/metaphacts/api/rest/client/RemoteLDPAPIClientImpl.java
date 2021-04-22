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
package com.metaphacts.api.rest.client;

import java.util.LinkedList;
import java.util.List;

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.Resource;
import org.eclipse.rdf4j.model.Value;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;

/**
 * Default implementation of {@link LDPAPIClient}.
 * 
 * @author msc
 */
public class RemoteLDPAPIClientImpl extends APIClientBaseImpl implements LDPAPIClient {

	public static final IRI LDP_CONTAINS = SimpleValueFactory.getInstance().createIRI("http://www.w3.org/ns/ldp#contains");
	
	private IRI containerId;
	
	public RemoteLDPAPIClientImpl(
		final String endpoint, final String user, final String password,
		final IRI containerId, final IRI baseIri) {
		
		super(endpoint, user, password, baseIri);
		
		this.containerId = containerId;
	}

	public IRI getContainerId() {
		return containerId;
	}

	@Override
	public List<Resource> getContainedObjects() throws APICallFailedException {

		final String ldpRequest = 
			ldpContainerContentRequestString(getContainerId().toString());

		final Model containedObjectsModel = getContainedObjectsModel(ldpRequest);
		
		final List<Resource> containedObjects = new LinkedList<Resource>();
		
		if (containedObjectsModel!=null) {
			
			for (Value obj : containedObjectsModel.objects()) {
				
				if (obj instanceof IRI) {
					containedObjects.add((IRI)obj);					
				}
				
			}
		}
		
		return containedObjects;
		
	}

	@Override
	public Model getObjectModel(Resource object) throws APICallFailedException {
		
		if (!(object instanceof IRI)) {
			return null;
		}
		
		final String ldpRequest =  
			ldpContainerContentRequestString(object.toString());
		
		return super.submitGET(ldpRequest);

	}	


	public Model getContainedObjectsModel(final String pathFromEndpoint) throws APICallFailedException  {
		
		// get the complete model
		final Model model = super.submitGET(pathFromEndpoint);
		
		// refine the model to the contained resources
		return model.filter(null, LDP_CONTAINS, null);
	
	}
	
	/**
	 * Constructs an LDP request against the given iri (relative to,
	 * but not including the endpoint).
	 * 
	 * @param iri
	 * @return
	 */
	private String ldpContainerContentRequestString(String iri) {
		
		final StringBuffer buf = new StringBuffer();
		buf.append("container?uri=");
		buf.append(iri.replace("#", "%23"));
		
		return buf.toString();
	}
}