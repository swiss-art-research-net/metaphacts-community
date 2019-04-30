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

package com.metaphacts.services.storage.api;

import com.google.common.base.Charsets;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;

import javax.annotation.Nullable;
import java.io.InputStream;
import java.io.UnsupportedEncodingException;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.util.List;
import java.util.Optional;

/**
 * Represents an abstract storage of so-called objects which are BLOBs indexed by {@link ObjectKind}
 * and string IDs and have metadata associated with each one.
 */
public interface ObjectStorage {
    /**
     * @return {@code true} if it's possible to modify storage data through mutation methods
     * {@link #appendObject}, {@link #deleteObject}, etc; {@code false} if storage is read-only
     */
    boolean isMutable();

    /**
     * Fetches an object record for specified kind, ID and (optionally) revision.
     *
     * @param kind target object kind
     * @param id target object ID
     * @param revision object revision to return or latest if {@code null}
     * @return object record with metadata and ability to retrieve the data
     * @throws StorageException if fetching operation failed
     */
    Optional<ObjectRecord> getObject(
        ObjectKind kind,
        String id,
        @Nullable String revision
    ) throws StorageException;

    /**
     * Fetches records for all revisions of objects with specified kind and ID.
     *
     * @param kind kind target object kind
     * @param id target object ID
     * @return object records with metadata and ability to retrieve the data
     * @throws StorageException if fetching operation failed
     */
    List<ObjectRecord> getRevisions(ObjectKind kind, String id) throws StorageException;

    /**
     * Fetches records for objects with specified kind which matches specified ID prefix.
     *
     * @param kind target object kind
     * @param idPrefix target prefix to match at start of full object ID
     * @return object records with metadata and ability to retrieve the data
     * @throws StorageException if fetching operation failed
     */
    List<ObjectRecord> getAllObjects(ObjectKind kind, String idPrefix) throws StorageException;

    /**
     * Either:
     *  - adds new object if it doesn't exists yet;
     *  - adds new revision to existing object;
     *  - replaces current object revision if storage doesn't support versioning.
     *
     * @param kind target object kind
     * @param id target object ID
     * @param metadata metadata of this revision of object
     * @param content new object revision content; automatically closed in
     *                either case of successful or failed operation
     * @param contentLength should be {@code null} or precisely equal to content size in bytes
     * @return new object revision metadata
     * @throws StorageException if appending operation failed
     */
    ObjectRecord appendObject(
        ObjectKind kind,
        String id,
        ObjectMetadata metadata,
        InputStream content,
        @Nullable Integer contentLength
    ) throws StorageException;

    /**
     * Deletes the specified object from storage.
     * Should not throw an exception if object doesn't exists.
     *
     * @throws StorageException if object exists but deleting operation failed
     */
    void deleteObject(ObjectKind kind, String id) throws StorageException;

    /**
     * @return canonical representation of specified IRI as object ID
     */
    static String objectIdFromIri(IRI iri) {
        try {
            return URLEncoder.encode(iri.stringValue(), Charsets.UTF_8.name());
        } catch (UnsupportedEncodingException ex) {
            throw new RuntimeException(ex);
        }
    }

    /**
     * @return IRI represented by specified object ID
     * @throws IllegalArgumentException when object ID is not a canonical representation of an IRI
     */
    static IRI iriFromObjectId(String objectId) {
        try {
            String decodedId = URLDecoder.decode(objectId, Charsets.UTF_8.name());
            ValueFactory vf = SimpleValueFactory.getInstance();
            return vf.createIRI(decodedId);
        } catch (UnsupportedEncodingException ex) {
            throw new RuntimeException(ex);
        }
    }
}
