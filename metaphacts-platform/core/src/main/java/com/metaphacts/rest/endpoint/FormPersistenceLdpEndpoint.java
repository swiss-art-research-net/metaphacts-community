/*
 * Copyright (C) 2015-2019, metaphacts GmbH
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

import java.util.List;

import javax.inject.Inject;
import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.*;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.Status;

import org.apache.commons.lang3.time.StopWatch;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.shiro.SecurityUtils;
import org.apache.shiro.authz.annotation.Logical;
import org.apache.shiro.authz.annotation.RequiresAuthentication;
import org.apache.shiro.authz.annotation.RequiresPermissions;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.LinkedHashModel;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.query.GraphQuery;
import org.eclipse.rdf4j.query.GraphQueryResult;
import org.eclipse.rdf4j.query.QueryResults;
import org.eclipse.rdf4j.repository.RepositoryConnection;

import com.google.common.collect.Sets;
import com.metaphacts.api.sparql.SparqlOperationBuilder;
import com.metaphacts.cache.CacheManager;
import com.metaphacts.data.rdf.PointedGraph;
import com.metaphacts.data.rdf.container.FormContainer;
import com.metaphacts.data.rdf.container.LDPApiInternal;
import com.metaphacts.data.rdf.container.LDPApiInternalRegistry;
import com.metaphacts.data.rdf.container.LDPImplManager;
import com.metaphacts.repository.RepositoryManager;
import com.metaphacts.repository.MpRepositoryProvider;
import com.metaphacts.security.Permissions.FORMS_LDP;
import com.metaphacts.vocabulary.LDP;

/**
 * @author Johannes Trame <jt@metaphacts.com>
 */
@Path("/ldp")
public class FormPersistenceLdpEndpoint {

    @Context
    private HttpServletRequest servletRequest;

    private static final Logger logger = LogManager.getLogger(FormPersistenceLdpEndpoint.class);

    @Inject
    private RepositoryManager repositoryManager;

    @Inject
    private CacheManager cacheManager;

    @Inject
    private LDPApiInternalRegistry ldpCache;

    private ValueFactory vf = SimpleValueFactory.getInstance();

    /**
     * Executes and array of SPARQL CONSTRUCT strings as graph queries on the
     * repository and merges the resulting triples into one new graph. The new
     * graph will be added to the repository using the {@link LDPApiInternal}, in
     * particular the {@link FormContainer}. Thereby, existing containers with
     * the same IRI will be eventually replaced.
     *
     * @param constructs
     *            An JSON array of SPARQL CONSTRUCT queries generated by the
     *            client-side form component
     * @param iri
     *            {@link IRI} of the container to be created or replaced
     * @return
     */
    @POST
    @RequiresAuthentication
    @Consumes(MediaType.APPLICATION_JSON)
    @RequiresPermissions(value = { FORMS_LDP.CREATE, FORMS_LDP.UPDATE }, logical = Logical.OR)
    public Response storeConstructs(
        List<String> constructs,
        @QueryParam("iri") IRI iri,
        @QueryParam("repository") String repositoryID
    ) {
        if (iri == null) {
            return Response.status(Status.BAD_REQUEST)
                .entity("Missing required parameter 'iri'")
                .build();
        }
        if (repositoryID == null) {
            return Response.status(Status.BAD_REQUEST)
                .entity("Missing required parameter 'repository'")
                .build();
        }

        logger.debug("Received SPARQL construct queries: {}", constructs);
        try {
            IRI formContainerIri = iri;
            Model model = new LinkedHashModel();
            final StopWatch stopwatch = new StopWatch();

            try (RepositoryConnection con = repositoryManager.getRepository(repositoryID).getConnection()) {
                for (String constructString : constructs) {

                    if(logger.isTraceEnabled()){
                        stopwatch.reset();
                        stopwatch.start();
                    }
                    GraphQuery graphOperation = SparqlOperationBuilder.<GraphQuery>create(constructString, GraphQuery.class ).build(con);
                    try(GraphQueryResult res =  graphOperation.evaluate()){
                        model.addAll(QueryResults.asModel(res));
                    }

                    if(logger.isTraceEnabled()){
                        stopwatch.stop();
                        logger.trace("It took {} to execute and collect stmts of construct: {}", stopwatch, constructString);
                    }
                }
            }
            if(logger.isTraceEnabled()){
                stopwatch.reset();
                stopwatch.start();
            }
            // this should rather go over LdpApi instead of calling the container
            // directly
            PointedGraph pg = new PointedGraph(formContainerIri, model);
            FormContainer formContainer = (FormContainer) LDPImplManager.getLDPImplementation(
                FormContainer.IRI,
                Sets.newHashSet(LDP.Container, LDP.Resource),
                new MpRepositoryProvider(this.repositoryManager, repositoryID)
            );

            if(logger.isTraceEnabled()){
                stopwatch.stop();
                logger.trace("It took {} to get the form container.", stopwatch);

                stopwatch.reset();
                stopwatch.start();
            }

            boolean contains = formContainer.containsLDPResource(formContainerIri);

            if(logger.isTraceEnabled()){
                stopwatch.stop();
                logger.trace("It took {} check on existing form contains whether the resource alreay exists.", stopwatch, formContainerIri.stringValue());
            }

            if (contains) { // is existing resource => perform update
                if (!SecurityUtils.getSubject().isPermitted(FORMS_LDP.UPDATE)) {
                    return Response
                            .status(Status.FORBIDDEN)
                            .entity("No permission to update form container: "
                                    + formContainerIri.stringValue()).build();
                }

                if (logger.isTraceEnabled()) {
                    stopwatch.reset();
                    stopwatch.start();
                }

                formContainer.update(pg);

                if(logger.isTraceEnabled()){
                    stopwatch.stop();
                    logger.trace("It took {} to perform the update of the form resource {}", stopwatch, pg.getPointer().stringValue() );
                }
            } else { // is new resource => add as new LDP resource
                if (!SecurityUtils.getSubject().isPermitted(FORMS_LDP.CREATE)) {
                    return Response
                            .status(Status.FORBIDDEN)
                            .entity("No permission to update the existing form container: "
                                    + formContainerIri.stringValue()).build();
                }

                if(logger.isTraceEnabled()){
                    stopwatch.reset();
                    stopwatch.start();
                }

                formContainer.add(pg);

                if(logger.isTraceEnabled()){
                    stopwatch.stop();
                    logger.trace("It took {} to add the statements to the new form container", stopwatch);
                }
            }

            //try to invalidate all caches i.e. forms are likely to have changed types or labels
            //TODO remove once we have a global strategy for listening to repository/resource changes
            try{
                cacheManager.invalidateAll();
            }catch(Exception e){
                // we do not want the form transaction to fail only because for whatever reason the invalidation has failed
                logger.error("Invalidation of caches failed: {}", e.getMessage());
            }

            return Response
                    .ok(new java.net.URI(formContainerIri.stringValue()).toString())
                    .build();
        } catch (Exception e) {
            logger.error("Error while storing forms: {} ", e.getMessage());
            logger.debug("Details: {} ", e);
            return Response.serverError().entity(e.getMessage()).build();
        }

    }

    /**
     * Deletes entity container for specified subject IRI from the repository
     * using the {@link LDPApi}.
     *
     * @param iri {@link IRI} of the container to be deleted
     */
    @DELETE
    @RequiresAuthentication
    @Consumes(MediaType.APPLICATION_JSON)
    @RequiresPermissions(FORMS_LDP.DELETE)
    public Response deleteEntity(
        @QueryParam("iri") IRI iri,
        @QueryParam("repository") String repositoryID
    ) {
        if (iri == null) {
            return Response.status(Status.BAD_REQUEST)
                .entity("Missing required parameter 'iri'")
                .build();
        }
        if (repositoryID == null) {
            return Response.status(Status.BAD_REQUEST)
                .entity("Missing required parameter 'repository'")
                .build();
        }

        try {
            IRI formContainerIri = iri;
            StopWatch stopwatch = new StopWatch();

            if (!SecurityUtils.getSubject().isPermitted(FORMS_LDP.DELETE)) {
                return Response.status(Status.FORBIDDEN)
                    .entity("No permission to update the existing form container: "
                        + formContainerIri.stringValue()
                    ).build();
            }

            if (logger.isTraceEnabled()) {
                stopwatch.reset();
                stopwatch.start();
            }

            LDPApiInternal ldpApi = ldpCache.api(repositoryID);
            ldpApi.deleteLDPResource(formContainerIri);

            if (logger.isTraceEnabled()) {
                stopwatch.stop();
                logger.trace("It took {} to delete entity from form container", stopwatch);
            }

            return Response.ok().build();
        } catch (Exception e) {
            logger.error("Error while deleting form entity: {} ", e.getMessage());
            logger.debug("Details: {} ", e);
            return Response.serverError().entity(e.getMessage()).build();
        }
    }
}
