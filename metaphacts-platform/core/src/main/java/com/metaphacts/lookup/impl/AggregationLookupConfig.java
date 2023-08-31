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
package com.metaphacts.lookup.impl;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.Resource;
import org.eclipse.rdf4j.model.util.Models;

import com.metaphacts.lookup.impl.RepositoryBasedLookupConfig;
import com.metaphacts.lookup.spi.LookupServiceConfigException;

public class AggregationLookupConfig extends RepositoryBasedLookupConfig {
    public static final IRI LOOKUP_DELEGATE_SERVICE = VF.createIRI(LOOKUP_NAMESPACE, "delegateService");
    public static final IRI LOOKUP_SAMEAS_PATTERN = VF.createIRI(LOOKUP_NAMESPACE, "sameAsPattern");
    public static final IRI LOOKUP_FILTER_SECONDARY_RESULTS = VF.createIRI(LOOKUP_NAMESPACE, "filterSecondaryResults");

    protected Boolean filterSecondaryResults;
    protected String delegateService;
    protected List<String> sameAsPatterns;

    public AggregationLookupConfig() {
        super(AggregationLookupServiceFactory.LOOKUP_TYPE);
    }

    public void setFilterSecondaryResults(Boolean filterSecondaryResults) {
        this.filterSecondaryResults = filterSecondaryResults;
    }

    public Boolean getFilterSecondaryResults() {
        return filterSecondaryResults;
    }

    public boolean isFilterSecondaryResults() {
        return (filterSecondaryResults != null ? filterSecondaryResults : false);
    }

    public void setDelegateService(String delegateService) {
        this.delegateService = delegateService;
    }

    public String getDelegateService() {
        return delegateService;
    }

    public List<String> getSameAsPatterns() {
        return sameAsPatterns;
    }

    public void setSameAsPatterns(List<String> sameAsPatterns) {
        this.sameAsPatterns = sameAsPatterns;
    }

    public void addSameAsPattern(String sameAsPattern) {
        if (this.sameAsPatterns == null) {
            this.sameAsPatterns = new ArrayList<>();
        }
        this.sameAsPatterns.add(sameAsPattern);
    }

    @Override
    public Resource export(Model model) {
        Resource implNode = super.export(model);

        if (getFilterSecondaryResults() != null) {
            model.add(implNode, LOOKUP_FILTER_SECONDARY_RESULTS, VF.createLiteral(getFilterSecondaryResults()));
        }
        if (getDelegateService() != null) {
            model.add(implNode, LOOKUP_DELEGATE_SERVICE, VF.createLiteral(getDelegateService()));
        }
        Optional.ofNullable(getSameAsPatterns()).stream().flatMap(l -> l.stream())
                .forEach(pattern -> model.add(implNode, LOOKUP_SAMEAS_PATTERN, VF.createLiteral(pattern)));

        return implNode;
    }

    @Override
    public void parse(Model model, Resource resource) throws LookupServiceConfigException {
        super.parse(model, resource);

        Models.objectLiteral(model.filter(resource, LOOKUP_FILTER_SECONDARY_RESULTS, null))
                .ifPresent(literal -> setFilterSecondaryResults(literal.booleanValue()));
        Models.objectLiteral(model.filter(resource, LOOKUP_DELEGATE_SERVICE, null))
                .ifPresent(literal -> setDelegateService(literal.stringValue()));
        Models.objectLiterals(model.filter(resource, LOOKUP_SAMEAS_PATTERN, null))
                .forEach(literal -> addSameAsPattern((literal.stringValue())));
    }

    @Override
    public void validate() throws LookupServiceConfigException {
        super.validate();
        if (getDelegateService() == null) {
            throw new LookupServiceConfigException("No delegate service set!");
        }
    }
}
