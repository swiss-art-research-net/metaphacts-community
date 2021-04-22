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
package com.metaphacts.services.fields;

import static java.util.stream.Collectors.toList;

import java.io.IOException;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

import javax.annotation.Nullable;

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.model.Value;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaphacts.data.json.JsonUtil;
import com.metaphacts.vocabulary.XsdUtils;

public final class FieldDefinition {
    private IRI iri;

    @Nullable
    private Literal description;

    @Nullable
    private Literal minOccurs;

    @Nullable
    private Literal maxOccurs;

    @Nullable
    private IRI xsdDatatype;

    private Set<IRI> domain = new HashSet<>();

    private Set<IRI> range = new HashSet<>();

    private Set<Value> defaultValues = new HashSet<>();

    @Nullable
    private String selectPattern;

    @Nullable
    private String insertPattern;

    @Nullable
    private String deletePattern;

    @Nullable
    private String askPattern;

    @Nullable
    private String autosuggestionPattern;

    @Nullable
    private String valueSetPattern;

    @Nullable
    private String treePatterns;

    @Nullable
    private OrderedWith orderedWith;

    public IRI getIri() {
        return iri;
    }

    public void setIri(IRI iri) {
        this.iri = iri;
    }

    @Nullable
    public Literal getDescription() {
        return description;
    }

    public void setDescription(@Nullable Literal description) {
        this.description = description;
    }

    public Literal getMinOccurs() {
        return minOccurs;
    }

    public void setMinOccurs(Literal minOccurs) {
        this.minOccurs = minOccurs;
    }

    public Literal getMaxOccurs() {
        return maxOccurs;
    }

    public void setMaxOccurs(Literal maxOccurs) {
        this.maxOccurs = maxOccurs;
    }

    @Nullable
    public IRI getXsdDatatype() {
        return xsdDatatype;
    }

    public void setXsdDatatype(@Nullable IRI xsdDatatype) {
        this.xsdDatatype = xsdDatatype;
    }

    public Set<IRI> getDomain() {
        return domain;
    }

    public void setDomain(Set<IRI> domain) {
        this.domain = domain;
    }

    public Set<IRI> getRange() {
        return range;
    }

    public void setRange(Set<IRI> range) {
        this.range = range;
    }

    public Set<Value> getDefaultValues() {
        return defaultValues;
    }

    public void setDefaultValues(Set<Value> defaultValues) {
        this.defaultValues = defaultValues;
    }

    public String getInsertPattern() {
        return insertPattern;
    }

    public void setInsertPattern(String insertPattern) {
        this.insertPattern = insertPattern;
    }

    @Nullable
    public String getSelectPattern() {
        return selectPattern;
    }

    public void setSelectPattern(@Nullable String selectPattern) {
        this.selectPattern = selectPattern;
    }

    @Nullable
    public String getDeletePattern() {
        return deletePattern;
    }

    public void setDeletePattern(@Nullable String deletePattern) {
        this.deletePattern = deletePattern;
    }

    @Nullable
    public String getAskPattern() {
        return askPattern;
    }

    public void setAskPattern(@Nullable String askPattern) {
        this.askPattern = askPattern;
    }

    @Nullable
    public String getAutosuggestionPattern() {
        return autosuggestionPattern;
    }

    public void setAutosuggestionPattern(@Nullable String autosuggestionPattern) {
        this.autosuggestionPattern = autosuggestionPattern;
    }

    @Nullable
    public String getValueSetPattern() {
        return valueSetPattern;
    }

    public void setValueSetPattern(@Nullable String valueSetPattern) {
        this.valueSetPattern = valueSetPattern;
    }

    @Nullable
    public String getTreePatterns() {
        return treePatterns;
    }

    public void setTreePatterns(@Nullable String treePatterns) {
        this.treePatterns = treePatterns;
    }

    public OrderedWith getOrderedWith() {
        return orderedWith;
    }

    public void setOrderedWith(OrderedWith orderedWith) {
        this.orderedWith = orderedWith;
    }

    public Map<String, Object> toJson() {
        Map<String, Object> json = new HashMap<>();
        if (getIri() != null) {
            json.put("id", getIri().stringValue());
            json.put("iri", getIri().stringValue());
        }
        if (getDescription() != null) {
            json.put("description", getDescription().stringValue());
        }
        if (getMinOccurs() != null) {
            String datatype = getMinOccurs().getDatatype().stringValue();
            try {
                json.put("minOccurs",
                        XsdUtils.isIntegerDatatype(datatype) ? Integer.parseInt(getMinOccurs().stringValue())
                                : getMinOccurs().stringValue());
            } catch (NumberFormatException e) {
                throw new RuntimeException("Failed to serialize field " + getIri()
                        + " to JSON: invalid minOccurs value " + getMinOccurs(), e);
            }
        }
        if (getMaxOccurs() != null) {
            String datatype = getMaxOccurs().getDatatype().stringValue();
            try {
                json.put("maxOccurs",
                        XsdUtils.isIntegerDatatype(datatype) ? Integer.parseInt(getMaxOccurs().stringValue())
                                : getMaxOccurs().stringValue());
            } catch (NumberFormatException e) {
                throw new RuntimeException("Failed to serialize field " + getIri()
                        + " to JSON: invalid maxOccurs value " + getMaxOccurs(), e);
            }
        }
        if (getXsdDatatype() != null) {
            json.put("xsdDatatype", getXsdDatatype().stringValue());
        }
    
        json.put("domain", getDomain().stream().map(Value::stringValue).sorted().collect(toList()));
        json.put("range", getRange().stream().map(Value::stringValue).sorted().collect(toList()));
        json.put("defaultValues", getDefaultValues().stream().map(Value::stringValue).sorted().collect(toList()));
    
        if (getSelectPattern() != null) {
            json.put("selectPattern", getSelectPattern());
        }
        if (getInsertPattern() != null) {
            json.put("insertPattern", getInsertPattern());
        }
        if (getDeletePattern() != null) {
            json.put("deletePattern", getDeletePattern());
        }
        if (getAskPattern() != null) {
            json.put("askPattern", getAskPattern());
        }
        if (getAutosuggestionPattern() != null) {
            json.put("autosuggestionPattern", getAutosuggestionPattern());
        }
        if (getValueSetPattern() != null) {
            json.put("valueSetPattern", getValueSetPattern());
        }
        if (getTreePatterns() != null) {
            ObjectMapper mapper = JsonUtil.getDefaultObjectMapper();
            try {
                Object treePatternsJson = mapper.readTree(getTreePatterns());
                json.put("treePatterns", treePatternsJson);
            } catch (IOException e) {
                throw new RuntimeException("Failed to serialize field " + getIri()
                        + " to JSON: invalid treePatterns value " + getTreePatterns(), e);
            }
        }
        if (getOrderedWith() != null) {
            OrderedWith orderedWith = getOrderedWith();
            if (orderedWith.equals(OrderedWith.INDEX_PROPERTY)) {
                json.put("orderedWith", "index-property");
            }
        }

        return json;
    }
}