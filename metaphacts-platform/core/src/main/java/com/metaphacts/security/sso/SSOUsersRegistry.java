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
package com.metaphacts.security.sso;

import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import com.metaphacts.security.SecurityConfigType;
import com.metaphacts.security.SecurityConfigRecord;
import org.apache.commons.lang3.StringUtils;
import org.apache.shiro.config.Ini;
import org.apache.shiro.realm.text.IniRealm;

import com.metaphacts.config.Configuration;

/**
 * Local users registry that can be used for authorization in SSO environment.
 * 
 * @author Artem Kozlov {@literal <ak@metaphacts.com>}
 */
public class SSOUsersRegistry {

    private Map<String, Collection<String>> users = new HashMap<>();

    public SSOUsersRegistry(Configuration config) {
        SecurityConfigRecord record = config.getEnvironmentConfig()
            .getSecurityConfig(SecurityConfigType.SsoUsersConfig);
        if (record.exists()) {
            Ini ini = SecurityConfigRecord.readIni(record);
            initUsers(ini.getSection(IniRealm.USERS_SECTION_NAME));
        }
    }

    public Collection<String> getRolesForUser(String principal) {
        return Optional.ofNullable(users.get(principal)).orElse(Collections.emptyList());
    }

    private void initUsers(Map<String, String> userDefs) {
        if (userDefs == null || userDefs.isEmpty()) {
            return;
        }

        userDefs.keySet().stream().forEach(userId -> {
            String userRoles = userDefs.get(userId);
            String[] roles = StringUtils.split(userRoles, ',');
            users.put(userId, Arrays.asList(roles));
        });
    }
}
