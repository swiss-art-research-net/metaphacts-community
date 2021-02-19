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
package com.metaphacts.dataquality;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.rdf4j.model.BNode;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.Resource;
import org.eclipse.rdf4j.model.Statement;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.model.impl.TreeModel;
import org.eclipse.rdf4j.model.util.Models;
import org.eclipse.rdf4j.model.vocabulary.SPIN;
import org.eclipse.rdf4j.repository.RepositoryConnection;
import org.eclipse.rdf4j.repository.RepositoryResult;

import com.google.common.base.Preconditions;
import com.google.common.collect.Lists;
import com.metaphacts.api.dto.querytemplate.QueryTemplate;
import com.metaphacts.api.rest.client.QueryCatalogAPIClientImpl;
import com.metaphacts.api.rest.client.QueryTemplateCatalogAPIClientImpl;
import com.metaphacts.data.rdf.container.LocalLDPAPIClient;
import com.metaphacts.vocabulary.MPQA;

public class ShaclUtils {
    
    private static final ValueFactory VF = SimpleValueFactory.getInstance();
    private static final Logger logger = LogManager
            .getLogger(ShaclUtils.class);
    
    private ShaclUtils() {
    }

    
    public static Model extractSubTreeBySubject(RepositoryConnection conn, IRI patternIRI) {
        Model model = new TreeModel();
        putStatementsIntoModelRecursively(conn, patternIRI, model);
        return model;
    }

    private static void putStatementsIntoModelRecursively(RepositoryConnection conn, Resource root,
            Model model) {
        List<Resource> objectResources = Lists.newArrayList();
        try (RepositoryResult<Statement> stmtsRes = conn.getStatements(root, null, null)) {
            while (stmtsRes.hasNext()) {
                Statement stmt = stmtsRes.next();
                model.add(stmt);
                if (stmt.getObject() instanceof Resource) {
                    objectResources.add((Resource) stmt.getObject());
                }
            }
        }
        objectResources.stream()
                .forEach(res -> putStatementsIntoModelRecursively(conn, res, model));
    }

    private static void putStatementsIntoModelRecursively(Model parentModel, Resource root, Model model) {
        Model subModel = parentModel.filter(root, null, null);
        List<Resource> objectResources = subModel.stream().map(stmt -> stmt.getObject())
                .filter(val -> (val instanceof Resource)).map(val -> (Resource) val)
                .collect(Collectors.toList());

        model.addAll(subModel);
        objectResources.stream()
                .forEach(res -> putStatementsIntoModelRecursively(parentModel, res, model));
    }

    public static Model extractSubTreeBySubject(Model parentModel, Resource root) {
        Model model = new TreeModel();
        putStatementsIntoModelRecursively(parentModel, root, model);
        return model;
    }
    
    /**
     * Retrieves from the model all objects of the property <code>property</code> and (optionally) subject <code>subject</code>
     * where these objects are resources 
     * 
     * @param model
     * @param property
     * @param subject
     */
    public static List<Resource> getObjectResources(Model model, IRI property, Resource subject) {
        Preconditions.checkNotNull(model, "model must not be null");
        Preconditions.checkNotNull(property, "property must not be null");
        
        return model
            .filter(subject, property, null).stream()
            .map(stmt -> stmt.getObject()).filter(val -> (val instanceof Resource))
            .map(val -> (Resource) val).collect(Collectors.toList());
    }
    
    public static void expandWithReferencedQueryTemplates(Model model,
            LocalLDPAPIClient ldpApiClient) throws Exception {

        List<Resource> templateReferences = model
                .filter(null, MPQA.hasSPINQueryTemplate, null).stream()
                .map(stmt -> stmt.getObject()).filter(val -> (val instanceof Resource))
                .map(val -> (Resource) val).collect(Collectors.toList());
        // We assume that the template references which are not provided explicitly
        // in the file must be retrieved from the query catalog.
        templateReferences = templateReferences.stream()
                .filter(res -> (res instanceof IRI) && !model.contains(res, SPIN.BODY_PROPERTY, null))
                .collect(Collectors.toList());

        for (Resource ref : templateReferences) {
            try {
                Model templateModel = ldpApiClient.getObjectModel((IRI) ref);
                IRI bodyIRI = Models.getPropertyIRI(templateModel, ref, SPIN.BODY_PROPERTY).get();
                model.addAll(templateModel);
                
                Model queryModel = ldpApiClient.getObjectModel(bodyIRI);
                model.addAll(queryModel);
            } catch (Exception e) {
                logger.warn("Could not retrieve the query template <" + ref.stringValue() + ">: "
                        + e.getMessage());
                logger.debug("Details: ", e);
            }
        }
    }
    
    public static List<QueryTemplate<?>> retrieveQueryTemplates(Model parentModel) throws Exception {
        List<Resource> referencedTemplateResources = parentModel
                .filter(null, MPQA.hasSPINQueryTemplate, null).stream()
                .map(stmt -> stmt.getObject()).filter(val -> (val instanceof Resource))
                .map(val -> (Resource) val).collect(Collectors.toList());

        ModelBasedLdpApiClientImpl pseudoClient = new ModelBasedLdpApiClientImpl(parentModel);
        QueryCatalogAPIClientImpl queryCatalogClient = new QueryCatalogAPIClientImpl(pseudoClient);
        QueryTemplateCatalogAPIClientImpl queryTemplateCatalogClient = 
                new QueryTemplateCatalogAPIClientImpl(pseudoClient, queryCatalogClient);

        List<QueryTemplate<?>> queryTemplates = Lists.newArrayList();
        for (Resource res : referencedTemplateResources) {
            QueryTemplate<?> queryTemplate = queryTemplateCatalogClient.getQueryTemplate(res);
            queryTemplates.add(queryTemplate);
        }
        return queryTemplates;
    }
    
    /**
     * Replaces all blank nodes in the model with the ones with different ids
     * (needed for instantiating multiple graphs based on a parameterized pattern).
     * 
     * @param parentModel
     */
    public static void renameBNodes(Model parentModel) {
        Set<BNode> bnodes = Models.subjectBNodes(parentModel);
        for (BNode bnode : bnodes) {
            renameResource(parentModel, bnode);
        }
    }
    
    private static void renameResource(Model parentModel, Resource resource) {
        BNode replace = VF.createBNode();
        
        List<Statement> toRemove = Lists.newArrayList();
        List<Statement> toAdd = Lists.newArrayList();
        
        parentModel.filter(resource, null, null).stream().forEach(stmt -> { 
            toRemove.add(stmt);
            toAdd.add(VF.createStatement(replace, stmt.getPredicate(), stmt.getObject()));
        });
        
        parentModel.filter(null, null, resource).stream().forEach(stmt -> { 
            toRemove.add(stmt);
            toAdd.add(VF.createStatement(stmt.getSubject(), stmt.getPredicate(), replace));
        });
        
        parentModel.removeAll(toRemove);
        parentModel.addAll(toAdd);
    }
}
