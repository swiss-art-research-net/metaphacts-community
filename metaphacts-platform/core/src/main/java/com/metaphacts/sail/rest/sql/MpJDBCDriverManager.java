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
package com.metaphacts.sail.rest.sql;

import java.sql.Connection;
import java.sql.Driver;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.concurrent.CopyOnWriteArrayList;

import javax.inject.Singleton;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

@Singleton
public class MpJDBCDriverManager {

    private static final Logger logger = LogManager.getLogger(MpJDBCDriverManager.class);

    private final CopyOnWriteArrayList<Driver> registeredDrivers = new CopyOnWriteArrayList<>();

    public MpJDBCDriverManager() {
    }

    public Connection getConnection(String url) throws SQLException {

        java.util.Properties info = new java.util.Properties();
        return (getConnection(url, info));
    }

    public Connection getConnection(String url, String user, String password) throws SQLException {
        return getConnection(url, user, password, new java.util.Properties());
    }
    
    public Connection getConnection(String url, String user, String password,
            java.util.Properties info) throws SQLException {
        if (user != null) {
            info.put("user", user);
        }
        if (password != null) {
            info.put("password", password);
        }

        return (getConnection(url, info));
    }

    public Connection getConnection(String url, java.util.Properties info) throws SQLException {

        if (url == null) {
            throw new SQLException("The url cannot be null", "08001");
        }

        logger.trace("DriverManager.getConnection(\"" + url + "\")");
        
        SQLException reason = null;
        SQLException originalReason = null;
        
        try {
            return DriverManager.getConnection(url, info);
        } catch (SQLException e) {
            originalReason = e;
        }

        for (Driver driver : registeredDrivers) {
            try {
                Connection con = driver.connect(url, info);
                if (con != null) {
                    logger.trace("getConnection returning " + driver.getClass().getName());
                    return (con);
                }
            } catch (SQLException ex) {
                if (reason == null) {
                    reason = ex;
                }
            }
        }
        
        if (reason == null) {
            reason = originalReason;
        }

        // if we got here nobody could connect.
        if (reason != null) {
            logger.warn("getConnection failed: " + reason);
            throw reason;
        }

        logger.warn("getConnection: no suitable driver found for " + url);
        throw new SQLException("No suitable driver found for " + url, "08001");
    }
    
    public void registerDriver(Driver driver) {
        registeredDrivers.addIfAbsent(driver);
    }
}
