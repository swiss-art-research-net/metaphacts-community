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
package com.metaphacts.api.dto.queryform;

import java.util.Collection;

import org.eclipse.rdf4j.model.IRI;

import com.metaphacts.api.dto.InconsistentDtoException;
import com.metaphacts.api.dto.base.DTOBase;
import com.metaphacts.api.dto.querytemplate.QueryTemplate;

/**
 * POJO representing a query form configuration.
 * Template type T represents the query template type backing the configuration
 *
 * @author msc, jt
 */
public class QueryFormConfiguration<T extends QueryTemplate<?>> extends DTOBase {


	private static final long serialVersionUID = -4971495504331025542L;

	// the underlying query template
	private QueryTemplate<?> queryTemplate;
	
	// specification of the form elements and how they map to the query's template parameters
	private Collection<QueryFormElement> queryFormElements;

	public QueryFormConfiguration(
		final IRI id, final String label, final String description,
		final QueryTemplate<?> queryTemplate, 
		final Collection<QueryFormElement> queryFormElements) {
		
		super(id, label, description);
		
		this.queryTemplate = queryTemplate;
		this.queryFormElements = queryFormElements;
	}

	public QueryTemplate<?> getQueryTemplate() {
		return queryTemplate;
	}

	public void setQueryTemplate(QueryTemplate<?> queryTemplate) {
		this.queryTemplate = queryTemplate;
	}

	public Collection<QueryFormElement> getQueryFormElements() {
		return queryFormElements;
	}

	public void setQueryFormElements(
			Collection<QueryFormElement> queryFormElements) {
		this.queryFormElements = queryFormElements;
	}
	
	public QueryFormElement getQueryFormElement(IRI queryFormElementId){
	    for(QueryFormElement el : this.queryFormElements)
	        if(el.getId().equals(queryFormElementId)) return el;
	    
	    return null;
	}

    @Override
    public void assertConsistency() throws InconsistentDtoException {
        
        super.assertConsistency();
        
        // only the ID is mandatory
        if (queryTemplate==null) {
            throw new InconsistentDtoException(this.getClass(), "queryTemplate is null", getId());
        }
        if (queryFormElements==null) {
            throw new InconsistentDtoException(this.getClass(), "queryFormElements is null", getId());
        }
    }
}