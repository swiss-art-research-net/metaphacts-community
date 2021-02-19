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
package com.metaphacts.repository;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.rdf4j.query.QueryEvaluationException;
import org.eclipse.rdf4j.query.algebra.evaluation.federation.FederatedService;
import org.eclipse.rdf4j.query.algebra.evaluation.federation.FederatedServiceResolver;
import org.eclipse.rdf4j.repository.sparql.federation.SPARQLServiceResolver;

import com.metaphacts.config.NamespaceRegistry;

/**
 * A {@link FederatedServiceResolver} for platform managed repositories, which
 * falls back to {@link SPARQLServiceResolver} for other services.
 * <p>
 * Repositories can be referenced using <i>Repository:repoId<i> as <i>SERVICE
 * IRI</i> (where repoId refers to an existing managed repository).
 * </p>
 * <p>
 * Note that we use the registered
 * {@link NamespaceRegistry#DFLT_REPOSITORY_NAMESPACE} namespace.
 * </p>
 * 
 * 
 * @author Andreas Schwarte
 *
 */
public class PlatformRepositoryFederatedServiceResolver extends SPARQLServiceResolver
        implements FederatedServiceResolver {

    private static final Logger logger = LogManager.getLogger(PlatformRepositoryFederatedServiceResolver.class);

    private final RepositoryManager repositoryManager;


    PlatformRepositoryFederatedServiceResolver(RepositoryManager repositoryManager) {
        super();
        this.repositoryManager = repositoryManager;
    }

    @Override
    protected FederatedService createService(String serviceUrl) throws QueryEvaluationException {

        // check if a platform repository service is requested
        if (serviceUrl.startsWith(NamespaceRegistry.DFLT_REPOSITORY_NAMESPACE)) {
            String repoId = serviceUrl.substring(NamespaceRegistry.DFLT_REPOSITORY_NAMESPACE.length());
            logger.trace("Create repository federated service for managed repository: " + repoId);
            try {
                return new PlatformRepositoryFederatedService(repositoryManager.getRepository(repoId), repoId);
            } catch (Exception e) {
                throw new QueryEvaluationException("Could not resolve repository " + repoId + ": " + e.getMessage(), e);
            }
        }

        return super.createService(serviceUrl);
    }

}
