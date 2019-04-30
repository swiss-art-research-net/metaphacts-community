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

package com.metaphacts.templates;

import com.github.jknack.handlebars.io.AbstractTemplateLoader;
import com.github.jknack.handlebars.io.ReloadableTemplateSource;
import com.github.jknack.handlebars.io.TemplateSource;
import com.metaphacts.services.storage.StorageUtils;
import com.metaphacts.services.storage.api.ObjectKind;
import com.metaphacts.services.storage.api.ObjectRecord;
import com.metaphacts.services.storage.api.PlatformStorage;

import java.io.IOException;
import java.time.Instant;

public abstract class FromStorageLoader extends AbstractTemplateLoader {
    protected final PlatformStorage storage;

    public FromStorageLoader(PlatformStorage storage) {
        this.storage = storage;
    }

    protected abstract ResolvedObject resolveLocation(String location);

    @Override
    public TemplateSource sourceAt(String location) throws IOException {
        ResolvedObject resolved = resolveLocation(location);
        PlatformStorage.FindResult found = storage
            .findObject(resolved.kind, resolved.objectId)
            .orElseThrow(() -> new TemplateNotFoundException(
                "Template \"" + location + "\" does not exist."));
        return new ReloadableTemplateSource(
            new StorageTemplateSource(location, found.getRecord())
        );
    }

    protected static class ResolvedObject {
        public final ObjectKind kind;
        public final String objectId;

        public ResolvedObject(ObjectKind kind, String objectId) {
            this.kind = kind;
            this.objectId = objectId;
        }
    }

    protected static class StorageTemplateSource implements TemplateSource {
        private String filename;
        private ObjectRecord record;

        public StorageTemplateSource(String filename, ObjectRecord record) {
            this.filename = filename;
            this.record = record;
        }

        @Override
        public String content() throws IOException {
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
        public TemplateNotFoundException(String message) {
            super(message);
        }
    }
}
