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
package com.metaphacts.services.storage.api;

import java.time.Instant;

import javax.annotation.Nullable;

import com.metaphacts.services.storage.StorageUtils;

/**
 * Represents metadata stored with object in {@link ObjectStorage}.
 */
public final class ObjectMetadata {

    public static class ObjectMetadataBuilder {

        public static ObjectMetadataBuilder create() {
            return new ObjectMetadataBuilder();
        }

        public static ObjectMetadataBuilder defaultMetadata() {
            String author = StorageUtils.currentUsername().orElse(null);
            return new ObjectMetadataBuilder().withAuthor(author);
        }

        private final ObjectMetadata metadata = new ObjectMetadata();

        public ObjectMetadataBuilder withAuthor(String author) {
            metadata.author = author;
            return this;
        }

        public ObjectMetadataBuilder withCreationDate(Instant creationDate) {
            metadata.creationDate = creationDate;
            return this;
        }

        public ObjectMetadataBuilder withTitle(String title) {
            metadata.title = title;
            return this;
        }

        public ObjectMetadataBuilder withComment(String comment) {
            metadata.comment = comment;
            return this;
        }
        
        public ObjectMetadata build() {
            return metadata;
        }
    }
    @Nullable
    private String author;
    @Nullable
    private Instant creationDate;
    @Nullable
    private String title;
    @Nullable
    private String comment;

    public ObjectMetadata() {}

    /**
     * 
     * @param author
     * @param creationDate
     * @note use {@link ObjectMetadataBuilder} instead
     */
    public ObjectMetadata(
        @Nullable String author,
        @Nullable Instant creationDate
    ) {
        this.author = author;
        this.creationDate = creationDate;
    }

    /**
     * Object author's username.
     */
    @Nullable
    public String getAuthor() {
        return author;
    }

    /**
     * Object revision creation date.
     *
     * <p>This field is ignored when providing source metadata for new revision.</p>
     */
    @Nullable
    public Instant getCreationDate() {
        return creationDate;
    }

    /**
     * The optional title for the object's revision (e.g. a Git summary message)
     * <p>
     * Note: the title may be a substring of the {@link #getComment()}.
     * </p>
     * 
     * @return
     */
    public String getTitle() {
        return title;
    }

    /**
     * The optional comment for the object's revision (e.g. a full Git commit
     * message)
     * 
     * @return
     */
    @Nullable
    public String getComment() {
        return comment;
    }

    public ObjectMetadata withCurrentDate() {
        return new ObjectMetadata(author, Instant.now());
    }

    public static ObjectMetadata empty() {
        return new ObjectMetadata(null, null);
    }
}
