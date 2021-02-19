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

import java.util.Set;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.shiro.subject.Subject;
import org.apache.shiro.util.ThreadContext;
import org.eclipse.rdf4j.common.iteration.CloseableIteration;
import org.eclipse.rdf4j.common.iteration.EmptyIteration;
import org.eclipse.rdf4j.query.BindingSet;
import org.eclipse.rdf4j.query.QueryEvaluationException;
import org.eclipse.rdf4j.query.algebra.Service;
import org.eclipse.rdf4j.repository.Repository;
import org.eclipse.rdf4j.repository.sparql.federation.RepositoryFederatedService;

import com.metaphacts.api.sparql.SparqlUtil.SparqlOperation;
import com.metaphacts.security.PermissionUtil;

/**
 * A specialized {@link RepositoryFederatedService} which can check permissions
 * of the current {@link Subject} on the reference repository.
 * 
 * <p>
 * If the current user is not permitted to access the repository, a
 * {@link QueryEvaluationException} is thrown. Note that this exception can be
 * suppressed using the SILENT keyword, yielding to an empty result.
 * </p>
 * 
 * @author Andreas Schwarte
 * @see PermissionUtil#hasSparqlPermission(SparqlOperation, String)
 */
public class PlatformRepositoryFederatedService extends RepositoryFederatedService {

    private static final Logger logger = LogManager.getLogger(PlatformRepositoryFederatedService.class);

    private final String repoId;
    private boolean requiresPermissionCheck = true;

    public PlatformRepositoryFederatedService(Repository repo, String repoId) {
        this(repo, false, repoId); // managed repositories must not be shut down
    }

    public PlatformRepositoryFederatedService(Repository repo, boolean shutDown, String repoId) {
        super(repo, shutDown);
        this.repoId = repoId;
    }

    @Override
    public CloseableIteration<BindingSet, QueryEvaluationException> select(Service service, Set<String> projectionVars,
            BindingSet bindings, String baseUri) throws QueryEvaluationException {
        if (!isPermitted(service)) {
            if (service.isSilent()) {
                logger.debug("Not permitted to access service repository " + repoId);
                return new EmptyIteration<BindingSet, QueryEvaluationException>();
            }
            throw new QueryEvaluationException("Not permitted to access service repository " + repoId);
        }
        return super.select(service, projectionVars, bindings, baseUri);
    }

    @Override
    public boolean ask(Service service, BindingSet bindings, String baseUri) throws QueryEvaluationException {
        if (!isPermitted(service)) {
            if (service.isSilent()) {
                logger.debug("Not permitted to access service repository " + repoId);
                return false;
            }
            throw new QueryEvaluationException("Not permitted to access service repository " + repoId);
        }
        return super.ask(service, bindings, baseUri);
    }

    @Override
    public CloseableIteration<BindingSet, QueryEvaluationException> evaluate(Service service,
            CloseableIteration<BindingSet, QueryEvaluationException> bindings, String baseUri)
            throws QueryEvaluationException {
        if (!isPermitted(service)) {
            if (service.isSilent()) {
                logger.debug("Not permitted to access service repository " + repoId);
                return new EmptyIteration<BindingSet, QueryEvaluationException>();
            }
            throw new QueryEvaluationException("Not permitted to access service repository " + repoId);
        }
        return super.evaluate(service, bindings, baseUri);
    }

    public boolean isRequiresPermissionCheck() {
        return requiresPermissionCheck;
    }

    public void setRequiresPermissionCheck(boolean requiresPermissionCheck) {
        this.requiresPermissionCheck = requiresPermissionCheck;
    }

    private boolean isPermitted(Service service) {
        if (!requiresPermissionCheck) {
            return true;
        }

        // handle cases where subject is not authenticated (e.g. background thread)
        if (ThreadContext.getSubject() == null) {
            logger.trace("Subject not defined in current thread context, enforcing permission check. Service expr: {}",
                    service);
            // TODO decide about default value
            boolean enforceCheckForUnauthenticatedUser = true;
            if (!enforceCheckForUnauthenticatedUser) {
                return true;
            }
        }

        return PermissionUtil.hasSparqlPermission(SparqlOperation.SELECT, repoId);
    }

}
