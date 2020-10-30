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
package com.metaphacts.rest.swagger;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import javax.inject.Singleton;
import javax.ws.rs.ApplicationPath;
import javax.ws.rs.core.Application;

/**
 * Registry for OpenAPI specifications.
 * 
 * @author Stefan Schmitt <stefan.schmitt@metaphacts.com>
 */
@Singleton
public class SwaggerRegistry {

    private List<Application> apps = new ArrayList<>();
    private List<ApiDefinition> apiDefs = new ArrayList<>();

    /**
     * Registers an OpenAPI spec from an application.
     * 
     * @param app  to register
     * @param name display name
     */
    public void addApp(Application app, String name) {
        apps.add(app);

        Class<? extends Application> appClass = app.getClass();
        ApplicationPath appPath = (ApplicationPath) appClass.getAnnotation(ApplicationPath.class);
        if (appPath != null) {
            String path = "/" + appPath.value() + "/openapi.json";

            if (name == null) {
                name = appClass.getSimpleName();
            }
            apiDefs.add(new ApiDefinition(path, name));
        }
    }

    /**
     * @return all registered OpenAPI specs.
     */
    public List<ApiDefinition> getApiDefinitions() {
        return Collections.unmodifiableList(apiDefs);
    }

    public static class ApiDefinition {
        private String path;
        private String name;

        public ApiDefinition(String path, String name) {
            super();
            this.path = path;
            this.name = name;
        }
        
        public String getPath() {
            return path;
        }
        
        public String getName() {
            return name;
        }
    }
}
