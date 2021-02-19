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
package com.metaphacts.lookup.impl;

import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.Resource;
import org.eclipse.rdf4j.model.util.Models;

import com.metaphacts.lookup.spi.LookupServiceConfigException;

/**
 * Configuration for query patterns for lookup queries based on SPARQL.
 * 
 * @author Wolfgang Schell <ws@metaphacts.com>
 */
public class SparqlQueryLookupConfig extends RepositoryBasedLookupConfig {
    private String entityTypesQuery;
    private String datasetQuery;
    private String queryTemplate;
    private String searchBlockTemplate;
    private String typeBlockTemplate;
    private String objectPropertyBlockTemplate;
    private String dataPropertyBlockTemplate;

    public SparqlQueryLookupConfig() {
        super(GenericSparqlLookupServiceFactory.LOOKUP_TYPE);
    }
    
    public SparqlQueryLookupConfig(String type) {
        super(type);
    }

    /**
     * Sparql-query to retrieve a set of available Entity-types.
     * The <pre>?type</pre> variable must be defined as output variable.
     *
     * @default SELECT ?type WHERE {
     *  {SELECT DISTINCT ?type WHERE {?subject a ?type .}}
     *  FILTER ISIRI(?type)
     * }
     */
    public String getEntityTypesQuery() {
        return entityTypesQuery;
    }
    
    public void setEntityTypesQuery(String entityTypesQuery) {
        this.entityTypesQuery = entityTypesQuery;
    }

    /**
     * Sparql-query to retrieve candidate's dataset.
     * 
     * <p>
     * Output variables: <pre>?candidate</pre>, <pre>?dataset</pre>, <pre>?datsetLabel</pre>.
     * The <pre>?candidate</pre> is a binding variable. <pre>?candidate</pre> is instantiated 
     * by adding to the end of the query following pattern <pre>VALUES (?candidate) { ... }</pre>.
     * </p>
     * 
     * Example:
     * <pre>
     * SELECT DISTINCT ?candidate ?dataset ?datsetLabel WHERE {
     *  GRAPH ?dataset {
     *      ?candidate a ?type .
     *  }
     *  ?dataset rdfs:label ?datsetLabel .
     * }
     * </pre>
     */
    public String getDatasetQuery() {
        return datasetQuery;
    }
    
    public void setDatasetQuery(String datasetQuery) {
        this.datasetQuery = datasetQuery;
    }

    /**
     * Get query template. The template may have some insertion patterns which are filled
     * by additional fragments.
     * 
     * <p>
     * Available placeholders: <pre>{{static_uuid}}</pre>, <pre>{{search_block}}</pre>, 
     * <pre>{{properties_block}}</pre>, <pre>{{limit_block}}</pre>, <pre>{{type_block}}</pre>. 
     * It is expected to have following variables as a result: ?candidate, ?types, ?score. 
     * And in the default configuration it's expected to have following variables as input 
     * from inner blocks: ?type and ?score_private (from <pre>{{search_block}}</pre>)
     * </p>
     * 
     * Example:
     * <pre>
     * SELECT
     *     ?candidate
     *     (GROUP_CONCAT(DISTINCT ?type ; separator=",") as ?types)
     *     (MAX(?score_private) as ?score)
     * WHERE {
     *     {{type_block}}
     *     {{search_block}}
     *     {{properties_block}}
     * } GROUP BY ?candidate ORDER BY DESC(?score) {{limit_block}}
     * </pre>
     * @return query template
     */
    public String getQueryTemplate() {
        return queryTemplate;
    }
    
    public void setQueryTemplate(String queryTemplate) {
        this.queryTemplate = queryTemplate;
    }

    /**
     * Get template for search block.
     * 
     * <p>
     * Defines custom template for <code>{{search_block}}</code> part in the queryTemplate. This part 
     * in general performs filtration by token, but also returns ?type and ?score_private variables. 
     * Available placeholders: <code>{{static_uuid}}</code>. Available bindings: ?__token__. In the 
     * default configuration it is expected to have following variables as a result: ?score_private.
     * </p>
     * 
     * Example:
     * <pre>
     * ?candidate a ?type.
     * ?candidate ?keyProp ?key.
     * FILTER ISLITERAL(?key)
     * BIND(IF(
     *      STRLEN(?key) > STRLEN(?__token__),
     *      STRLEN(?__token__) - STRLEN(?key),
     *      IF(
     *          STRLEN(?key) < STRLEN(?__token__),
     *          STRLEN(?key) - STRLEN(?__token__),
     *          "0"
     *      )
     * )  as ?score_private)
     * FILTER REGEX(LCASE(?key), LCASE(?__token__), "i").
     * </pre>
     */
    public String getSearchBlockTemplate() {
        return searchBlockTemplate;
    }
    
    public void setSearchBlockTemplate(String searchBlockTemplate) {
        this.searchBlockTemplate = searchBlockTemplate;
    }

    /**
     * Get type block template.
     * 
     * <p>
     * Defines custom template for <code>{{type_block}}</code> part in the queryTemplate. 
     * Performs filtration by selected type. Depending on lookup-request can be skipped by builder. 
     * Available placeholders: <code>{{static_uuid}}</code>. Available bindings: ?__type__.
     * </p>
     * 
     * Example:
     * <pre>
     * ?candidate a ?__type__.
     * </pre>
     * @return
     */
    public String getTypeBlockTemplate() {
        return typeBlockTemplate;
    }
    
    public void setTypeBlockTemplate(String typeBlockTemplate) {
        this.typeBlockTemplate = typeBlockTemplate;
    }

    /**
     * Get object block template.
     * 
     * <p>
     * Defines custom template for all object property blocks from the <code>{{properties_block}}</code>
     * part in the queryTemplate. Available placeholders: <code>{{static_uuid}}</code>.
     * Available bindings: ?__property__, ?__object__.
     * </p>
     * 
     * Example:
     * <pre>
     * ?candidate ?__property__ ?__object__.
     * </pre>
     * @return
     */
    public String getObjectPropertyBlockTemplate() {
        return objectPropertyBlockTemplate;
    }
    
    public void setObjectPropertyBlockTemplate(String objectPropertyBlockTemplate) {
        this.objectPropertyBlockTemplate = objectPropertyBlockTemplate;
    }

    /**
     * Get data block template.
     * 
     * <p>
     * Defines custom template for all data property blocks from the <code>{{properties_block}}</code> 
     * part in the queryTemplate. Available placeholders: <code>{{static_uuid}}</code>. 
     * Available bindings: ?__property__, ?__literal__.
     * </p>
     * 
     * Example:
     * <pre>
     * ?candidate ?__property__ ?value{{static_uuid}}.
     * FILTER ISLITERAL(?value{{static_uuid}})
     * FILTER (STR(?value{{static_uuid}}) = STR(?__literal__))
     * </pre>
     * @return
     */
    public String getDataPropertyBlockTemplate() {
        return dataPropertyBlockTemplate;
    }
    
    public void setDataPropertyBlockTemplate(String dataPropertyBlockTemplate) {
        this.dataPropertyBlockTemplate = dataPropertyBlockTemplate;
    }
    
    @Override
    public Resource export(Model model) {
        Resource implNode = super.export(model);
        
        if (getEntityTypesQuery() != null) {
            model.add(implNode, LOOKUP_QUERY_ENTITYTYPES, VF.createLiteral(getEntityTypesQuery()));
        }
        if (getDatasetQuery() != null) {
            model.add(implNode, LOOKUP_QUERY_DATASET, VF.createLiteral(getDatasetQuery()));
        }
        if (getQueryTemplate() != null) {
            model.add(implNode, LOOKUP_QUERY_TEMPLATE, VF.createLiteral(getQueryTemplate()));
        }
        if (getSearchBlockTemplate() != null) {
            model.add(implNode, LOOKUP_QUERY_SEARCHBLOCKTEMPLATE, VF.createLiteral(getSearchBlockTemplate()));
        }
        if (getTypeBlockTemplate() != null) {
            model.add(implNode, LOOKUP_QUERY_TYPEBLOCKTEMPLATE, VF.createLiteral(getTypeBlockTemplate()));
        }
        if (getObjectPropertyBlockTemplate() != null) {
            model.add(implNode, LOOKUP_QUERY_OBJECTPROPERTYBLOCKTEMPLATE, VF.createLiteral(getObjectPropertyBlockTemplate()));
        }
        if (getDataPropertyBlockTemplate() != null) {
            model.add(implNode, LOOKUP_QUERY_DATAPROPERTYBLOCKTEMPLATE, VF.createLiteral(getDataPropertyBlockTemplate()));
        }
        
        return implNode;
    }
    
    @Override
    public void parse(Model model, Resource resource) throws LookupServiceConfigException {
        super.parse(model, resource);
        
        Models.objectLiteral(model.filter(resource, LOOKUP_QUERY_ENTITYTYPES, null))
            .ifPresent(literal -> setEntityTypesQuery(literal.stringValue()));
        
        Models.objectLiteral(model.filter(resource, LOOKUP_QUERY_DATASET, null))
            .ifPresent(literal -> setDatasetQuery(literal.stringValue()));
        
        Models.objectLiteral(model.filter(resource, LOOKUP_QUERY_TEMPLATE, null))
            .ifPresent(literal -> setQueryTemplate(literal.stringValue()));
        
        Models.objectLiteral(model.filter(resource, LOOKUP_QUERY_SEARCHBLOCKTEMPLATE, null))
            .ifPresent(literal -> setSearchBlockTemplate(literal.stringValue()));
        
        Models.objectLiteral(model.filter(resource, LOOKUP_QUERY_TYPEBLOCKTEMPLATE, null))
            .ifPresent(literal -> setTypeBlockTemplate(literal.stringValue()));
        
        Models.objectLiteral(model.filter(resource, LOOKUP_QUERY_OBJECTPROPERTYBLOCKTEMPLATE, null))
            .ifPresent(literal -> setObjectPropertyBlockTemplate(literal.stringValue()));
        
        Models.objectLiteral(model.filter(resource, LOOKUP_QUERY_DATAPROPERTYBLOCKTEMPLATE, null))
            .ifPresent(literal -> setDataPropertyBlockTemplate(literal.stringValue()));
    }
}
