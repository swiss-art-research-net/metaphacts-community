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

package com.metaphacts.services.storage.file;

import com.google.common.collect.ImmutableList;
import com.metaphacts.services.storage.api.*;
import org.apache.commons.io.IOUtils;

import javax.annotation.Nullable;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Thread-safe in-memory object storage implementation.
 */
public class InMemoryStorage implements ObjectStorage {
    private final Map<ObjectKind, Map<String, Record>> buckets = new HashMap<>();

    public InMemoryStorage() {
        for (ObjectKind kind : ObjectKind.values()) {
            buckets.put(kind, new HashMap<>());
        }
    }

    private static class Record {
        public final ObjectKind kind;
        public final String id;
        public final SortedMap<Integer, ObjectRevision> revisions = new TreeMap<>();

        public Record(ObjectKind kind, String id) {
            this.kind = kind;
            this.id = id;
        }
    }

    private static class ObjectRevision {
        public final int key;
        public final ObjectMetadata metadata;
        public final byte[] content;

        public ObjectRevision(int key, ObjectMetadata metadata, byte[] content) {
            this.key = key;
            this.metadata = metadata;
            this.content = content;
        }

        public static int parseKey(String revisionKey) {
            try {
                return Integer.parseInt(revisionKey);
            } catch (NumberFormatException e) {
                return -1;
            }
        }
    }

    private class InMemoryLocation implements StorageLocation {
        private final ObjectRevision revision;

        public InMemoryLocation(ObjectRevision revision) {
            this.revision = revision;
        }

        @Override
        public ObjectStorage getStorage() {
            return InMemoryStorage.this;
        }

        @Override
        public InputStream readContent() throws IOException {
            return new ByteArrayInputStream(revision.content);
        }

        @Override
        public SizedStream readSizedContent() throws IOException {
            return new SizedStream(
                new ByteArrayInputStream(revision.content),
                revision.content.length
            );
        }
    }

    @Override
    public boolean isMutable() {
        return true;
    }

    @Override
    public Optional<ObjectRecord> getObject(ObjectKind kind, String id, @Nullable String revision) throws StorageException {
        Record foundRecord;
        synchronized (buckets) {
            foundRecord = buckets.get(kind).get(id);
        }
        return Optional.ofNullable(foundRecord)
            .flatMap(record -> {
                synchronized (record) {
                    return Optional.ofNullable(
                        revision == null
                            ? record.revisions.get(record.revisions.lastKey())
                            : record.revisions.get(ObjectRevision.parseKey(revision))
                    );
                }
            })
            .map(rev -> new ObjectRecord(
                new InMemoryLocation(rev),
                kind,
                id,
                String.valueOf(rev.key),
                rev.metadata
            ));
    }

    @Override
    public List<ObjectRecord> getRevisions(ObjectKind kind, String id) throws StorageException {
        Record record;
        synchronized (buckets) {
            record = buckets.get(kind).get(id);
        }
        if (record == null) {
            return ImmutableList.of();
        }
        synchronized (record) {
            return record.revisions.values().stream()
                .map(revision -> new ObjectRecord(
                    new InMemoryLocation(revision),
                    kind,
                    id,
                    String.valueOf(revision.key),
                    revision.metadata
                ))
                .collect(Collectors.toList());
        }
    }

    @Override
    public List<ObjectRecord> getAllObjects(ObjectKind kind, String idPrefix) throws StorageException {
        List<Record> records;
        synchronized (buckets) {
            records = buckets.get(kind).values().stream()
                .filter(record -> record.id.startsWith(idPrefix))
                .collect(Collectors.toList());
        }
        List<ObjectRecord> result = new ArrayList<>();
        for (Record record : records) {
            getObject(record.kind, record.id, null).ifPresent(result::add);
        }
        return result;
    }

    @Override
    public ObjectRecord appendObject(
        ObjectKind kind,
        String id,
        ObjectMetadata metadata,
        InputStream content,
        @Nullable Integer contentLength
    ) throws StorageException {
        Record record;
        synchronized (buckets) {
            record = buckets.get(kind).get(id);
            if (record == null) {
                record = new Record(kind, id);
                buckets.get(kind).put(record.id, record);
            }
        }

        byte[] contentAsBytes;
        try {
            contentAsBytes = IOUtils.toByteArray(content);
        } catch (IOException e) {
            throw new StorageException(e);
        }

        ObjectRevision revision;
        synchronized (record) {
            int revisionKey = record.revisions.size();
            revision = new ObjectRevision(revisionKey, metadata.withCurrentDate(), contentAsBytes);
            record.revisions.put(revisionKey, revision);
        }
        return new com.metaphacts.services.storage.api.ObjectRecord(
            new InMemoryLocation(revision),
            record.kind,
            record.id,
            String.valueOf(revision.key),
            revision.metadata
        );
    }

    @Override
    public void deleteObject(ObjectKind kind, String id) throws StorageException {
        synchronized (buckets) {
            buckets.get(kind).remove(id);
        }
    }
}
