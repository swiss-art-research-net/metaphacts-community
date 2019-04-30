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

import java.io.BufferedOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Optional;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import javax.inject.Inject;
import javax.inject.Singleton;
import javax.ws.rs.ForbiddenException;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.ResponseBuilder;
import javax.ws.rs.core.StreamingOutput;

import org.apache.commons.io.IOUtils;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.shiro.SecurityUtils;
import org.apache.shiro.authz.annotation.RequiresAuthentication;
import org.apache.shiro.authz.permission.WildcardPermission;

import com.google.common.collect.Lists;
import com.metaphacts.plugin.PlatformPluginManager;
import com.metaphacts.rest.feature.CacheControl.NoCache;
import com.metaphacts.security.Permissions.APP;
import com.metaphacts.security.Permissions.STORAGE;
import com.metaphacts.services.storage.MainPlatformStorage;
import com.metaphacts.services.storage.api.ObjectKind;
import com.metaphacts.services.storage.api.ObjectRecord;
import com.metaphacts.services.storage.api.ObjectStorage;
import com.metaphacts.services.storage.api.StorageException;

import ro.fortsoft.pf4j.PluginWrapper;

/**
 * @author Johannes Trame <jt@metaphacts.com>
 *
 */
@Singleton
@Path("admin")
public class AppAdminEndpoint {

    private static final Logger logger = LogManager.getLogger(AppAdminEndpoint.class);

    @Inject
    private PlatformPluginManager pluginManager;
    
    @Inject
    private MainPlatformStorage storageManager;

    private class MetaObject {
        public MetaObject(String id, String storageKind, Boolean mutableStorage) {
            this.id = id;
            this.storageKind = storageKind;
            this.mutableStorage = mutableStorage;
        }

        @SuppressWarnings("unused")
        public String id;
        @SuppressWarnings("unused")
        public String storageKind;
        @SuppressWarnings("unused")
        public Boolean mutableStorage;
    }

    /**
     * List apps and respective meta-data,
     * considering the {@link STORAGE.PREFIX_ZIP_EXPORT} 
     * permission, i.e. storages to which the user does not have access,
     * will be filtered.
     * 
     * @return JSON array with storage meta-data objects 
     */
    @GET()
    @Path("apps")
    @NoCache
    @RequiresAuthentication
    @Produces(MediaType.APPLICATION_JSON)
    public Response listApps() {
        ArrayList<MetaObject> l = new ArrayList<MetaObject>();
        for (PluginWrapper p : pluginManager.getPlugins()) {
            String appId = p.getPluginId();
            if (checkPermission(APP.PREFIX_CONFIG_VIEW + appId)) {
                l.add(getStorageMetaOject(appId));
            }
        }
        for(String pId : Lists.<String>newArrayList("runtime")){
            l.add(getStorageMetaOject(pId));
        }
        return Response.ok().entity(l).build();
    }
    
    private MetaObject getStorageMetaOject(String id){
        ObjectStorage s = storageManager.getStorage(id);
        return new MetaObject(id, s.getClass().getCanonicalName(), s.isMutable() );
    }
    
    /**
     * List storages and respective meta-data,
     * considering the {@link STORAGE.PREFIX_ZIP_EXPORT} 
     * permission, i.e. storages to which the user does not have access,
     * will be filtered.
     * 
     * @return JSON array with storage meta-data objects 
     */
    @GET()
    @Path("storages")
    @NoCache
    @RequiresAuthentication
    @Produces(MediaType.APPLICATION_JSON)
    public Response listStorages() {
        ArrayList<MetaObject> l = Lists.newArrayList();
        for(String storageId : storageManager.getStorages().keySet()){
            if (checkPermission(STORAGE.PREFIX_VIEW_CONFIG + storageId)) {
                l.add(getStorageMetaOject(storageId));
            }
        }
        return Response.ok().entity(l).build();
    }
    
    @GET()
    @Path("/storages/{storageId}/zip")
    @NoCache
    @RequiresAuthentication
    public Response downloadAppStorage(@PathParam("storageId") String storageId) throws StorageException {
        if (!checkPermission(STORAGE.PREFIX_ZIP_EXPORT + storageId)) {
            throw new ForbiddenException();
        }
        String fileName = new SimpleDateFormat("yyyy_MM_dd-HH_mm").format(new Date())+"-app_"+storageId+"_export.zip";

        logger.info("Exporting storage {} as zip.", storageId);
        StreamingOutput stream = new StreamingOutput() {
            @Override
            public void write(OutputStream output) throws IOException {


                try (ZipOutputStream zip = new ZipOutputStream(new BufferedOutputStream(output))){
                    ObjectStorage storage = storageManager.getStorage(storageId);
                    List<ObjectRecord> objects = Lists.newArrayList();
                    objects.addAll(storage.getAllObjects(ObjectKind.TEMPLATE, ""));
                    objects.addAll(storage.getAllObjects(ObjectKind.CONFIG, ""));
                    objects.addAll(storage.getAllObjects(ObjectKind.ASSET, ""));
                    objects.addAll(storage.getAllObjects(ObjectKind.LDP, ""));
                    for (ObjectRecord storageObject : objects) {
                        // Get InputStream from storage
                        try (InputStream in = storageObject.getLocation().readContent()) {
                            // Add Zip Entry
                            Optional<String> path = storageManager.getPathMapping().pathForObjectId(storageObject.getKind(), storageObject.getId());
                            zip.putNextEntry(new ZipEntry(storageId+"/"+path.get()));
                            // Write file into zip
                            IOUtils.copy(in, zip);
                            zip.closeEntry();
                        }
                    }
                } catch (Exception e) {
                    throw new RuntimeException(e);
                } finally {
                    // flush and close
                    output.flush();
                    output.close();
                }
            }
        };

        // Set response headers and return 
        ResponseBuilder response = Response.ok(stream);
        response.header("Content-Disposition", "attachment; filename=\""+ fileName +"\"");
        return response.build();

    }
    
    /**
     * Return true if the currently logged-in user has the respective permission.
     * @param permission
     * @return true if the current user has the permission
     */
    private boolean checkPermission(String permission) {
        return SecurityUtils.getSubject().isPermitted(new WildcardPermission(permission));
    }


}
