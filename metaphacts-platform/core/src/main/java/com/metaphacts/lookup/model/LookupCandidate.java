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
package com.metaphacts.lookup.model;

import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class LookupCandidate implements Cloneable {
    private String id;
    private String name;
    @JsonProperty("type")
    private List<LookupEntityType> types;
    private double score;
    private boolean match;
    private LookupDataset dataset;
    private String description;
    private String reference;

    public LookupCandidate() {
    }

    public LookupCandidate(
        String id,
        String name,
        List<LookupEntityType> types,
        double score,
        boolean match,
        LookupDataset dataset,
        String description
    ) {
        this.id = id;
        this.name = name;
        this.types = types;
        this.score = score;
        this.match = match;
        this.dataset = dataset;
        this.description = description;
    }

    @Override
    public LookupCandidate clone() {
        try {
            // fields with primitive types are directly cloned, for complex objects use
            // explicit clone
            LookupCandidate clone = (LookupCandidate) super.clone();
            // clone/copy list of types
            if (types != null) {
                clone.types = new ArrayList<>(this.types);
            }
            return clone;
        } catch (CloneNotSupportedException e) {
            throw new RuntimeException(e);
        }
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public List<LookupEntityType> getTypes() {
        return types;
    }

    public void setTypes(List<LookupEntityType> types) {
        this.types = types;
    }

    public double getScore() {
        return score;
    }

    public void setScore(double score) {
        this.score = score;
    }

    public boolean isMatch() {
        return match;
    }

    public void setMatch(boolean match) {
        this.match = match;
    }

    public LookupDataset getDataset() {
        return dataset;
    }

    public void setDataset(LookupDataset dataset) {
        this.dataset = dataset;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getReference() {
        return reference;
    }

    public void setReference(String reference) {
        this.reference = reference;
    }
}
