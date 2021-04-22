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

import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.Resource;
import org.eclipse.rdf4j.model.util.Models;

import com.metaphacts.lookup.spi.LookupServiceConfigException;

/**
 * Configuration for a remote LookupService using the Reconciliation API.
 * 
 * @author Wolfgang Schell <ws@metaphacts.com>
 */
public class RemoteLookupConfig extends RepositoryBasedLookupConfig {
    private String remoteServiceUrl;
    private Boolean remoteInformationServiceEnabled;
    private String remoteServiceUser;
    private String remoteServicePassword;
    private Integer remoteTimeout;
    private QueryMethod queryMethod = QueryMethod.postUrlEncodedForm;

    public RemoteLookupConfig() {
        super(RemoteLookupServiceFactory.LOOKUP_TYPE);
    }
    
    public RemoteLookupConfig(String type) {
        super(type);
    }
    
    /**
     * Get url address of the remote ReconciliationApi service to fetch data from.
     * @return service URL.
     */
    public String getRemoteServiceUrl() {
        return remoteServiceUrl;
    }

    public void setRemoteServiceUrl(String remoteServiceUrl) {
        this.remoteServiceUrl = remoteServiceUrl;
    }

    /**
     * Get read- and connection timeout (in seconds)
     * 
     * @return read- connection timeout (in seconds) or <code>null</code> if unset
     */
    public Integer getRemoteTimeout() {
        return remoteTimeout;
    }

    /**
     * Set read- and connection timeout (in seconds)
     * 
     * @param timeout read- and connection timeout (in seconds) or <code>null</code>
     *                for unspecified
     */
    public void setRemoteTimeout(Integer timeout) {
        this.remoteTimeout = timeout;
    }

    /**
     * Tell if remote label/description services should be used if possible. By
     * default the remote description service is disabled.
     * 
     * @return boolean.
     */
    public boolean isRemoteInformationServiceEnabled() {
        return remoteInformationServiceEnabled != null ? remoteInformationServiceEnabled : false;
    }

    protected Boolean getRemoteDescriptionServiceEnabled() {
        return remoteInformationServiceEnabled;
    }

    public void setRemoteInformationServiceEnabled(boolean remoteInformationServiceEnabled) {
        this.remoteInformationServiceEnabled = remoteInformationServiceEnabled;
    }

    /**
     * Get user to authenticate into the remote lookup service.
     * @return user name or <code>null</code> if unset.
     */
    public String getRemoteServiceUser() {
        return remoteServiceUser;
    }

    public void setRemoteServiceUser(String remoteServiceUser) {
        this.remoteServiceUser = remoteServiceUser;
    }
    
    /**
     * Get password to authenticate into the remote lookup service.
     * @return password or <code>null</code> if unset.
     */
    public String getRemoteServicePassword() {
        return remoteServicePassword;
    }

    public void setRemoteServicePassword(String remoteServicePassword) {
        this.remoteServicePassword = remoteServicePassword;
    }
    
    /**
     * Get method to be used for fetching data from the remote lookup service.
     * <p>
     * Possible values: get, postUrlEncodedForm, postRawJson, postDataForm. The default is {@value QueryMethod#postUrlEncodedForm}.
     * </p>
     * 
     * @return query method
     */
    public QueryMethod getQueryMethod() {
        return queryMethod;
    }

    public void setQueryMethod(QueryMethod queryMethod) {
        this.queryMethod = queryMethod;
    }
    
    @Override
    public Resource export(Model model) {
        Resource implNode = super.export(model);
        
        if (getRemoteServiceUrl() != null) {
            model.add(implNode, LOOKUP_REMOTESERVICE_URL, VF.createLiteral(getRemoteServiceUrl()));
        }
        if (getRemoteServiceUser() != null) {
            model.add(implNode, LOOKUP_REMOTESERVICE_USER, VF.createLiteral(getRemoteServiceUser()));
        }
        if (getRemoteServicePassword() != null) {
            model.add(implNode, LOOKUP_REMOTESERVICE_PASSWORD, VF.createLiteral(getRemoteServicePassword()));
        }
        if (getQueryMethod() != null) {
            model.add(implNode, LOOKUP_REMOTESERVICE_QUERYMETHOD, VF.createLiteral(getQueryMethod().toString()));
        }
        if (getRemoteTimeout() != null) {
            model.add(implNode, LOOKUP_REMOTESERVICE_TIMEOUT, VF.createLiteral(getRemoteTimeout()));
        }

        if (getRemoteDescriptionServiceEnabled() != null) {
            model.add(implNode, LOOKUP_REMOTESERVICE_INFORMATIONENABLED,
                    VF.createLiteral(isRemoteInformationServiceEnabled()));
        }
        return implNode;
    }
    
    @Override
    public void parse(Model model, Resource resource) throws LookupServiceConfigException {
        super.parse(model, resource);
        
        Models.objectLiteral(model.filter(resource, LOOKUP_REMOTESERVICE_URL, null))
            .ifPresent(literal -> setRemoteServiceUrl(literal.stringValue()));
        
        Models.objectLiteral(model.filter(resource, LOOKUP_REMOTESERVICE_USER, null))
            .ifPresent(literal -> setRemoteServiceUser(literal.stringValue()));
        
        Models.objectLiteral(model.filter(resource, LOOKUP_REMOTESERVICE_PASSWORD, null))
            .ifPresent(literal -> setRemoteServicePassword(literal.stringValue()));
        
        Models.objectLiteral(model.filter(resource, LOOKUP_REMOTESERVICE_QUERYMETHOD, null))
            .ifPresent(literal -> setQueryMethod(QueryMethod.valueOf(literal.stringValue())));

        Models.objectLiteral(model.filter(resource, LOOKUP_REMOTESERVICE_TIMEOUT, null))
                .ifPresent(literal -> setRemoteTimeout(literal.intValue()));

        Models.objectLiteral(model.filter(resource, LOOKUP_REMOTESERVICE_INFORMATIONENABLED, null))
            .ifPresent(literal -> setRemoteInformationServiceEnabled(literal.booleanValue()));
    }
    
    public enum QueryMethod {
        get, postUrlEncodedForm, postRawJson, postDataForm
    }
}
