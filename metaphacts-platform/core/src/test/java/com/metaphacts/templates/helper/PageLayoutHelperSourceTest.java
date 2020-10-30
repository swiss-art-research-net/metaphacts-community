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
package com.metaphacts.templates.helper;

import org.junit.Assert;
import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;

import com.google.inject.Inject;
import com.metaphacts.junit.AbstractIntegrationTest;
import com.metaphacts.junit.Log4jRule;
import com.metaphacts.junit.PlatformStorageRule;
import com.metaphacts.services.storage.api.ObjectKind;


public class PageLayoutHelperSourceTest extends AbstractIntegrationTest {

    @Inject
    @Rule
    public PlatformStorageRule platformStorageRule;

    @Rule
    public Log4jRule log4j = Log4jRule.create();

    @Before
    public void setup() throws Exception {

        platformStorageRule.getPlatformStorage().addStorage("metaphactory");
        platformStorageRule.getPlatformStorage().addStorage("metaphacts-platform");
    }

    @Test
    public void testSimple() throws Exception {

        String contentHeader = "content of header.hbs";
        storeFile("header.hbs", contentHeader, "metaphactory");
        String contentFooter = "content of footer.hbs";
        storeFile("footer.hbs", contentFooter, "metaphacts-platform");

        Assert.assertEquals(contentHeader, run("header.hbs"));
        Assert.assertEquals(contentFooter, run("footer.hbs"));
    }


    @Test
    public void testOverride() throws Exception {

        // metaphactory has precedence
        storeFile("header.hbs", "from metaphactory", "metaphactory");
        storeFile("header.hbs", "from metaphts-platform", "metaphacts-platform");

        Assert.assertEquals("from metaphactory", run("header.hbs"));
    }

    @Test
    public void testInvalidFileName() throws Exception {
        Assert.assertEquals("[ERROR]: file name invalidFilename.hbs not supported.", run("invalidFilename.hbs"));
    }

    private String run(String fileName) {
        return new PageLayoutHelperSource(platformStorageRule.getPlatformStorage()).pageLayout(fileName, null);
    }

    private void storeFile(String fileName, String content, String storageId) {
        platformStorageRule.storeContent(ObjectKind.CONFIG.resolve("page-layout/" + fileName), content, storageId);
    }
}
