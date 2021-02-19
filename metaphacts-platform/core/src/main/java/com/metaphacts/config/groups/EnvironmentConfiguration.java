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
package com.metaphacts.config.groups;

import java.nio.file.Paths;
import java.util.List;

import javax.inject.Inject;

import com.google.common.collect.Lists;
import com.metaphacts.config.ConfigurationParameter;
import com.metaphacts.config.ConfigurationParameter.VisibilityLevel;
import com.metaphacts.config.InvalidConfigurationException;
import com.metaphacts.security.SecurityConfigRecord;
import com.metaphacts.security.SecurityConfigType;
import com.metaphacts.security.ShiroGuiceModule.ShiroFilter;
import com.metaphacts.services.storage.api.PlatformStorage;

/**
 * Configuration group for all deployment-specific configuration options,
 * such as server URLs, keys, etc.
 *
 * @author Michael Schmidt <ms@metaphacts.com>
 */
public class EnvironmentConfiguration extends ConfigurationGroupBase {
    private final static String ID = "environment";
    // TODO: outline using locale
    private final static String DESCRIPTION =
            "The environment group (file \"config/environment.prop\") contains all deployment-specific configuration "
            + "options such as server URLs, keys, etc. These parameters may influence how the platform is initialized "
            + "and as such they can not be change during runtime, for example, through the  <a href=\"/resource/Admin:Configuration\">configuration UI</a>";

    @Inject
    public EnvironmentConfiguration(PlatformStorage platformStorage) throws InvalidConfigurationException {
        super(ID, DESCRIPTION, platformStorage);
    }


    /***************************************************************************
     ************************ CONFIGURATION OPTIONS ****************************
     **************************************************************************/

    @ConfigurationParameter(name = "sparqlEndpoint", restartRequired = true, desc = "URL to the remote SPARQL endpoint. "
            + "Can be used to bootstrap the system without the need to define a default repository configuration. "
            + "<b>If the repository is running on a different machine and only accessible through HTTPS</b>, "
            + "then it might be required to import certificates into your JVM's keystore")
    public String getSparqlEndpoint() {
        return getString("sparqlEndpoint");
    }

    @ConfigurationParameter(name = "linkedDefaultRepository", restartRequired = true, desc = "ID of the the linked default "
            + " repository which is active and applied for all database operations if no specific target repository (other "
            + "than 'default') is requested. Can be used to configure the default target (e.g. to activate an Ephedra based "
            + "federation environment).")
    public String getLinkedDefaultRepository() {
        return getString("linkedDefaultRepository");
    }

    /***************************** DIRECTORIES ********************************/

    /**
     * storage location used by file upload component
     */
    public String getFileUploadLocation(final String type) {
        return getString("upload-" + type);
    }

    /***************************** URL MAPPINGS *******************************/
    @ConfigurationParameter(
            name = "resourceUrlMapping", 
            desc = "URL path mapping for resources. Default: /resource/",
            restartRequired = true, 
            visibilityLevel = VisibilityLevel.advanced)
    public String getResourceUrlMapping(){
        return getString("resourceUrlMapping", "/resource/");
    }

    // TODO not referenced, consider deprecation
    @ConfigurationParameter(name = "pagesUrlMapping", 
            restartRequired = true,
            visibilityLevel = VisibilityLevel.experimental)
    public String getPagesUrlMapping(){
        return getString("pagesUrlMapping", "/page/");
    }

    @ConfigurationParameter(
            name = "platformBaseIri", 
            desc = "Defines the base IRI for the platform. If not specified explicitly, this is inferred from the client's request URL.",
            restartRequired = false,
            visibilityLevel = VisibilityLevel.advanced
            )
    public String getPlatformBaseIri() {
        return getString("platformBaseIri");
    }

    @ConfigurationParameter(
            name = "pathsToRewrite", 
            desc = "List of request path prefixes which are rewritten to allow canonical access. "
                    + "Example: <code>http://example.org/person/foo</code> may be canocicalized to "
                    + "<code>http://example.com/resource/?uri=http://example.com/person/foo</code>",
            visibilityLevel = VisibilityLevel.advanced,
            restartRequired = true)
    public List<String> getPathsToRewrite() {
        return getStringList("pathsToRewrite", Lists.newArrayList());
    }

    /**************************** AUTHENTICATION ******************************/

    /**
     * If specified, all security configuration files will be loaded from specified storage.
     * @see #getSecurityConfig(SecurityConfigType)
     */
    @ConfigurationParameter(
            name = "securityConfigStorageId", 
            desc = "Specifies the ID of an existing storage from which security related "
                    + "configuration files (e.g. <code>shiro.ini</code>) are loaded.",
            visibilityLevel = VisibilityLevel.advanced,
            restartRequired = true)
    public String getSecurityConfigStorageId() {
        return getString("securityConfigStorageId");
    }

    private String getConfigFilePath(SecurityConfigType type) {
        return getString(type.getParamKey(), type.getDefaultPath());
    }

    /**
     * Returns {@link SecurityConfigRecord} for specified config type.
     * <ul>
     *   <li>if {@link #getSecurityConfigStorageId()} is defined then the platform will use
     *   storage to read/write the config files;</li>
     *   <li>otherwise filesystem and corresponding config parameters
     *   (e.g. {@link #getShiroConfig()}) will be used.</li>
     * </ul>
     */
    public SecurityConfigRecord getSecurityConfig(SecurityConfigType type) {
        String storageId = getSecurityConfigStorageId();
        if (storageId == null) {
            return SecurityConfigRecord.fromFilesystem(type, Paths.get(getConfigFilePath(type)));
        } else {
            return SecurityConfigRecord.fromStorage(type, platformStorage, storageId);
        }
    }

    @ConfigurationParameter(name = "shiroConfig", restartRequired = true)
    public String getShiroConfig() {
        return getConfigFilePath(SecurityConfigType.ShiroConfig);
    }

    @ConfigurationParameter(name = "shiroLDAPConfig", restartRequired = true)
    public String getShiroLDAPConfig() {
        return getConfigFilePath(SecurityConfigType.ShiroLDAPConfig);
    }


    @ConfigurationParameter(name = "oauthParameters", restartRequired = true)
    public String getOauthParameters() {
        return getConfigFilePath(SecurityConfigType.OauthParameters);
    }

    @ConfigurationParameter(name = "samlParameters", restartRequired = true)
    public String getSamlParameters() {
        return getConfigFilePath(SecurityConfigType.SamlParameters);
    }
    
    @ConfigurationParameter(name = "jwtParameters", restartRequired = true)
    public String getJwtParameters() {
        return getConfigFilePath(SecurityConfigType.JwtParameters);
    }

    @ConfigurationParameter(name = "ssoFactorAuthOverride", restartRequired = true)
    public String getSsoAuthConfigOverride() {
        return getConfigFilePath(SecurityConfigType.SsoAuthConfigOverride);
    }

    @ConfigurationParameter(name = "ssoUserConfig", restartRequired = true)
    public String getSsoUsersConfig() {
        return getConfigFilePath(SecurityConfigType.SsoUsersConfig);
    }

    @ConfigurationParameter(name = "shiroAuthenticationFilter", restartRequired = true, desc = "Authentication filter to apply. "
            + "Any combination of \"anon\" (Anonymous User),\"authc\" (FormBasedAuthentication) ,\"authcBasic\" (HTTP Basic Authentication). "
            + "Default: \"authcBasic, authc\"")
    public List<String> getShiroAuthenticationFilter() {
        return getStringList("shiroAuthenticationFilter",
                             Lists.newArrayList(ShiroFilter.authcBasic.name(), ShiroFilter.authc.name()));
    }

    @ConfigurationParameter(name = "shiroSessionTimeoutSecs", restartRequired = true, desc = "The time in seconds after which sessions will be closed in "
            + "case of inactivity Default: 1800.")
    public Integer getShiroSessionTimeoutSecs() {
        return getInteger("shiroSessionTimeoutSecs", 1800 /* = 30 mins */);
    }

    /**
     * Use local users from shiro.ini even if sso/ldap is in use.
     */
    @ConfigurationParameter(
            name = "enableLocalUsers", 
            desc = "Flag whether to enable local users if an external security realm (e.g. LDAP) is configured. "
                    + "If enabled, users can authenticate against the external realm and the local users "
                    + "realm, i.e. as an authentication chain. Default: disabled.",
            restartRequired = false)
    public Boolean isEnableLocalUsers() {
        return getBoolean("enableLocalUsers", false);
    }

    /**************************** SPARQL HTTP CLIENT PARAMETERS ***************/
    // TODO consider increasing the default number (at least for the total
    // connections)
    @ConfigurationParameter(name = "maxSparqlHttpConnections", desc = "The maximum number of HTTP connections for SPARQL repositories. "
            + "The HTTP connections are globally managed by the repository manager. "
            + "Default: 10 connections", restartRequired = true)
    public Integer getMaxSparqlHttpConnections() {
        return getInteger("maxSparqlHttpConnections", 10);
    }

    /**
     * SPARQL HTTP connection timeout (in seconds).
     *
     * This value is used to set both <b>http.connection.timeout</b>
     * (timeout for establishing the connection)
     * and <b>http.socket.timeout</b> (timeout for waiting for the data)
     * parameters of the Apache HttpClient.
     *
     * Note that the Operation#setMaxExecutionTime method of RDF4J
     * sets only the <b>http.socket.timeout</b> parameter
     * (see SparqlOperationBuilder).
     *
     * Default: null (infinite)
     *
     * @return
     */
    @ConfigurationParameter(name = "sparqlHttpConnectionTimeout", restartRequired = true, desc = "SPARQL HTTP connection timeout (in seconds). "
            + "This value is used to set both <code>http.connection.timeout</code> (timeout for establishing the connection) "
            + "and <code>http.socket.timeout</code> (timeout for waiting for the data) parameters of the Apache HttpClient. "
            + "Default: null (infinite)")
    public Integer getSparqlHttpConnectionTimeout() {
        return getInteger("sparqlHttpConnectionTimeout");
    }
    
    @ConfigurationParameter(
        name = "experimental.sparqlRequestHandlerClassName",
        restartRequired = true,
        desc = "Class name of the SparqlRequestHandler to use to process SPARQL queries." 
        + " Note: this is an experimental setting that may be removed at any time without further notice!",
        visibilityLevel = VisibilityLevel.experimental
    )
    public String getSparqlRequestHandlerClassName() {
        return getString("experimental.sparqlRequestHandlerClassName"); 
    }

    /**
     * A valid cross origin pattern to enable CORS
     * By default returns <code>null</null> i.e. CORS should not be enabled by default.
     *
     * @return
     */
    @ConfigurationParameter(name = "allowedCrossOrigin", restartRequired = true, desc = "Specifies the <code>Access-Control-Allow-Origin</code>. <code>*</code> can be used as a wildcard, "
            + "thereby allowing any origin to access the resource. "
            + "Please note that by default this property is set to null and thereby does set any CORS headers at all. "
            + "Default: null.")
    public String getAllowedCrossOrigin() {
        return getString("allowedCrossOrigin");
    }

    /****************************** VALIDATION ********************************/
    @Override
    public void assertConsistency() {

    }

}
