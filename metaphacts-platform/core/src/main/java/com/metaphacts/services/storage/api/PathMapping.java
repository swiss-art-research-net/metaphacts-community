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
package com.metaphacts.services.storage.api;

import java.util.Optional;

/**
 * Represents file path mapping for storage implementations.
 *
 * <p>This mapping allows to add flexibility when configuring implementations to preserve backwards
 * compatibility or limit access to specific paths.</p>
 */
public abstract class PathMapping {
    /**
     * @return relative path to object with file extension at the end if applicable,
     * e.g. "foo/bar/baz.html"
     */
    public abstract Optional<StoragePath> mapForward(StoragePath path);

    public abstract Optional<StoragePath> mapBack(StoragePath path);

    public static class Default extends PathMapping {
        @Override
        public Optional<StoragePath> mapForward(StoragePath path) {
            return Optional.of(path);
        }

        @Override
        public Optional<StoragePath> mapBack(StoragePath path) {
            return Optional.of(path);
        }
    }

    /**
     * Maps object paths from one path prefix to another.
     */
    public static class MapPrefix extends PathMapping {
        private final PathMapping base;
        private final StoragePath from;
        private final StoragePath to;

        public MapPrefix(PathMapping base, StoragePath from, StoragePath to) {
            this.base = base;
            this.from = from;
            this.to = to;
        }

        @Override
        public Optional<StoragePath> mapForward(StoragePath path) {
            return base.mapForward(path)
                .flatMap(from::relativize)
                .map(to::resolve);
        }

        @Override
        public Optional<StoragePath> mapBack(StoragePath path) {
            return to.relativize(path)
                .map(from::resolve)
                .flatMap(base::mapBack);
        }
    }
}
