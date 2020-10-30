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

import java.util.Collection;
import java.util.Collections;

import javax.inject.Inject;

import org.apache.shiro.authc.credential.CredentialsMatcher;
import org.apache.shiro.authc.credential.DefaultPasswordService;
import org.apache.shiro.authc.credential.SimpleCredentialsMatcher;
import org.apache.shiro.config.Ini;
import org.apache.shiro.realm.Realm;

import com.metaphacts.cache.CacheManager;
import com.metaphacts.config.Configuration;
import com.metaphacts.junit.MetaphactsShiroRule;
import com.metaphacts.services.storage.api.PlatformStorage;

public class MetaphactsSecurityTestUtils {

    @Inject
    public CacheManager cacheService;
    
    /**
     * Create an isolated {@link MetaphactsSecurityManager} for testing purposes.
     * See {@link MetaphactsShiroRule} for usage.
     * 
     * @param iniResourcePath
     * @param config
     * @return
     */
    public static MetaphactsSecurityManager createInstance(String iniResourcePath, Configuration config,
            CacheManager cacheService, PlatformStorage platformStorage) {
        ShiroTextRealm iniRealm = loadRealm(iniResourcePath);
        Collection<Realm> realms = Collections.singletonList(iniRealm);
        return createInstance(realms, config, cacheService, platformStorage);
    }

    /**
     * Create an isolated {@link MetaphactsSecurityManager} for testing purposes.
     * See {@link MetaphactsShiroRule} for usage.
     * 
     * @param realms
     * @param config
     * @return
     */
    public static MetaphactsSecurityManager createInstance(Collection<Realm> realms, Configuration config,
            CacheManager cacheService, PlatformStorage platformStorage) {
        MetaphactsSecurityManager securityManager = new MetaphactsSecurityManager(realms, config, cacheService,
                platformStorage);
        securityManager.setPasswordService(new DefaultPasswordService());
        securityManager.setAccountManager((ShiroTextRealm) realms.stream().filter(r -> r instanceof ShiroTextRealm)
                .findFirst()
                .orElseGet(() -> (ShiroTextRealm) null));
        return securityManager;
    }

    /**
     * Load a {@link ShiroTextRealm} from the given resource. See
     * {@link MetaphactsShiroRule} for usage.
     * 
     * @param iniResourcePath ini file resource, e.g.
     *                        classpath:com/metaphacts/security/shiro-templates-rights.ini
     * @return
     */
    public static ShiroTextRealm loadRealm(String iniResourcePath) {
        CredentialsMatcher passwordMatcher = new SimpleCredentialsMatcher();
        Ini ini = Ini.fromResourcePath(iniResourcePath);
        ShiroTextRealm iniRealm = new ShiroTextRealm(ini, passwordMatcher);
        return iniRealm;
    }


}
