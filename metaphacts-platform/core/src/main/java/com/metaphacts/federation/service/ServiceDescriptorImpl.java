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
package com.metaphacts.federation.service;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import javax.annotation.Nullable;

import org.eclipse.rdf4j.model.BNode;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.Resource;
import org.eclipse.rdf4j.model.Statement;
import org.eclipse.rdf4j.model.Value;
import org.eclipse.rdf4j.model.util.Models;
import org.eclipse.rdf4j.model.util.RDFCollections;
import org.eclipse.rdf4j.model.vocabulary.RDF;
import org.eclipse.rdf4j.model.vocabulary.RDFS;
import org.eclipse.rdf4j.model.vocabulary.SP;
import org.eclipse.rdf4j.model.vocabulary.SPIN;
import org.eclipse.rdf4j.query.algebra.StatementPattern;
import org.eclipse.rdf4j.query.algebra.Var;
import org.eclipse.rdf4j.query.algebra.helpers.TupleExprs;

import com.google.common.collect.Lists;
import com.google.common.collect.Maps;
import com.metaphacts.repository.MpRepositoryVocabulary;
import com.metaphacts.vocabulary.SPL;

/**
 * Descriptor for custom services.
 * 
 * @author Andriy Nikolov an@metaphacts.com
 *
 */
public class ServiceDescriptorImpl implements ServiceDescriptor {


    public static class ParameterImpl implements Parameter {

        private String parameterName;
        private Resource parameterId;
        private Resource rootNode;
        private IRI valueType;
        private Map<IRI, Value> propertiesMap = Maps.newHashMap();
        private Value defaultValue = null;

        private List<StatementPattern> subjectPatterns = Lists.newArrayList();
        private List<StatementPattern> objectPatterns = Lists.newArrayList();

        @Override
        public Resource getParameterId() {
            return parameterId;
        }
        
        public void setParameterId(Resource parameterId) {
            this.parameterId = parameterId;
        }

        @Override
        public String getParameterName() {
            return parameterName;
        }
        
        public void setParameterName(String parameterName) {
            this.parameterName = parameterName;
        }

        @Override
        public List<StatementPattern> getSubjectPatterns() {
            return subjectPatterns;
        }
        
        public void setSubjectPatterns(List<StatementPattern> subjectPatterns) {
            this.subjectPatterns = subjectPatterns;
        }

        @Override
        public List<StatementPattern> getObjectPatterns() {
            return objectPatterns;
        }
        
        public void setObjectPatterns(List<StatementPattern> objectPatterns) {
            this.objectPatterns = objectPatterns;
        }

        @Override
        public IRI getValueType() {
            return valueType;
        }
        
        public void setValueType(IRI valueType) {
            this.valueType = valueType;
        }
        
        @Override
        public Resource getRootNode() {
            return rootNode;
        }
        
        public void setRootNode(Resource rootNode) {
            this.rootNode = rootNode;
        }

        public Map<IRI, Value> getPropertiesMap() {
            return propertiesMap;
        }
        
        public void setPropertiesMap(Map<IRI, Value> propertiesMap) {
            this.propertiesMap = propertiesMap;
        }

        @Override
        public Optional<Value> getDefaultValue() {
            return Optional.ofNullable(defaultValue);
        }

        public void setDefaultValue(Value defaultValue) {
            this.defaultValue = defaultValue;
        }
    }


    /** The name of the Turtle file (without the .ttl extension) */
    private final String serviceId;

    private IRI serviceIRI;
    private String label = null;

    private List<StatementPattern> statementPatterns = Lists.newArrayList();

    private Map<String, Parameter> inputParameters = Maps.newHashMap();
    private Map<String, Parameter> outputParameters = Maps.newHashMap();
    private List<String> outputBindingNames = Lists.newArrayList();
    
    private Model model;

    public ServiceDescriptorImpl() {
        this(null);
    }

    public ServiceDescriptorImpl(@Nullable String serviceId) {
        this.serviceId = serviceId;
    }

    @Override
    public String getServiceId() {
        return serviceId;
    }
    
    public void setInputParameters(Map<String, Parameter> inputParameters) {
        this.inputParameters.putAll(inputParameters);
    }
    
    public void setOutputParameters(Map<String, Parameter> outputParameters) {
        this.outputParameters.putAll(outputParameters);
    }

    public void setOutputBindingNames(List<String> outputProjections) {
        this.outputBindingNames = outputProjections;
    }

    public void parse(Model model, IRI serviceIRI) {
        this.model = model;
        Map<Resource, ParameterImpl> parametersByIRI = Maps.newHashMap();
        
        this.serviceIRI = serviceIRI;
        
        Optional<Literal> optLabel = Models.getPropertyLiteral(model, serviceIRI, RDFS.LABEL);
        if (optLabel.isPresent()) {
            this.label = optLabel.get().stringValue();
        }

        Set<Resource> inputs = Models
                .objectResources(model.filter(serviceIRI, SPIN.CONSTRAINT_PROPERTY, null));
        inputs.stream().filter(input -> model.contains(input, RDF.TYPE, SPL.ARGUMENT_CLASS))
                .map(input -> parseParameter(model, input)).forEach(param -> {
                    inputParameters.put(param.getParameterName(), param);
                    parametersByIRI.put(param.getParameterId(), param);
                });

        Set<Resource> outputs = Models
                .objectResources(model.filter(serviceIRI, SPIN.COLUMN_PROPERTY, null));
        outputs.stream().filter(output -> model.contains(output, RDF.TYPE, SPIN.COLUMN_CLASS))
                .map(input -> parseParameter(model, input)).forEach(param -> {
                    outputParameters.put(param.getParameterName(), param);
                    parametersByIRI.put(param.getParameterId(), param);
                });

        Resource sparqlPattern = Models.objectResource(model.filter(serviceIRI, MpRepositoryVocabulary.HAS_SPARQL_PATTERN, null))
                .get();

        List<Value> items = RDFCollections.asValues(model, sparqlPattern, Lists.newArrayList());

        items.stream().map(item -> (Resource) item).map(item -> parseStatementPattern(item, model, parametersByIRI))
                .forEach(stmtPattern -> statementPatterns.add(stmtPattern));
    }

    protected ParameterImpl parseParameter(Model model, Resource resource) {
        ParameterImpl parameter = new ParameterImpl();
        Optional<Resource> varOptional = Models
                .objectResource(model.filter(resource, SPL.PREDICATE_PROPERTY, null));
        parameter.rootNode = resource;
        parameter.parameterId = varOptional.get();
        if (parameter.parameterId instanceof BNode) {
            parameter.parameterName = ((BNode) parameter.parameterId).getID();
        } else if ((parameter.parameterId instanceof IRI)) {
            String id = ((IRI)parameter.parameterId).getLocalName();
            if(!id.startsWith("_")) {
                throw new IllegalArgumentException(
                        "parameterId can be reprepresented by a blank node or a URI starting with '_'");
            } 
            parameter.parameterName = id.substring(1);
        } 

        Optional<IRI> typeOptional = Models
                .objectIRI(model.filter(resource, SPL.VALUETYPE_PROPERTY, null));
        if (typeOptional.isPresent()) {
            parameter.valueType = typeOptional.get();
        }
        
        for (Statement stmt : model.filter(resource, null, null)) {
            parameter.propertiesMap.put(stmt.getPredicate(), stmt.getObject());
        }
        
        Optional<Value> defaultValue = Models.object(model.filter(resource, SPL.DEFAULT_VALUE_PROPERTY, null));
        if (defaultValue.isPresent()) {
            parameter.setDefaultValue(defaultValue.get());
        }

        return parameter;
    }

    protected StatementPattern parseStatementPattern(Resource resource, Model model,
            Map<Resource, ParameterImpl> paramMap) {
        StatementPattern pattern = new StatementPattern();

        Value subj = Models.object(model.filter(resource, SP.SUBJECT_PROPERTY, null))
                .get();
        Value predicate = Models
                .object(model.filter(resource, SP.PREDICATE_PROPERTY, null)).get();
        Value obj = Models.object(model.filter(resource, SP.OBJECT_PROPERTY, null))
                .get();
        
        pattern.setSubjectVar(parseToVar(subj));
        pattern.setPredicateVar(parseToVar(predicate));
        pattern.setObjectVar(parseToVar(obj));
        
        if ((subj instanceof Resource) && paramMap.containsKey(subj)) {
            paramMap.get(subj).subjectPatterns.add(pattern);
        }
        if ((obj instanceof Resource) && paramMap.containsKey(obj)) {
            paramMap.get(obj).objectPatterns.add(pattern);
        }

        return pattern;
    }
    
    protected Var parseToVar(Value res) {
        String id = null;
        if (res instanceof BNode) {
            return new Var(((BNode) res).getID());
        } else if (res instanceof IRI) {
            id = ((IRI) res).getLocalName();
            if (id.startsWith("_")) {
                id = id.substring(1);
                return new Var(id);
            }
        }
        return TupleExprs.createConstVar(res);
    }
    
    
    @Override
    public IRI getServiceIRI() {
        return serviceIRI;
    }
    
    @Override
    public String getLabel() {
        return label;
    }

    @Override
    public List<StatementPattern> getStatementPatterns() {
        return statementPatterns;
    }

    public void setStatementPatterns(List<StatementPattern> statementPatterns) {
        this.statementPatterns = statementPatterns;
    }

    @Override
    public Map<String, Parameter> getInputParameters() {
        return this.inputParameters;
    }

    @Override
    public Map<String, Parameter> getOutputParameters() {
        return this.outputParameters;
    }

    @Override
    public List<String> getOutputBindingNames() {
        return outputBindingNames;
    }

    @Override
    public Model getModel() {
        return model;
    }
}
