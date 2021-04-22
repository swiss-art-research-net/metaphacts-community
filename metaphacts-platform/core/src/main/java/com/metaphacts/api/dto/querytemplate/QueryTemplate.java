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
package com.metaphacts.api.dto.querytemplate;

import java.util.ArrayList;
import java.util.List;

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Resource;

import com.metaphacts.api.dto.InconsistentDtoException;
import com.metaphacts.api.dto.base.DTOBase;
import com.metaphacts.api.dto.query.Query;

/**
 * Abstract base class representing a query template, including information
 * about the query template itself and the template parameters. Instantiated by
 * concrete instances see {@link SelectQueryTemplate}, {@link AskQueryTemplate}
 * and {@link ConstructQueryTemplate}
 * 
 * Template parameter T is the type of the query template.
 * 
 * @author jt
 */
public abstract class QueryTemplate<T extends Query<?>> extends DTOBase {
	
    private static final long serialVersionUID = -3153405725541947787L;

    private T query;

    private List<QueryArgument> arguments = new ArrayList<QueryArgument>();
    
    private String labelTemplate = "";
    
    
    public QueryTemplate(Resource id, String label, String description, T query) {
        super(id, label, description);
        this.query=query;
    }
    
	/**
	 * @return list of query arguments, empty list otherwise
	 */
	public List<QueryArgument> getArguments() {
        return arguments;
    }

    public void addArguments(List<QueryArgument> arguments) {
        this.arguments.addAll(arguments);
    }
    
    public void addArgument(QueryArgument argument) {
        this.arguments.add(argument);
    }

    /**
     * Returns the {@link QueryArgument} with the specified IRI
     * @param argumentId
     * @return specified {@link QueryArgument}, <code>null</null> otherwise
     */
    public QueryArgument getArgument(IRI argumentId){
        for(QueryArgument arg : this.arguments){
            if(arg.getId().equals(argumentId))
                return arg;
        }
        return null;
    }
    
    /**
     * @return template string with placeholders {local name of the predicate
     *         argument}, <code>null</nulL> if it does not exist
     */
    public String getLabelTemplate() {
        return labelTemplate;
    }

    /**
     * Template string with place-holders for the variable names between { and }
     * so that user interfaces can render the template calls in a human-readable
     * way.
     * 
     * @param labelTemplate
     */
    public void setLabelTemplate(String labelTemplate) {
        this.labelTemplate = labelTemplate;
    }
    
    public T getQuery() {
        return query;
    }

    public void setQuery(T query) {
        this.query = query;
    }
    
    @Override
    public void assertConsistency() throws InconsistentDtoException {
        
        super.assertConsistency();
        
        // only the ID is mandatory
        if (query==null) {
            throw new InconsistentDtoException(this.getClass(), "query is null", getId());
        }
        
        getQuery(); // validate syntax
    }

}