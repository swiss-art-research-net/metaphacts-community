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
package com.metaphacts.config;

import java.util.Collection;
import java.util.List;

import org.apache.commons.lang.StringUtils;

import com.metaphacts.config.ConfigurationParameter.VisibilityLevel;
import com.metaphacts.config.groups.ConfigurationParameterType;

/**
 * Lightweight wrapper around the value of a configuration parameter. In
 * addition to the configuration parameter itself, it contains meta data
 * such as the information whether the value is shadowed in the
 * configuration.
 *
 * The class overrides toString() to yield a string representation of the
 * parameter's value object.
 *
 * @author msc
 */
public class ConfigParameterValueInfo {
    private final String parameterType;
    private final Object value;
    private final boolean isShadowed;
    private final List<String> definedByApps;
    private final ConfigurationParameter configParameter;

    public ConfigParameterValueInfo(
            ConfigurationParameterType type, Object value, boolean isShadowed, List<String> definedByApps,
            ConfigurationParameter configParameter
    ) {
        this.parameterType = type.getTypeName();
        this.value = value;
        this.isShadowed = isShadowed;
        this.definedByApps = definedByApps;
        this.configParameter = configParameter;
    }

    public String getParameterType() {
        return parameterType;
    }

    public Object getValue() {
        return value;
    }

    /**
     * @return whether config parameter is overridden by system property, e.g. {@code -Dproperty=...}
     */
    public boolean isShadowed() {
        return isShadowed;
    }

    /**
     * @return list of object storage IDs which defines property files wih values for this parameter,
     * in override order (e.g. [base, override1, override2, ...])
     */
    public List<String> getDefinedByApps() {
        return definedByApps;
    }

    public boolean isRestartRequired() {
        return configParameter.restartRequired();
    }

    /**
     * @return the optional description, may be <code>null</code> or empty
     */
    public String getDescription() {
        return configParameter.desc();
    }

    /**
     * 
     * @return the {@link VisibilityLevel}
     */
    public VisibilityLevel getVisibilityLevel() {
        return configParameter.visibilityLevel();
    }

    @Override
    public String toString() {
        if (parameterType.equals(ConfigurationParameterType.STRING_LIST.getTypeName())) {
            StringUtils.join((Collection<?>) value, ",");
        }
        return value.toString();
    }

}
