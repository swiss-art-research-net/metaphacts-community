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
package com.metaphacts.api.rest.client;

import java.net.HttpURLConnection;
import java.net.URL;

import org.apache.commons.codec.binary.Base64;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.rio.RDFFormat;
import org.eclipse.rdf4j.rio.RDFParser;
import org.eclipse.rdf4j.rio.Rio;
import org.eclipse.rdf4j.rio.helpers.StatementCollector;

/**
 * Default implementation of {@link APIClientBase}.
 * 
 * @author msc
 */
public class APIClientBaseImpl implements APIClientBase {

	private String endpoint;
	private String user;
	private String password;
	private IRI baseIri;

	public APIClientBaseImpl(
	    String endpoint, String user, String password, IRI baseIri) {
		
	    this.endpoint = endpoint;
	    this.user = user;
	    this.password = password;
		this.baseIri = baseIri;
	}

	@Override
	public String getEndpoint() {
		return endpoint;
	}
	

    @Override
    public String getUser() {
        return user;
    }
    

    @Override
    public String getPassword() {
        return password;
    }
	
	@Override
	public IRI getBaseIri() {
		return baseIri;
	}


	/**
	 * Submits a GET request and converts the result into a {@link Model}.
	 * 
	 * @param pathFromEndpoint path relative to the endpoint (without leading /)
	 * 
	 * @return the model or null, in case something went wrong with the request
	 * @throws APICallFailedException 
	 */
	@Override
	public Model submitGET(final String pathFromEndpoint) 
	throws APICallFailedException  {
		
		HttpURLConnection conn = null;
		
		try {
			
			final StringBuffer buf = new StringBuffer();
			buf.append(getEndpoint());
			buf.append("/");
			buf.append(pathFromEndpoint);
	
			final URL url = new URL(buf.toString());
			
			conn = (HttpURLConnection) url.openConnection();
			conn.setRequestMethod("GET");
			
			// set basic auth header, if credentials specified
			if (user!=null && !user.isEmpty() && password!=null) {
			    String userCredentials = user + ":" + password;
			    String basicAuth = 
			       "Basic " + new String(new Base64().encode(userCredentials.getBytes()));
			    conn.setRequestProperty ("Authorization", basicAuth);
			}
	
			if (conn.getResponseCode() != 200) {
				throw new APICallFailedException(
					"API call failed with HTTP error code '" + 
					conn.getResponseCode() + "'");
			}
	
			RDFParser rdfParser = Rio.createParser(RDFFormat.N3);
			Model model = new org.eclipse.rdf4j.model.impl.LinkedHashModel();
			rdfParser.setRDFHandler(new StatementCollector(model));

			rdfParser.parse(conn.getInputStream(), baseIri.stringValue());

			return model;
			

		} catch (Exception e) {
		
			throw new APICallFailedException(
			    "API call failed with message '" + e.getMessage() + "'");
			
		} finally {
			
			if (conn!=null) {
				conn.disconnect();
			}
			
		}
	
	}
}