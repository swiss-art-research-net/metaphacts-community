/*
 * Copyright (C) 2015-2019, metaphacts GmbH
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
import java.util.stream.Collectors;

import com.google.common.collect.Lists;
import com.metaphacts.config.PropertyPattern;
import com.metaphacts.config.ConfigurationParameter;
import com.metaphacts.config.InvalidConfigurationException;
import com.metaphacts.config.NamespaceRegistry;
import com.google.inject.Provider;
import com.metaphacts.services.storage.api.PlatformStorage;

import javax.annotation.Nullable;
import javax.inject.Inject;

/**
 * Configuration group for options that affect how data is displayed in the UI.
 *
 * @author Michael Schmidt <ms@metaphacts.com>
 */
public class UIConfiguration extends ConfigurationGroupBase {

    private final static String ID = "ui";

    // TODO: outline using locale
    private final static String DESCRIPTION =
        "Configuration options that affect how data is displayed in the UI.";

    private final static String DEFAULT_LANGUAGE = "en";

    @Inject
    public UIConfiguration(PlatformStorage platformStorage) throws InvalidConfigurationException {
        super(ID, DESCRIPTION, platformStorage);
    }


    /***************************************************************************
     ************************ CONFIGURATION OPTIONS ****************************
     **************************************************************************/

    /**
     * Returns preferred label property IRIs for rendering resource
     * labels in the UI.
     *
     * @return a list of full IRIs enclosed in angle brackets (&lt;&gt;).
     */
    @ConfigurationParameter
    public List<String> getPreferredLabels() {
        return getStringList(
            "preferredLabels",
            Lists.newArrayList("<http://www.w3.org/2000/01/rdf-schema#label>")
        );
    }

    @ConfigurationParameter
    public List<String> getPreferredLanguages() {
        return getStringList("preferredLanguages", Lists.newArrayList(DEFAULT_LANGUAGE));
    }

    public String resolvePreferredLanguage(@Nullable String preferredLanguage) {
        if (preferredLanguage != null) {
            return preferredLanguage;
        }
        List<String> systemPreferredLanguages = getPreferredLanguages();
        if (!systemPreferredLanguages.isEmpty()) {
            return systemPreferredLanguages.get(0);
        }
        return DEFAULT_LANGUAGE;
    }

    /**
     * Returns preferred thumbnail property IRIs for rendering resource
     * thumbnail images in the UI.
     *
     * @return a list of full IRIs enclosed in angle brackets (&lt;&gt;).
     */
    @ConfigurationParameter
    public List<String> getPreferredThumbnails() {
        return getStringList(
            "preferredThumbnails",
            Lists.newArrayList("<http://schema.org/thumbnail>")
        );
    }

    @ConfigurationParameter
    public String getTemplateIncludeQuery() {
        return getString("templateIncludeQuery", "SELECT ?type WHERE { ?? a ?type }");
    }

    @ConfigurationParameter
    public Boolean getEnableUiComponentBasedSecurity() {
        return getBoolean("enableUiComponentBasedSecurity", false);
    }
//    @ConfigurationParameter
//    public String getDatePattern() {
//        return getString("datePattern"); // TODO: this is not yet in use
//    }
//
//    @ConfigurationParameter
//    public String getTimePattern() {
//        return getString("timePattern"); // TODO: this is not yet in use
//    }

    @ConfigurationParameter
    public String getDeploymentTitle() {
        return getString("deploymentTitle", "metaphacts platform");
    }

    @ConfigurationParameter
    public String getUnsupportedBrowserMessage() { return getString("unsupportedBrowserMessage", ""); }

    /**
     * Returns supported web browsers in the format BrowserName-MinimumVersion, e.g. Chrome-58
     *
     * @return a list of supported browsers and their minimum version numbers.
     */
    @ConfigurationParameter
    public List<String> getSupportedBrowsers() {
        return getStringList("supportedBrowsers", Lists.newArrayList());
    }



    /****************************** VALIDATION ********************************/
    @Override
    public void assertConsistency() {
        // we can't use 'getPreferredLabels' to check consistency
        // because it depends on NamespaceRegistry which is not initialized when
        // assertConsistency is called
        if (getPreferredLanguages().isEmpty()) {
            throw new IllegalArgumentException("getPreferredLanguages must not be empty.");
        }
    }
}
