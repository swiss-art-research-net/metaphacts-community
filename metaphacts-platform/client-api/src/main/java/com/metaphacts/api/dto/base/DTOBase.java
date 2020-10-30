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
package com.metaphacts.api.dto.base;

import java.io.Serializable;

import org.eclipse.rdf4j.model.Resource;

import com.metaphacts.api.dto.InconsistentDtoException;

/**
 * Base class for all REST DTOs, providing common base functionality to
 * access the ID (=IRI), label, and description of the resource underlying
 * the DTO.
 * 
 * @author msc
 */
public class DTOBase implements Serializable {

	private static final long serialVersionUID = -6825861105426356559L;

    public final static String BASE_IRI_STR = "http://www.metaphacts.com/";
	
	// IRI identifying the object
	Resource id;
	
	// label of the form element (aka rdfs:label)
	String label;
	
	// human-readable description of the form element (aka rdfs:description)
	String description;

	
	public DTOBase(final Resource id, final String label, final String description) {

		this.id = id;
		this.label = label;
		this.description = description;
		
	}

	public Resource getId() {
		return id;
	}
	
	public String getLabel() {
		return label;
	}

	public void setLabel(String label) {
		this.label = label;
	}

	public String getDescription() {
		return description;
	}

	public void setDescription(String description) {
		this.description = description;
	}
	
	/**
	 * Check the consistency of the given DTO. May be overriden in subclasses,
	 * verifying that mandatory fields are set and possible interdependencies
	 * between fields are valid. Do *not* implement recursive assertions, i.e.
	 * do *not* call assert of another DTO from within the assert method
	 * except for the super class assert, where appropriate.
	 * 
	 * @throws InconsistentDtoException in case the DTO is not consistent
	 */
	public void assertConsistency() throws InconsistentDtoException {
	    // only the ID is mandatory
	    if (id==null) {
	        throw new InconsistentDtoException(this.getClass(), "ID not set", null /* unknown */);
	    }
	}
	
}