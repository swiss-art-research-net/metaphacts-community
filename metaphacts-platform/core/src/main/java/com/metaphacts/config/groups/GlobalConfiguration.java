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

import java.util.List;

import javax.inject.Inject;

import com.google.common.collect.Lists;
import com.metaphacts.config.ConfigurationParameter;
import com.metaphacts.config.ConfigurationParameter.VisibilityLevel;
import com.metaphacts.config.InvalidConfigurationException;
import com.metaphacts.repository.RepositoryManager;
import com.metaphacts.services.storage.api.PlatformStorage;

/**
 * Configuration group for global system configuration, affecting system
 * startup and global system functionality.
 *
 * @author Michael Schmidt <ms@metaphacts.com>
 */
public class GlobalConfiguration extends ConfigurationGroupBase {

    private final static String ID = "global";

    // TODO: outline using locale
    private final static String DESCRIPTION =
            "Global system configuration, affecting system functionality like global redirects etc.";

    @Inject
    public GlobalConfiguration(PlatformStorage platformStorage) throws InvalidConfigurationException {
        super(ID, DESCRIPTION, platformStorage);
    }


    /***************************************************************************
     ************************ CONFIGURATION OPTIONS ****************************
     **************************************************************************/
    @ConfigurationParameter(name = "homePage", restartRequired = false, desc = "Prefixed or full URI (surrounded by <>) to "
            + "specify the page the user should be redirect to after login or if she clicks on the home button. "
            + "Default: \":Start\"")
    public String getHomePage() {
        // TODO: reconsider start page once we have /page servlet in place
        return getString("homePage", ":Start");
    }


    /****************************** VALIDATION ********************************/
    @Override
    public void assertConsistency() {
        // nothing to be done here for now, may implement some sophisticated
        // syntactic checks on strings or interdependencies
    }

    /****************************** LDP ASSETS ********************************/
    @ConfigurationParameter(name = "repositoriesLDPSave", restartRequired = true, desc = "List of repository IDs, "
            + "for which LDP assets will be saved in the runtime storage. (see <a href=\"/resource/Help:LDPAssetsManagement\">LDP assets management</a>) "
            + "Default: <code>assets</code>. To disable this functionality for all repositories, use <code>repositoriesLDPSave=,</code>.")
    public List<String> getRepositoriesLDPSave() {
        return getStringList(
                "repositoriesLDPSave",
                Lists.newArrayList(RepositoryManager.ASSET_REPOSITORY_ID)
            );
    }
    
    @ConfigurationParameter(name = "repositoriesLDPLoad", restartRequired = true, desc = "List of repository IDs, "
            + "for which LDP assets will be loaded from the storage at startup. (see <a href=\"/resource/Help:LDPAssetsManagement\">LDP assets management</a>)"
            + "Default: <code>assets</code>. To disable this functionality for all repositories, use <code>repositoriesLDPLoad=,</code>.")
    public List<String> getRepositoriesLDPLoad() {
        return getStringList(
                "repositoriesLDPLoad",
                Lists.newArrayList(RepositoryManager.ASSET_REPOSITORY_ID)
            );
    }
    
    
    @ConfigurationParameter(
            name = "experimental.enableTemplateIndexing",
            restartRequired = true, 
            desc = "A setting to deactivate template indexing to the platform metadata repository. Template indexing is triggered during the startup of the platform. "
                    + "In case of issues, this experimental setting can be used to deactivate indexing completely.",
            visibilityLevel = VisibilityLevel.experimental)
    public boolean isTemplateIndexingEnabled() {
        return getBoolean("experimental.enableTemplateIndexing", true);
    }
}
