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

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URISyntaxException;
import java.util.Date;
import java.util.HashSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import javax.inject.Inject;
import javax.servlet.http.HttpServletRequest;
import javax.validation.constraints.NotNull;
import javax.ws.rs.DELETE;
import javax.ws.rs.GET;
import javax.ws.rs.HEAD;
import javax.ws.rs.POST;
import javax.ws.rs.PUT;
import javax.ws.rs.Path;
import javax.ws.rs.QueryParam;
import javax.ws.rs.WebApplicationException;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.Status;
import javax.ws.rs.core.StreamingOutput;
import javax.ws.rs.core.UriInfo;

import org.apache.commons.lang.time.DateFormatUtils;
import org.apache.commons.lang3.RandomStringUtils;
import org.apache.commons.lang3.StringUtils;
import org.apache.http.HttpHeaders;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.shiro.authz.annotation.RequiresAuthentication;
import org.apache.shiro.authz.annotation.RequiresPermissions;
import org.eclipse.rdf4j.RDF4JException;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.Resource;
import org.eclipse.rdf4j.model.Statement;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.model.vocabulary.RDF4J;
import org.eclipse.rdf4j.model.vocabulary.SESAME;
import org.eclipse.rdf4j.query.GraphQuery;
import org.eclipse.rdf4j.query.GraphQueryResult;
import org.eclipse.rdf4j.query.UpdateExecutionException;
import org.eclipse.rdf4j.repository.Repository;
import org.eclipse.rdf4j.repository.RepositoryConnection;
import org.eclipse.rdf4j.repository.RepositoryException;
import org.eclipse.rdf4j.repository.RepositoryResult;
import org.eclipse.rdf4j.rio.RDFFormat;
import org.eclipse.rdf4j.rio.RDFParserRegistry;
import org.eclipse.rdf4j.rio.RDFWriter;
import org.eclipse.rdf4j.rio.RDFWriterFactory;
import org.eclipse.rdf4j.rio.RDFWriterRegistry;
import org.eclipse.rdf4j.rio.Rio;

import com.google.common.collect.Sets;
import com.metaphacts.api.sparql.ServletRequestUtil;
import com.metaphacts.cache.CacheManager;
import com.metaphacts.config.Configuration;
import com.metaphacts.config.NamespaceRegistry;
import com.metaphacts.data.rdf.ReadConnection;
import com.metaphacts.repository.RepositoryManager;
import com.metaphacts.security.Permissions.SPARQL;
import com.metaphacts.util.ExceptionUtils;

/**
 * Implementation of SPARQL 1.1 Graph Store HTTP Protocol<br/>
 * <ul>
 * <li>GET /rdf-graph-store?graph={IRI} <br/>
 * Returns the content of the graph with {IRI} using a serialization as
 * specified in the request header.</li>
 * <li>POST /rdf-graph-store?graph={IRI} <br/>
 * Create the graph with {IRI} and message body. Content-type must be specified in the header. If {IRI} is not specified statements will be added to the default/null graph or to the graphs as specified in the serialization format (i.e. if format is e.g. TRIG/NT/JSON-LD). </li>
 * <li>PUT /rdf-graph-store?graph={IRI} <br/>
 * Updates the graph with {IRI} and message body. Graph must exist.  Content-type must be specified in the header.</li>
 * <li>DELETE /rdf-graph-store?graph={IRI} <br/>
 * Deletes the graph with {IRI}.</li>
 * </uL>
 *
 * Current Implementation does NOT support HTTP HEAD and HTTP PATCH.
 *
 * @see http://www.w3.org/TR/sparql11-http-rdf-update/
 * @author Johannes Trame <jt@metaphacts.com>
 *
 */
@Path("")
public class RDFGraphStoreEndpoint {

    private static final Logger logger = LogManager.getLogger(RDFGraphStoreEndpoint.class);

    @Context
    private HttpServletRequest servletRequest;

    @Context
    private UriInfo uriInfo;

    @Inject
    private NamespaceRegistry ns;

    @Inject
    private RepositoryManager repositoryManager;

    @Inject
    private Configuration config;

    @Inject
    private CacheManager cacheManager;

    @POST
    @RequiresAuthentication
    @RequiresPermissions(SPARQL.GRAPH_STORE_CREATE)
    public Response createGraph(
            @QueryParam("graph") Optional<IRI> uri,
            @QueryParam("keepSourceGraphs") boolean keepSourceGraphs,
            @QueryParam("repository") Optional<String> repository,
            InputStream in) throws URISyntaxException {

        if(logger.isTraceEnabled()) {
            logger.trace("Request to create GRAPH {}", uri);
        }

        IRI graphUri = uri.orElse(getAutoGeneratedGraphUri());

        if(graphExists(graphUri,repository)){
            logger.debug("GRAPH {} already exists. Payload will be merged with existing statements.", graphUri);
        }

        String contentMimeType = getContentMIMEType(servletRequest);
        Optional<RDFFormat> format = RDFParserRegistry.getInstance().getFileFormatForMIMEType(contentMimeType);
        if(!format.isPresent()){
            return Response.serverError().status(Status.NOT_ACCEPTABLE).entity("Unkown content type.").build();
        }

        try (RepositoryConnection con = getRepository(repository).getConnection()){
            RDFFormat rioFormat = format.get();
            Model results = Rio.parse(in, uriInfo.getAbsolutePath().toString(), rioFormat);

            boolean quadFormat = (rioFormat == RDFFormat.TRIG)
                                    || (rioFormat == RDFFormat.TRIX)
                                    || (rioFormat == RDFFormat.NQUADS);
            con.begin();
            if (quadFormat && keepSourceGraphs) {
                con.add(results);
            } else {
                con.add(results, graphUri);
            }
            con.commit();
            cacheManager.invalidateAll();
        } catch (RepositoryException e) {

            final Throwable cause = e.getCause();

            if (cause instanceof UpdateExecutionException && cause.getMessage().equals("Broken pipe")) {

                // log proper explanation in case of Jetty's message size limit being exceeded,
                // which is a frequent root cause for this exception being thrown
                final StringBuilder msgBuilder = new StringBuilder();
                msgBuilder.append("Broken pipe. ");
                msgBuilder.append("It is likely that the message body size for Jetty has been exceeded. ");
                msgBuilder.append("To increase the maximum body size you may want to re-start the platform while setting ");
                msgBuilder.append("\"-Dorg.eclipse.jetty.server.Request.maxFormContentSize=<MAX_SUPPORTED_NUM_BYTES>\" as a JVM parameter.");

                logger.error("Failed to create GRAPH \"{}\" :", graphUri, msgBuilder);

                // and return a payload too large exception, indicating that the file size is too large
                return Response.status(413 /* payload too large */).type("text/plain").entity(msgBuilder.toString()).build();

            } else {

                logger.error("Failed to create GRAPH \"{}\" : {}", graphUri, e.getMessage());
                logger.debug("Details:" , e);
                String message = ExceptionUtils.extractSparqlExceptionMessage(e);
                return Response.serverError().entity(message).build();

            }

        } catch (Exception e) {

            logger.error("Failed to create GRAPH \""+ graphUri +"\" :"+e.getMessage());
            logger.debug("Details:" , e);
            String message = ExceptionUtils.extractSparqlExceptionMessage(e);
            return Response.serverError().entity(message).build();

        }

        return Response.created(new java.net.URI(graphUri.stringValue())).build();
    }


    @GET
    @RequiresAuthentication
    @RequiresPermissions(SPARQL.GRAPH_STORE_GET)
    public Response getGraph(final @NotNull @QueryParam("graph") IRI uri,
            @QueryParam("repository") Optional<String> repository)
            throws Exception {

        if (logger.isTraceEnabled())
            logger.trace("Request to return GRAPH: "+ uri);

        if (!graphExists(uri, repository)) {
            return Response
                    .serverError()
                    .status(Status.NOT_FOUND)
                    .entity("NamedGraph " + uri + " does not exist or is empty.").build();
        }

        Optional<String> prefMime = getAcceptMIMEType(servletRequest);

        if(!prefMime.isPresent()){
            return Response.serverError().status(Status.NOT_ACCEPTABLE).build();
        }

        String prefMimeType = prefMime.get();

        RDFFormat format = Rio.getParserFormatForMIMEType(prefMimeType).orElse(RDFFormat.TURTLE);
        try{
            final RDFWriterFactory factory = RDFWriterRegistry.getInstance().get(format).orElseThrow(
                    () -> new IllegalStateException(
                            "Not able to instantiate RDFWriterFactory for format " + format.getName()));
            StreamingOutput stream = new StreamingOutput() {
                @Override
                public void write(OutputStream os) throws IOException, WebApplicationException {
                    try (RepositoryConnection con = getRepository(repository).getConnection()) {
                        
                        StringBuilder qb = new StringBuilder();
                        qb.append("CONSTRUCT \n");

                        /*
                         * If RDF4J.NIL is used as the graph name, we interpret that as a request for data in the
                         * default graph. We specify the default graph by adding the various triplestores' virtual
                         * property names for the default graph into the query's dataset.
                         * 
                         * NB we are appending to the query string instead of configuring a Dataset object on the
                         * prepared query because some older triplestores (Blazegraph) do not fully support sending
                         * graph names along as parameters (as specified in SPARQL 1.1 Protocol).
                         */
                        if (RDF4J.NIL.equals(uri)) {
                            qb.append("FROM <" + RDF4J.NIL + "> \n");
                            qb.append("FROM <" + SESAME.NIL + "> \n");
                            qb.append("FROM <tag:stardog:api:context:default> \n");
                            qb.append("FROM <http://www.bigdata.com/rdf#nullGraph> \n");
                            qb.append("FROM <http://aws.amazon.com/neptune/vocab/v01/DefaultNamedGraph> \n");
                        } else {
                            qb.append("FROM <" + uri + ">\n");
                        }
                        qb.append("WHERE { ?s ?p ?o }");

                        GraphQuery query = con.prepareGraphQuery(qb.toString());
                        query.setIncludeInferred(false);
                        try (GraphQueryResult statements = query.evaluate()) {
                            RDFWriter writer = factory.getWriter(os);
                            writer.startRDF();
                            for (Map.Entry<String, String> entry : ns.getPrefixMap().entrySet()) {
                                String prefix = entry.getKey();
                                String namespace = entry.getValue();
                                writer.handleNamespace(prefix, namespace);
                            }
                            if (!RDF4J.NIL.equals(uri) && format.supportsContexts()) {
                                statements.stream()
                                        .map(st -> con.getValueFactory().createStatement(st.getSubject(),
                                                st.getPredicate(), st.getObject(), uri))
                                        .forEach(writer::handleStatement);
                            }
                            else {
                                statements.forEach(writer::handleStatement);
                            }
                            writer.endRDF();
                        }
                    } catch (RDF4JException e) {
                        logger.error("Failed to retrieve or write the requested graph \"{}\":", uri, e);
                        // these are checked exceptions anyway
                        throw e;
                    }
                }
              };

              return Response.ok(stream).header("content-disposition","attachment; filename = graph-export-"+DateFormatUtils.ISO_DATETIME_FORMAT.format(new Date())+"."+format.getDefaultFileExtension()).build();
        }catch(Exception e){
            logger.error("Failed to return GRAPH \""+ uri +"\" :"+e.getMessage());
            logger.debug("Details:" , e);
            String message = ExceptionUtils.extractSparqlExceptionMessage(e);
            return Response.serverError().entity(message).build();
        }
    }


    @DELETE
    @RequiresAuthentication
    @RequiresPermissions(SPARQL.GRAPH_STORE_DELETE)
    public Response deleteGraph(@QueryParam("graph") IRI uri,
            @QueryParam("repository") Optional<String> repository)
            throws RepositoryException {

        if(logger.isTraceEnabled()) {
            logger.trace("Request to delete GRAPH: "+ uri);
        }

        if(!graphExists(uri, repository)){
            return Response
                    .serverError()
                    .status(Status.NOT_FOUND)
                    .entity("NamedGraph " + uri+ " does not exist or is empty.").build();
        }

        try(RepositoryConnection con = getRepository(repository).getConnection()){
            if (RDF4J.NIL.equals(uri)) {
                // use SPARQL DROP command instead of RDF4J clear to avoid GraphDB bug in clearing the null context
                con.prepareUpdate("DROP DEFAULT").execute();
            }
            else {
                con.clear(uri);
            }
            cacheManager.invalidateAll();
        }catch(Exception e){
            logger.error("Failed to delete GRAPH \"" + uri + "\": " + e.getMessage());
            logger.debug("Details:" , e);
            String message = ExceptionUtils.extractSparqlExceptionMessage(e);
            return Response.serverError().entity(message).build();
        }
        return Response.ok().build();
    }

    @PUT
    @RequiresAuthentication
    @RequiresPermissions(SPARQL.GRAPH_STORE_UPDATE)
    public Response updateGraph(
            @QueryParam("graph") Optional<IRI> uri,
            @QueryParam("repository") Optional<String> repository,
            InputStream in
    ) throws URISyntaxException {

        IRI graphUri = uri.orElse(getAutoGeneratedGraphUri());

        if(logger.isTraceEnabled())
            logger.trace("Request to update LDP resource with IRI: "+uri);

        HashSet<String> allRegistedMimeTypes = Sets.newHashSet();
        for(RDFFormat format : RDFWriterRegistry.getInstance().getKeys())
            allRegistedMimeTypes.addAll(format.getMIMETypes());

        String contentMimeType = getContentMIMEType(servletRequest);
        Optional<RDFFormat> format = RDFParserRegistry.getInstance().getFileFormatForMIMEType(contentMimeType);
        if(!format.isPresent()){
            return Response.serverError().status(Status.NOT_ACCEPTABLE).build();
        }
        try(RepositoryConnection con= getRepository(repository).getConnection() ) {
            Model results = Rio.parse(in, uriInfo.getAbsolutePath().toString(), format.get());
            con.begin();
            con.clear(graphUri);
            con.add(results, graphUri);
            con.commit();
            cacheManager.invalidateAll();
        } catch (Exception e) {
            logger.error("Failed to update GRAPH \""+ graphUri +"\" :"+e.getMessage());
            logger.debug("Details:" , e);
            String message = ExceptionUtils.extractSparqlExceptionMessage(e);
            return Response.serverError().entity(message).build();
        }

        return Response.created(new java.net.URI(graphUri.toString())).build();
    }

    @HEAD
    @RequiresAuthentication
    @RequiresPermissions(SPARQL.GRAPH_STORE_HEAD)
    public Response checkGraph(final @NotNull @QueryParam("graph") IRI uri,
            @QueryParam("repository") Optional<String> repository)
            throws Exception {

        if(!graphExists(uri, repository)){
            return Response
                    .serverError()
                    .status(Status.NOT_FOUND)
                    .entity("NamedGraph " + uri+ " does not exist or is empty.").build();

        }
        return Response.ok().build();
    }

    /**
     * Generates random GRAPH identifiers i.e. according to the spec, the API
     * should create identifiers and return in the location header, if not
     * explicitly specified as parameter by the client.
     *
     * @return
     */
    private IRI getAutoGeneratedGraphUri(){
        logger.debug("No graph URI specified. Creating random URI.");
        String platformBaseIriConfig = config.getEnvironmentConfig().getPlatformBaseIri();
        String platformBaseIri = StringUtils.isEmpty(platformBaseIriConfig)
                ? uriInfo.getBaseUri().toString()
                : platformBaseIriConfig;
        return SimpleValueFactory.getInstance().createIRI(
                platformBaseIri + "/graph/" + new Date().getTime() + RandomStringUtils.randomAlphanumeric(5)
               );
    }

    private Optional<String> getAcceptMIMEType(HttpServletRequest servletRequest) {
        Set<String> allKnownMimeTypes = Sets.newLinkedHashSet();
        for(RDFFormat format : RDFWriterRegistry.getInstance().getKeys())
            allKnownMimeTypes.addAll(format.getMIMETypes());
        return ServletRequestUtil.getPreferredMIMEType(allKnownMimeTypes, servletRequest);
    }

    private String getContentMIMEType(HttpServletRequest servletRequest) {
        return servletRequest.getHeader(HttpHeaders.CONTENT_TYPE);
    }

    private boolean graphExists(IRI iri, Optional<String> repository) {
        if (iri == null) {
            return false;
        }
        return RDF4J.NIL.equals(iri) ? true
                : new ReadConnection(getRepository(repository)).hasStatement(null, null, null, iri);
    }

    private Repository getRepository(Optional<String> repository){
        return repository.isPresent()
                ? repository.map( rep -> repositoryManager.getRepository(rep)).get()
                : repositoryManager.getDefault();
    }
}
