/*
 * Copyright (C) 2015-2016, metaphacts GmbH
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
package com.metaphacts.api.rest.client;

import java.util.List;

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Resource;

import com.metaphacts.api.dto.queryform.QueryFormConfiguration;
import com.metaphacts.api.dto.querytemplate.AskQueryTemplate;
import com.metaphacts.api.dto.querytemplate.ConstructQueryTemplate;
import com.metaphacts.api.dto.querytemplate.QueryTemplate;
import com.metaphacts.api.dto.querytemplate.SelectQueryTemplate;

/**
 * API for query form configurations, 
 * providing convenient access to stored configurations.
 * 
 * @author msc
 */
public interface QueryFormCatalogAPIClient extends LDPAPIDtoClient<QueryFormConfiguration<QueryTemplate<?>>>{

	/**
	 * Return all query form configurations.
	 */
	public List<QueryFormConfiguration<QueryTemplate<?>>> getFormConfigurations() 
	throws APICallFailedException;
	
	/**
	 * Return all SELECT query backed query form configuration.
	 */
	public List<QueryFormConfiguration<SelectQueryTemplate>> getSelectBasedFormConfigurations() 
	throws APICallFailedException;
	
	/**
	 * Return all CONSTRUCT query backed query form configuration.
	 */
	public List<QueryFormConfiguration<ConstructQueryTemplate>> getConstructBasedFormConfigurations() 
	throws APICallFailedException;
	
	/**
	 * Return all ASK query backed query form configuration.
	 */
	public List<QueryFormConfiguration<AskQueryTemplate>> getAskBasedFormConfigurations() 
	throws APICallFailedException;
	
	/**
	 * Returns the query form configuration with the given {@link IRI}. 
	 * 
	 * @param FormConfigurationId the configuration's ID
	 * @return the configuration or null if the ID could not be resolved or does not reflect an query form configuration
	 */
	public QueryFormConfiguration<QueryTemplate<?>> getFormConfiguration(Resource FormConfigurationId) 
	throws APICallFailedException;

	/**
	 * Returns the query form configuration with the given {@link IRI} if its underlying template is
	 * a SELECT query, null otherwise.
	 * 
	 * @param FormConfigurationId the configuration's ID
	 * @return the configuration or null if the ID could not be resolved or does not reflect an query form configuration
	 */
	public QueryFormConfiguration<SelectQueryTemplate> getSelectBasedFormConfiguration(Resource FormConfigurationId) 
	throws APICallFailedException;
	
	/**
	 * Returns the query form configuration with the given {@link IRI} if its underlying template is
	 * a CONSTRUCT query, null otherwise.
	 * 
	 * @param FormConfigurationId the configuration's ID
	 * @return the configuration or null if the ID could not be resolved or does not reflect an query form configuration
	 */
	public QueryFormConfiguration<ConstructQueryTemplate> getConstructBasedFormConfiguration(Resource FormConfigurationId) 
	throws APICallFailedException;
	
	/**
	 * Returns the query form configuration with the given {@link IRI} if its underlying template is
	 * an ASK query, null otherwise.
	 * 
	 * @param FormConfigurationId the configuration's ID
	 * @return the configuration or null if the ID could not be resolved or does not reflect an query form configuration
	 */
	public QueryFormConfiguration<AskQueryTemplate> getAskBasedFormConfiguration(Resource FormConfigurationId) 
	throws APICallFailedException;

}