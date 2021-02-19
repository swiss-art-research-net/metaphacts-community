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

import java.util.Map;
import java.util.Set;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.shiro.config.Ini;
import org.apache.shiro.config.Ini.Section;
import org.apache.shiro.realm.Realm;
import org.apache.shiro.realm.ldap.DefaultLdapRealm;
import org.apache.shiro.web.config.WebIniSecurityManagerFactory;

import com.google.common.collect.Sets;
import com.google.inject.Inject;
import com.google.inject.Provider;
import com.metaphacts.config.Configuration;
import com.metaphacts.secrets.SecretResolver;
import com.metaphacts.secrets.SecretsHelper;

/**
 * Creates and configures the {@link LDAPRealm}.
 * 
 * <p>
 * The following configuration values are subject to secret resolution (see {@link SecretResolver} for details):
 * <ul>
 * <li>username for system user</li>
 * <li>password for system user</li>
 * </ul>
 * </p>
 * 
 * @author Johannes Trame <jt@metaphacts.com>
 */
@SuppressWarnings("deprecation")
public class LDAPRealmProvider implements Provider<Realm> {

    private static final Logger logger = LogManager.getLogger(LDAPRealmProvider.class);

    @Inject
    private Configuration config;
    
    @Inject(optional=true)
    private SecretResolver secretResolver;

    @Override
    public Realm get() {
           SecurityConfigRecord record = config.getEnvironmentConfig()
               .getSecurityConfig(SecurityConfigType.ShiroLDAPConfig);

           Ini ini = SecurityConfigRecord.readIni(record);
           logger.info("Trying to initialize SHIRO LDAP realm from: " + record.getLocationDescription());

           resolveSecrets(ini);
           
           WebIniSecurityManagerFactory factory = new WebIniSecurityManagerFactory(ini);
           //need to call getInstance before getting the beans
           factory.getInstance();
           Map<String, ?> beans = factory.getBeans();
           Object r = beans.get("ldapRealm");
           if(r==null || !DefaultLdapRealm.class.isAssignableFrom(r.getClass()))
               throw new IllegalArgumentException(
                   "Invalid DefaultLdapRealm specified in " + record.getLocationDescription());
           
           return (DefaultLdapRealm)r;
    }

    protected void resolveSecrets(Ini ini) {
        // iterate over all sections and replace known settings containing secrets
        final Set<String> settingsWithSecrets = Sets.newHashSet(
                            "ldapRealm.contextFactory.systemUsername",
                            "ldapRealm.contextFactory.systemPassword");
        for (String sectionName : ini.getSectionNames()) {
            Section section = ini.getSection(sectionName);
            section.replaceAll((key, value) -> {
                if (settingsWithSecrets.contains(key)) {
                    if (value.startsWith("\\${") && value.endsWith("}")) {
                        // get rid of the leading \ which might be used to escape the $
                        value = value.substring(1);
                    }
                    return SecretsHelper.resolveSecretOrFallback(secretResolver, value);
                }
                return value;
            });
        }
    }
    

}
