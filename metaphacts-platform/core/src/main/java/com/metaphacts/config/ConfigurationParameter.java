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

import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.reflect.Method;

import com.metaphacts.config.groups.ConfigurationGroupBase;

/**
 * Annotation describing a configuration parameter and its metadata.
 * 
 * @author Michael Schmidt <ms@metaphacts.com>
 * @see ConfigurationGroupBase
 * @see ConfigurationUtil#toConfigurationParameter(String, String, boolean)
 */
@Retention(RetentionPolicy.RUNTIME)
public @interface ConfigurationParameter {
    /**
     * The name of the parameter.
     * <p>
     * Note that for legacy reasons for now we allow it to be unset. In such case
     * the name is inferred from the configuration {@link Method}.
     * </p>
     * 
     * @return the name of the configuration parameter. For legacy reasons we
     *         support this value to be unset.
     */
    public String name() default "";

    /**
     * The description of the parameter
     * 
     * @return the optional description. Default: empty String
     */
    public String desc() default "";

    /**
     * Whether a restart is required for this configuration parameter to be active
     * 
     * @return whether a restart is required. Default: true
     */
    public boolean restartRequired() default true;
    
    /**
     * The visibility level of settings, e.g. whether they are exposed in the UI and
     * documentation
     * 
     * @return
     */
    public VisibilityLevel visibilityLevel() default VisibilityLevel.simple;

    public static enum VisibilityLevel {
        /**
         * Default visibility level.
         */
        simple,
        /**
         * Can be used to mark more advanced settings.
         */
        advanced,
        /**
         * Can be used to mark experimental settings (e.g. which will not show up in the
         * documentation)
         */
        experimental;
    }
}