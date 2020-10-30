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
package com.metaphacts.rest.endpoint;

import static javax.ws.rs.core.MediaType.APPLICATION_JSON;

import java.io.BufferedWriter;
import java.io.IOException;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.util.Set;

import javax.inject.Inject;
import javax.inject.Singleton;
import javax.validation.constraints.NotNull;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.Status;
import javax.ws.rs.core.StreamingOutput;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.shiro.authz.annotation.RequiresAuthentication;
import org.eclipse.rdf4j.model.IRI;
import org.semanticweb.owlapi.model.OWLOntology;

import com.google.common.base.Charsets;
import com.google.common.base.Throwables;

import de.uni_stuttgart.vis.vowl.owl2vowl.Converter;
import de.uni_stuttgart.vis.vowl.owl2vowl.export.types.Exporter;
import io.swagger.v3.oas.annotations.Hidden;

/**
 * @author Johannes Trame <jt@metaphacts.com>
 *
 */
@Singleton
@Path("ontologies")
public class OntologyManagerEndpoint {
    private static final Logger logger = LogManager.getLogger(OntologyManagerEndpoint.class);

    @Inject
    private OntologyManager ontologyManager;

    @GET
    @RequiresAuthentication
    @Produces(APPLICATION_JSON)
    public Set<IRI> getAvailableOntologies() {
        return ontologyManager.getAvailableOntologies();
    }

    @GET
    @Path("/vowl")
    @RequiresAuthentication
    @Produces(APPLICATION_JSON)
    @Hidden
    public Response getVowlForOntology(final @NotNull @QueryParam("ontologyIri") IRI ontologyIri)
            throws Exception {
        logger.debug("Request to convert Ontology {} to vowl.");
        try{
            OWLOntology ontology = ontologyManager.loadOntology(ontologyIri, false);
            final Converter converter = new Converter(ontology, ontologyIri.stringValue());
            converter.convert();
            StreamingOutput stream = new StreamingOutput() {
                @Override
                public void write(OutputStream os) throws IOException {
                    Writer writer = new BufferedWriter(new OutputStreamWriter(os, Charsets.UTF_8));
                    try {
                        converter.export(new Exporter() {
    
                            @Override
                            public void write(final String vowlText) throws Exception {
                                writer.write(vowlText);
                                writer.flush();
                            }
    
                        });
                    } catch (Exception e) {
                        throw Throwables.propagate(e);
                    }
                }
            };
            return Response.ok(stream).build();
        }catch(IllegalArgumentException e){
            return Response.status(Status.NOT_FOUND).entity(e.getMessage()).build();
        }catch(IOException e){
            return Response.serverError().entity(e.getMessage()).build();
        }
    }

}
