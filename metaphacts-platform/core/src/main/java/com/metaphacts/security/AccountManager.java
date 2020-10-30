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

import java.util.Map;

import org.apache.shiro.authc.Account;

/**
 * Defines methods for local account management
 * 
 * @author Andreas Schwarte <as@metaphacts.com>
 * @see ShiroTextRealm
 */
public interface AccountManager {

    /**
     * 
     * @return all known local accounts (maps user name to {@link Account})
     */
    public Map<String, Account> getAccounts();

    /**
     * Add the given account
     * 
     * @param username
     * @param password
     * @param roles
     * @throws RuntimeException if adding the account has failed (e.g. due to IO
     *                          issues)
     */
    public void addAccount(String username, String password, String... roles);

    /**
     * 
     * @param username
     * @return true if a local account for the given user exists
     */
    public boolean accountExists(String username);

    /**
     * Delete the account corresponding to the given user
     * 
     * @param username
     * @throws RuntimeException if deletion of the account has failed (e.g. due to
     *                          IO issues)
     */
    public void deleteAccount(String username);

    /**
     * Update the account for the given user
     * 
     * @param username
     * @param encryptPassword
     * @param roles
     * @throws RuntimeException if updating of the account has failed (e.g. due to
     *                          IO issues)
     */
    public void updateAccount(String username, String encryptPassword, String... roles);
}
