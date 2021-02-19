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
package com.metaphacts.services.storage.api;

import org.apache.commons.configuration2.Configuration;

/**
 * Abstract representation of a storage configuration. Specializations may extend it and implement
 * own validation logic in {@link #validate()}.
 * 
 * @author Alexey Morozov
 * @author Johannes Trame <jt@metaphacts.com>
 */
public abstract class StorageConfig {
    protected boolean mutable = false;
    protected String subroot;

    /**
     * Returns a key to identify the type of storage that can be instantiated with this
     * configuration.
     */
    public abstract String getStorageType();

    /**
     * Storage specific configuration validation logic.
     * Should check whether storage config is consistent and valid.
     */
    protected void validate() throws StorageConfigException {
        if (this.subroot != null) {
            try {
                StoragePath.parse(this.subroot);
            } catch (Exception ex) {
                throw new StorageConfigException("Invalid value for property 'subroot'", ex);
            }
        }
    }

    public void setMutable(boolean mutable) {
        this.mutable = mutable;
    }

    public boolean isMutable() {
        return this.mutable;
    }

    public void setSubroot(String subroot) {
        this.subroot = subroot;
    }

    public String getSubroot() {
        return subroot;
    }

    public static void readBaseProperties(StorageConfig config, Configuration properties) {
        if (properties.containsKey("mutable")) {
            config.setMutable(properties.getBoolean("mutable"));
        }
        if (properties.containsKey("subroot")) {
            config.setSubroot(properties.getString("subroot"));
        }
    }
}
