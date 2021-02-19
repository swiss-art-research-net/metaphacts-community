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
import java.util.Collections;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;

import javax.inject.Inject;

import org.apache.logging.log4j.Level;
import org.apache.shiro.SecurityUtils;
import org.apache.shiro.authc.AuthenticationException;
import org.apache.shiro.authc.AuthenticationInfo;
import org.apache.shiro.authc.AuthenticationToken;
import org.apache.shiro.authc.SimpleAuthenticationInfo;
import org.apache.shiro.authc.UsernamePasswordToken;
import org.apache.shiro.authz.AuthorizationInfo;
import org.apache.shiro.authz.Permission;
import org.apache.shiro.authz.SimpleAuthorizationInfo;
import org.apache.shiro.authz.permission.RolePermissionResolver;
import org.apache.shiro.cache.Cache;
import org.apache.shiro.realm.AuthorizingRealm;
import org.apache.shiro.realm.Realm;
import org.apache.shiro.subject.PrincipalCollection;
import org.apache.shiro.subject.Subject;
import org.apache.shiro.util.CollectionUtils;
import org.jukito.UseModules;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;

import com.github.jsonldjava.shaded.com.google.common.collect.Sets;
import com.google.common.collect.Lists;
import com.google.common.collect.Maps;
import com.metaphacts.cache.CacheManager;
import com.metaphacts.config.Configuration;
import com.metaphacts.junit.Log4jRule;
import com.metaphacts.junit.MetaphactsGuiceTestModule;
import com.metaphacts.junit.MetaphactsJukitoRunner;
import com.metaphacts.junit.MetaphactsShiroRule;
import com.metaphacts.junit.PlatformStorageRule;


@RunWith(MetaphactsJukitoRunner.class)
@UseModules(MetaphactsGuiceTestModule.class)
public class MetaphactsSecurityManagerTest {


    @Inject
    public Configuration configuration;
    
    @Inject
    @Rule
    public PlatformStorageRule platformStorageRule;

    @Rule
    public Log4jRule log4j = Log4jRule.create(Level.DEBUG);

    // @Inject TODO use injection instead of test implementation
    public CacheManager cacheService = new CacheManager() {
        @Override
        protected String getCacheSpec(String cacheId) {
            // configure special retention on the cache for the test
            // => keep only two items at maximum
            if (MetaphactsSecurityManager.AUTH_CACHE_NAME.equals(cacheId)) {
                return "maximumSize=2";
            }
            return super.getCacheSpec(cacheId);
        }
    };

    private TestAuthenticatingRealm testRealm = new TestAuthenticatingRealm();

    @Rule
    public MetaphactsShiroRule rule = new MetaphactsShiroRule(
            () -> Lists.newArrayList((Realm) testRealm,
                    MetaphactsSecurityTestUtils.loadRealm("classpath:com/metaphacts/security/shiro-legacy.ini")),
            () -> configuration)
                    .withCacheManager(() -> cacheService)
                    .withPlatformStorageRule(() -> platformStorageRule)
                    .withPlatformRole("admin", Lists.newArrayList("my:permission:*"))
                    .withPlatformRole("legacy-override", Lists.newArrayList("from:platform:*"))
                    .withPlatformRole("role-with-wildcard", Lists
                            .newArrayList("pages:edit:regex(<((?!(http://www.metaphacts.com/resource/admin/)).)*>)"));


    @Before
    public void before() {

        testRealm.reset();
    }

    @Test
    public void testRolePermissions() throws Exception {

        testRealm.addAcceptedUser("admin", "admin", "admin");

        final Subject subject = SecurityUtils.getSubject();

        subject.login(new UsernamePasswordToken("admin", "admin"));
        subject.checkRoles("admin");
        
        Assert.assertTrue(subject.isPermitted("my:permission:*"));
    }

    @Test
    public void testLegacyRoleFromShiroTextRealm() {

        final Subject subject = SecurityUtils.getSubject();

        subject.login(new UsernamePasswordToken("legacy-admin", "password"));
        subject.checkRoles("legacy-admin", "admin");

        Assert.assertTrue(subject.isPermitted("from:legacy:*")); // from legacy-admin role
        Assert.assertTrue(subject.isPermitted("my:permission:*")); // from shiro-roles.ini file
    }

    @Test
    public void testLegacyRoleFromShiroTextRealm_LegacyPermissionWins() {

        final Subject subject = SecurityUtils.getSubject();

        testRealm.addAcceptedUser("legacy-override", "password", "legacy-override");

        subject.login(new UsernamePasswordToken("legacy-override", "password"));
        subject.checkRoles("legacy-override");

        Assert.assertTrue(subject.isPermitted("from:legacy:override")); // from legacy-override role in shiro-legacy.ini
        Assert.assertFalse(subject.isPermitted("from:platform:*")); // from legacy-override role in shiro-legacy.ini
    }

    @Test
    public void testWildcardPermission() {

        final Subject subject = SecurityUtils.getSubject();

        testRealm.addAcceptedUser("admin2", "password", "role-with-wildcard");

        subject.login(new UsernamePasswordToken("admin2", "password"));
        subject.checkRoles("role-with-wildcard");

        Assert.assertTrue(subject.isPermitted("pages:edit:<http://www.metaphacts.com/resource/Start>"));
        Assert.assertFalse(subject.isPermitted("pages:edit:<http://www.metaphacts.com/resource/admin/Admin>"));
    }

    @Test
    public void testCaching() throws Exception {
        
        testRealm.addAcceptedUser("admin", "admin");

        final Subject subject = SecurityUtils.getSubject();
        final MetaphactsSecurityManager securityManager = (MetaphactsSecurityManager) SecurityUtils
                .getSecurityManager();
        final Cache<Object, Object> authCache = securityManager.getCacheManager()
                .getCache(MetaphactsSecurityManager.AUTH_CACHE_NAME);

        Assert.assertEquals(0, authCache.size());
        Assert.assertEquals(0, testRealm.loginCount.get());

        securityManager.login(subject, new UsernamePasswordToken("admin", "admin"));

        // assert that entry is cached
        Assert.assertEquals(1, authCache.size());
        AuthenticationInfo authInfo = (AuthenticationInfo) authCache.values().iterator().next();
        Assert.assertEquals("admin", authInfo.getPrincipals().getPrimaryPrincipal());
        Assert.assertNotEquals("admin", authInfo.getCredentials());
        Assert.assertTrue(authInfo.getCredentials().toString().startsWith("$shiro1$"));
        Assert.assertEquals(1, testRealm.loginCount.get());

        // make sure that the cache is used, i.e. login count from the realm does not
        // increase
        securityManager.login(subject, new UsernamePasswordToken("admin", "admin"));
        Assert.assertEquals(1, testRealm.loginCount.get());
        Assert.assertEquals(1, authCache.size());

        // provide a wrong password => cache should be cleared
        try {
            securityManager.login(subject, new UsernamePasswordToken("admin", "wrong-pass"));
            Assert.fail("Expected authentication exception");
        } catch (AuthenticationException e) {
            // expected
        }
        Assert.assertEquals(0, authCache.size());
        Assert.assertEquals(2, testRealm.loginCount.get());

        // login again successfully
        securityManager.login(subject, new UsernamePasswordToken("admin", "admin"));
        Assert.assertEquals(1, authCache.size());
        Assert.assertEquals(3, testRealm.loginCount.get());
    }

    @Test
    public void testCacheRetention() throws Exception {

        for (int i = 1; i <= 10; i++) {
            testRealm.addAcceptedUser("admin" + i, "admin");
        }

        final Subject subject = SecurityUtils.getSubject();
        final MetaphactsSecurityManager securityManager = (MetaphactsSecurityManager) SecurityUtils
                .getSecurityManager();
        
        final Cache<Object, Object> authCache = securityManager.getCacheManager()
                .getCache(MetaphactsSecurityManager.AUTH_CACHE_NAME);

        Assert.assertEquals(0, authCache.size());
        Assert.assertEquals(0, testRealm.loginCount.get());

        securityManager.login(subject, new UsernamePasswordToken("admin1", "admin"));

        Assert.assertEquals(1, authCache.size());
        Assert.assertEquals(1, testRealm.loginCount.get());

        securityManager.login(subject, new UsernamePasswordToken("admin1", "admin"));
        Assert.assertEquals(1, authCache.size());
        Assert.assertEquals(1, testRealm.loginCount.get());

        securityManager.login(subject, new UsernamePasswordToken("admin2", "admin"));
        Assert.assertEquals(2, authCache.size());
        Assert.assertEquals(2, testRealm.loginCount.get());

        securityManager.login(subject, new UsernamePasswordToken("admin3", "admin"));
        Assert.assertEquals(2, authCache.size()); // cache keeps at maximum two items
        Assert.assertEquals(3, testRealm.loginCount.get());

    }


    // TODO move to new standalone class
    public static final class TestAuthenticatingRealm extends AuthorizingRealm
            implements OneTimeRolePermissionResolverAware {

        AtomicInteger loginCount = new AtomicInteger(0);

        Map<String, String> acceptedUsers = Maps.newHashMap();
        Map<String, Set<String>> userToRoles = Maps.newHashMap();

        private RolePermissionResolver oneTimeRolePermissionResolver;

        public TestAuthenticatingRealm() {
            super();
            setPermissionResolver(new WildcardPermissionResolver());
        }

        @Override
        protected AuthenticationInfo doGetAuthenticationInfo(AuthenticationToken token) throws AuthenticationException {
            loginCount.incrementAndGet();
            String acceptedUser = token.getPrincipal().toString();
            if (acceptedUsers.containsKey(acceptedUser)) {
                String acceptedPassword = acceptedUsers.get(acceptedUser);
                String password = new String((char[]) token.getCredentials());
                if (acceptedPassword.equals(password)) {
                    return new SimpleAuthenticationInfo(acceptedUser, acceptedPassword, "testRealm");
                }
            }
            throw new AuthenticationException("User could not be authenticated: " + token.getPrincipal());
        }


        public void addAcceptedUser(String user, String password, String... roles) {
            acceptedUsers.put(user, password);
            if (roles.length > 0) {
                userToRoles.put(user, Sets.newHashSet(roles));
            }
        }

        public void reset() {
            loginCount.set(0);
            acceptedUsers.clear();
        }

        @Override
        protected AuthorizationInfo doGetAuthorizationInfo(PrincipalCollection principals) {
            String userId = principals.getPrimaryPrincipal().toString();
            Set<String> roles = userToRoles.getOrDefault(userId, Collections.emptySet());
            SimpleAuthorizationInfo res = new SimpleAuthorizationInfo(roles);
            
            Set<Permission> newPermissions = Sets.newHashSet();

            // role to permissions
            for (String role : roles) {
                Collection<Permission> perms = oneTimeRolePermissionResolver.resolvePermissionsInRole(role);
                if (!CollectionUtils.isEmpty(perms)) {
                    newPermissions.addAll(perms);
                }
            }
            
            res.setObjectPermissions(newPermissions);

            return res;
        }

        @Override
        public void setOneTimeRolePermissionResolver(RolePermissionResolver rpr) {
            this.oneTimeRolePermissionResolver = rpr;
        }
    }
}
