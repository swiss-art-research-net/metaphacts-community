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
package com.metaphacts.repository.http;

import org.apache.commons.lang3.StringUtils;
import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.Resource;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.model.util.ModelException;
import org.eclipse.rdf4j.model.util.Models;
import org.eclipse.rdf4j.repository.config.RepositoryConfigException;
import org.eclipse.rdf4j.repository.http.config.HTTPRepositoryConfig;

import com.metaphacts.repository.MpRepositoryVocabulary;

/**
 * @author Jeen Broekstra <jb@metaphacts.com>
 *
 */
public abstract class AuthenticatingHTTPRepositoryConfig extends HTTPRepositoryConfig {

    protected static final ValueFactory vf = SimpleValueFactory.getInstance();

    private String username;

    private String password;

    public AuthenticatingHTTPRepositoryConfig(String type){
        setType(type);
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }
    
    @Override
    public void validate()
        throws RepositoryConfigException
    {
        super.validate();
        if(requiresUsername() && StringUtils.isEmpty(getUsername())){
            throw new RepositoryConfigException("No username specified for SPARQL authenticating repository.");
        }
        if (requiresPassword() && StringUtils.isEmpty(getPassword())) {
            throw new RepositoryConfigException("No password specified for SPARQL authenticating repository.");
        }
    }
    
    @Override
    public Resource export(Model m) {
        Resource implNode = super.export(m);

        if (getUsername() != null) {
            m.setNamespace("mph", MpRepositoryVocabulary.NAMESPACE);
            m.add(implNode, MpRepositoryVocabulary.USERNAME, vf.createLiteral(getUsername()));
        }
        if (getPassword() != null) {
            m.setNamespace("mph", MpRepositoryVocabulary.NAMESPACE);
            m.add(implNode, MpRepositoryVocabulary.PASSWORD, vf.createLiteral(getPassword()));
        }

        return implNode;
    }

    @Override
    public void parse(Model m, Resource implNode)
        throws RepositoryConfigException
    {
        super.parse(m, implNode);

        try {
            Models.objectLiteral(m.filter(implNode, MpRepositoryVocabulary.USERNAME, null)).ifPresent(
                    iri -> setUsername(iri.stringValue()));
            Models.objectLiteral(m.filter(implNode, MpRepositoryVocabulary.PASSWORD, null)).ifPresent(
                    iri -> setPassword(iri.stringValue()));
        }
        catch (ModelException e) {
            throw new RepositoryConfigException(e.getMessage(), e);
        }
    }
    
    /**
     * Specifies whether the username is required (used by validation). Sub-classes may override this method 
     * to indicate that the username is optional, e.g. for other types of authentication.
     * @return <code>true</code> if the username is required, <code>false</code> otherwise
     */
    protected boolean requiresUsername() {
        return true;
    }
    
    /**
     * Specifies whether the password is required (used by validation). Sub-classes may override this method 
     * to indicate that the password is optional, e.g. for other types of authentication.
     * @return <code>true</code> if the password is required, <code>false</code> otherwise
     */
    protected boolean requiresPassword() {
        return true;
    }

}