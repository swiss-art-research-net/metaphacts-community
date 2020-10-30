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
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;

import javax.inject.Inject;
import javax.inject.Singleton;
import javax.ws.rs.Consumes;
import javax.ws.rs.DELETE;
import javax.ws.rs.GET;
import javax.ws.rs.PUT;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.Status;

import org.apache.commons.configuration2.ex.ConfigurationException;
import org.apache.commons.lang3.StringUtils;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.shiro.SecurityUtils;
import org.apache.shiro.authz.UnauthorizedException;
import org.apache.shiro.authz.annotation.RequiresAuthentication;

import com.google.common.collect.Lists;
import com.google.common.collect.Maps;
import com.metaphacts.cache.CacheManager;
import com.metaphacts.config.ConfigParameterValueInfo;
import com.metaphacts.config.Configuration;
import com.metaphacts.config.ConfigurationParameter.VisibilityLevel;
import com.metaphacts.config.UnknownConfigurationException;
import com.metaphacts.config.groups.CacheConfiguration;
import com.metaphacts.config.groups.DataQualityConfiguration;
import com.metaphacts.config.groups.EnvironmentConfiguration;
import com.metaphacts.config.groups.GlobalConfiguration;
import com.metaphacts.config.groups.UIConfiguration;
import com.metaphacts.rest.feature.CacheControl.NoCache;
import com.metaphacts.security.Permissions.APIUsageMode;
import com.metaphacts.security.Permissions.CONFIGURATION;
import com.metaphacts.services.storage.api.ObjectKind;
import com.metaphacts.services.storage.api.PlatformStorage;

import io.swagger.v3.oas.annotations.Hidden;

/**
 * Endpoint exposing the configuration via a REST-style protocol. Supports both
 * read and write access to the configuration, backed by SHIRO permission
 * management.
 * 
 * @author Michael Schmidt <ms@metaphacts.com>
 */
@Path("config")
@Singleton
public class ConfigurationEndpoint {

    private static final Logger logger = LogManager.getLogger(ConfigurationEndpoint.class);

    @Inject
    private PlatformStorage platformStorage;

    /**
     * The backing system configuration class, which is exposed via this endpoint.
     */
    @Inject
    private Configuration systemConfig;

    @Inject
    private CacheManager cacheManager;

    /**
     * Lists all configuration groups (sorted lexicographically).
     * 
     * @return all configuration groups, independently from whether the user
     *          has access rights to (any of) their items
     */
    @GET()
    @NoCache
    @RequiresAuthentication
    @Produces(MediaType.APPLICATION_JSON)
    public Response listConfigurationGroups() {
        
        return Response.ok().entity(systemConfig.listGroups()).build();

    }

    /**
     * Lists all configuration values in the configuration group for which
     * the user currently has access (sorted lexicographically).
     * 
     * @param configGroup the config group for which the lookup is performed
     * @return the string identifiers of the configuration values
     */
    @GET()
    @NoCache
    @Path("{configGroup}")
    @RequiresAuthentication
    @Produces(MediaType.APPLICATION_JSON)
    public Response listConfigurationParamsInGroup(@PathParam("configGroup") String configGroup) {
        
        try {
            Map<String, ConfigParameterValueInfo> unfilteredMap = systemConfig.listParamsInGroups(configGroup);
            Map<String, ConfigParameterValueInfo> filteredMap = Maps.newHashMap();
            for( Entry<String, ConfigParameterValueInfo> entry : unfilteredMap.entrySet()){
                final String configIdInGroup = entry.getKey();
                // check user has permission 
                String requiredReadPermission = CONFIGURATION.getPermissionString(
                    configGroup, configIdInGroup, APIUsageMode.read);

                if (SecurityUtils.getSubject().isPermitted(requiredReadPermission)) {
                    filteredMap.put(entry.getKey(), entry.getValue());
                }
            }
            
            return Response.ok().entity(filteredMap).build();
            
        } catch (UnknownConfigurationException e) {
            
            logger.trace("Lookup for unknown configuration group: " + configGroup);
            return Response.status(Response.Status.NOT_FOUND).build();

        }
    }

    /**
     * Lists the metadata of all available configuration settings in configGroups
     * passed.
     * 
     * <p>
     * Default set of configuration groups:
     * </p>
     * 
     * <ul>
     * <li>environment - {@link EnvironmentConfiguration}</li>
     * <li>global - {@link GlobalConfiguration}</li>
     * <li>ui - {@link UIConfiguration}</li>
     * <li>cache - {@link CacheConfiguration}</li>
     * <li>dataQuality - {@link DataQualityConfiguration}</li>
     * </ul>
     * 
     * <p>
     * This method returns all settings with {@link VisibilityLevel#advanced} or
     * lower, i.e. it does not return {@link VisibilityLevel#experimental} settings.
     * </p>
     * 
     * @param configGroups optional list of config groups identifiers (e.g.
     *                     environment). If not specified the default set of
     *                     configuration groups is shown
     * @return the list of {@link ConfigurationParameterGroupDoc}
     * 
     */
    @GET()
    @Path("allConfigurationParametersDoc")
    @RequiresAuthentication
    @Produces(MediaType.APPLICATION_JSON)
    @Hidden
    public List<ConfigurationParameterGroupDoc> allConfigurationParametersDoc(
            @QueryParam("configGroups") List<String> configGroups)
            throws UnknownConfigurationException {

        final VisibilityLevel maxVisibilityLevel = VisibilityLevel.advanced;

        List<ConfigurationParameterGroupDoc> result = Lists.newArrayList();
        List<String> defaultConfigGroups = Lists.newArrayList("environment", "global", "ui", "cache", "dataQuality");
        for (String configGroup : !configGroups.isEmpty() ? configGroups : defaultConfigGroups) {

            Map<String, ConfigParameterValueInfo> unfilteredMap = systemConfig.listParamsInGroups(configGroup);
            ConfigurationParameterGroupDoc groupDoc = new ConfigurationParameterGroupDoc();

            groupDoc.groupName = StringUtils.capitalize(configGroup) + " Configuration Group";
            groupDoc.groupDescription = systemConfig.getDescriptionForGroup(configGroup);
            groupDoc.configParamInfo = Lists.newArrayList();

            unfilteredMap.forEach((group, configParamValues) -> {
                // check if this setting is actually visible
                if (configParamValues.getVisibilityLevel().ordinal() > maxVisibilityLevel.ordinal()) {
                    return;
                }
                ConfigurationParameterDoc configParameterDoc = new ConfigurationParameterDoc();
                configParameterDoc.name = group;
                configParameterDoc.description = configParamValues.getDescription();
                configParameterDoc.restartRequired = configParamValues.isRestartRequired();
                configParameterDoc.type = configParamValues.getParameterType();

                groupDoc.configParamInfo.add(configParameterDoc);
            });

            result.add(groupDoc);
        }
        return result;
    }

    /**
     * Read the current configuration value identified by the parameter pair.
     * 
     * @param configGroup
     * @param configIdInGroup
     * @return the value; returns NOT_FOUND if the config value does not exist and
     *          FORBIDDEN if the config value exists but has no value
     */
    @GET()
    @NoCache
    @Path("{configGroup}/{configIdInGroup}")
    @RequiresAuthentication
    @Produces(MediaType.APPLICATION_JSON)
    public Response getConfigurationValue(
        @PathParam("configGroup") String configGroup,
        @PathParam("configIdInGroup") String configIdInGroup) {

        try {
            // assert user permissions sufficient
            String requiredReadPermission = CONFIGURATION.getPermissionString(
                configGroup, configIdInGroup, APIUsageMode.read);

            if (!SecurityUtils.getSubject().isPermitted(requiredReadPermission)) {
                throw new UnauthorizedException(); // no read permissions
            }
            
            return Response.ok().entity(systemConfig.lookupProperty(configGroup, configIdInGroup)).build();

        } catch (UnknownConfigurationException e) {
            
            logger.trace("Lookup for unknown configuration item: " + configGroup + " / " + configIdInGroup);
            return Response.status(Response.Status.NOT_FOUND).build();
            
        } catch (UnauthorizedException e) {

            logger.trace("User has no access to configuration item (please enable in shiro.ini if you "
                    + "believe this should be accessible): " + configGroup + " / " + configIdInGroup);
            return Response.status(Response.Status.FORBIDDEN).build();
            
        }
    }
    
    @PUT
    @Path("{configGroup}/{configIdInGroup}")
    @Consumes(MediaType.APPLICATION_JSON)
    @RequiresAuthentication
    public Response setConfigurationValue(
        @PathParam("configGroup") String configGroup,
        @PathParam("configIdInGroup") String configIdInGroup,
        @QueryParam("targetAppId") String targetAppId,
        List<String> configValues
    ) {
        try {
            // prevent writing if user does not have permissions
            String requiredWritePermission = CONFIGURATION.getPermissionString(
                configGroup, configIdInGroup, APIUsageMode.write);
            
            if (!SecurityUtils.getSubject().isPermitted(requiredWritePermission)) {
                throw new UnauthorizedException(); // no write permissions
            }

            systemConfig.setProperty(configGroup, configIdInGroup, configValues, targetAppId);
            
            //TODO temporary workaround for invalidating caches after updates
            // should go into proper event system within configuration management
            cacheManager.invalidateAll();
            
            return Response.ok().build();
        } catch(UnauthorizedException e) {
            logger.trace("User has no access to set configuration item (please enable in shiro.ini if you "
                    + "believe this should be accessible): " + configGroup + " / " + configIdInGroup);
            return Response.status(Response.Status.FORBIDDEN).entity(e.getMessage()).build();
        } catch (UnknownConfigurationException e) {
            return Response.status(Status.INTERNAL_SERVER_ERROR).entity(e.getMessage()).type("text/plain").build();
        } catch (Exception e) {
            if(e.getCause() instanceof ConfigurationException) {
                return Response.status(Response.Status.NOT_ACCEPTABLE).entity(e.getCause().getMessage()).build();
            }
            return Response.status(Response.Status.NOT_ACCEPTABLE).entity(e.getMessage()).build();
        }
    }

    @DELETE
    @Path("{configGroup}/{configIdInGroup}")
    @RequiresAuthentication
    public Response deleteConfigurationValue(
        @PathParam("configGroup") String configGroup,
        @PathParam("configIdInGroup") String configIdInGroup,
        @QueryParam("targetAppId") String targetAppId
    ) throws ConfigurationException {
        try {
            // prevent writing if user does not have permissions
            String requiredWritePermission = CONFIGURATION.getPermissionString(
                configGroup, configIdInGroup, APIUsageMode.write);

            if (!SecurityUtils.getSubject().isPermitted(requiredWritePermission)) {
                throw new UnauthorizedException(); // no write permissions
            }

            systemConfig.setProperty(configGroup, configIdInGroup, Collections.emptyList(), targetAppId);

            //TODO temporary workaround for invalidating caches after updates
            // should go into proper event system within configuration management
            cacheManager.invalidateAll();

            return Response.ok().build();
        } catch(UnauthorizedException e) {
            logger.trace("User has no access to set configuration item (please enable in shiro.ini if you "
                + "believe this should be accessible): " + configGroup + " / " + configIdInGroup);
            return Response.status(Response.Status.FORBIDDEN).entity(e.getMessage()).build();
        } catch (UnknownConfigurationException e) {
            return Response.status(Status.INTERNAL_SERVER_ERROR).entity(e.getMessage()).type("text/plain").build();
        }
    }

    @GET
    @Path("storageStatus")
    @Produces(MediaType.APPLICATION_JSON)
    @RequiresAuthentication
    public Response getStorageStatus() throws IOException {
        List<PlatformStorage.StorageStatus> writableApps =
            platformStorage.getStorageStatusFor(ObjectKind.TEMPLATE);
        return Response.ok(writableApps).build();
    }

    /**
     * Wrapper for the parameter present in "Configuration Parameter". Contains the
     * configuration's name, description, return type and if a restart is required.
     */
    static class ConfigurationParameterDoc {
        public String name;
        public String description;
        public boolean restartRequired;
        public String type;
    }

    /**
     * Structural class for storing the Configuration Parameters as a group.
     */
    static class ConfigurationParameterGroupDoc {
        public String groupName;
        public String groupDescription;
        public List<ConfigurationParameterDoc> configParamInfo;
    }
}
