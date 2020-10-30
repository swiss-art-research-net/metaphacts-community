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
package com.metaphacts.sail.rest;

import org.apache.commons.lang3.StringUtils;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.Resource;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.model.util.Models;
import org.eclipse.rdf4j.sail.config.AbstractSailImplConfig;
import org.eclipse.rdf4j.sail.config.SailConfigException;
import org.eclipse.rdf4j.sail.config.SailImplConfig;

import com.metaphacts.repository.MpRepositoryVocabulary;

/**
 * Abstract {@link SailImplConfig} implementation for the REST API services.
 * Holds one generic parameter: service URL.
 * 
 * @author Andriy Nikolov <an@metaphacts.com>
 *
 */
public abstract class AbstractServiceWrappingSailConfig extends AbstractSailImplConfig {

    String url = null;
    IRI serviceID = null;

    public AbstractServiceWrappingSailConfig() {

    }

    public AbstractServiceWrappingSailConfig(String type) {
        super(type);
    }

    @Override
    public void validate() throws SailConfigException {
        super.validate();
        if (StringUtils.isEmpty(url)) {
            throw new SailConfigException("REST service URL is not provided");
        }
    }

    @Override
    public Resource export(Model model) {
        Resource implNode = super.export(model);
        if (!StringUtils.isEmpty(url)) {
            model.add(implNode, MpRepositoryVocabulary.SERVICE_URL,
                    SimpleValueFactory.getInstance().createLiteral(url));
        }
        
        if (getServiceID() != null) {
            model.add(implNode, MpRepositoryVocabulary.IMPLEMENTS_SERVICE, getServiceID());
        }
        return implNode;
    }

    @Override
    public void parse(Model model, Resource implNode) throws SailConfigException {
        super.parse(model, implNode);
        Models.objectLiteral(model.filter(implNode, MpRepositoryVocabulary.SERVICE_URL, null))
                .ifPresent(lit -> setUrl(lit.stringValue()));
        Models.objectIRI(model.filter(implNode, MpRepositoryVocabulary.IMPLEMENTS_SERVICE, null))
                .ifPresent(iri -> setServiceID(iri));
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }

    public IRI getServiceID() {
        return serviceID;
    }

    public void setServiceID(IRI serviceID) {
        this.serviceID = serviceID;
    }

}