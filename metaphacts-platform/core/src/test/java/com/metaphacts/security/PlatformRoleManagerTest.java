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
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import javax.inject.Inject;

import org.apache.commons.io.IOUtils;
import org.apache.commons.lang3.StringUtils;
import org.apache.logging.log4j.Level;
import org.apache.shiro.SecurityUtils;
import org.apache.shiro.authz.Permission;
import org.hamcrest.MatcherAssert;
import org.hamcrest.Matchers;
import org.junit.Assert;
import org.junit.Rule;
import org.junit.Test;

import com.github.jsonldjava.shaded.com.google.common.collect.Maps;
import com.google.common.collect.Lists;
import com.google.common.collect.Sets;
import com.metaphacts.cache.CacheManager;
import com.metaphacts.config.Configuration;
import com.metaphacts.junit.AbstractIntegrationTest;
import com.metaphacts.junit.Log4jRule;
import com.metaphacts.junit.MetaphactsShiroRule;
import com.metaphacts.junit.PlatformStorageRule;
import com.metaphacts.security.PlatformRoleManager.PlatformRole;
import com.metaphacts.services.storage.api.ObjectKind;
import com.metaphacts.services.storage.api.PlatformStorage;
import com.metaphacts.services.storage.api.StoragePath;


public class PlatformRoleManagerTest extends AbstractIntegrationTest {

    @Inject
    public Configuration configuration;

    @Inject
    @Rule
    public PlatformStorageRule platformStorageRule;

    @Inject
    private CacheManager cacheManager;

    @Rule
    public Log4jRule log4j = Log4jRule.create(Level.DEBUG);
    
    
    @Rule
    public MetaphactsShiroRule rule = new MetaphactsShiroRule(
            () -> Lists.newArrayList(
                    MetaphactsSecurityTestUtils.loadRealm("classpath:com/metaphacts/security/shiro-legacy.ini")),
            () -> configuration)
                    .withCacheManager(() -> cacheManager)
                    .withPlatformStorageRule(() -> platformStorageRule)
                    .withPlatformRole("admin", Lists.newArrayList("my:permission:*"))
                    .withPlatformRole("legacy-override", Lists.newArrayList("from:platform:*")).withInitalizer(rule -> {

                        // runtime storage
                        Map<String, List<String>> runtimeRoles = Maps.newHashMap();
                        runtimeRoles.put("admin", Lists.newArrayList("my:runtime:permission"));
                        runtimeRoles.put("runtime-admin", Lists.newArrayList("my:runtime:admin"));
                        runtimeRoles.put("myapp-override", Lists.newArrayList("my:runtime:my-app-override"));
                        rule.storeRoles(runtimeRoles, "runtime");

                        // app storage
                        String appStorageId = "myApp";
                        platformStorageRule.getPlatformStorage().addStorage(appStorageId);
                        Map<String, List<String>> appRoles = Maps.newHashMap();
                        appRoles.put("admin", Lists.newArrayList("my:myApp:permission"));
                        appRoles.put("myapp-override", Lists.newArrayList("my:myapp:override"));
                        appRoles.put("myapp-admin", Lists.newArrayList("my:myapp:admin"));
                        rule.storeRoles(appRoles, appStorageId);
                    });

    @Test
    public void testGetAvailableRoles() {

        final MetaphactsSecurityManager securityManager = (MetaphactsSecurityManager) SecurityUtils
                .getSecurityManager();
        PlatformRoleManager roleManager = securityManager.getPlatformRoleManager();
        
        Collection<PlatformRole> roles = roleManager.getAllAvailableRoles();
        
        Map<String, String> roleToPermission = Maps.newHashMap();
        roles.forEach(r -> roleToPermission.put(r.getName(), StringUtils.join(r.getPermissions(), ",")));

        Assert.assertEquals("my:permission:*", roleToPermission.get("admin"));
        Assert.assertEquals("from:legacy:*", roleToPermission.get("legacy-admin"));
        Assert.assertEquals("from:legacy:override", roleToPermission.get("legacy-override"));
        Assert.assertEquals("my:runtime:admin", roleToPermission.get("runtime-admin"));
        Assert.assertEquals("my:myapp:admin", roleToPermission.get("myapp-admin"));
        Assert.assertEquals("my:runtime:my-app-override", roleToPermission.get("myapp-override"));
        Assert.assertEquals(6, roles.size());
    }

    @Test
    public void testResolvePermission() {

        final MetaphactsSecurityManager securityManager = (MetaphactsSecurityManager) SecurityUtils
                .getSecurityManager();
        PlatformRoleManager roleManager = securityManager.getPlatformRoleManager();

        Collection<PlatformRole> roles = roleManager.getAllAvailableRoles();

        Map<String, String> roleToPermission = Maps.newHashMap();
        for (String role : roles.stream().map(r -> r.getName()).collect(Collectors.toList())) {
            Collection<Permission> perms = roleManager.resolvePermissionsInRole(role);
            roleToPermission.put(role, StringUtils.join(perms, ","));
        }

        Assert.assertEquals("my:permission:*", roleToPermission.get("admin"));
        Assert.assertEquals("from:legacy:*", roleToPermission.get("legacy-admin"));
        Assert.assertEquals("from:legacy:override", roleToPermission.get("legacy-override"));
        Assert.assertEquals("my:runtime:admin", roleToPermission.get("runtime-admin"));
        Assert.assertEquals("my:myapp:admin", roleToPermission.get("myapp-admin"));
        Assert.assertEquals("my:runtime:my-app-override", roleToPermission.get("myapp-override"));
        Assert.assertEquals(6, roles.size());
    }

    @Test
    public void testMutability() {


        final MetaphactsSecurityManager securityManager = (MetaphactsSecurityManager) SecurityUtils
                .getSecurityManager();
        PlatformRoleManager roleManager = securityManager.getPlatformRoleManager();

        Collection<PlatformRole> roles = roleManager.getAllAvailableRoles();

        Map<String, PlatformRole> roleByName = Maps.newHashMap();
        roles.forEach(r -> roleByName.put(r.getName(), r));

        // platform roles are not mutable
        Assert.assertEquals(false, roleByName.get("admin").isMutable());
        Assert.assertEquals(true, roleByName.get("legacy-admin").isMutable());
        Assert.assertEquals(true, roleByName.get("legacy-override").isMutable());
        Assert.assertEquals(true, roleByName.get("runtime-admin").isMutable());
        Assert.assertEquals(true, roleByName.get("myapp-admin").isMutable());
        Assert.assertEquals(true, roleByName.get("myapp-override").isMutable());
        Assert.assertEquals(6, roles.size());
    }

    @Test
    public void testDeletability() {

        final MetaphactsSecurityManager securityManager = (MetaphactsSecurityManager) SecurityUtils
                .getSecurityManager();
        PlatformRoleManager roleManager = securityManager.getPlatformRoleManager();

        Collection<PlatformRole> roles = roleManager.getAllAvailableRoles();

        Map<String, PlatformRole> roleByName = Maps.newHashMap();
        roles.forEach(r -> roleByName.put(r.getName(), r));

        // only runtime roles are deletable
        Assert.assertEquals(false, roleByName.get("admin").isDeletable());
        Assert.assertEquals(false, roleByName.get("legacy-admin").isDeletable());
        Assert.assertEquals(false, roleByName.get("legacy-override").isDeletable());
        Assert.assertEquals(true, roleByName.get("runtime-admin").isDeletable());
        Assert.assertEquals(false, roleByName.get("myapp-admin").isDeletable());
        Assert.assertEquals(true, roleByName.get("myapp-override").isDeletable()); // overridden from runtime
        Assert.assertEquals(6, roles.size());
    }

    @Test
    public void testUpdateRoles_ImmutablePlatformRole() {

        // platform roles are not mutable
        final MetaphactsSecurityManager securityManager = (MetaphactsSecurityManager) SecurityUtils
                .getSecurityManager();
        PlatformRoleManager roleManager = securityManager.getPlatformRoleManager();
        
        
        Map<String, List<String>> newRoleDefinition = Maps.newHashMap();
        newRoleDefinition.put("admin", Lists.newArrayList("updated:permission:*"));

        try {
            roleManager.updateRoles(newRoleDefinition, Collections.emptySet());
            Assert.fail("Expected illegal argument exception");
        } catch (Exception e) {
            MatcherAssert.assertThat(e.getMessage(), Matchers.containsString("Role admin is immutable"));
        }
        
        Assert.assertEquals("[my:permission:*]", roleManager.resolvePermissionsInRole("admin").toString());
    }

    @Test
    public void testUpdateRoles_ImmutablePlatformRole_NotModified() throws Exception {

        // platform roles are not mutable
        final MetaphactsSecurityManager securityManager = (MetaphactsSecurityManager) SecurityUtils
                .getSecurityManager();
        PlatformRoleManager roleManager = securityManager.getPlatformRoleManager();

        Map<String, List<String>> newRoleDefinition = Maps.newHashMap();
        newRoleDefinition.put("admin", Lists.newArrayList("my:permission:*")); // same as current permission

        roleManager.updateRoles(newRoleDefinition, Collections.emptySet());

        Assert.assertEquals("[my:permission:*]", roleManager.resolvePermissionsInRole("admin").toString());
    }

    @Test
    public void testUpdateRoles_MutableAppRole() throws Exception {

        final MetaphactsSecurityManager securityManager = (MetaphactsSecurityManager) SecurityUtils
                .getSecurityManager();
        PlatformRoleManager roleManager = securityManager.getPlatformRoleManager();

        Assert.assertEquals("[my:myapp:admin]", roleManager.resolvePermissionsInRole("myapp-admin").toString());

        Map<String, List<String>> newRoleDefinition = Maps.newHashMap();
        newRoleDefinition.put("myapp-admin", Lists.newArrayList("updated:permission:*"));

        roleManager.updateRoles(newRoleDefinition, Collections.emptySet());

        Assert.assertEquals("[updated:permission:*]", roleManager.resolvePermissionsInRole("myapp-admin").toString());

        // verify that it is persisted in runtime / shiro.ini
        StoragePath path = ObjectKind.CONFIG.resolve(PlatformRoleManager.SHIRO_ROLES_FILE);

        String content = IOUtils
                .toString(platformStorageRule.getObjectStorage(PlatformStorage.DEVELOPMENT_RUNTIME_STORAGE_KEY)
                        .getObject(path, null).get().getLocation().readContent(), "UTF-8");

        MatcherAssert.assertThat(content, Matchers.containsString("myapp-admin = updated:permission:*"));
    }

    @Test
    public void testUpdateRoles_MutableRuntimeRole() throws Exception {

        final MetaphactsSecurityManager securityManager = (MetaphactsSecurityManager) SecurityUtils
                .getSecurityManager();
        PlatformRoleManager roleManager = securityManager.getPlatformRoleManager();

        Assert.assertEquals("[my:runtime:admin]", roleManager.resolvePermissionsInRole("runtime-admin").toString());

        Map<String, List<String>> newRoleDefinition = Maps.newHashMap();
        newRoleDefinition.put("runtime-admin", Lists.newArrayList("my:runtime:admin", "updated:permission:*"));

        roleManager.updateRoles(newRoleDefinition, Collections.emptySet());

        Assert.assertEquals("[my:runtime:admin, updated:permission:*]",
                roleManager.resolvePermissionsInRole("runtime-admin").toString());

        // verify that it is persisted in runtime / shiro.ini
        StoragePath path = ObjectKind.CONFIG.resolve(PlatformRoleManager.SHIRO_ROLES_FILE);

        String content = IOUtils
                .toString(platformStorageRule.getObjectStorage(PlatformStorage.DEVELOPMENT_RUNTIME_STORAGE_KEY)
                        .getObject(path, null).get().getLocation().readContent(), "UTF-8");

        MatcherAssert.assertThat(content,
                Matchers.containsString("runtime-admin = my:runtime:admin, updated:permission:*"));
    }

    @Test
    public void testUpdateRoles_DeletePlatformRole() throws Exception {
        // platform roles are not mutable
        final MetaphactsSecurityManager securityManager = (MetaphactsSecurityManager) SecurityUtils
                .getSecurityManager();
        PlatformRoleManager roleManager = securityManager.getPlatformRoleManager();

        Set<String> deleteRoles = Sets.newHashSet("admin");

        try {
            roleManager.updateRoles(Maps.newHashMap(), deleteRoles);
            Assert.fail("Expected illegal argument exception");
        } catch (Exception e) {
            MatcherAssert.assertThat(e.getMessage(), Matchers.containsString("Role admin is immutable"));
        }

        Assert.assertEquals("[my:permission:*]", roleManager.resolvePermissionsInRole("admin").toString());

    }

    @Test
    public void testUpdateRoles_DeleteNonExistingRole() throws Exception {
        // platform roles are not mutable
        final MetaphactsSecurityManager securityManager = (MetaphactsSecurityManager) SecurityUtils
                .getSecurityManager();
        PlatformRoleManager roleManager = securityManager.getPlatformRoleManager();

        Set<String> deleteRoles = Sets.newHashSet("non-existing");

        try {
            roleManager.updateRoles(Maps.newHashMap(), deleteRoles);
            Assert.fail("Expected illegal argument exception");
        } catch (Exception e) {
            MatcherAssert.assertThat(e.getMessage(), Matchers.containsString("Role non-existing does not exist"));
        }

    }

    @Test
    public void testUpdateRoles_DeleteAppRole() throws Exception {
        // platform roles are not mutable
        final MetaphactsSecurityManager securityManager = (MetaphactsSecurityManager) SecurityUtils
                .getSecurityManager();
        PlatformRoleManager roleManager = securityManager.getPlatformRoleManager();

        Set<String> deleteRoles = Sets.newHashSet("myapp-admin");

        try {
            roleManager.updateRoles(Maps.newHashMap(), deleteRoles);
            Assert.fail("Expected illegal argument exception");
        } catch (Exception e) {
            MatcherAssert.assertThat(e.getMessage(),
                    Matchers.containsString("Role myapp-admin is not defined in runtime storage"));
        }

        Assert.assertEquals("[my:myapp:admin]", roleManager.resolvePermissionsInRole("myapp-admin").toString());

    }

    @Test
    public void testUpdateRoles_DeleteRuntimeRole() throws Exception {

        // platform roles are not mutable
        final MetaphactsSecurityManager securityManager = (MetaphactsSecurityManager) SecurityUtils
                .getSecurityManager();
        PlatformRoleManager roleManager = securityManager.getPlatformRoleManager();

        Assert.assertEquals("[my:runtime:admin]", roleManager.resolvePermissionsInRole("runtime-admin").toString());

        Set<String> deleteRoles = Sets.newHashSet("runtime-admin");
        roleManager.updateRoles(Maps.newHashMap(), deleteRoles);

        Assert.assertEquals("[]", roleManager.resolvePermissionsInRole("runtime-admin").toString());

        StoragePath path = ObjectKind.CONFIG.resolve(PlatformRoleManager.SHIRO_ROLES_FILE);

        String content = IOUtils
                .toString(platformStorageRule.getObjectStorage(PlatformStorage.DEVELOPMENT_RUNTIME_STORAGE_KEY)
                        .getObject(path, null).get().getLocation().readContent(), "UTF-8");

        MatcherAssert.assertThat(content,
                Matchers.not(Matchers.containsString("runtime-admin = my:runtime:admin, updated:permission:*")));

    }
}
