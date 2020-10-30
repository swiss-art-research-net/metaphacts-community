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
package com.metaphacts.lookup.impl;

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.Resource;
import org.eclipse.rdf4j.model.util.Models;

import com.google.common.cache.CacheBuilderSpec;
import com.metaphacts.lookup.spi.AbstractLookupServiceConfig;
import com.metaphacts.lookup.spi.LookupServiceConfigException;

/**
 * Common configuration options for a LookupService.
 * 
 * @author Wolfgang Schell <ws@metaphacts.com>
 */
public class CommonLookupConfig extends AbstractLookupServiceConfig {
    protected IRI datasetId;
    protected String datasetLabel;
    protected String lookupCacheConfig;
    
    public CommonLookupConfig() {
    }
    
    public CommonLookupConfig(String type) {
        super(type);
    }
    
    /**
     * Defines constant dataset id for all candidates in lookup response.
     * @return dataset id or <code>null</code> if not defined.
     */
    public IRI getDatasetId() {
        return datasetId;
    }
    
    public void setDatasetId(IRI datasetId) {
        this.datasetId = datasetId;
    }
    
    /**
     * Defines constant dataset label for all candidates in lookup response.
     * @return dataset label or <code>null</code> if not defined.
     */
    public String getDatasetLabel() {
        return datasetLabel;
    }
    
    public void setDatasetLabel(String datasetLabel) {
        this.datasetLabel = datasetLabel;
    }
    
    /**
     * Defines the <a href="https://guava.dev/releases/snapshot-jre/api/docs/com/google/common/cache/CacheBuilderSpec.html">cache configuration</a> for this lookup service.
     * @return cache configuration or <code>null</code> if not defined.
     * 
     * @see CacheBuilderSpec
     */
    public String getLookupCacheConfig() {
        return lookupCacheConfig;
    }
    
    public void setLookupCacheConfig(String lookupCacheConfig) {
        this.lookupCacheConfig = lookupCacheConfig;
    }
    
    @Override
    public Resource export(Model model) {
        Resource implNode = super.export(model);
        
        if (getDatasetId() != null) {
            model.add(implNode, LOOKUP_DATASET_ID, getDatasetId());
        }
        if (getDatasetLabel() != null) {
            model.add(implNode, LOOKUP_DATASET_NAME, VF.createLiteral(getDatasetLabel()));
        }
        if (getLookupCacheConfig() != null) {
            model.add(implNode, LOOKUP_CACHE_CONFIG, VF.createLiteral(getLookupCacheConfig()));
        }
        
        return implNode;
    }
    
    @Override
    public void parse(Model model, Resource resource) throws LookupServiceConfigException {
        super.parse(model, resource);
        
        Models.objectLiteral(model.filter(resource, LOOKUP_DATASET_NAME, null))
            .ifPresent(literal -> setDatasetLabel(literal.stringValue()));
        
        Models.objectIRI(model.filter(resource, LOOKUP_DATASET_ID, null))
            .ifPresent(iri -> setDatasetId(iri));
        
        Models.objectLiteral(model.filter(resource, LOOKUP_CACHE_CONFIG, null))
            .ifPresent(literal -> setLookupCacheConfig(literal.stringValue()));
    }
}
