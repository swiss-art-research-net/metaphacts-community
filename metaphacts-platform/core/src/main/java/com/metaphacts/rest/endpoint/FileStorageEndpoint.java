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

import com.metaphacts.data.rdf.container.LDPResource;
import com.google.common.collect.Sets;
import com.metaphacts.api.sparql.SparqlOperationBuilder;
import com.metaphacts.data.rdf.PointedGraph;
import com.metaphacts.data.rdf.container.FileContainer;
import com.metaphacts.data.rdf.container.LDPImplManager;
import com.metaphacts.repository.MpRepositoryProvider;
import com.metaphacts.repository.RepositoryManager;
import com.metaphacts.security.Permissions.*;
import com.metaphacts.security.WildcardPermission;
import com.metaphacts.services.storage.MainPlatformStorage;
import com.metaphacts.services.storage.api.*;
import com.metaphacts.vocabulary.LDP;
import org.apache.commons.io.IOUtils;
import org.apache.logging.log4j.LogManager;
import org.apache.shiro.SecurityUtils;
import org.apache.shiro.authz.annotation.RequiresAuthentication;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;
import org.eclipse.rdf4j.model.*;
import org.eclipse.rdf4j.query.*;
import org.eclipse.rdf4j.repository.RepositoryConnection;
import org.eclipse.rdf4j.repository.RepositoryException;
import org.glassfish.jersey.media.multipart.FormDataContentDisposition;
import org.glassfish.jersey.media.multipart.FormDataParam;

import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;
import javax.inject.Inject;
import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.*;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.StreamingOutput;
import java.io.InputStream;
import java.util.*;
import java.security.SecureRandom;

@Path("")
public class FileStorageEndpoint {
    private static final String RESOURCE_IRI = "__resourceIri__";
    private static final String DOCUMENT_NAME = "__fileName__";
    private static final String MEDIA_TYPE = "__mediaType__";
    private static final String CONTEXT_URI = "__contextUri__";
    private static final String DEFAULT_CONTEXT_IRI = "http://www.metaphacts.com/ontologies/platform#file";

    @Context
    private HttpServletRequest servletRequest;

    private static final org.apache.logging.log4j.Logger logger =
        LogManager.getLogger(FileStorageEndpoint.class.getName());

    private ValueFactory vf = SimpleValueFactory.getInstance();

    @Inject
    private RepositoryManager repositoryManager;

    @Inject
    PlatformStorage platformStorage;

    @Inject
    MainPlatformStorage storageRegistry;

    @POST
    @Path("/direct")
    @RequiresAuthentication
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    public Response postAdminFile(
        @FormDataParam("storage") String storageId,
        @FormDataParam("path") String path,
        @FormDataParam("fileName") String customFileName,
        @FormDataParam("file") FormDataContentDisposition fileDisposition,
        @FormDataParam("file") InputStream in
    ) {
        if(logger.isTraceEnabled()) logger.trace("Request to store a file to a storage");

        String sequence = "" + nextLong(); // random sequence for id generating
        try {
            if(!checkPermission(STORAGE.PREFIX_WRITE + storageId)) {
                ForbiddenException e = new ForbiddenException("Permission denied!");
                logger.error(e);
                return Response.status(Response.Status.FORBIDDEN).entity(e.getMessage()).build();
            }

            String fileName;
            if (customFileName.isEmpty()) {
                fileName = generateUniqueFileName(sequence, fileDisposition.getFileName());
            } else {
                fileName = customFileName;
            }
            String storedFileName = URLEncoder.encode(fileName, "UTF-8");

            // store file
            ObjectStorage storage = this.storageRegistry.getStorage(storageId);
            storeFile(storedFileName, storage, path, in);

            return Response.ok().entity(storedFileName).build();
        } catch (Exception e) {
            logger.error(e.getMessage());
            logger.debug("Details:" , e);
            return Response.serverError().entity(e.getMessage()).build();
        }
    }

    @GET
    @RequiresAuthentication
    public Response getFile(
        @QueryParam("fileName") String fileName,
        @QueryParam("storage") String storageId
    ) {
        if(logger.isTraceEnabled()) logger.trace("Request to get a file from a storage");
        try {
            if(!checkPermission(FILE.PREFIX_READ + storageId)) {
                ForbiddenException e = new ForbiddenException("Permission denied!");
                logger.error(e);
                return Response.status(Response.Status.FORBIDDEN).entity(e.getMessage()).build();
            }

            StreamingOutput fileStream;
            fileStream = fetchFile(fileName, this.storageRegistry.getStorage(storageId));
            return Response.ok(fileStream, MediaType.APPLICATION_OCTET_STREAM)
                .header("content-disposition","attachment; filename = " + fileName)
                .build();
        } catch (Exception e) {
            String exceptionMessage = "Error fetching file " + fileName + " : " + e.getMessage();
            logger.error(exceptionMessage);
            return Response.serverError().entity(exceptionMessage).build();
        }
    }


    @POST
    @RequiresAuthentication
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    public Response postFile(
        @FormDataParam("storage") String storageId,
        @FormDataParam("generateIriQuery") String generateIriQuery,
        @FormDataParam("createResourceQuery") String createResourceQuery,
        @FormDataParam("contextUri") String contextUri,
        @FormDataParam("file") FormDataContentDisposition fileDisposition,
        @FormDataParam("file") InputStream in
    ) {
        if(logger.isTraceEnabled()) logger.trace("Request to store a file as LDP resource to the storage");

        String mediaType = fileDisposition.getType();
        String sequence = "" + nextLong(); // random sequence for id generating
        String originalFileName = fileDisposition.getFileName();
        try {
            if(!checkPermission(FILE.PREFIX_WRITE + storageId)) {
                ForbiddenException e = new ForbiddenException("Permission denied!");
                logger.error(e);
                return Response.status(Response.Status.FORBIDDEN).entity(e.getMessage()).build();
            }

            String storedFileName = generateUniqueFileName(sequence, originalFileName);
            // store file
            ObjectStorage storage = this.storageRegistry.getStorage(storageId);
            storeFile(storedFileName, storage, in);

            IRI resourceIri = createLDPResource(
                storedFileName,
                generateIriQuery,
                createResourceQuery,
                contextUri,
                mediaType
            );

            return Response.created(new java.net.URI(resourceIri.toString())).build();

        } catch (Exception e) {
            logger.error(e.getMessage());
            logger.debug("Details:" , e);
            return Response.serverError().entity(e.getMessage()).build();
        }
    }

    @DELETE
    @RequiresAuthentication
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    public Response deleteFile(
        @FormDataParam("fileName") String fileName,
        @FormDataParam("storage") String storageId,
        @FormDataParam("resourceIri") String resourceIri
    ) {
        if(logger.isTraceEnabled()) logger.trace("Request to delete an LDP file resource from a storage");
        try {
            if(!checkPermission(FILE.PREFIX_WRITE + storageId)) {
                ForbiddenException e = new ForbiddenException("Permission denied!");
                logger.error(e);
                return Response.status(Response.Status.FORBIDDEN).entity(e.getMessage()).build();
            }

            IRI iri = vf.createIRI(resourceIri);
            LDPResource fileResource = LDPImplManager.getLDPImplementation(
                iri,
                Sets.newHashSet(LDP.Container, LDP.Resource),
                new MpRepositoryProvider(this.repositoryManager, RepositoryManager.ASSET_REPOSITORY_ID)
            );
            fileResource.delete();
            return this.removeFileFromStorage(fileName, storageId);
        } catch (Exception e) {
            logger.error(
                "Failed to remove resource " + storageId + ": " + e.getMessage()
            );
            logger.debug("Details:" , e);
            return Response.serverError().entity(e.getMessage()).build();
        }
    }

    @POST
    @Path("/temporary")
    @RequiresAuthentication
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    public Response saveToTemporaryStorage(
        @FormDataParam("storage") String storageId,
        @FormDataParam("file") FormDataContentDisposition fileDisposition,
        @FormDataParam("file") InputStream in
    ) {
        if(logger.isTraceEnabled()) logger.trace("Request to store a file to a storage");

        String sequence = "" + nextLong(); // random sequence for id generating
        try {
            if(!checkPermission(FILE.PREFIX_WRITE + storageId)) {
                ForbiddenException e = new ForbiddenException("Permission denied!");
                logger.error(e);
                return Response.status(Response.Status.FORBIDDEN).entity(e.getMessage()).build();
            }

            String encodedFileName = URLEncoder.encode(fileDisposition.getFileName(), "UTF-8");
            String storedFileName = generateUniqueFileName(sequence, encodedFileName);

            // store file
            ObjectStorage storage = this.storageRegistry.getStorage(storageId);
            storeFile(storedFileName, storage, in);

            return Response.ok().entity(storedFileName).build();
        } catch (Exception e) {
            logger.error(e.getMessage());
            logger.debug("Details:" , e);
            return Response.serverError().entity(e.getMessage()).build();
        }
    }

    @POST
    @Path("/move")
    @RequiresAuthentication
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    public Response createResourceFromTemporaryFile(
        @FormDataParam("fileName") String fileName,
        @FormDataParam("storage") String storageId,
        @FormDataParam("temporaryStorage") String temporaryStorageId,
        @FormDataParam("generateIriQuery") String generateIriQuery,
        @FormDataParam("createResourceQuery") String createResourceQuery,
        @FormDataParam("contextUri") String contextUri,
        @FormDataParam("mediaType") String mediaType
    ) {
        if(logger.isTraceEnabled()) logger.trace("Request to save an LDP file resource from a temporary storage to a storage");

        try {
            if(!(
                checkPermission(FILE.PREFIX_READ + temporaryStorageId) &&
                checkPermission(FILE.PREFIX_WRITE + temporaryStorageId) &&
                checkPermission(FILE.PREFIX_WRITE + storageId)
            )) {
                ForbiddenException e = new ForbiddenException("Permission denied!");
                logger.error(e);
                return Response.status(Response.Status.FORBIDDEN).entity(e.getMessage()).build();
            }

            // store file
            ObjectStorage fromStorage = this.storageRegistry.getStorage(temporaryStorageId);
            ObjectStorage toStorage = this.storageRegistry.getStorage(storageId);

            Optional<ObjectRecord> existing = fromStorage.getObject(
                ObjectKind.FILE,
                fileName,
                null
            );

            if (existing.isPresent()) {
                ObjectRecord fileRecord = existing.get();
                InputStream inputFileStream = fileRecord.getLocation().readContent();
                toStorage.appendObject(
                    ObjectKind.FILE,
                    fileName,
                    this.platformStorage.getDefaultMetadata(),
                    inputFileStream,
                    null
                );
                removeFileFromStorage(fileName, temporaryStorageId);
            } else {
                throw new WebApplicationException("File " + fileName + " Not Found!");
            }

            IRI resourceIri = createLDPResource(
                fileName,
                generateIriQuery,
                createResourceQuery,
                contextUri,
                mediaType
            );

            return Response.created(new java.net.URI(resourceIri.toString())).build();
        } catch (Exception e) {
            logger.error(e.getMessage());
            logger.debug("Details:" , e);
            return Response.serverError().entity(e.getMessage()).build();
        }
    }

    @DELETE
    @Path("/temporary")
    @RequiresAuthentication
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    public Response removeTemporaryFile(
        @FormDataParam("fileName") String fileName,
        @FormDataParam("storage") String storageId
    ) {
        if(logger.isTraceEnabled()) logger.trace("Request to delete an LDP file resource from a storage");
        try {
            if(!checkPermission(FILE.PREFIX_WRITE + storageId)) {
                ForbiddenException e = new ForbiddenException("Permission denied!");
                logger.error(e);
                return Response.status(Response.Status.FORBIDDEN).entity(e.getMessage()).build();
            }

            return this.removeFileFromStorage(fileName, storageId);
        } catch (Exception e) {
            logger.error(
                "Failed to remove from temporary storage (" + storageId + "): " + e.getMessage()
            );
            logger.debug("Details:" , e);
            return Response.serverError().entity(e.getMessage()).build();
        }
    }

    private boolean checkPermission(String permission) {
        return SecurityUtils.getSubject().isPermitted(new WildcardPermission(permission));
    }

    private ObjectKind getObjectKindFromPath(String path) throws FileNotFoundException {
        if (path.isEmpty()) throw new FileNotFoundException("Path \"" + path + "\" is defined incorrectly!");
        return Arrays.stream(ObjectKind.values())
            .filter(kind -> path.startsWith(kind.locationKey))
            .findFirst().get();
    }

    private IRI createLDPResource(
        String fileName,
        String generateIriQuery,
        String createResourceQuery,
        String contextUri,
        String mediaType
    ) throws Exception {
        FileContainer fileContainer = (FileContainer) LDPImplManager.getLDPImplementation(
            FileContainer.IRI,
            Sets.newHashSet(LDP.Container, LDP.Resource),
            new MpRepositoryProvider(this.repositoryManager, RepositoryManager.ASSET_REPOSITORY_ID)
        );

        boolean generateIriFromQuery = generateIriQuery != null && !generateIriQuery.isEmpty();

        IRI resourceIri;
        if (generateIriFromQuery) {
            // generating file iri
            resourceIri = generateIriFromQuery(
                contextUri,
                generateIriQuery,
                fileName,
                mediaType
            );
        } else {
            boolean isContextUriEmpty = contextUri == null || contextUri.isEmpty();
            resourceIri = vf.createIRI(
                (isContextUriEmpty ? DEFAULT_CONTEXT_IRI : contextUri) + fileName
            );
        }

        // creating resource data
        PointedGraph resourcePointedGraph = processQuery(
            resourceIri,
            createResourceQuery,
            contextUri,
            fileName,
            mediaType
        );

        // adding resource to container
        fileContainer.add(resourcePointedGraph);

        return resourceIri;
    }

    public Response removeFileFromStorage(
        String fileName,
        String storage
    ) {
        try {
            ObjectStorage objStorage = this.storageRegistry.getStorage(storage);
            objStorage.deleteObject(
                ObjectKind.FILE,
                fileName
            );
            return Response.ok().build();
        } catch (Exception e) {
            logger.error(
                "Failed to remove file from " + storage + ": " + e.getMessage()
            );
            logger.debug("Details:" , e);
            return Response.serverError().entity(e.getMessage()).build();
        }
    }

    private String generateUniqueFileName(String sequence, String originalFileName) throws UnsupportedEncodingException {
        String encodedFileName = URLEncoder.encode(originalFileName, "UTF-8");
        return sequence + "_" + encodedFileName;
    }

    private void storeFile(String fileName, ObjectStorage storage, InputStream in) throws Exception {
        storage.appendObject(
            ObjectKind.FILE,
            fileName,
            this.platformStorage.getDefaultMetadata(),
            in,
            null
        );
    }

    private void storeFile(String fileName, ObjectStorage storage, String path, InputStream in) throws FileNotFoundException, StorageException {
        ObjectKind objectKind = getObjectKindFromPath(path);
        String pathWithoutKind = path.substring(objectKind.locationKey.length(), path.length());
        String objectId;
        if (!pathWithoutKind.endsWith("/")) {
            pathWithoutKind += "/";
        }
        objectId = pathWithoutKind + fileName;

        
        storage.appendObject(
            objectKind,
            objectId,
            this.platformStorage.getDefaultMetadata(),
            in,
            null
        );
    }

    private StreamingOutput fetchFile(String fileName, ObjectStorage storage) throws IOException {
        Optional<ObjectRecord> existing = storage.getObject(
            ObjectKind.FILE,
            fileName,
            null
        );

        ObjectRecord fileRecord = existing.orElseThrow(() ->
            new WebApplicationException("File " + fileName + " Not Found!"));
        InputStream inputFileStream = fileRecord.getLocation().readContent();
        return new StreamingOutput() {
            @Override
            public void write(java.io.OutputStream output) throws IOException {
                IOUtils.copy(inputFileStream, output);
                output.flush();
            }
        };
    }

    private IRI generateIriFromQuery(
        String contextUri,
        String generateIriQuery,
        String fileName,
        String mediaType
    ) throws Exception {
        if (generateIriQuery != null && !generateIriQuery.isEmpty()) {
            RepositoryConnection connection = repositoryManager.getDefault().getConnection();
            SparqlOperationBuilder<TupleQuery> operationBuilder =
                SparqlOperationBuilder.create(generateIriQuery, TupleQuery.class);

            operationBuilder = operationBuilder
                .setBinding(DOCUMENT_NAME, vf.createLiteral(fileName))
                .setBinding(MEDIA_TYPE, vf.createLiteral(mediaType));

            if (contextUri != null && !contextUri.isEmpty()) {
                operationBuilder = operationBuilder.setBinding(CONTEXT_URI, vf.createIRI(contextUri));
            }
            TupleQuery query = operationBuilder.build(connection);

            TupleQueryResult result = query.evaluate();
            Binding binding = QueryResults.asList(result).get(0).getBinding("resourceIri");
            if (binding != null) {
                return vf.createIRI(binding.getValue().toString());
            } else {
                throw new Exception("IriQuery returned no IRI!");
            }
        } else {
            throw new Exception("Iri query is undefined!");
        }
    }

    private PointedGraph processQuery(
        IRI resourceIri,
        String query,
        String contextUri,
        String fileName,
        String mediaType
    ) throws RepositoryException, MalformedQueryException, QueryEvaluationException {
        try(RepositoryConnection connection = repositoryManager.getDefault().getConnection()){
            SparqlOperationBuilder<GraphQuery> operationBuilder =
                SparqlOperationBuilder.create(query, GraphQuery.class);
            operationBuilder = operationBuilder
                .setBinding(RESOURCE_IRI, resourceIri)
                .setBinding(DOCUMENT_NAME, vf.createLiteral(fileName))
                .setBinding(MEDIA_TYPE, vf.createLiteral(mediaType));

            if (contextUri != null && !contextUri.isEmpty()) {
                operationBuilder = operationBuilder.setBinding(CONTEXT_URI, vf.createIRI(contextUri));
            }
            GraphQueryResult result = operationBuilder.build(connection).evaluate();

            // asModel takes care of closing
             Model model = QueryResults.asModel(result);
             return new PointedGraph(resourceIri, model);
        }
    }

    private SecureRandom r = new SecureRandom();

    private long nextLong() {
        return Math.abs(r.nextLong());
    }
}
