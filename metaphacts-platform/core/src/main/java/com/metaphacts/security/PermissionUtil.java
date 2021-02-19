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
package com.metaphacts.security;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import javax.annotation.Nullable;

import org.apache.shiro.SecurityUtils;
import org.apache.shiro.subject.Subject;
import org.eclipse.rdf4j.model.IRI;

import com.metaphacts.api.sparql.SparqlUtil.SparqlOperation;
import com.metaphacts.repository.RepositoryManager;
import com.metaphacts.security.Permissions.PAGES;
import com.metaphacts.security.Permissions.SPARQL;

/**
 * @author Johannes Trame <jt@metaphacts.com>
 * @author Artem Kozlov <ak@metaphacts.com>
 */
public class PermissionUtil {

    private static final String VALID_PERMISSION_REGEX = "([-a-z0-9^\n]*):([^{}\n]*)";
    
    public static boolean hasSparqlPermission(SparqlOperation op, String repositoryId) {
        return (repositoryId.equals(RepositoryManager.DEFAULT_REPOSITORY_ID) 
                    && SecurityUtils.getSubject().isPermitted(SPARQL.sparqlOperationDefaultPermission(op)))
                || SecurityUtils.getSubject().isPermitted(SPARQL.sparqlOperationPermission(repositoryId, op));
    }
    
    /**
     * Check whether the current user has the permission to perform an action on the
     * specified named graph.
     * 
     * @param graphStoreAction graph store action, one of
     *                         <code>Permissions.SPARQL.GRAPH_STORE_*</code>
     * @param namedGraphIRI    IRI of the named graph to check (optional, may be
     *                         <code>null</code> to check for access to all named
     *                         graphs)
     * @return <code>true</code> if the permission is granted, <code>false</code>
     *         otherwise
     */
    public static boolean hasGraphStorePermission(String graphStoreAction, @Nullable IRI namedGraphIRI) {
        Subject subject = SecurityUtils.getSubject();
        // check for either a general permission or one for the specific named graph
        return (subject.isPermitted(graphStoreAction)
                || 
                subject.isPermitted(Permissions.SPARQL.graphStorePermission(graphStoreAction, namedGraphIRI)));
    }

    public static boolean hasTemplateActionPermission(IRI iri, PAGES.Action action) {
        return (SecurityUtils.getSubject().isPermitted(PAGES.templateOperationPermission(iri, action)));
    }
    
    /**
     * First part of the regular expression checks the permission type i.e. Check if it contains only alphanumeric characters.
     * Only exception here is a dash '-' that is allowed.
     * The Second part of the permission after ':' can contain anything except curly brackets '{}',
     * because ideally the user should replace the curly bracket with a valid entity example: proxyID, storageId, repositoryId.
     * @param Permission string entered by the user.
     * @return Returns whether the permission string is valid or not.
     */
    public static boolean isPermissionValid(String permission) {
        Pattern initialPattern = Pattern.compile(VALID_PERMISSION_REGEX, Pattern.CASE_INSENSITIVE);
        Matcher initalPatternMatcher = initialPattern.matcher(permission);
        if (!initalPatternMatcher.matches()) {
            return false;
        }
        return true;
    }
    
    public static String normalizePermission(String permission) {
        return permission.replaceAll("\\s","");
    }
}
