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
package com.metaphacts.rest.endpoint;

import java.io.IOException;
import java.io.OutputStream;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import javax.inject.Inject;
import javax.inject.Named;
import javax.inject.Singleton;
import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.WebApplicationException;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.Status;
import javax.ws.rs.core.StreamingOutput;
import javax.ws.rs.core.UriInfo;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Model;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.query.GraphQuery;
import org.eclipse.rdf4j.query.GraphQueryResult;
import org.eclipse.rdf4j.query.QueryEvaluationException;
import org.eclipse.rdf4j.query.QueryResults;
import org.eclipse.rdf4j.repository.RepositoryConnection;
import org.eclipse.rdf4j.rio.RDFFormat;
import org.eclipse.rdf4j.rio.RDFWriterRegistry;
import org.eclipse.rdf4j.rio.Rio;

import com.metaphacts.api.sparql.ServletRequestUtil;
import com.metaphacts.api.sparql.SparqlOperationBuilder;
import com.metaphacts.api.sparql.SparqlUtil;
import com.metaphacts.config.Configuration;
import com.metaphacts.config.NamespaceRegistry;
import com.metaphacts.data.rdf.ReadConnection;
import com.metaphacts.repository.RepositoryManager;
import com.metaphacts.rest.feature.CacheControl.NoCache;
import com.metaphacts.ui.templates.MainTemplate;
import com.metaphacts.ui.templates.ST;
import com.metaphacts.util.BrowserDetector;

/**
 * Main application entry point.
 *
 * @author Artem Kozlov <ak@metaphacts.com>
 */
@Path("")
@Singleton
public class ResourceEndpoint {

    @SuppressWarnings("unused")
    private static Logger logger = LogManager.getLogger(ResourceEndpoint.class);

    @Inject
    private MainTemplate mainTemplate;

    @Inject
    private RepositoryManager repositoryManager;

    @Inject
    private NamespaceRegistry namespaceRegistry;

    @Inject @Named("ASSETS_MAP")
    private Map<String, String> assetsMap;

    @Inject
    private ST st;

    @Inject
    private Configuration config;
    
    /**
     * When accessing from browser, return main template with client-side logic to present resource
     *
     * @return
     * @throws IOException
     */
    @GET()
    @Path("{path: .*}")
    @Produces(MediaType.TEXT_HTML)
    @NoCache
    public String getMainPage(@Context HttpServletRequest httpServletRequest) throws IOException {
        String browserId = BrowserDetector.detectBrowser(httpServletRequest.getHeader("User-Agent"));
        if (this.isBrowserUnsupported(browserId)) {
            Map<String, Object> map = st.getDefaultPageLayoutTemplateParams();
            map.put("assetsMap", this.assetsMap);
            return st.renderPageLayoutTemplate(ST.TEMPLATES.UNSUPPORTED_BROWSER, map);
        } else {
            return mainTemplate.getMainTemplate();
        }
    }

    /**
     * If there's no Accept: text/html, we'll do custom content negotiation here
     *
     * @param httpServletRequest bind by Jersey
     * @return
     * @throws IOException
     */
    @GET()
    @Path("{path: .*}")
    public Response getResource(@Context HttpServletRequest httpServletRequest, @Context UriInfo uriInfo) throws Exception {

        // we have two strategies to get iri: passed uri parameter or prefixed element of path
        String stringIri = null;
        //check if it's in parameter ?uri=
        stringIri = uriInfo.getQueryParameters().getFirst("uri");

        if (stringIri == null) {
            //check if we could convert path parameter with namespace to IRI
            String path = uriInfo.getPathParameters().getFirst("path");
            Optional<IRI> convertedIri =  namespaceRegistry.resolveToIRI(path);
            if (!convertedIri.isPresent()) return Response.status(Response.Status.BAD_REQUEST).entity("Could not translate IRI " + path).build();
            stringIri = convertedIri.get().stringValue();
        }

        IRI iri;
        try {
            iri = SimpleValueFactory.getInstance().createIRI(stringIri);
        } catch (IllegalArgumentException iae) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Not a valid IRI: <" + stringIri + ">").build();
        }

        if(!new ReadConnection(repositoryManager.getDefault()).hasOutgoingStatements(iri)){
            return Response.status(Response.Status.NOT_FOUND).entity("Entity with IRI <" + iri.stringValue() + "> does not exist").build();
        }

        return getRdfResponse(httpServletRequest, stringIri);
    }

    /**
     * Do content negotiation like in SparqlServlet and return sparql describe result
     * @param httpServletRequest
     * @param uri
     * @return
     */
    private Response getRdfResponse(HttpServletRequest httpServletRequest, String uri) {
        Optional<String> preferredMimeType = ServletRequestUtil.getPreferredMIMEType(SparqlUtil.getAllRegisteredWriterMimeTypes(), httpServletRequest);

        if (!preferredMimeType.isPresent()) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Unknown or empty accept header.").build();
        }
        String mimeType = preferredMimeType.get();

        SparqlOperationBuilder<GraphQuery> builder = SparqlOperationBuilder.<GraphQuery>create("DESCRIBE <" + uri + ">", GraphQuery.class);
        try (RepositoryConnection con = repositoryManager.getDefault().getConnection()) {
            GraphQuery query = builder.build(con);
            RDFWriterRegistry resultWriterRegistry = RDFWriterRegistry.getInstance();
            RDFFormat rdfFormat = resultWriterRegistry
                .getFileFormatForMIMEType(mimeType)
                .orElse(RDFFormat.TURTLE);
            try (final GraphQueryResult gqr = query.evaluate()){
                    final Model model = QueryResults.asModel(query.evaluate());
                    StreamingOutput stream = new StreamingOutput() {
                        @Override
                        public void write(OutputStream output) throws IOException, WebApplicationException {
                            Rio.write(model, output, rdfFormat);
                        }
                    };
                return Response.ok(stream).type(mimeType).build();
            }catch(QueryEvaluationException e){
                return Response.status(Status.INTERNAL_SERVER_ERROR).entity(e.getMessage()).build();
            }
        }
    }

    private boolean isBrowserUnsupported(String browserId) {
        List<String> browsers = this.config.getUiConfig().getUnsupportedBrowsers();
        return browsers.stream().anyMatch(bid -> bid.equals(browserId));
    }
}
