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

import java.util.concurrent.Callable;

import org.apache.shiro.SecurityUtils;
import org.apache.shiro.util.ThreadContext;

/**
 * Wrapper for Shiro security context handling.
 * 
 * @author Andreas Schwarte
 *
 */
public class PlatformTaskWrapper {

    public static final PlatformTaskWrapper INSTANCE = new PlatformTaskWrapper();

    /**
     * Wrap the given Runnable in the current Shiro security context
     * 
     * @param r
     * @return the wrapped runnable
     */
    public Runnable wrap(Runnable r) {
        if (hasSecurityManagerRegistered()) {
            return SecurityUtils.getSubject().associateWith(r);
        }
        return r;
    }

    /**
     * Wrap the given Callable in the current Shiro security context
     * 
     * @param r
     * @return the wrapped runnable
     */
    public <T> Callable<T> wrap(Callable<T> c) {
        if (hasSecurityManagerRegistered()) {
            return SecurityUtils.getSubject().associateWith(c);
        }
        return c;
    }

    private boolean hasSecurityManagerRegistered() {
        // Allows to handle case where no security manager is available
        // This may for instance be in stand-alone setups (e.g. tests)
        return ThreadContext.getSecurityManager() != null;
    }
}
