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
package com.metaphacts.security;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.lang.reflect.Field;
import java.util.ArrayList;


public class PermissionsParameterInfo {

    private String acl;
    private String description;
    private String example;

    public String getExample() {
        return example;
    }
    public void setExample(String example) {
        this.example = example;
    }
    public String getAcl() {
        return acl;
    }
    public void setAcl(String aclString) {
        this.acl = aclString;
    }
    public String getDescription() {
        return description;
    }
    public void setDescription(String description) {
        this.description = description;
    }

    /**
     * @param permissionGroup
     * @param permissions
     * Iterates over all the fields annotated with PermissionsDocField and checks for
     * description, pattern and example.
     */
    public void setAllAnnotationParameters(Class<?> permissionGroup, ArrayList<PermissionsParameterInfo> permissions) {
        for (Class<?> enumClass : permissionGroup.getDeclaredClasses()) {
            for (Field field : enumClass.getFields()) {
                setFieldParameterValues(field, permissionGroup, permissions);
            }
        }
        for (Field field: permissionGroup.getFields()) {
            setFieldParameterValues(field, permissionGroup, permissions);
        }
    }
    
    private void setFieldParameterValues(Field field, Class<?> permissionGroup, ArrayList<PermissionsParameterInfo> permissions) {
    	if (field.getAnnotation(PermissionsDocField.class) != null) {
            PermissionsParameterInfo permInfo = new PermissionsParameterInfo();
            permInfo.setDescription(field.getAnnotation(PermissionsDocField.class).desc());
            
            try {
                if (field.getAnnotation(PermissionsDocField.class).pattern().equals("")) {
                    acl = field.get(permissionGroup).toString();
                } else {
                    acl = field.getAnnotation(PermissionsDocField.class).pattern();
                }
                permInfo.setAcl(acl);
            } catch (Exception e) {
            	throw new RuntimeException(e);
            }
            if (!field.getAnnotation(PermissionsDocField.class).example().equals("")) {
            	loadExampleFromResources(field, permInfo);
            }
            permissions.add(permInfo);
        }
    }
    
    private void loadExampleFromResources(Field field, PermissionsParameterInfo permInfo) {
        try {
            BufferedReader bufferedReader = null;
            StringBuilder stringBuilder = new StringBuilder();
            Class<?> classloader = this.getClass();
            InputStream is = classloader.getResourceAsStream(field.getAnnotation(PermissionsDocField.class).example());
            InputStreamReader inputReader = new InputStreamReader(is);
            bufferedReader = new BufferedReader(inputReader);
            String line;
            while ((line =bufferedReader.readLine()) != null) {
                stringBuilder.append(line+"\n");
            }
            permInfo.setExample(stringBuilder.toString());
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
