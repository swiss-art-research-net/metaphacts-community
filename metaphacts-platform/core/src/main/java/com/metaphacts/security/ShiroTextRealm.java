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
package com.metaphacts.security;

import java.io.IOException;
import java.io.InputStream;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Set;

import org.apache.commons.lang3.StringUtils;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.shiro.SecurityUtils;
import org.apache.shiro.authc.Account;
import org.apache.shiro.authc.SimpleAccount;
import org.apache.shiro.authc.credential.CredentialsMatcher;
import org.apache.shiro.authz.Permission;
import org.apache.shiro.authz.SimpleRole;
import org.apache.shiro.authz.permission.RolePermissionResolver;
import org.apache.shiro.config.Ini;
import org.apache.shiro.config.Ini.Section;
import org.apache.shiro.realm.text.IniRealm;
import org.apache.shiro.subject.SimplePrincipalCollection;
import org.apache.shiro.util.CollectionUtils;

import com.google.common.collect.Lists;
import com.google.common.collect.Sets;
import com.google.inject.Inject;
import com.metaphacts.config.Configuration;



/**
 * @author Johannes Trame <jt@metaphacts.com>
 * @author Artem Kozlov <ak@metaphacts.com>
 */
public class ShiroTextRealm extends IniRealm
        implements AccountManager, RolePermissionResolver, OneTimeRolePermissionResolverAware {

    private static final Logger logger = LogManager.getLogger(ShiroTextRealm.class);
    
    @Inject
    public ShiroTextRealm(Configuration config,CredentialsMatcher passwordMatcher) {
        super();
        this.config=config;
        setIni(getIniFromConfig(config));
        setCredentialsMatcher(passwordMatcher);
        setPermissionResolver(new WildcardPermissionResolver());
        init();
    }

    /**
     * Constructor for testing purpose only to not require environment
     * 
     * @param passwordMatcher
     */
    /* packager */ ShiroTextRealm(Ini ini, CredentialsMatcher passwordMatcher) {
        super();
        setIni(ini);
        setCredentialsMatcher(passwordMatcher);
        setPermissionResolver(new WildcardPermissionResolver());
        init();
    }

    
    private Configuration config;
    
    private boolean isConfigShiro = true;

    private RolePermissionResolver oneTimeRolePermissionResolver;

    private Ini getIniFromConfig(Configuration config) {
        SecurityConfigRecord record = config.getEnvironmentConfig()
            .getSecurityConfig(SecurityConfigType.ShiroConfig);

        try (InputStream stream = record.readStream()) {
            Ini ini = new Ini();
            ini.load(stream);
            return ini;
        } catch (Exception e) {
            isConfigShiro = false;
            logger.error("Not able to load {} from {}",
                record.getType().getFileName(), record.getLocationDescription());
            logger.debug("Details: "+ e.getMessage(), e);
            // prevent any further startup
            System.exit(1);
        }
        return null;
    }
    
    public Map<String, SimpleAccount> getUsers(){
        return this.users;
    }
    
    @Override
    public Map<String, Account> getAccounts() {
        return Collections.unmodifiableMap(this.users);
    }

    /**
     * 
     * @return the roles as defined local in the shiro.ini
     * @deprecated as of 3.4 roles are no longer defined in shiro.ini, but managed
     *             by {@link PlatformRoleManager}
     */
    @Deprecated
    Map<String, SimpleRole> getRoles() {
        return this.roles;
    }
    
    @Override
    public void addAccount(String username, String password, String... roles) {
        if(isConfigShiro==false)
            throw new IllegalStateException("");
        
        List<String> suppliedRoles = (roles==null) ? Lists.<String>newArrayList()  : Lists.<String>newArrayList(roles); 
        PlatformRoleManager roleManager = ((MetaphactsSecurityManager) SecurityUtils.getSecurityManager())
                .getPlatformRoleManager();
        for(String r : suppliedRoles){
            if (!roleManager.roleExists(r)) {
                throw new IllegalArgumentException("Role "+ r +" does not exist.");
            }
        }
        
        super.addAccount(username, password, roles);
        
      //set permission otherwise restart is required
        Set<Permission> permissions = Sets.newHashSet();
        for(String r : suppliedRoles){
            permissions.addAll(roleManager.getRole(r).getPermissions());
        }
        getUser(username).setObjectPermissions(permissions);
        
        SimplePrincipalCollection principals = new SimplePrincipalCollection();
        principals.add("username", this.getName());
        clearCachedAuthorizationInfo(principals);
        Ini ini = getIni();
        Ini.Section usersSection = ini.getSection(USERS_SECTION_NAME);
        usersSection.put(username, password+","+StringUtils.join(roles, ","));
        saveIni(ini);
        
    }
    
    @Override
    public void addAccount(String username, String password) {
        this.addAccount(username, password, new String[]{});
    }

    @Override
    public void deleteAccount(String username){
        logger.trace("Deleting account with principal: "+username);
        if(!this.accountExists(username))
            throw new IllegalArgumentException("User with principal "+username + " does not exist.");
        USERS_LOCK.writeLock().lock();
        try {
        	this.users.remove(username);
        } finally {
            USERS_LOCK.writeLock().unlock();
        }
        
        Ini ini = getIni();
        Ini.Section usersSection = ini.getSection(USERS_SECTION_NAME);
        usersSection.remove(username);
        
        saveIni(ini);
    }
    
    private void saveIni(Ini ini) {
        SecurityConfigRecord record = config.getEnvironmentConfig()
            .getSecurityConfig(SecurityConfigType.ShiroConfig);
        logger.trace("Persisting changes to accounts. Saving changes to SHIRO text realm: " + record.getLocationDescription());

        StringBuilder sb = new StringBuilder();
        for(Section s :ini.getSections()){
            sb.append("["+s.toString()+"]\n");
            for(Entry<String, String> entry : s.entrySet())
             sb.append(entry+"\n");
        }

        try {
            record.writeAll(sb.toString());
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public void updateAccount(String principal, String encryptPassword, String... roles) {
        logger.trace("Updating account with principal: "+principal);
        if(!this.accountExists(principal))
            throw new IllegalArgumentException("User with principal "+principal + " does not exist.");
        if(encryptPassword==null)
            encryptPassword=this.getUser(principal).getCredentials().toString();

        this.addAccount(principal, encryptPassword, roles);
    }

    @Override
    public Collection<Permission> resolvePermissionsInRole(String roleString) {

        // NOTE: supported for legacy reasons to expose role definitions defined in
        // shiro.ini to other consumers (e.g. LDAPRealm)

        SimpleRole r = this.roles.get(roleString);
        if (r == null) {
            return Collections.emptySet();
        }
        return r.getPermissions();
    }
    
    @Override
    protected void processRoleDefinitions(Map<String, String> roleDefs) {
        if (roleDefs != null && !roleDefs.isEmpty()) {
            logger.warn("[Deprecated] reading roles from shiro.ini. As of 3.4 roles are separated from users,"
                    + " e.g. into shiro-roles.ini. Make sure to properly upgrade your shiro.ini.");
        }
        super.processRoleDefinitions(roleDefs);
    }

    @Override
    public void setOneTimeRolePermissionResolver(RolePermissionResolver rpr) {
        this.oneTimeRolePermissionResolver = rpr;
    }

    @Override
    public void updateRoleDefinitions() {

        // attach permissions from platform role permission resolver to already
        // initialized RoleAccounts

        if (oneTimeRolePermissionResolver == null) {
            throw new IllegalStateException("Role permission resolver is not defined.");
        }

        for (SimpleAccount account : this.users.values()) {

            Set<Permission> newPermissions = Sets.newHashSet();

            for (String role : account.getRoles()) {
                Collection<Permission> perms = oneTimeRolePermissionResolver.resolvePermissionsInRole(role);
                if (!CollectionUtils.isEmpty(perms)) {
                    newPermissions.addAll(perms);
                }
            }

            account.setObjectPermissions(newPermissions);
        }
    }
}
