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
package com.metaphacts.templates;

import java.io.IOException;
import java.nio.charset.Charset;
import java.time.Instant;

import com.github.jknack.handlebars.io.AbstractTemplateLoader;
import com.github.jknack.handlebars.io.ReloadableTemplateSource;
import com.github.jknack.handlebars.io.TemplateSource;
import com.metaphacts.services.storage.StorageUtils;
import com.metaphacts.services.storage.api.ObjectRecord;
import com.metaphacts.services.storage.api.PlatformStorage;
import com.metaphacts.services.storage.api.StoragePath;

public abstract class FromStorageLoader extends AbstractTemplateLoader {
    protected final PlatformStorage storage;

    public FromStorageLoader(PlatformStorage storage) {
        this.storage = storage;
    }

    protected abstract StoragePath resolveLocation(String location);

    @Override
    public TemplateSource sourceAt(String location) throws IOException {
        StoragePath resolved = resolveLocation(location);
        // handlebars library uses exception message as template location in their not-found-error,
        // so the message should be phased as a template location noun
        PlatformStorage.FindResult found = storage
            .findObject(resolved)
            .orElseThrow(() -> new TemplateNotFoundException(
                "Storage object \"" + resolved.toString() + "\""
            ));
        return new ReloadableTemplateSource(
            new StorageTemplateSource(location, found.getRecord())
        );
    }

    protected static class StorageTemplateSource implements TemplateSource {
        private String filename;
        private ObjectRecord record;

        public StorageTemplateSource(String filename, ObjectRecord record) {
            this.filename = filename;
            this.record = record;
        }

        @Override
        public String content(Charset charset) throws IOException {
            return StorageUtils.readTextContent(record);
        }

        @Override
        public String filename() {
            return filename;
        }

        @Override
        public long lastModified() {
            Instant date = record.getMetadata().getCreationDate();
            return date == null ? 0 : date.toEpochMilli();
        }
    }

    public class TemplateNotFoundException extends IOException {
        private static final long serialVersionUID = 8436858632114909521L;

        public TemplateNotFoundException(String message) {
            super(message);
        }
    }
}
