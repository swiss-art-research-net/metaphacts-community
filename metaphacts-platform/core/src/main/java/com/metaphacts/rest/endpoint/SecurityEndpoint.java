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
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

import javax.inject.Inject;
import javax.inject.Singleton;
import javax.naming.NamingException;
import javax.ws.rs.Consumes;
import javax.ws.rs.DELETE;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.PUT;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.WebApplicationException;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.Status;
import javax.ws.rs.core.StreamingOutput;

import org.apache.commons.lang.StringUtils;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.shiro.SecurityUtils;
import org.apache.shiro.authc.credential.PasswordService;
import org.apache.shiro.authz.Permission;
import org.apache.shiro.authz.annotation.RequiresAuthentication;
import org.apache.shiro.authz.annotation.RequiresPermissions;
import org.apache.shiro.subject.Subject;

import com.fasterxml.jackson.core.JsonParser;
import com.github.jsonldjava.shaded.com.google.common.collect.Sets;
import com.google.common.collect.Lists;
import com.google.common.collect.Maps;
import com.metaphacts.config.NamespaceRegistry;
import com.metaphacts.data.json.JsonUtil;
import com.metaphacts.repository.MpRepositoryProvider;
import com.metaphacts.repository.RepositoryManager;
import com.metaphacts.rest.feature.CacheControl.MaxAgeCache;
import com.metaphacts.rest.feature.CacheControl.NoCache;
import com.metaphacts.security.AccountManager;
import com.metaphacts.security.AnonymousUserFilter;
import com.metaphacts.security.LDAPRealm;
import com.metaphacts.security.MetaphactsSecurityManager;
import com.metaphacts.security.PermissionUtil;
import com.metaphacts.security.Permissions.ACCOUNTS;
import com.metaphacts.security.Permissions.PERMISSIONS;
import com.metaphacts.security.Permissions.ROLES;
import com.metaphacts.security.PermissionsDocGroup;
import com.metaphacts.security.PermissionsParameterInfo;
import com.metaphacts.security.PlatformRoleManager;
import com.metaphacts.security.PlatformRoleManager.PlatformRole;
import com.metaphacts.security.SecurityService;

import io.github.classgraph.ClassGraph;
import io.github.classgraph.ClassInfo;
import io.github.classgraph.ScanResult;
import io.swagger.v3.oas.annotations.Hidden;
/**
 * @author Johannes Trame <jt@metaphacts.com>
 */
@Path("security")
@Singleton
public class SecurityEndpoint {

    private static final Logger logger = LogManager.getLogger(SecurityEndpoint.class);

    @Inject
    private PasswordService passwordService;

    @Inject
    private NamespaceRegistry ns;
    
    @Inject
    private RepositoryManager repositoryManager;

    @Inject
    private SecurityService securityService;

    /**
     * POJO to represent the current user for serialization to JSON
     *  //TODO return some more sophisticated user object
     */
    @SuppressWarnings("unused")
    private class CurrentUser{
        public String principal = SecurityService.getUserName();
        public String userURI = ns.getUserIRI().stringValue();
        public boolean isAuthenticated = SecurityUtils.getSubject().isAuthenticated();
        public boolean isAnonymous = SecurityUtils.getSubject().getPrincipal().toString().equals(AnonymousUserFilter.ANONYMOUS_PRINCIPAL);
    }

    @SuppressWarnings("unused")
    private class SessionInfo{
        public long lastAccessTimestamp =  SecurityUtils.getSubject().getSession().getLastAccessTime().getTime();
        public long timout =  SecurityUtils.getSubject().getSession().getTimeout();
        public long idleTime = ( (new Date()).getTime() - lastAccessTimestamp) / 1000;
    }

    @SuppressWarnings("unused")
    private static class Account{
        //empty constructor is need for jackson
        public Account(){}

        public String getPrincipal() {
            return principal;
        }
        public void setPrincipal(String principal) {
            this.principal = principal;
        }
        public String getPassword() {
            return password;
        }
        public void setPassword(String password) {
            this.password = password;
        }
        public String getRoles() {
            return roles;
        }
        public void setRoles(String roles) {
            this.roles = roles;
        }

        public List<String> getPermissions() {
            return permissions;
        }
        public void setPermissions(List<String> permissions) {
            this.permissions = permissions;
        }

		
        private String principal;
        private String password;
        private String roles;
        private List<String> permissions;

    }

    static class RoleDefinition {
        //empty constructor is need for jackson
        public RoleDefinition(){}

        @SuppressWarnings("unused")
        public String getRoleName() {
            return roleName;
        }
        public void setRoleName(String roleName) {
            this.roleName = roleName;
        }

        public List<String> getPermissions() {
            return permissions;
        }

        public boolean isMutable() {
            return mutable;
        }

        public void setMutable(boolean mutable) {
            this.mutable = mutable;
        }

        public boolean isDeletable() {
            return deletable;
        }

        public void setDeletable(boolean deletable) {
            this.deletable = deletable;
        }

        public String roleName;
        public List<String> permissions;
        private boolean mutable;
        private boolean deletable;
    }

    @GET()
    @NoCache
    @Path("user")
    @Produces(MediaType.APPLICATION_JSON)
    public CurrentUser getUser() {
        return new CurrentUser();
    }

    @POST()
    @Path("createAccount")
    @Consumes(MediaType.APPLICATION_JSON)
    @RequiresAuthentication
    @RequiresPermissions(ACCOUNTS.CREATE)
    public void createAccount(Account account) {
        try{
           logger.debug("Adding new user account with principal :"+account.getPrincipal());
           String[] roles = StringUtils.isBlank(account.getRoles()) ? new String[]{} : account.getRoles().split(",");
           if(StringUtils.isBlank(account.getPrincipal()))
               throw new IllegalArgumentException("Principal can not be null or empty.");
           if(StringUtils.isBlank(account.getRoles()))
               throw new IllegalArgumentException("Roles can not be null or empty.");
           if(StringUtils.isBlank(account.getPassword()))
               throw new IllegalArgumentException("Password can not be null or empty.");

            if (getAccountManager().accountExists(account.getPrincipal()))
                   throw new IllegalArgumentException("Principal with name "+account.getPrincipal()+" does already exists.");

            getAccountManager().addAccount(account.getPrincipal(),
                    passwordService.encryptPassword(account.getPassword()), roles);
        }catch(IllegalArgumentException e){
            throw new CustomIllegalArgumentException(e.getMessage());
        }
    }

    @PUT()
    @NoCache
    @Path("isPermissionValid")
    @Consumes(MediaType.APPLICATION_JSON)
    @RequiresAuthentication
    public boolean isPermissionValid(String permission) {
        if(PermissionUtil.isPermissionValid(permission)) {
            return true;
        } else {
            return false;
        }
    }
    
    @GET()
    @NoCache
    @Path("getAllRoleDefinitions")
    @RequiresAuthentication
    @Produces(MediaType.APPLICATION_JSON)
    @RequiresPermissions({ROLES.QUERY, PERMISSIONS.QUERY})
    public List<RoleDefinition> getAllAvailableRoles() {
        List<RoleDefinition> roleDefinitions = Lists.newArrayList();
        for (PlatformRole role : getPlatformRoleManager().getAllAvailableRoles()) {
            RoleDefinition roleDefinition = new RoleDefinition();
            roleDefinition.permissions = new ArrayList<String>();
            roleDefinition.setRoleName(role.getName());
            roleDefinition.setMutable(role.isMutable());
            roleDefinition.setDeletable(role.isDeletable());
            for(Permission individualPermission : role.getPermissions()) {
                roleDefinition.permissions.add(individualPermission.toString());
            }
            roleDefinitions.add(roleDefinition);
        }
        return roleDefinitions;
    }

    @PUT()
    @Path("updateRoleDefinitions")
    @Consumes(MediaType.APPLICATION_JSON)
    @RequiresAuthentication
    @RequiresPermissions(ROLES.EDIT)
    public Response updateRoleDefinitions(RoleDefinition[] roles) throws Exception {
        Map<String, List<String>> updateMap = Maps.newHashMap();
        Set<String> deleteRoles = Sets.newHashSet();
        try {
            for(RoleDefinition role : roles) {
                String roleName = role.roleName;
                List<String> permissions = new ArrayList<String>();
                for(String permission : role.getPermissions()) {
                    boolean isPermissionValid = PermissionUtil.isPermissionValid(permission);
                    if(isPermissionValid) {
                        permissions.add(PermissionUtil.normalizePermission(permission));
                    } else {
                        throw new IllegalArgumentException(
                                "Permission \"" + permission + "\" could not be validated. Please update it.");
                    }
                }
                updateMap.put(roleName, permissions);
            }

            PlatformRoleManager roleManager = getPlatformRoleManager();

            // determine set of delete roles:
            Set<String> allRoles = roleManager.getAllAvailableRoles().stream().map(p -> p.getName())
                    .collect(Collectors.toSet());
            deleteRoles.addAll(allRoles);
            deleteRoles.removeAll(updateMap.keySet());

            getPlatformRoleManager().updateRoles(updateMap, deleteRoles);

            return Response.ok().build();

        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.BAD_REQUEST).entity(e.getMessage()).build();
        } catch (Exception e) {
            logger.debug("Error while updating role definitions: " + e.getMessage());
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR).entity(e.getMessage()).build();
        }
    }

    @DELETE()
    @Path("deleteAccount/{userPrincipal}")
    @RequiresAuthentication
    @RequiresPermissions(ACCOUNTS.DELETE)
    public void deleteAccount(@PathParam("userPrincipal") String userPrincipal) {
        try{
            if(StringUtils.isBlank(userPrincipal))
                throw new IllegalArgumentException("User principal can not be null.");

            getAccountManager().deleteAccount(userPrincipal);
        }catch(IllegalArgumentException e){
            throw new CustomIllegalArgumentException(e.getMessage());
        }
    }

    @PUT()
    @Path("updateAccount")
    @Consumes(MediaType.APPLICATION_JSON)
    @RequiresAuthentication
    @RequiresPermissions(ACCOUNTS.CREATE)
    public void updateAccount(Account account) {
        try{
            logger.debug("Updating user account with principal :"+account.getPrincipal());
            if(StringUtils.isBlank(account.getPrincipal()))
                throw new IllegalArgumentException("Principal can not be null or empty.");
            if(StringUtils.isBlank(account.getRoles()))
                throw new IllegalArgumentException("Roles can not be null or empty.");
            String[] roles = account.getRoles().split(",");

            String password= account.getPassword()!=null ? passwordService.encryptPassword(account.getPassword()) : null;
            getAccountManager().updateAccount(account.getPrincipal(), password, roles);
        }catch(IllegalArgumentException e){
            throw new CustomIllegalArgumentException(e.getMessage());
        }
    }


    @GET()
    @MaxAgeCache(time=1, unit=TimeUnit.DAYS)
    @Path("getAllPermissionsDoc")
    @Produces(MediaType.APPLICATION_JSON)
    @RequiresAuthentication
    @Hidden
    public Map<String, ArrayList<PermissionsParameterInfo>> getAllPermissionsDoc() {
        PermissionsParameterInfo permissionParameters = new PermissionsParameterInfo();
        ArrayList<PermissionsParameterInfo> permissions = Lists.newArrayList();
        HashMap<String, ArrayList<PermissionsParameterInfo>> map = Maps.newHashMap();
        String pkg = "com.metaphacts.security";
        String routeAnnotation = pkg + ".PermissionsDocGroup";
        try (ScanResult scanResult = new ClassGraph()
                .enableClassInfo()
                .enableAnnotationInfo()
                .enableStaticFinalFieldConstantInitializerValues()
                .whitelistPackages(pkg)
                .scan()) {
            for (ClassInfo routeClassInfo : scanResult.getClassesWithAnnotation(routeAnnotation)) {
                Class<?> permissionGroup = routeClassInfo.loadClass();
                String desc = permissionGroup.getAnnotation(PermissionsDocGroup.class).desc();
                permissions = new ArrayList<PermissionsParameterInfo>();
                permissionParameters.setAllAnnotationParameters(permissionGroup, permissions);
                map.put(desc, permissions);
            }
        }
        return map;
    }

    
    /**
     * Returns the roles for the current user (thread context) Does not have /
     * require any further permission checks, i.e. every user can view/list his
     * own roles.
     * 
     * @return list of role names (strings)
     */
    @GET()
    @NoCache
    @Path("getPersonalRoles")
    @Produces(MediaType.APPLICATION_JSON)
    @RequiresAuthentication
    public Collection<String> getPersonalRoles() {
        return getCurrentUserRoles();
    }
    
    /**
     * Returns additional attributes for the current user (thread context) Does not have /
     * require any further permission checks, i.e. every user can view/list his
     * own roles.
     * 
     * @return attribute map (string-object pairs)
     */
    @GET()
    @NoCache
    @Path("getPersonalUserAttributes")
    @Produces(MediaType.APPLICATION_JSON)
    @RequiresAuthentication
    public Map<String, Object> getPersonalUserAttributes() {
        return SecurityService.getUserAttributes();
    }
    
    @GET()
    @NoCache
    @Path("getAllAccounts")
    @Produces(MediaType.APPLICATION_JSON)
    @RequiresAuthentication
    @RequiresPermissions(ACCOUNTS.QUERY)
    public List<Account> getAllAcounts() {
        ArrayList<Account> accounts = Lists.newArrayList();
        AccountManager r = getAccountManager();

        for (Entry<String, org.apache.shiro.authc.Account> user : r.getAccounts().entrySet()) {
            Account account = new Account();
      
            account.setPrincipal(user.getKey());
            if(SecurityUtils.getSubject().isPermitted(ROLES.QUERY)){
                Collection<String> roles = user.getValue().getRoles();
                account.setRoles(StringUtils.join(roles,","));
            }

            List<String>permissions = new ArrayList<String>();
            if(SecurityUtils.getSubject().isPermitted(PERMISSIONS.QUERY)){
            	for(Permission permissionValue : user.getValue().getObjectPermissions()) {
            		permissions.add(permissionValue.toString());
            	}
            }
            permissions.sort(String::compareToIgnoreCase);
            account.setPermissions(permissions);
            accounts.add(account);
        }
        
        return accounts;
    }

    @POST
    @NoCache
    @Path("permissions")
    @Produces(MediaType.APPLICATION_JSON)
    @Consumes(MediaType.APPLICATION_JSON)
    @RequiresAuthentication
    @Hidden
    public Response hasPermissions(final JsonParser jp) throws IOException {
        final JsonUtil.JsonFieldProducer processor = (jGenerator, input) -> {
            try {
                jGenerator.writeBooleanField(input, SecurityUtils.getSubject().isPermitted(input));
            } catch(IOException e) {
                throw new RuntimeException(e);
            }
        };
        final StreamingOutput stream = JsonUtil.processJsonMap(jp, processor);
        return Response.ok(stream).build();
    }

    @GET()
    @NoCache
    @Path("getSessionInfo")
    @Produces(MediaType.APPLICATION_JSON)
    public SessionInfo getSession() {
        return new SessionInfo();
    }

    @POST()
    @Path("touchSession")
    @Produces(MediaType.APPLICATION_JSON)
    @RequiresAuthentication
    public void touchSession() {
        SecurityUtils.getSubject().getSession().touch();
    }

    @GET()
    @NoCache
    @Path("getLdapUsersMetadata")
    @Produces(MediaType.APPLICATION_JSON)
    @RequiresAuthentication
    @RequiresPermissions(ACCOUNTS.LDAP_SYNC)
    @Hidden
    public boolean getLdapUsersMetadata() throws NamingException, Exception {
        MetaphactsSecurityManager securityManager = (MetaphactsSecurityManager) SecurityUtils.getSecurityManager();
        LDAPRealm realm = securityManager.getLDAPRealm();
        String turtle = securityService.renderUsersMetadataToTurtle(realm);
        securityService.saveUsersMetadataTurtleInContainer(turtle, new MpRepositoryProvider(
                this.repositoryManager, RepositoryManager.ASSET_REPOSITORY_ID));
        return true;
    }

    /**
     * Returns the current users roles by iterating over all roles and checking if
     * the user is in the given role.
     * <p>
     * Note that there is no generic API method to retrieve all roles from a given
     * {@link Subject}
     * </p>
     * 
     * @return the current user's roles
     */
    private List<String> getCurrentUserRoles() {

        final Subject currentUser = SecurityUtils.getSubject();
        if (currentUser == null) {
            return Collections.emptyList();
        }
        List<String> roles = Lists.newArrayList();
        for (PlatformRole role : getPlatformRoleManager().getAllAvailableRoles()) {
            if (SecurityUtils.getSubject().hasRole(role.getName())) {
                roles.add(role.getName());
            }
        }
        return roles;
    }

    private PlatformRoleManager getPlatformRoleManager() {
        return ((MetaphactsSecurityManager) SecurityUtils.getSecurityManager()).getPlatformRoleManager();
    }

    private AccountManager getAccountManager() {
        return ((MetaphactsSecurityManager) SecurityUtils.getSecurityManager()).getAccountManager();
    }

    /**
     *  HTTP 500 (Internal Server Error) {@link WebApplicationException} with custom error message
     */
    public class CustomIllegalArgumentException extends WebApplicationException {
        private static final long serialVersionUID = 5775630458408531231L;
        /**
         * @param message the String that is the entity of the 500 response.
         */
        public CustomIllegalArgumentException(String message) {
            super(Response.status(Status.INTERNAL_SERVER_ERROR).
                    entity(message).type("text/plain").build());
        }
    }
}

