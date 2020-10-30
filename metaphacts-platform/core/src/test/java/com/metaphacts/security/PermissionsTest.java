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

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.io.IOException;
import java.io.InputStream;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

import org.apache.commons.io.IOUtils;
import org.apache.commons.lang.StringUtils;
import org.junit.Test;

import com.google.common.collect.Sets;

public class PermissionsTest {

    @Test
    public void loadExampleFromResourcesTest() throws IOException {
        String resourceDirString = "com/metaphacts/security/aclhelp/";
        Set<String> filesInResourceFolder = new HashSet<String>(IOUtils.readLines(
                this.getClass().getClassLoader().getResourceAsStream(resourceDirString),
                StandardCharsets.UTF_8));
        Set<String> filesReferencedInAnnotations = Sets.newHashSet();
        Set<Field> fields = Sets.newHashSet();
        for (Class<?> declaredClasses : Permissions.class.getDeclaredClasses()) {
            // nested enums
            for (Class<?> enumClass : declaredClasses.getDeclaredClasses()) {
                fields.addAll(Arrays.asList(enumClass.getFields()));
            }
            fields.addAll(Arrays.asList(declaredClasses.getDeclaredFields()));

        }

        for (Field field : fields) {
            if (field.isAnnotationPresent(PermissionsDocField.class)) {
                if (!field.getAnnotation(PermissionsDocField.class).example().equals("")) {
                    String resourceName = field.getAnnotation(PermissionsDocField.class).example();
                    filesReferencedInAnnotations
                            .add(StringUtils.substringAfterLast(resourceName, "/"));
                    InputStream is = this.getClass().getResourceAsStream(resourceName);

                    assertTrue("Referenced example resource file contains content",
                            StringUtils.isNotEmpty(IOUtils.toString(is, StandardCharsets.UTF_8)));
                }
            }
        }

        assertTrue(filesReferencedInAnnotations.size() > 0);
        assertEquals(filesReferencedInAnnotations.size(), filesInResourceFolder.size());

        if (!filesReferencedInAnnotations.containsAll(filesInResourceFolder)) {
            fail("The following permission example files are in the resource classpath but not used in any of the annotations: "
                    + Sets.difference(filesInResourceFolder, filesReferencedInAnnotations));
        }

        if (!filesInResourceFolder.containsAll(filesReferencedInAnnotations)) {
            fail("The following example files are referenced from annotations but not in the resource classpath: "
                    + Sets.difference(filesReferencedInAnnotations, filesInResourceFolder));
        }

    }
}
