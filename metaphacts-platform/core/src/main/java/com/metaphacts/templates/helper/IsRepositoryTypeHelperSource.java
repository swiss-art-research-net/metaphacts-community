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
package com.metaphacts.templates.helper;

import static com.google.common.base.Preconditions.checkNotNull;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.rdf4j.repository.Repository;
import org.eclipse.rdf4j.repository.config.RepositoryConfig;

import com.github.jknack.handlebars.Options;
import com.metaphacts.repository.RepositoryManager;
import com.metaphacts.templates.TemplateContext;

/**
 * Handlebars helper to check the RDF4J repository type of a specific repository. 
 * Will return either "true" or an empty string (for false). Takes two parameters: 
 * expected repository type and (optionally) the repository ID. 
 * If the repository ID is absent, the repository from the {@link TemplateContext} 
 * is checked. 
 * <br>
 * <strong>Subexpression Example:</strong> <br>
 * <code>
 * [[#if (isRepositoryType "metaphactory:SPARQLRepository")]]
 *  true branch
 * [[else]]
 *  false branch
 * [[/if]]
 * </code><br>
 * <strong>Stand-alone</strong><br>
 * <code>
 * Is this true ?: [[#isRepositoryType "metaphactory:SPARQLRepository" "default" ]]
 * </code>
 * 
 * @author Andriy Nikolov an@metaphacts.com
 *
 */
public class IsRepositoryTypeHelperSource {
    
    private static final Logger logger = LogManager.getLogger(IsRepositoryTypeHelperSource.class);
    
    private final RepositoryManager repositoryManager;
    
    public IsRepositoryTypeHelperSource(RepositoryManager repositoryManager) {
        this.repositoryManager = repositoryManager;
    }
    

    public String isRepositoryType(String param0, Options options) {
        String expected = checkNotNull(param0, "Expected repository type string must not be null.");
        String repositoryId;
        if (options.params.length > 0) {
            repositoryId = options.param(0);
        } else {
            TemplateContext context =  (TemplateContext) options.context.model();
            Repository repo = context.getRepository();
            repositoryId = repositoryManager.getRepositoryID(repo);
        }
        
        try {
            RepositoryConfig repConfig = 
                    repositoryManager.getRepositoryConfig(repositoryId);
            return repConfig.getRepositoryImplConfig().getType().equals(expected) ? "true" : "";
        } catch (Exception e) {
            throw new RuntimeException(
                    "Could not check the type of the repository " 
                            + repositoryId + ": " + e.getMessage(), e);
        }
    }
}