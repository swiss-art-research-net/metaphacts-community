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

import java.io.InputStream;
import java.util.LinkedHashMap;
import java.util.Optional;

import javax.inject.Inject;
import javax.inject.Singleton;
import javax.ws.rs.Consumes;
import javax.ws.rs.POST;
import javax.ws.rs.PUT;
import javax.ws.rs.Path;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.MultivaluedMap;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.Status;

import org.apache.commons.configuration2.Configuration;
import org.apache.commons.configuration2.JSONConfiguration;
import org.apache.commons.configuration2.ex.ConfigurationException;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.shiro.authz.annotation.RequiresAuthentication;
import org.apache.shiro.authz.annotation.RequiresPermissions;

import com.metaphacts.config.ConfigurationUtil;
import com.metaphacts.security.Permissions;
import com.metaphacts.services.storage.api.ObjectStorage;
import com.metaphacts.services.storage.api.PlatformStorage;
import com.metaphacts.services.storage.api.StorageConfig;
import com.metaphacts.services.storage.api.StorageConfigLoader;
import com.metaphacts.services.storage.api.StorageConfigWriter;
import com.metaphacts.services.storage.api.StorageRegistry;

/**
 * Admin endpoint for the storage layer
 * 
 * @author Andreas Schwarte
 *
 */
@Singleton
@Path("admin/storage")
public class StorageAdminEndpoint {

    private static final Logger logger = LogManager.getLogger(StorageAdminEndpoint.class);

    @Inject
    private PlatformStorage platformStorage;

    @Inject
    private StorageRegistry storageRegistry;


    /**
     * Add a dynamic storage defined using URL encoded form parameters.
     * 
     * <p>
     * Required:
     * </p>
     * 
     * <ul>
     * <li>name</li>
     * <li>type</li></li>
     * 
     * <p>
     * Other properties are storage configuration specific (e.g. <i>root</i>).
     * </p>
     * 
     * <p>
     * This method constructs a hierarchical configuration following the scheme
     * <i>name.property</i> (e.g. <i>my-storage.type</i>).
     * </p>
     * 
     * 
     * 
     * @param formParams
     * @return
     */
    @POST
    @Consumes(MediaType.APPLICATION_FORM_URLENCODED)
    @Path("addStorage")
    @RequiresAuthentication
    @RequiresPermissions(Permissions.STORAGE.PREFIX_ADD)
    public Response addStorage(MultivaluedMap<String, String> formParams) {

        String name = formParams.getFirst("name");
        String type = formParams.getFirst("type");

        if (name == null) {
            return Response.status(Status.BAD_REQUEST).entity("Missing form param 'name'").build();
        }
        if (type == null) {
            return Response.status(Status.BAD_REQUEST).entity("Missing form param 'type'").build();
        }
        
        Configuration configuration = ConfigurationUtil.createEmptyConfig();
        formParams.keySet().stream().filter(key -> !key.equals("name")).forEach(key -> {
            String value = formParams.getFirst(key);
            String storageConfigKey = name + "." + key;
            configuration.setProperty(storageConfigKey, value);
        });
        

        return addStorageConfigInternal(configuration);

    }


    /**
     * Add a dynamic storage defined in JSON configuration.
     * 
     * <pre>
     * {
     *  "my-storage": {
     *       "type": "nonVersionedFile",
     *       "root": "/path/to/root"
     *       }
     * }
     * </pre>
     * 
     * <p>
     * Storages are added as dynamic storage configurations in the <i>runtime</i>
     * storage.prop.
     * </p>
     * 
     * <p>
     * If the storage already exists, a HTTP {@link Status#BAD_REQUEST} is returned.
     * </p>
     * 
     * @param in
     * @return
     */
    @PUT
    @Consumes(MediaType.APPLICATION_JSON)
    @Path("addStorage")
    @RequiresAuthentication
    @RequiresPermissions(Permissions.STORAGE.PREFIX_ADD)
    public Response addStorageConfig(InputStream in) {

        JSONConfiguration configuration = new JSONConfiguration();
        try {
            configuration.read(in);
        } catch (ConfigurationException e) {
            String msg = "Failed to parse storage JSON configuration: " + e.getMessage();
            logger.warn(msg);
            logger.debug("Details:", e);
            return Response.status(Status.BAD_REQUEST).entity(msg).build();
        }

        return addStorageConfigInternal(configuration);
    }

    /**
     * Helper method for adding a storage configuration.
     * <p>
     * The configuration is expected to have its values in the format
     * <i>my-storage.type</i>.
     * </p>
     * 
     * @param configuration
     * @return
     */
    protected Response addStorageConfigInternal(Configuration configuration) {

        LinkedHashMap<String, StorageConfig> storages = null;
        try {
            // load and validate storages
            storages = new StorageConfigLoader(storageRegistry).readStorageConfig(configuration);

            if (storages.isEmpty()) {
                return Response.status(Status.BAD_REQUEST)
                        .entity("No storage configurations found in provided configurations.").build();
            }

            // check if the any of the storages to be added exists
            // => we only allow adding storages that do not yet exist
            for (String storageId : storages.keySet()) {

                try {
                    ObjectStorage objectStorage = platformStorage.getStorage(storageId);
                    if (objectStorage != null) {
                        return Response.status(Status.BAD_REQUEST)
                                .entity("Storage '" + storageId + "' is already defined and cannot be added.").build();
                    }
                } catch (IllegalArgumentException e) {
                    // catch this exception explicitly: this is the good case
                    logger.trace("Storage to be created does not yet exist: " + storageId);
                }
            }

        } catch (Exception e) {
            logger.debug("Failed to validate storage configuration: " + e.getMessage());
            logger.trace("Details:", e);
            return Response.status(Status.BAD_REQUEST).entity("Failed to validate configuration: " + e.getMessage())
                    .build();
        }

        logger.info("Trying to add dynamic storages: {}", storages.keySet());

        ObjectStorage runtime = platformStorage.getStorage(PlatformStorage.DEVELOPMENT_RUNTIME_STORAGE_KEY);

        // keep a backup of the current config to potentially revert
        Optional<Configuration> previousConfig;
        try {
            previousConfig = StorageConfigWriter.currentConfiguration(runtime);
        } catch (Exception e) {
            logger.warn("Failed to read current configuration from storage: " + e.getMessage());
            logger.debug("Details:", e);
            return Response.status(Status.INTERNAL_SERVER_ERROR)
                    .entity("Unknown error while adding storage configuration").build();
        }

        try {
            StorageConfigWriter.mergeStorageConfig(configuration, runtime);
        } catch (Exception e) {
            logger.warn("Failed to merge configuration to storage: " + e.getMessage());
            logger.debug("Details:", e);
            return Response.status(Status.INTERNAL_SERVER_ERROR)
                    .entity("Unknown error while adding storage configuration").build();
        }

        try {
            platformStorage.refreshDynamicStorages();
        } catch (Exception e) {
            logger.warn("Failed to refresh dynamic storages: " + e.getMessage());
            logger.debug("Details:", e);

            // try to revert
            if (previousConfig.isPresent()) {
                try {
                    StorageConfigWriter.writeStorageConfig(previousConfig.get(), runtime);
                    platformStorage.refreshDynamicStorages();
                } catch (Exception e2) {
                    logger.warn("Failed to revert configuration to previous state: " + e2.getMessage());
                    logger.debug("Details:", e2);
                }
            }

            return Response.status(Status.INTERNAL_SERVER_ERROR)
                    .entity("Unexpected error while refreshing dynamic storages. " + e.getMessage()).build();
        }

        return Response.ok().build();

    }
}
