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
package com.metaphacts.util;

import org.codehaus.jackson.JsonNode;
import org.codehaus.jackson.map.ObjectMapper;
import org.eclipse.rdf4j.RDF4JException;

/**
 * @author Johannes Trame <jt@metaphacts.com>
 */
public class ExceptionUtils {

    /**
     * Will try to extract the root exception message if the root is is a
     * {@link RDF4JException}.
     * 
     * <p>
     * This method implements special logic for Stardog to unwrap the original erorr
     * message from a JSON object.
     * </p>
     * 
     * @param e
     * @return The exception message of the root exception if not null. Otherwise
     *         the plain exception message from the original exception (which might
     *         be null)
     */
  public static String extractSparqlExceptionMessage(Exception e) {
    String message = e.getMessage();
    Throwable rootCause = org.apache.commons.lang3.exception.ExceptionUtils.getRootCause(e);

    /*
     * TODO this may not belong here but might be better improved upstream
     * RDF4J and or FedX wraps exceptions and does not propagate the original exception message.
     * Example:
     * Caused by: org.eclipse.rdf4j.repository.RepositoryException: error executing transaction
        at org.eclipse.rdf4j.repository.sparql.SPARQLConnection.commit(SPARQLConnection.java:421) ~[rdf4j-repository-sparql-3.4.0.jar:3.4.0+ace0473]
        at org.eclipse.rdf4j.federated.write.RepositoryWriteStrategy.commit(RepositoryWriteStrategy.java:55) ~[rdf4j-tools-federation-3.4.0.jar:3.4.0+ace0473]
        at org.eclipse.rdf4j.federated.FedXConnection.commitInternal(FedXConnection.java:199) ~[rdf4j-tools-federation-3.4.0.jar:3.4.0+ace0473]
        at org.eclipse.rdf4j.sail.helpers.AbstractSailConnection.commit(AbstractSailConnection.java:395) ~[rdf4j-sail-api-3.4.0.jar:3.4.0+ace0473]
        at org.eclipse.rdf4j.repository.sail.SailRepositoryConnection.commit(SailRepositoryConnection.java:206) ~[rdf4j-repository-sail-3.4.0.jar:3.4.0+ace0473]
       Caused by: org.eclipse.rdf4j.query.UpdateExecutionException: {"message":"ICV validation failed.."}
        at org.eclipse.rdf4j.repository.sparql.query.SPARQLUpdate.execute(SPARQLUpdate.java:47) ~[rdf4j-repository-sparql-3.4.0.jar:3.4.0+ace0473]
        at org.eclipse.rdf4j.repository.sparql.SPARQLConnection.commit(SPARQLConnection.java:419) ~[rdf4j-repository-sparql-3.4.0.jar:3.4.0+ace0473]
        at org.eclipse.rdf4j.federated.write.RepositoryWriteStrategy.commit(RepositoryWriteStrategy.java:55) ~[rdf4j-tools-federation-3.4.0.jar:3.4.0+ace0473]
        at org.eclipse.rdf4j.federated.FedXConnection.commitInternal(FedXConnection.java:199) ~[rdf4j-tools-federation-3.4.0.jar:3.4.0+ace0473]
        at org.eclipse.rdf4j.sail.helpers.AbstractSailConnection.commit(AbstractSailConnection.java:395) ~[rdf4j-sail-api-3.4.0.jar:3.4.0+ace0473]
        at org.eclipse.rdf4j.repository.sail.SailRepositoryConnection.commit(SailRepositoryConnection.java:206) ~[rdf4j-repository-sail-3.4.0.jar:3.4.0+ace0473]
        ... 95 more
       Caused by: org.eclipse.rdf4j.repository.RepositoryException: {"message":"ICV validation failed.."}
     */
    if ((rootCause instanceof RDF4JException) && rootCause.getMessage() != null) {
      // only if it is a RDF4J Exception, we trust it and extract the root message
      message = rootCause.getMessage();
    }

    return tryToExtractStardogError(message);
  }

    /**
     * Stardog sends error messages as JSON objects in the response body (
     * {"message":"xy"} ). This message checks whether it is a JSON string and tries
     * to extract the message.
     * 
     * If it is not successful, it will always return the original message string.
     * 
     * @param message
     * @return
     */
  private static String tryToExtractStardogError(String message) {
    
    try {
      JsonNode jsonObject;

      jsonObject = new ObjectMapper().readTree(message);
      if (jsonObject != null && jsonObject.get("message") != null) {
        message = jsonObject.get("message").getTextValue();
      }
    } catch (Throwable e1) {
      return message;
    }

    return message;
  }
}
