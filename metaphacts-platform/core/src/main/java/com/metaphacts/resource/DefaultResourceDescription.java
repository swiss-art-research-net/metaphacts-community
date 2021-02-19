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
package com.metaphacts.resource;

import java.util.Collections;
import java.util.List;

import org.eclipse.rdf4j.model.Resource;

/**
 * Holder for a compiled resource description for an entity.
 * 
 * <p>
 * This includes type information, label, textual description as well as a set
 * of description properties for this entity.
 * </p>
 * 
 * @author Wolfgang Schell <ws@metaphacts.com>
 */
public class DefaultResourceDescription implements ResourceDescription {
    
    private Resource resourceIRI;
    private String label;
    private String description;
    private TypeDescription typeDescription;
    private List<PropertyValue> descriptionProperties;
    private String languageTag;

    public DefaultResourceDescription(Resource resourceIRI) {
        this.resourceIRI = resourceIRI;
    }

    @Override
    public Resource getResource() {
        return resourceIRI;
    }
    
    public String getLanguageTag() {
        return languageTag;
    }
    
    public DefaultResourceDescription withLanguageTag(String languageTag) {
        this.languageTag = languageTag;
        return this;
    }

    @Override
    public String getLabel() {
        return label;
    }
    
    public DefaultResourceDescription withLabel(String label) {
        this.label = label;
        return this;
    }

    @Override
    public String getDescription() {
        return description;
    }
    
    public DefaultResourceDescription withDescription(String description) {
        this.description = description;
        return this;
    }

    @Override
    public TypeDescription getTypeDescription() {
        return typeDescription;
    }
    
    public DefaultResourceDescription withTypeDescription(TypeDescription typeDescription) {
        this.typeDescription = typeDescription;
        return this;
    }

    @Override
    public List<PropertyValue> getDescriptionProperties() {
        return (descriptionProperties != null ? descriptionProperties : Collections.emptyList());
    }

    public DefaultResourceDescription withDescriptionProperties(List<PropertyValue> descriptionProperties) {
        this.descriptionProperties = descriptionProperties;
        return this;
    }

    @Override
    public String toString() {
        return resourceIRI.stringValue();
    }

}
