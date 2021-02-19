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

import java.util.Collection;

import javax.inject.Inject;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.shiro.SecurityUtils;
import org.apache.shiro.authc.AuthenticationException;
import org.apache.shiro.authc.AuthenticationInfo;
import org.apache.shiro.authc.AuthenticationToken;
import org.apache.shiro.authc.SimpleAuthenticationInfo;
import org.apache.shiro.authc.credential.PasswordService;
import org.apache.shiro.cache.AbstractCacheManager;
import org.apache.shiro.cache.Cache;
import org.apache.shiro.cache.CacheException;
import org.apache.shiro.cache.MapCache;
import org.apache.shiro.mgt.DefaultSecurityManager;
import org.apache.shiro.realm.CachingRealm;
import org.apache.shiro.realm.Realm;
import org.apache.shiro.subject.Subject;
import org.apache.shiro.web.mgt.DefaultWebSecurityManager;
import org.apache.shiro.web.session.mgt.DefaultWebSessionManager;

import com.metaphacts.cache.CacheManager;
import com.metaphacts.config.Configuration;
import com.metaphacts.services.storage.api.PlatformStorage;

import io.buji.pac4j.token.Pac4jToken;

/**
 * Platform specific security manager. Contains custom logics for Shiro realms,
 * caching, and session (timeout) management.
 *
 *
 * @author Michael Schmidt <ms@metaphacts.com>
 * @author Johannes Trame <jt@metaphacts.com>
 */
public class MetaphactsSecurityManager extends DefaultWebSecurityManager {

    private static final Logger logger = LogManager.getLogger(MetaphactsSecurityManager.class);

    public static final String AUTH_CACHE_NAME = "security.authCache";

    @Inject
    private ShiroTextRealm shiroTextRealm;

    @Inject
    private PasswordService passwordService;

    private final CacheManager cacheManager;
    
    private final PlatformRoleManager platformRoleManager;

    @Inject
    public MetaphactsSecurityManager(Collection<Realm> realms, Configuration config, CacheManager cacheManager,
            PlatformStorage platformStorage) {
        super(realms);

        this.cacheManager = cacheManager;

        // Initialize a cache manager
        final MPCacheManager _cacheManager = new MPCacheManager();
        setCacheManager(_cacheManager);

        // Initialize a session manager (using Shiro's internal default web session manager)
        final DefaultWebSessionManager sessionManager = new DefaultWebSessionManager();

        sessionManager.setGlobalSessionTimeout(config.getEnvironmentConfig().getShiroSessionTimeoutSecs() * 1000);

        /*
         *  Disable sessionIdUrlRewriting (appending ;JSESSIONID=).
         *  This fixes potential problems with access to path parameters and
         *  redirects (ID-278) as well as fixes a potential security risk.
         *
         *  According to OWASP exposing the SESSIONID e.g. through rewriting should be avoid anyway,
         *  since it bears a significant security risk ( https://www.owasp.org/index.php/Top_10_2007-A7).
         *
         *  Available with SHIRO 1.3.0:
         *  https://issues.apache.org/jira/browse/SHIRO-360
         *  https://issues.apache.org/jira/browse/SHIRO-361
         *  NOTE: if a user has disabled cookies, they will NOT be able to login if this is disable.
         */
        sessionManager.setSessionIdUrlRewritingEnabled(false);

        setSessionManager(sessionManager);

        // configure the role permission resolver
        platformRoleManager = new PlatformRoleManager(this, platformStorage, cacheManager);

        for(Realm r : realms){
            if(CachingRealm.class.isAssignableFrom(r.getClass())){
                ((CachingRealm) r).setCacheManager(_cacheManager);
            }
            // attach one time role permission resolver to respective realms
            if (r instanceof OneTimeRolePermissionResolverAware) {
                OneTimeRolePermissionResolverAware resolverRealm = (OneTimeRolePermissionResolverAware) r;
                resolverRealm.setOneTimeRolePermissionResolver(platformRoleManager);
                resolverRealm.updateRoleDefinitions();
            }
        }

    }

    @Override
    public Subject login(Subject subject, AuthenticationToken token) throws AuthenticationException {

        // inspect cache
        Cache<Object, Object> authCache = getCacheManager().getCache(AUTH_CACHE_NAME);
        Object authInfo = authCache.get(token.getPrincipal());
        if (authInfo != null && authInfo instanceof AuthenticationInfo) {

            logger.trace("Authenticating user {} with information from cache", token.getPrincipal());

            // validate credentials against cached AuthenticationInfo
            // => if not matching, continue with the chain and remove entry from the cache
            AuthenticationInfo info = (AuthenticationInfo) authInfo;
            if (matchCredentials(token, info)) {

                Subject loggedIn = createSubject(token, info, subject);

                // explicitly call super.onSuccessfulLogin as this has some logic
                super.onSuccessfulLogin(token, info, loggedIn);

                return loggedIn;
            } else {
                // remove from cache and continue in chain
                logger.trace(
                        "Authentication info from cache does not match provided credentials, continuing with chain.");
                authCache.remove(token.getPrincipal());
            }
        }

        return super.login(subject, token);
    }

    protected boolean matchCredentials(AuthenticationToken token, AuthenticationInfo info) {

        return passwordService.passwordsMatch(token.getCredentials(), info.getCredentials().toString());
    }

    @Override
    protected void onSuccessfulLogin(AuthenticationToken token, AuthenticationInfo info, Subject subject) {

        super.onSuccessfulLogin(token, info, subject);

        // add to cache
        try {

            // Exclude SAML tokens (i.e. Pac4j)
            if (token instanceof Pac4jToken) {
                return;
            }
            // Note: we explicitly use the encrypted credentials from the
            // AuthenticationToken in the cache and do the comparison using the
            // PasswordService
            Cache<Object, Object> authCache = getCacheManager().getCache(AUTH_CACHE_NAME);
            Object encryptedCredentials = passwordService.encryptPassword(token.getCredentials());
            AuthenticationInfo encryptedEntry = new SimpleAuthenticationInfo(info.getPrincipals(),
                    encryptedCredentials);
            authCache.put(token.getPrincipal(), encryptedEntry);
        } catch (Exception e) {
            logger.warn("Failed to add token to authentication cache: " + e.getMessage());
            logger.debug("Details:", e);
        }

    }

    @Override
    public void logout(Subject subject) {
        super.logout(subject);

        // remove entry from cache on explicit logout
        Cache<Object, Object> authCache = getCacheManager().getCache(AUTH_CACHE_NAME);
        logger.trace("Removing user {} from authentication cache", subject.getPrincipal());
        authCache.remove(subject.getPrincipal());

    }

    /**
     * 
     * @return the instance of the {@link PlatformRoleManager}
     */
    public PlatformRoleManager getPlatformRoleManager() {
        return this.platformRoleManager;
    }
    
    /**
     * @return Instance of the {@link AccountManager}
     */
    public AccountManager getAccountManager() throws IllegalStateException {
        return shiroTextRealm;
    }

   /**
    * @return Instance of the {@link LDAPRealm} if configured, <code>null</code> otherwise
    */
   public LDAPRealm getLDAPRealm(){
       DefaultSecurityManager manager = (DefaultSecurityManager) SecurityUtils.getSecurityManager();
       for(Realm realm : manager.getRealms()){
           if(realm instanceof LDAPRealm)
               return (LDAPRealm)realm;
       }
       return null;
   }

    /**
     * Inject a {@link PasswordService} explicitly, can be used for testing
     * 
     * @param passwordService
     */
    /* package */ void setPasswordService(PasswordService passwordService) {
        this.passwordService = passwordService;
    }

    /**
     * Inject a {@link ShiroTextRealim} explicitly, can be used for testing
     * 
     * @param accountManager
     */
    /* package */ void setAccountManager(ShiroTextRealm accountManager) {
        this.shiroTextRealm = accountManager;
    }

    class MPCacheManager extends AbstractCacheManager {

        private static final String DEFAULT_SPEC = "expireAfterWrite=30m,maximumSize=1000";

        @Override
        protected Cache<Object, Object> createCache(String name) throws CacheException {

            com.google.common.cache.Cache<Object, Object> guavaCache = cacheManager
                    .newBuilder(name, DEFAULT_SPEC).build();
            return new MapCache<Object, Object>(name, guavaCache.asMap());
        }
    }
}
