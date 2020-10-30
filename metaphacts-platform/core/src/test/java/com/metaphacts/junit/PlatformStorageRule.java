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
package com.metaphacts.junit;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

import javax.inject.Inject;

import org.eclipse.rdf4j.model.IRI;
import org.junit.rules.ExternalResource;

import com.metaphacts.services.storage.api.ObjectStorage;
import com.metaphacts.services.storage.api.StorageException;
import com.metaphacts.services.storage.api.StoragePath;
import com.metaphacts.templates.TemplateByIriLoader;
import com.metaphacts.ui.templates.ST;

public class PlatformStorageRule extends ExternalResource {
    private TestPlatformStorage platformStorage;

    @Inject
    public PlatformStorageRule(TestPlatformStorage platformStorage) {
        this.platformStorage = platformStorage;
    }

    public TestPlatformStorage getPlatformStorage() {
        return platformStorage;
    }

    public ObjectStorage getObjectStorage() {
        return platformStorage.getMainStorage();
    }

    public ObjectStorage getObjectStorage(String storageId) {
        return platformStorage.getStorage(storageId);
    }

    @Override
    protected void before() throws Throwable {
        super.before();
        platformStorage.reset();
    }

    /**
     * Stores the content of the resource to the storage.
     * 
     * @param targetPath
     * @param sourceClass
     * @param resourceFileName the absolute resource path
     * @throws IOException
     */
    public void storeContentFromResource(StoragePath targetPath, String resourceFileName) throws IOException {
        storeContentFromResource(targetPath, PlatformStorageRule.class, resourceFileName);
    }

    /**
     * Stores the content of the resource to the storage.
     * 
     * @param targetPath
     * @param sourceClass
     * @param resourceFileName the absolute resource path
     * @throws IOException
     */
    public void storeContentFromResource(StoragePath targetPath, String resourceFileName, String storageId)
            throws IOException {
        storeContentFromResource(targetPath, PlatformStorageRule.class, resourceFileName, storageId);
    }

    /**
     * Stores the content of the resource to the storage.
     * 
     * @param targetPath
     * @param sourceClass
     * @param resourceFileName the resource name (either relative to sourceClass or
     *                         absolute)
     * @throws IOException
     */
    public void storeContentFromResource(StoragePath targetPath, Class<?> sourceClass, String resourceFileName)
            throws IOException {
        storeContentFromResource(targetPath, sourceClass, resourceFileName, TestPlatformStorage.STORAGE_ID);
    }

    /**
     * Stores the content of the resource to the storage.
     * 
     * @param targetPath
     * @param sourceClass
     * @param resourceFileName the resource name (either relative to sourceClass or
     *                         absolute)
     * @throws IOException
     */
    public void storeContentFromResource(StoragePath targetPath, Class<?> sourceClass, String resourceFileName,
            String storageId)
            throws IOException {
        try (InputStream in = sourceClass.getResourceAsStream(resourceFileName)) {
            storeContent(targetPath, in, -1, storageId);
        }
    }

    public void storeContent(StoragePath targetPath, String content, String storageId) {

        byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
        storeContent(targetPath, new ByteArrayInputStream(bytes), bytes.length, storageId);
    }

    public void storeContent(StoragePath targetPath, InputStream in, int length, String storageId) {
        try {
            ObjectStorage storage = getObjectStorage(storageId);
            storage.appendObject(targetPath, getPlatformStorage().getDefaultMetadata(), in, length);
        } catch (StorageException e) {
            throw new IllegalStateException(e);
        }
    }

    public void storeNewTemplateRevision(IRI templateIri, String content) throws IOException {
        storeContent(TemplateByIriLoader.templatePathFromIri(templateIri), content, TestPlatformStorage.STORAGE_ID);
    }

    public void mockPageLayoutTemplate(String name) {
        String content = "Test Page Layout Template: '" + name + "'.";
        byte[] bytes = content.getBytes();
        try {
            getObjectStorage().appendObject(
                ST.objectIdForTemplate(name),
                getPlatformStorage().getDefaultMetadata(),
                new ByteArrayInputStream(bytes),
                bytes.length
            );
        } catch (StorageException e) {
            throw new RuntimeException(e);
        }
    }
}
