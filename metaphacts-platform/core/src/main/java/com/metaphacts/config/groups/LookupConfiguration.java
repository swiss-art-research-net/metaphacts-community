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
package com.metaphacts.config.groups;

import javax.inject.Inject;

import com.metaphacts.config.ConfigurationParameter;
import com.metaphacts.config.InvalidConfigurationException;
import com.metaphacts.services.storage.api.PlatformStorage;

public class LookupConfiguration extends ConfigurationGroupBase {
    private static final String ID = "lookup";
    private static final String DESCRIPTION =
        "Configuration options that manages work of lookup service.";

    @Inject
    public LookupConfiguration(PlatformStorage platformStorage) throws InvalidConfigurationException {
        super(ID, DESCRIPTION, platformStorage);
    }

    @ConfigurationParameter(
        name = "experimental.maxParallelSearch",
        restartRequired = true,
        desc = "Defines custom search query for retrieving entity types information."
    )
    public Integer getMaxParallelSearch() {
        return getInteger("experimental.maxParallelSearch", 10);
    }
    
    @ConfigurationParameter(
        name = "experimental.defaultExternalLookupServiceName",
        restartRequired = false,
        desc = "Name of the lookup service to use by default in the rest service."
    )
    public String getDefaultExternalLookupServiceName() {
        return getString("experimental.defaultExternalLookupServiceName");
    }

    @ConfigurationParameter(
        name = "experimental.defaultLookupServiceName",
        restartRequired = false,
        desc = "Name of the lookup service to use by default."
    )
    public String getDefaultLookupServiceName() {
        return getString("experimental.defaultLookupServiceName");
    }
    
    @Override
    public void assertConsistency() {}
}
