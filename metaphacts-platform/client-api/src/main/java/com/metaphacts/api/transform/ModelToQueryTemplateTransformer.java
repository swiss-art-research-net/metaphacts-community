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
package com.metaphacts.api.transform;

import static com.metaphacts.api.transform.ModelUtils.getNotNullObjectLiteral;
import static com.metaphacts.api.transform.ModelUtils.getNotNullObjectResource;
import static com.metaphacts.api.transform.ModelUtils.getNotNullObjectIRI;
import static com.metaphacts.api.transform.ModelUtils.getNotNullSubjectResource;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import org.apache.commons.lang3.NotImplementedException;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.Resource;
import org.eclipse.rdf4j.model.Value;
import org.eclipse.rdf4j.model.util.ModelException;
import org.eclipse.rdf4j.model.util.Models;
import org.eclipse.rdf4j.model.vocabulary.RDF;
import org.eclipse.rdf4j.model.vocabulary.RDFS;
import org.eclipse.rdf4j.model.vocabulary.SPIN;

import com.metaphacts.api.dto.InconsistentDtoException;
import com.metaphacts.api.dto.query.AskQuery;
import com.metaphacts.api.dto.query.ConstructQuery;
import com.metaphacts.api.dto.query.Query;
import com.metaphacts.api.dto.query.SelectQuery;
import com.metaphacts.api.dto.query.UpdateQuery;
import com.metaphacts.api.dto.querytemplate.AskQueryTemplate;
import com.metaphacts.api.dto.querytemplate.ConstructQueryTemplate;
import com.metaphacts.api.dto.querytemplate.QueryArgument;
import com.metaphacts.api.dto.querytemplate.QueryTemplate;
import com.metaphacts.api.dto.querytemplate.SelectQueryTemplate;
import com.metaphacts.api.dto.querytemplate.UpdateQueryTemplate;
import com.metaphacts.api.rest.client.APICallFailedException;
import com.metaphacts.api.rest.client.QueryCatalogAPIClient;
import com.metaphacts.vocabulary.SPL;

/**
 * Transformation from {@link Model} to {@link Query} and back.
 * 
 * @author msc, jt
 */
public class ModelToQueryTemplateTransformer implements ModelToDtoTransformer<QueryTemplate<?>> {

    private QueryCatalogAPIClient queryCatalogApi;
    
    public ModelToQueryTemplateTransformer(QueryCatalogAPIClient queryCatalogApi) {
       this.queryCatalogApi = queryCatalogApi;
    }

    @Override
    public QueryTemplate<?> modelToDto(final Model model) throws InvalidQueryTemplateModelException {
        if (model==null)  return null;
        
        Resource queryId = null;
        Resource queryTemplateId = null;
        String label = null;
        String description = null;
        Set<Value> templateTypes = new LinkedHashSet<Value>();
        Set<Value> argumentIdentifier = null;
        Optional<Literal> labelTemplate = null;
        
        List<QueryArgument> arguments = new ArrayList<QueryArgument>();
        try {
            // getOptional will throw exception if not exactly one matching object/subject can be found
            queryTemplateId = getNotNullSubjectResource(model, RDF.TYPE, SPIN.TEMPLATE_CLASS);
            queryId = getNotNullObjectResource(model,queryTemplateId, SPIN.BODY_PROPERTY);
            label = getNotNullObjectLiteral(model, queryTemplateId, RDFS.LABEL).stringValue();
            description = getNotNullObjectLiteral(model, queryTemplateId, RDFS.COMMENT).stringValue();
            
            //this is optional and will return null if not exists, but throw an error if it exists but is no literal
            labelTemplate = Models.objectLiteral(model.filter(queryTemplateId, SPIN.LABEL_TEMPLATE_PROPERTY, null));
            templateTypes.addAll(model.filter(queryTemplateId, RDF.TYPE, null).objects());
            argumentIdentifier = model.filter(queryTemplateId, SPIN.CONSTRAINT_PROPERTY,null).objects();
            for(Value arg : argumentIdentifier){
                //TODO think of whether we really want to enforce this?
                if(!(arg instanceof IRI))
                    throw new InvalidQueryTemplateModelException(
                        "Argument " + arg + " of query template " + queryTemplateId + 
                        " must be a IRI.", null /* cause */);
                
                IRI argType = getNotNullObjectIRI(model, (Resource) arg, RDF.TYPE);
                if(!argType.equals(SPL.ARGUMENT_CLASS))
                    throw new InvalidQueryTemplateModelException(
                        "Argument " + arg.stringValue() +" in query template " 
                        + queryTemplateId + " must be typed as spl:Argument", null /* cause */);
                
                // the predicate i.e. to be parameterized binding name is defined as the local name of the object IRI of the predicate property
                String argLabel = getNotNullObjectLiteral(model, (Resource) arg,RDFS.LABEL).stringValue();
                String argDescription = getNotNullObjectLiteral(model, (Resource) arg, RDFS.COMMENT).stringValue();
                String argPredicate = getNotNullObjectIRI(model, (Resource) arg, SPL.PREDICATE_PROPERTY).getLocalName();
                IRI argValueType = getNotNullObjectIRI(model, (Resource) arg, SPL.VALUETYPE_PROPERTY);
                Optional<Value> argDefaultValue = Models.object(
                    model.filter((Resource) arg, SPL.DEFAULT_VALUE_PROPERTY, null));
                QueryArgument qArgument = new QueryArgument(
                    (IRI) arg,
                    argLabel,
                    argDescription,
                    argPredicate,
                    argValueType
                );
                
                argDefaultValue.ifPresent(v -> qArgument.setDefaultValue(v));
                
                try{ 
                    Literal optional = getNotNullObjectLiteral(model, (Resource) arg, SPL.OPTIONAL_PROPERTY);
                    if(optional!=null) qArgument.setRequired(!optional.booleanValue());
                }catch (ModelException|IllegalArgumentException e1) {}
                
                arguments.add(qArgument);
            }
        } catch (ModelException e) {
            throw new InvalidQueryTemplateModelException(
                "Failed to extract field for query template " + queryTemplateId, e);
        }
        
        Query<?> queryDto = null ;
        try {
            queryDto = queryCatalogApi.getQuery(queryId);
            if (queryDto==null) 
                throw new InvalidQueryTemplateModelException("Query resolved to null", null /* cause */);
            queryDto.assertConsistency();
            
        } catch (InvalidQueryTemplateModelException e) {
            throw new InvalidQueryTemplateModelException(
                "Query " + queryId + " for query template " + queryTemplateId + " specified in query template configuration " +
                " could not be resolved", e);
        } catch (APICallFailedException e) {
            throw new InvalidQueryTemplateModelException(
                 "Recursive API call for query resolution " + queryId + " in query template configuration " +
                 queryTemplateId + " could not be resolved", e);
        } catch (InconsistentDtoException e) {
            throw new InvalidQueryTemplateModelException(
                "Query " + queryId + " for query template " + queryTemplateId + " specified in query template configuration " +
                " is inconsistent", e);
        }
        
        final QueryTemplate<?> queryTemplate;
        if (templateTypes.contains(SPIN.SELECT_TEMPLATE_CLASS)) {
            queryTemplate = new SelectQueryTemplate(queryTemplateId, label, description,(SelectQuery)queryDto);
        } else if (templateTypes.contains(SPIN.ASK_TEMPLATE_CLASS)) {
            queryTemplate = new AskQueryTemplate(queryTemplateId, label, description, (AskQuery)queryDto);
//        } else if (templateTypes.contains(SPIN.DESCRIBE_TEMPLATE_CLASS)) {
//            queryTemplate = new DescribeQueryTemplate(queryTemplateId, label, description, (DescribeQuery)queryDto);
        } else if (templateTypes.contains(SPIN.CONSTRUCT_TEMPLATE_CLASS)) {            
            queryTemplate =  new ConstructQueryTemplate(queryTemplateId, label, description,(ConstructQuery)queryDto);
        } else if (templateTypes.contains(SPIN.UPDATE_TEMPLATE_CLASS)) {
            queryTemplate =  new UpdateQueryTemplate(queryTemplateId, label, description,(UpdateQuery)queryDto);
        } else { 
            throw new InvalidQueryTemplateModelException(
                "Query template " + queryTemplateId + 
                " must be of type spin:SelectTemplate, spin:ConstructTemplate or spin:AskTemplate.", 
                null /* cause */);
        } 
        
        labelTemplate.ifPresent(t -> queryTemplate.setLabelTemplate(t.stringValue()));
        queryTemplate.addArguments(arguments);
        
        try {
            queryTemplate.assertConsistency();
        } catch (InconsistentDtoException e) {
            throw new InvalidQueryTemplateModelException(
                "Query template " + queryTemplateId + " is inconsistent", e);
        }
        
        return queryTemplate;
    }

    @Override
    public Model dtoToModel(final QueryTemplate<?> dto) {
        throw new NotImplementedException(QueryTemplate.class.getName()  + " to Model is not yet implemented.");
    }

}