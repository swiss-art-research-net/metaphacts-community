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

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.model.Resource;
import org.eclipse.rdf4j.model.Value;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.model.vocabulary.XMLSchema;
import org.eclipse.rdf4j.query.algebra.StatementPattern;
import org.eclipse.rdf4j.query.algebra.Var;
import org.eclipse.rdf4j.query.impl.MapBindingSet;

import com.jayway.jsonpath.JsonPath;
import com.jayway.jsonpath.PathNotFoundException;
import com.metaphacts.sail.rest.AbstractServiceWrappingSailConnection.RESTParametersHolder;

/**
 * Util class for common {@link AbstractServiceWrappingSailConnection} routines, 
 * in particular, for extracting input and output parameters from the 
 * SPARQL {@link StatementPattern}s passed to the service.
 *  
 * @author Andriy Nikolov an@metaphacts.com
 */
public class RESTWrappingSailUtils {
    
    private static final Logger logger = LogManager.getLogger(RESTWrappingSailUtils.class);

    private static final ValueFactory VF = SimpleValueFactory.getInstance();
    
    private RESTWrappingSailUtils() {

    }
    
    /**
     * Collects constants (either literals or resources) which appear as objects 
     * of <code>propertyIri</code> and (optional) <code>subjectVariable</code>. 
     * 
     * @param statementPatterns
     * @param subjectVariable
     * @param propertyIri
     * @return
     */
    public static List<Value> getObjectInputParameters(Collection<StatementPattern> statementPatterns,
            Var subjectVariable,
            IRI propertyIri) {
        return statementPatterns.stream().filter(stmtPattern -> (predicateAndSubjectVarMatch(stmtPattern, subjectVariable, propertyIri) 
                && stmtPattern.getObjectVar().hasValue())).map(stmtPattern -> stmtPattern.getObjectVar().getValue()).collect(Collectors.toList());
    }
    
    /**
     * Collects {@Literal} constants which appear as objects 
     * of <code>propertyIri</code> and (optional) <code>subjectVariable</code>. 
     * 
     * @param statementPatterns
     * @param subjectVariable
     * @param propertyIri
     * @return
     */
    public static List<Literal> getLiteralObjectInputParameters(
            Collection<StatementPattern> statementPatterns,
            Var subjectVariable,
            IRI propertyIri) {
        return getObjectInputParameters(statementPatterns, subjectVariable, propertyIri).stream()
                .filter(val -> (val instanceof Literal)).map(val -> (Literal) val)
                .collect(Collectors.toList());
    }
    
    /**
     * Collects {Resource} constants which appear as objects 
     * of <code>propertyIri</code> and (optional) <code>subjectVariable</code>. 
     * 
     * @param statementPatterns
     * @param subjectVariable
     * @param propertyIri
     * @return
     */
    public static List<Resource> getResourceObjectInputParameters(
            Collection<StatementPattern> statementPatterns,
            Var subjectVariable,
            IRI propertyIri) {
        return getObjectInputParameters(statementPatterns, subjectVariable, propertyIri).stream()
                .filter(val -> (val instanceof Resource)).map(val -> (Resource) val)
                .collect(Collectors.toList());
    }
    
    
    /**
     * Retrieves a single constant (either literal or resource) which appears as an object 
     * of <code>propertyIri</code> and (optional) <code>subjectVariable</code>. 
     * 
     * @param statementPatterns
     * @param subjectVariable
     * @param propertyIri
     * @return
     */
    public static Optional<Value> getObjectInputParameter(Collection<StatementPattern> statementPatterns,
            Var subjectVariable,
            IRI propertyIri) {
        List<Value> objValues = getObjectInputParameters(statementPatterns, subjectVariable, propertyIri);
        return objValues.isEmpty() ? Optional.empty() : Optional.of(objValues.iterator().next());
    }
    
    /**
     * Retrieves a single {@Literal} constant which appears as an object 
     * of <code>propertyIri</code> and (optional) <code>subjectVariable</code>. 
     * 
     * @param statementPatterns
     * @param subjectVariable
     * @param propertyIri
     * @return
     */
    public static Optional<Literal> getLiteralObjectInputParameter(
            Collection<StatementPattern> statementPatterns,
            Var subjectVariable,
            IRI propertyIri) {
        List<Literal> objLiterals = getLiteralObjectInputParameters(statementPatterns, subjectVariable, propertyIri);
        return objLiterals.isEmpty() ? Optional.empty() : Optional.of(objLiterals.iterator().next());
    }
    
    /**
     * Retrieves a single {@Resource} constant which appears as an object 
     * of <code>propertyIri</code> and (optional) <code>subjectVariable</code>. 
     * 
     * @param statementPatterns
     * @param subjectVariable
     * @param propertyIri
     * @return
     */
    public static Optional<Resource> getResourceObjectInputParameter(
            Collection<StatementPattern> statementPatterns,
            Var subjectVariable,
            IRI propertyIri) {
        List<Resource> objResources = getResourceObjectInputParameters(statementPatterns, subjectVariable, propertyIri);
        return objResources.isEmpty() ? Optional.empty() : Optional.of(objResources.iterator().next());
    }
    
    /**
     * Retrieves a variable appearing as object of <code>propertyIri</code> and
     * (optional) <code>subjectVariable</code>.
     * 
     * Note: the Variable may be bound to {@link Value}
     * 
     * @param statementPatterns
     * @param subjectVariable
     * @param propertyIri
     * @return
     */
    public static Optional<Var> getObjectOutputVariable(
            Collection<StatementPattern> statementPatterns,
            Var subjectVariable,
            IRI propertyIri) {
        return statementPatterns.stream().filter(stmtPattern -> 
            (predicateEquals(stmtPattern, propertyIri)
                && ((subjectVariable == null) || subjectEquals(stmtPattern, subjectVariable)))
            ).map(stmtPattern -> stmtPattern.getObjectVar()).findFirst();
    }
    
    /**
     * Retrieves a variable appearing as subject of 
     * <code>propertyIri</code> and (optional) <code>objectVariable</code>. 
     * 
     * @param statementPatterns
     * @param subjectVariable
     * @param propertyIri
     * @return
     */
    public static Optional<Var> getSubjectOutputVariable(
            Collection<StatementPattern> statementPatterns,
            Var objectVariable,
            IRI propertyIri) {
        return statementPatterns.stream().filter(stmtPattern -> 
            (predicateEquals(stmtPattern, propertyIri)
                && ((objectVariable == null) || objectEquals(stmtPattern, objectVariable))
                && isVariable(stmtPattern.getSubjectVar()))
            ).map(stmtPattern -> stmtPattern.getSubjectVar()).findFirst();
    }
    
    public static void addBindingIfExists(RESTParametersHolder parametersHolder,
            Map<String, Object> resMap, MapBindingSet bs, String key, IRI propertyIri,
            IRI dataType) {
        if (parametersHolder.getOutputVariables().containsKey(propertyIri)) {
            Object objVal = resMap.get(key);
            String variableName = parametersHolder.getOutputVariables().get(propertyIri);
            addToBindingSet(bs, variableName, objVal, dataType);
        }
    }
    
    public static void addBindingFromJsonPathIfExists(RESTParametersHolder parametersHolder,
            Object resMap, MapBindingSet bs, String key, IRI propertyIri, IRI dataType,
            String jsonPath) {
        if (parametersHolder.getOutputVariables().containsKey(propertyIri)) {
            try {
                Object objVal = JsonPath.read(resMap, jsonPath);
                String variableName = parametersHolder.getOutputVariables().get(propertyIri);
                addToBindingSet(bs, variableName, objVal, dataType);
            } catch (PathNotFoundException e) {
                // legit situation: the path not present, we just skip the variable
                logger.trace("Skipping property {}, value not present in row {}", propertyIri, resMap);
            }
        }
    }
    
    /**
     * Method to check whether a given bound output value is part of the JSON
     * response from the endpoint.
     * 
     * @param resMap
     * @param boundValue
     * @param dataType
     * @param jsonPath
     * @return true if the bound output matches the result
     */
    public static boolean boundOutputMatches(Object resMap, Value boundValue, IRI dataType, String jsonPath) {

        try {
            Object objVal = JsonPath.read(resMap, jsonPath);
            Value outputValue = toValue(objVal, dataType);
            return outputValue.equals(boundValue);
        } catch (PathNotFoundException e) {
            // legit situation: the path not present, we just skip the variable and assume
            // it matches
            return true;
        }
    }

    private static void addToBindingSet(MapBindingSet bs, String variableName, Object objVal,
            IRI dataType) {
        // support for optional values
        if (objVal == null) {
            return;
        }
        Value rdfValue = toValue(objVal, dataType);
        bs.addBinding(variableName, rdfValue);
    }
    
    private static Value toValue(Object objVal, IRI dataType) {
        if (dataType.equals(XMLSchema.ANYURI)) {
            return VF.createIRI(objVal.toString());
        } else {
            return VF.createLiteral(objVal.toString(), dataType);
        }
    }

    private static boolean predicateEquals(StatementPattern pattern, IRI propertyIri) {
        return pattern.getPredicateVar().hasValue() && pattern.getPredicateVar().getValue().equals(propertyIri);
    }
    
    private static boolean subjectEquals(StatementPattern pattern, Resource resource) {
        return pattern.getSubjectVar().hasValue() && pattern.getSubjectVar().getValue().equals(resource);
    }
    
    private static boolean subjectEquals(StatementPattern pattern, String varName) {
        return (!pattern.getSubjectVar().hasValue()) && pattern.getSubjectVar().getName().equals(varName);
    }
    
    private static boolean subjectEquals(StatementPattern pattern, Var subjectVar) {
        return subjectVar.hasValue() ? subjectEquals(pattern, (Resource)subjectVar.getValue()) : subjectEquals(pattern, subjectVar.getName());
    }
    
    private static boolean objectEquals(StatementPattern pattern, Value resource) {
        return pattern.getObjectVar().hasValue() && pattern.getObjectVar().getValue().equals(resource);
    }
    
    private static boolean objectEquals(StatementPattern pattern, String varName) {
        return (!pattern.getObjectVar().hasValue()) && pattern.getObjectVar().getName().equals(varName);
    }
    
    private static boolean objectEquals(StatementPattern pattern, Var objectVar) {
        return objectVar.hasValue() ? objectEquals(pattern, objectVar.getValue()) : objectEquals(pattern, objectVar.getName());
    }
    
    private static boolean predicateAndSubjectVarMatch(StatementPattern stmtPattern, Var subjectVariable, IRI propertyIri) {
        return predicateEquals(stmtPattern, propertyIri)
                && ((subjectVariable == null) || subjectEquals(stmtPattern, subjectVariable));
    }
    
    private static boolean isVariable(Var var) {
        return !var.hasValue();
    }

}
