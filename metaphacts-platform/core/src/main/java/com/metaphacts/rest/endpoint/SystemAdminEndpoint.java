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

import java.io.File;
import java.io.FileOutputStream;
import java.lang.management.ManagementFactory;
import java.lang.management.RuntimeMXBean;
import java.nio.file.Files;
import java.nio.file.attribute.FileTime;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

import javax.inject.Inject;
import javax.inject.Singleton;
import javax.servlet.ServletContext;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.Status;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.shiro.authz.annotation.RequiresAuthentication;
import org.apache.shiro.authz.annotation.RequiresPermissions;

import com.google.common.collect.Maps;
import com.google.inject.Provider;
import com.metaphacts.rest.feature.CacheControl.NoCache;
import com.metaphacts.security.Permissions.SYSTEM;
import com.metaphacts.util.SystemPropUtils;

/**
 * @author Johannes Trame <jt@metaphacts.com>
 *
 */
@Singleton
@Path("admin/system")
public class SystemAdminEndpoint {
    @Inject
    private Provider<ServletContext> sc;

    private static final Logger logger = LogManager.getLogger(SystemAdminEndpoint.class);

    @GET()
    @Path("platform-info")
    @NoCache
    @RequiresAuthentication
    @Produces(MediaType.APPLICATION_JSON)
    public Response getPlatformInfo() {
        HashMap<String, Object> info = Maps.newHashMap();
        info.put("Platform Version", SystemPropUtils.getVersionFromManifest(sc.get()));
        return Response.ok().entity(info).build();
    }

    @GET()
    @Path("jvm-properties")
    @NoCache
    @RequiresAuthentication
    @RequiresPermissions(SYSTEM.JVM_PROPERTIES)
    @Produces(MediaType.APPLICATION_JSON)
    public Response getJvmProperties() {
        List<String> whitelist = Arrays.asList("file.encoding", "java.vm", "com.metaphacts","config.mutablePluginApps",
                "config.environment.","config.ui.", "config.global.",  "java.class", "java.version", "log4j.configurationFile",
                "runtimeDirectory", "pf4j.pluginsDir", "org.eclipse.jetty", "jetty.git.hash",
                "user.timezone", "path.separator");
        RuntimeMXBean bean = ManagementFactory.getRuntimeMXBean();
        final Map<String, String> properties = bean.getSystemProperties();
        final Map<String, String> filteredProperties = properties.entrySet().stream()
                .filter(entry -> whitelist.stream()
                        .anyMatch(listEntry -> entry.getKey().startsWith(listEntry)))
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
        // DO NOT expose all input arguments bean.getInputArguments(), since they expose secretes
        return Response.ok().entity(new TreeMap<String, String>(filteredProperties)).build();
    }

    @POST()
    @Path("restart")
    @NoCache
    @RequiresAuthentication
    @RequiresPermissions(SYSTEM.RESTART)
    public Response restartSystem() {
        // restart is performed by looking for a file ${jetty.base}/webapps/ROOT.xml
        // and 'touch'ing it (i.e. update write timestamp) to make Jetty reload the webapp 
        File contextXml = null;
        File jettyBase = null;
        String jettyBasePath = System.getProperty("jetty.base", "/var/lib/jetty");
        if (jettyBasePath != null) {
            jettyBase = new File(jettyBasePath);
        }
        if (jettyBase != null && jettyBase.isDirectory()) {
            contextXml = new File(jettyBase, "webapps/ROOT.xml");
        }
        if (contextXml != null && contextXml.isFile()) {
            logger.info("Asking Jetty to restart webapp");
            if (touch(contextXml)) {
                return Response.ok().build();
            } else {
                return Response.status(Status.INTERNAL_SERVER_ERROR).build();
            }
        }
        logger.error("failed to reload app: ${jetty.base}/webapps/ROOT.xml does not exist");
        return Response.status(Status.INTERNAL_SERVER_ERROR).build();
    }

    private boolean touch(File contextXml) {
        try {
            Files.setLastModifiedTime(contextXml.toPath(), FileTime.fromMillis(System.currentTimeMillis()));
            logger.debug("Successfully touched {}", contextXml);
            return true;
        }
        catch (Exception e) {
            // setting last modified time seems to require file ownership, if that fails we try to 
            // open the file for writing (in append mode) without actually writing anything
            logger.debug("failed to reload app by touching {}: {}", contextXml, e.getMessage());
            logger.debug("ROOT.xml: {}, readable: {}, writable: {}", contextXml.getPath(), contextXml.canRead(), contextXml.canWrite());
            try (FileOutputStream fos = new FileOutputStream(contextXml, true)) {
                logger.debug("trying write-append");
                byte[] empty = new byte[0];
                fos.write(empty);
                logger.debug("Successfully touched {}", contextXml);
            }
            catch (Exception e2) {
                logger.debug("failed to reload app by touching {}: {}", contextXml, e2.getMessage());
            }
            // calling "touch" via local shell execution as fallback when the
            // current user is not the owner of the file
            try {
                logger.debug("trying write-append using /bin/sh -c \"touch ROOT.xml\"");
                ProcessBuilder processBuilder = new ProcessBuilder();
                processBuilder.command("/bin/touch", contextXml.getAbsolutePath());
                Process process = processBuilder.start();
                logger.debug("Successfully touched {} using /bin/sh -c \"touch ROOT.xml\"", contextXml);
                process.waitFor(5, TimeUnit.SECONDS);
                int exitValue = process.exitValue();
                if(exitValue==0) {
                    logger.debug("Exit code is 0");
                    return true;
                }
                else {
                    logger.debug("Exit code: " +exitValue);
                    return false;
                }
            } catch (Exception e3) {
                logger.debug("failed to reload app by touching {} using /bin/sh -c \"touch ROOT.xml\" : {} ",
                        contextXml, e3.getMessage());
                return false;
            }
        }
    }

}
