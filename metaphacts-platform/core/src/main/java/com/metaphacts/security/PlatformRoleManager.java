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
package com.metaphacts.security;

import java.io.IOException;
import java.io.InputStream;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Set;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

import org.apache.commons.lang3.StringUtils;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.shiro.authz.Permission;
import org.apache.shiro.authz.SimpleRole;
import org.apache.shiro.authz.permission.RolePermissionResolver;
import org.apache.shiro.config.Ini;
import org.apache.shiro.realm.Realm;
import org.apache.shiro.realm.text.IniRealm;
import org.apache.shiro.util.CollectionUtils;

import com.github.jsonldjava.shaded.com.google.common.collect.Maps;
import com.github.jsonldjava.shaded.com.google.common.collect.Sets;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.Lists;
import com.metaphacts.cache.CacheManager;
import com.metaphacts.config.Configuration;
import com.metaphacts.services.storage.api.ObjectKind;
import com.metaphacts.services.storage.api.PlatformStorage;
import com.metaphacts.services.storage.api.PlatformStorage.FindResult;
import com.metaphacts.services.storage.api.StoragePath;

/**
 * Main implementation of role management and {@link RolePermissionResolver} for
 * the entire platform.
 * <p>
 * Role definitions can be provided using <i>config/shiro-roles.ini</i> in the
 * different storage layers.
 * </p>
 * <p>
 * This implementation first inspects the immutable default platform roles from
 * the platform storage. The default platform storage id is retrieved from
 * {@link Configuration#getPlatformStorageId()}
 * </p>
 * 
 * <p>
 * After that any role definitions from apps or the runtime storage are
 * evaluated. Note that the evaluation is done in the override order as defined
 * by the storage, i.e. the <i>runtime</i> storage is more specific than an app
 * storage.
 * </p>
 * 
 * <p>
 * Role resolution regards the following order:
 * </p>
 * <ol>
 * <li>Legacy Role Definitions (e.g. shiro.ini)</li>
 * <li>Default immutable platform roles</li>
 * <li>Runtime storage role resolver
 * <li>App role resolver in override order as defined by the storage</li>
 * </ol>
 * 
 * <p>
 * Note that the first resolve <i>wins</i>, i.e. if a role name could be
 * resolved to a set of permissions by any resolver, the respective permissions
 * are returned immediately and the remaining resolvers are skipped. This in
 * effect means that platform default roles cannot be overridden, with the
 * exception of a legacy definition in shiro.ini.
 * </p>
 * 
 * <p>
 * This role manager supports updating of roles and permissions for mutable
 * roles. The default roles shipped with the platform are explicitly defined to
 * be immutable and cannot be overridden. Any other role can be overridden,
 * where the relevant role data is written to the runtime storage. Note that
 * roles can only deleted, when they are defined in the runtime storage. When
 * trying to delete any other role an appropriate error is thrown.
 * </p>
 * 
 * @author Andreas Schwarte <as@metaphacts.com>
 * @since 3.4.0
 */
public class PlatformRoleManager implements RolePermissionResolver {

    private static final Logger logger = LogManager.getLogger();

    public static final String SHIRO_ROLES_FILE = "shiro-roles.ini";

    static final String CACHE_ID = "platform.RoleCache";
    static final String SINGLETON_CACHE_KEY = "RoleCache.SINGLETON_ROLE_LIST";

    static final String DEFAULT_PLATFORM_STORAGE_ID = "metaphacts-platform";

    private final PlatformStorage platformStorage;
    private final MetaphactsSecurityManager securityManager;
    private final CacheManager cacheManager;

    /**
     * The identifier of the storage from which the shiro-roles.ini defining default
     * platform roles is read
     */
    private final String platformStorageId;

    private PlatformRolePermissionResolver platformRoleResolver;

    private RuntimeRolePermissionResolver runtimeRolePermissionResolver;

    /**
     * All app resolvers in order as defined by storage
     */
    private List<AppRolePermissionResolver> appRoleResolver = Lists.newArrayList();

    /**
     * Cache for all known roles. The key is a dummy key, i.e. we will always have
     * just one entry. Always use {@link #SINGLETON_CACHE_KEY} as key.
     */
    private LoadingCache<String, Map<String, PlatformRole>> rolesCache;

    public PlatformRoleManager(MetaphactsSecurityManager securityManager, PlatformStorage platformStorage,
            CacheManager cacheManager) {
        super();
        this.platformStorage = platformStorage;
        this.securityManager = securityManager;
        this.cacheManager = cacheManager;
        this.platformStorageId = Configuration.getPlatformStorageId();
        initialize();
    }

    protected synchronized void initialize() {

        // initialize cache
        rolesCache = cacheManager.newBuilder(CACHE_ID, b -> b.expireAfterWrite(60, TimeUnit.MINUTES))
                .build(new CacheLoader<String, Map<String, PlatformRole>>() {

                    @Override
                    public Map<String, PlatformRole> load(String key) throws Exception {
                        if (!key.equals(SINGLETON_CACHE_KEY)) {
                            throw new IllegalArgumentException("Always use " + SINGLETON_CACHE_KEY + " as key.");
                        }
                        Collection<PlatformRole> roles = getAllAvailableRolesInternal();
                        Map<String, PlatformRole> res = Maps.newHashMap();
                        roles.forEach(r -> res.put(r.getName(), r));
                        return res;
                    }
                });

        // 1. initialize platform resolver
        try {
            this.platformRoleResolver = loadPlatformRoleResolver();
        } catch (IOException e) {
            throw new IllegalStateException("Failed to initialize platform role manager: " + e.getMessage(), e);
        }
        
        // 2. runtime storage resolver, keep this specific for modifications
        try {
            this.runtimeRolePermissionResolver = loadRuntimeRoleResolver();
        } catch (IOException e) {
            throw new IllegalStateException("Failed to initialize platform role manager: " + e.getMessage(), e);
        }
        
        // 3. find app storage role resolvers
        // Note: reverse is required, to add the most specific override
        // first in our appResolver (e.g. runtime shiro-roles.ini has higher precedence
        // than myApp shiro-roles.ini)
        try {
            StoragePath path = ObjectKind.CONFIG.resolve(SHIRO_ROLES_FILE);
            for (FindResult f : Lists.reverse(platformStorage.findOverrides(path))) {
                if (f.getAppId().equals(DEFAULT_PLATFORM_STORAGE_ID) || f.getAppId().equals(this.platformStorageId)) {
                    continue; // skip non-apps
                }
                if (f.getAppId().equals(PlatformStorage.DEVELOPMENT_RUNTIME_STORAGE_KEY)) {
                    continue; // skip runtime storage
                }
                logger.info("Loading role definitions from app '" + f.getAppId() + "' at path: " + path + "");
                try {
                    boolean mutable = true; // app or runtime roles can be overridden
                    appRoleResolver
                            .add(new AppRolePermissionResolver(f.getAppId(), loadRoleResolverFromStorage(f, mutable)));
                } catch (IOException e) {
                    logger.warn(
                            "Failed to initialize app role resolver for app " + f.getAppId() + ": " + e.getMessage());
                    logger.debug("Details:", e);
                    throw new IllegalStateException("Failed to initialize platform role manager for app " + f.getAppId() + ": " + e.getMessage(), e);
                }
            }
        } catch (IOException e) {
            throw new IllegalStateException("Failed to initialize platform role manager: " + e.getMessage(), e);
        }
        
        
        // do some validation and print warning messages
        final String logMessage = "The system detected an attempt to override the default platform role {} "
                + "in the storage {}. Platform roles are immutable and cannot be overriden, "
                + "the role-definition will be ignored.";
        for (PlatformRole role : runtimeRolePermissionResolver.getRoles()) {
            if (platformRoleResolver.roleExists(role.getName())) {
                logger.warn(logMessage, role.getName(), "runtime");
            }
        }
        for (AppRolePermissionResolver appResolver : appRoleResolver) {
            for (PlatformRole role : appResolver.getRoles()) {
                if (platformRoleResolver.roleExists(role.getName())) {
                    logger.warn(logMessage, role.getName(), appResolver.appId);
                }
            }
        }
    }

    private PlatformRolePermissionResolver loadPlatformRoleResolver() throws IOException {
        SecurityConfigRecord record = SecurityConfigRecord.fromStorage(SecurityConfigType.ShiroRoles, platformStorage,
                this.platformStorageId);
        
        if (!record.exists()) {
            throw new IllegalStateException("Could not find " + SHIRO_ROLES_FILE + " file in " + platformStorageId);
         }
        
        logger.debug("Loading platform role definitions from " + record.getLocationDescription());

        return new PlatformRolePermissionResolver(this.platformStorageId,
                loadRoleResolverFromStorage(record, false, false));
    }

    private RuntimeRolePermissionResolver loadRuntimeRoleResolver() throws IOException {

        SecurityConfigRecord record = SecurityConfigRecord.fromStorage(SecurityConfigType.ShiroRoles, platformStorage, 
                PlatformStorage.DEVELOPMENT_RUNTIME_STORAGE_KEY);

        RoleIniRealm roleIniRealm;
        if (record.exists()) {
            // initialize from runtime shiro-roles.ini
            logger.info("Loading role definitions from " + record.getLocationDescription());
            roleIniRealm = loadRoleResolverFromStorage(record, true, true);
        } else {
            roleIniRealm = new RoleIniRealm(new Ini(), true, true); // initialize with empty roles
            logger.debug("No role definitions defined in runtime storage.");

        }
        

        return new RuntimeRolePermissionResolver(PlatformStorage.DEVELOPMENT_RUNTIME_STORAGE_KEY, roleIniRealm);
    }

    private RoleIniRealm loadRoleResolverFromStorage(FindResult f, boolean mutable) throws IOException {
        Ini ini = new Ini();

        try (InputStream in = f.getRecord().getLocation().readContent()) {
            ini.load(in);
        }

        return new RoleIniRealm(ini, mutable, false);
    }

    private RoleIniRealm loadRoleResolverFromStorage(SecurityConfigRecord record, boolean mutable, boolean deletable)
            throws IOException {

        Ini ini = new Ini();

        try (InputStream in = record.readStream()) {
            ini.load(in);
        }

        return new RoleIniRealm(ini, mutable, deletable);

    }

    /**
     * Method to inspect whether the role is known to this instance.
     * 
     * @param role the role
     * @return true if the given role exists
     */
    public boolean roleExists(String role) {
        return getRole(role) != null;
    }

    /**
     * Retrieve the {@link PlatformRole} associated to the role string (if it
     * exists)
     * 
     * @param role
     * @return the {@link PlatformRole} or <code>null</code> if the role does not
     *         exist
     */
    public PlatformRole getRole(String role) {
        try {
            return rolesCache.get(SINGLETON_CACHE_KEY).get(role);
        } catch (ExecutionException e) {
            throw new IllegalStateException(e);
        }
    }

    /**
     * Retrieve all available roles currently known to this role manager. Note that
     * this method uses a cache.
     * 
     * @return
     */
    public Collection<PlatformRole> getAllAvailableRoles() {
        try {
            return ImmutableList.copyOf(rolesCache.get(SINGLETON_CACHE_KEY).values());
        } catch (ExecutionException e) {
            throw new IllegalStateException("Failed to retrieve platform roles: " + e.getMessage(), e);
        }
    }

    /**
     * Retrieves all available roles currently known to this role manager. This
     * method directly retrieves roles from the source objects.
     * 
     * @return
     */
    protected Collection<PlatformRole> getAllAvailableRolesInternal() {

        Map<String, PlatformRole> roles = Maps.newHashMap();

        // collect legacy roles (shiro.ini)
        for (PlatformRole r : getRolesFromRealms()) {
            roles.put(r.getName(), r);
        }

        // add platform role if it is not yet defined
        for (PlatformRole r : platformRoleResolver.getRoles()) {
            if (!roles.containsKey(r.getName())) {
                roles.put(r.getName(), r);
            }
        }

        // add runtime roles if not yet defined
        for (PlatformRole r : runtimeRolePermissionResolver.getRoles()) {
            if (!roles.containsKey(r.getName())) {
                roles.put(r.getName(), r);
            }
        }

        // add any role definitions from app, if role is not defined by platform
        // Note: apps are available in override order
        for (AppRolePermissionResolver resolver : appRoleResolver) {
            for (PlatformRole r : resolver.getRoles()) {
                if (!roles.containsKey(r.getName())) {
                    roles.put(r.getName(), r);
                }
            }
        }

        return roles.values();
    }

    @Override
    public Collection<Permission> resolvePermissionsInRole(String roleString) {

        Collection<Permission> perms;

        // legacy support: read role definitions from realms, e.g. shiro.ini
        perms = resolveFromRealms(roleString);
        if (perms != null && !perms.isEmpty()) {
            if (logger.isTraceEnabled()) {
                logger.trace("Retrieved permissions for role {} from legacy realm: " + perms);
            }
            return perms;
        }

        // check the platform default roles
        perms = platformRoleResolver.resolvePermissionsInRole(roleString);
        if (perms != null && !perms.isEmpty()) {
            if (logger.isTraceEnabled()) {
                logger.trace("Retrieved permissions for role {} from platform definitions: " + perms, roleString);
            }
            return perms;
        }

        // check runtime role resolver
        perms = runtimeRolePermissionResolver.resolvePermissionsInRole(roleString);
        if (perms != null && !perms.isEmpty()) {
            if (logger.isTraceEnabled()) {
                logger.trace("Retrieved permissions for role {} from runtime definitions: " + perms, roleString);
            }
            return perms;
        }

        // check if apps provide permissions
        // note: app resolvers are defined in override order, i.e. most specific one is
        // asked first
        for (AppRolePermissionResolver appResolver : appRoleResolver) {
            perms = appResolver.resolvePermissionsInRole(roleString);
            if (perms != null && !perms.isEmpty()) {
                if (logger.isTraceEnabled()) {
                    logger.trace("Retrieved permissions for role {} from app " + appResolver.appId + ": " + perms,
                            roleString);
                }
                return perms;
            }
        }

        return Collections.emptyList();
    }

    @Deprecated
    protected Collection<Permission> resolveFromRealms(String roleString) {
        
        // NOTE: this method is kept for legacy support

        for (Realm realm : securityManager.getRealms()) {
            if (realm instanceof RolePermissionResolver) {
                RolePermissionResolver r = (RolePermissionResolver) realm;
                Collection<Permission> perms = r.resolvePermissionsInRole(roleString);

                if (r == null || perms.isEmpty()) {
                    return null;
                }
                if (logger.isTraceEnabled()) {
                    logger.trace("[Deprecated] reading role " + roleString + " from realm " + realm.getName()
                            + ". As of 3.4 roles are separated from users,"
                            + " e.g. into shiro-roles.ini. Make sure to properly upgrade your shiro.ini.");
                }
                return perms;
            }
        }

        return null;
    }

    @SuppressWarnings("deprecation")
    protected Collection<PlatformRole> getRolesFromRealms() {

        // NOTE: this method is kept for legacy support

        for (Realm realm : securityManager.getRealms()) {
            if (realm instanceof ShiroTextRealm) {
                ShiroTextRealm textRealm = (ShiroTextRealm) realm;
                return textRealm.getRoles().values().stream().map(s -> new PlatformRole(s, true, false))
                        .collect(Collectors.toList());
            }
        }

        return Collections.emptyList();
    }

    /**
     * Updates role definitions in the {@link #SHIRO_ROLES_FILE} in the runtime
     * storage with the provided data.
     * <p>
     * Notes:
     * </p>
     * <ul>
     * <li>When trying to modify an immutable platform role, an
     * {@link IllegalArgumentException} is thrown</li>
     * <li>When trying to delete a role that is either an immutable platform role,
     * or not defined in the runtime storage, an {@link IllegalArgumentException} is
     * thrown.</li>
     * <li>All new or overridden roles are written to the runtime storage</li>
     * <li>The provided map of updates may contain data of unmodified roles.</li>
     * </ul>
     * 
     * <p>
     * Note that this method updates the role cache.
     * </p>
     * 
     * @param updateRolesMap the map of roles to update. Maps user to the
     *                       permissions.
     * @param deleteRoles    the set of roles to delete. May be empty.
     * @throws IOException
     */
    public synchronized void updateRoles(Map<String, List<String>> updateRolesMap, Set<String> deleteRoles)
            throws IOException {

        Map<String, PlatformRole> allRoles;
        try {
            allRoles = rolesCache.get(SINGLETON_CACHE_KEY);
        } catch (ExecutionException e) {
            throw new IllegalStateException("Failed to retrieve platform roles: " + e.getMessage(), e);
        }

        // determine modified role set
        updateRolesMap = determineModifiedRoles(updateRolesMap);

        // check if all supplied modified roles are actually mutable
        // if there is any that cannot be overridden, throw an exception
        for (String toUpdateRole : updateRolesMap.keySet()) {
            PlatformRole r = allRoles.get(toUpdateRole);
            if (r != null && !r.isMutable()) {
                throw new IllegalArgumentException("Role " + toUpdateRole + " is immutable and cannot be overridden.");
            }
        }
        
        // check if all roles to be deleted can actually be deleted
        // this is: role is mutable and defined in runtime storage
        for (String toDeleteRole : deleteRoles) {
            PlatformRole r = allRoles.get(toDeleteRole);
            if (r == null) {
                throw new IllegalArgumentException("Role " + toDeleteRole + " does not exist and cannot be deleted.");
            }
            if (!r.isMutable()) {
                throw new IllegalArgumentException("Role " + toDeleteRole + " is immutable and cannot be deleted.");
            }
            if (!runtimeRolePermissionResolver.getRoles().stream().anyMatch(pr -> pr.getName().equals(toDeleteRole))) {
                throw new IllegalArgumentException(
                        "Role " + toDeleteRole + " is not defined in runtime storage and thus cannot be deleted.");
            }
        }

        if (updateRolesMap.isEmpty() && deleteRoles.isEmpty()) {
            logger.debug("No modified roles.");
            return;
        }

        if (!updateRolesMap.isEmpty()) {
            logger.info("Updating roles in runtime shiro-roles.ini: " + updateRolesMap.keySet());
        }
        if (!deleteRoles.isEmpty()) {
            logger.info("Deleting roles from runtime shiro-roles.ini: " + deleteRoles);
        }

        // re-add the roles from runtime storage (as persistRoles will override the file
        // in runtime). Note that roles to be deleted are not re-added
        Map<String, List<String>> toPersistRoles = Maps.newHashMap();
        toPersistRoles.putAll(updateRolesMap);
        for (PlatformRole role : runtimeRolePermissionResolver.getRoles()) {
            if (toPersistRoles.containsKey(role.getName())) {
                continue;
            }
            if (deleteRoles.contains(role.getName())) {
                continue; // skip roles that should be deleted
            }
            toPersistRoles.put(role.getName(),
                    role.getPermissions().stream().map(p -> p.toString()).collect(Collectors.toList()));
        }

        persistRoles(toPersistRoles);

        // reload the runtime resolver
        runtimeRolePermissionResolver = loadRuntimeRoleResolver();

        // invalidate cache
        rolesCache.invalidateAll();

        // update cached permissions in relevant realms
        for (Realm realm : securityManager.getRealms()) {
            if (realm instanceof OneTimeRolePermissionResolverAware) {
                OneTimeRolePermissionResolverAware resolverRealm = (OneTimeRolePermissionResolverAware) realm;
                resolverRealm.updateRoleDefinitions();
            }
        }
    }

    protected Map<String, List<String>> determineModifiedRoles(Map<String, List<String>> updateRolesMap) {

        Map<String, List<String>> modifiedRoles = Maps.newHashMap();
        for (Entry<String, List<String>> entry : updateRolesMap.entrySet()) {
            if (isRoleModified(entry.getKey(), entry.getValue())) {
                modifiedRoles.put(entry.getKey(), entry.getValue());
            }
        }
        return modifiedRoles;
    }

    protected boolean isRoleModified(String role, List<String> newPermissions) {
        
        Set<String> currentPerms = resolvePermissionsInRole(role).stream().map(p -> p.toString())
                .collect(Collectors.toSet());

        return !Sets.newHashSet(newPermissions).equals(currentPerms);
    }

    /**
     * Persists the given roles to the {@link #SHIRO_ROLES_FILE} in the runtime
     * storage. Note that the file is overridden, i.e. the list of roles must be
     * complete.
     * 
     * @param roles
     * @throws IOException
     */
    private void persistRoles(Map<String, List<String>> roles) throws IOException {

        StringBuilder sb = new StringBuilder();
        sb.append("[roles]\n");
        roles.forEach((role, perms) -> {
            sb.append(role).append(" = ").append(StringUtils.join(perms, ", ")).append("\n");
        });

        SecurityConfigRecord record = SecurityConfigRecord.fromStorage(SecurityConfigType.ShiroRoles, platformStorage,
                PlatformStorage.DEVELOPMENT_RUNTIME_STORAGE_KEY);
        record.writeAll(sb.toString());
    }

    /**
     * Helper class to resolve roles from an {@link Ini} based configuration with a
     * roles section.
     * 
     * @author Andreas Schwarte <as@metaphacts.com>
     *
     */
    static class RoleIniRealm extends IniRealm implements RolePermissionResolver {

        private final boolean mutable;
        private final boolean deletable;

        public RoleIniRealm(Ini ini, boolean mutable, boolean deletable) {
            super();
            this.mutable = mutable;
            this.deletable = deletable;
            setIni(ini);
            setPermissionResolver(new WildcardPermissionResolver());
            if (!CollectionUtils.isEmpty(ini)) {
                init();
            }
        }

        public List<PlatformRole> getRoles() {
            return this.roles.values().stream().map(s -> new PlatformRole(s, mutable, deletable))
                    .collect(Collectors.toList());
        }

        @Override
        public Collection<Permission> resolvePermissionsInRole(String roleString) {
            SimpleRole r = this.roles.get(roleString);
            if (r == null) {
                return Collections.emptySet();
            }
            return ImmutableList.copyOf(r.getPermissions());
        }
    }

    /**
     * Helper class which expose the {@link RolePermissionResolver} as well as other
     * interfaces to {@link PlatformRoleManager}
     * 
     * @author Andreas Schwarte <as@metaphacts.com>
     *
     */
    static abstract class StorageRolePermissionResolver implements RolePermissionResolver {

        protected final String appId;
        protected final RoleIniRealm delegate;

        public StorageRolePermissionResolver(String appId, RoleIniRealm delegate) {
            super();
            this.appId = appId;
            this.delegate = delegate;
        }

        @Override
        public Collection<Permission> resolvePermissionsInRole(String roleString) {
            return delegate.resolvePermissionsInRole(roleString);
        }

        public List<PlatformRole> getRoles() {
            return delegate.getRoles();
        }

        public boolean roleExists(String role) {
            return delegate.roleExists(role);
        }

    }

    /**
     * The {@link StorageRolePermissionResolver} for the main platform roles (which
     * cannot be overridden)
     * 
     * @author Andreas Schwarte <as@metaphacts.com>
     *
     */
    static class PlatformRolePermissionResolver extends StorageRolePermissionResolver {

        public PlatformRolePermissionResolver(String appId, RoleIniRealm delegate) {
            super(appId, delegate);
        }
    }

    /**
     * The {@link StorageRolePermissionResolver} for app modules
     * 
     * @author Andreas Schwarte <as@metaphacts.com>
     *
     */
    static class AppRolePermissionResolver extends StorageRolePermissionResolver {

        public AppRolePermissionResolver(String appId, RoleIniRealm delegate) {
            super(appId, delegate);
        }

    }

    /**
     * Specialized {@link AppRolePermissionResolver} for the runtime storage
     * 
     * @author Andreas Schwarte <as@metaphacts.com>
     *
     */
    static class RuntimeRolePermissionResolver extends StorageRolePermissionResolver {

        public RuntimeRolePermissionResolver(String appId, RoleIniRealm delegate) {
            super(appId, delegate);
        }
    }

    /**
     * Structure class providing information about roles and their
     * {@link Permission}s.
     * 
     *
     * @author Andreas Schwarte <as@metaphacts.com>
     *
     */
    public static class PlatformRole {

        private final String name;
        private final Set<Permission> permissions;
        private final boolean mutable;
        private final boolean deletable;

        public PlatformRole(SimpleRole simpleRole, boolean mutable, boolean deletable) {
            this(simpleRole.getName(), simpleRole.getPermissions(), mutable, deletable);
        }

        public PlatformRole(String name, Set<Permission> permissions, boolean mutable, boolean deletable) {
            super();
            this.name = name;
            this.permissions = permissions;
            this.mutable = mutable;
            this.deletable = deletable;
        }

        public String getName() {
            return name;
        }

        public Set<Permission> getPermissions() {
            return permissions;
        }

        /**
         * 
         * @return true if this role is mutable, i.e. if it can be overridden
         */
        public boolean isMutable() {
            return mutable;
        }

        /**
         * 
         * @return whether this role definition can be deleted, i.e deleted from the
         *         runtime storage
         */
        public boolean isDeletable() {
            return this.deletable;
        }
    }
}
