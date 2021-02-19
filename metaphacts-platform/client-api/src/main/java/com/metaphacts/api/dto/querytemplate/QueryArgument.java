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


import java.util.Optional;

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Value;

import com.metaphacts.api.dto.base.DTOBase;
import com.metaphacts.vocabulary.SPL;

/**
 * POJO representation of {@link SPL#ARGUMENT_CLASS}
 * @author jt
 *
 */
public class QueryArgument extends DTOBase {
    private static final long serialVersionUID = 274319120337754602L;
    
    /**
     * Default constructor
     */
    public QueryArgument(
        IRI id,
        String label,
        String description,
        String predicate,
        IRI valueType
    ) {
        super(id, label, description);
        
        setPredicate(predicate);
        setValueType(valueType);
    }
    
    /**
     * holds {@link SPL#PREDICATE_PROPERTY}
     */
    private String predicate;
    /**
     * holds {@link SPL#VALUETYPE_PROPERTY}, usually any of the xsd:Datatype or rdfs:Resource
     */
    private IRI valueType;
    /**
     * holds an inverse of {@link SPL#OPTIONAL_PROPERTY}
     */
    private boolean required = true;
    /**
     * holds {@link SPL#DEFAULT_VALUE_PROPERTY}
     */
    private Value defaultValue;
    
    public String getPredicate() {
        return predicate;
    }

    public void setPredicate(String predicate) {
        if(predicate==null || predicate.isEmpty())
            throw new IllegalArgumentException("A QueryArgument must have a predicate.");
        this.predicate = predicate;
    }

    public IRI getValueType() {
        return valueType;
    }

    public void setValueType(IRI valueType) {
        if(valueType==null)
            throw new IllegalArgumentException("A QueryArgument must have a valueType.");
        this.valueType = valueType;
    }
    
    /**
     * @return true by default 
     */
    public boolean isRequired() {
        return required;
    }

    public void setRequired(boolean required) {
        this.required = required;
    }

    public Optional<Value> getDefaultValue() {
        return Optional.ofNullable(this.defaultValue);
    }

    public void setDefaultValue(Value defaultValue) {
    	// TODO add datatype validation here
        this.defaultValue = defaultValue;
    }
}