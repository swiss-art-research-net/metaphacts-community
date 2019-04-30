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

import org.apache.commons.lang.StringUtils;

import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Represents file path mapping for storage implementations.
 *
 * <p>This mapping allows to add flexibility when configuring implementations to preserve backwards
 * compatibility or limit access to specific paths.</p>
 */
public abstract class PathMapping {
    public static final String SEPARATOR = "/";

    /**
     * Disallowed path traversal components such as {@code .} or {@code ..}.
     */
    private static final Pattern NON_CANONICAL_PATH_FRAGMENT = Pattern.compile("[^/]\\.\\.?[/$]");

    /**
     * @return relative path prefix for all objects of specified kind, e.g. "foo/folder/"
     */
    public abstract String getPathPrefix(ObjectKind kind);

    /**
     * @return suffix for object path (usually file extension prefixed with a dot, e.g. ".html")
     */
    protected String getPathSuffix(ObjectKind kind) {
        return "";
    }

    /**
     * @return relative path to object with file extension at the end if applicable,
     * e.g. "foo/bar/baz.html"
     */
    public Optional<String> pathForObjectId(ObjectKind kind, String objectId) {
        return Optional.of(getPathPrefix(kind) + objectId + getPathSuffix(kind));
    }

    public Optional<String> objectIdFromPath(ObjectKind kind, String path) {
        String prefix = getPathPrefix(kind);
        String suffix = getPathSuffix(kind);
        int otherLength = prefix.length() + suffix.length();
        if (path.startsWith(prefix) && path.endsWith(suffix) && path.length() > otherLength) {
            int start = prefix.length();
            int end = path.length() - suffix.length();
            String objectId = path.substring(start, end);
            return Optional.of(objectId);
        } else {
            return Optional.empty();
        }
    }

    public static class PrefixedPathMapping extends Default {
        private String prefix;

        public PrefixedPathMapping(String prefix) {
            this.prefix = prefix.endsWith("/") ? prefix : prefix+"/";
        }

        public String getPathPrefix(ObjectKind kind) {
            return prefix + super.getPathPrefix(kind);
        }
    }

    public static class Default extends PathMapping {
        @Override
        public String getPathPrefix(ObjectKind kind) {
            switch (kind) {
                case TEMPLATE: return "data/templates/";
                default: return kind.locationKey + "/";
            }
        }

        @Override
        protected String getPathSuffix(ObjectKind kind) {
            switch (kind) {
                case TEMPLATE: return ".html";
                default: return "";
            }
        }
    }

    public static class RemovePrefixFallback extends PathMapping {
        private final ObjectKind targetKind;
        private final String removedPrefix;

        public RemovePrefixFallback(ObjectKind targetKind, String removedPrefix) {
            this.targetKind = targetKind;
            this.removedPrefix = removedPrefix;
        }

        @Override
        public String getPathPrefix(ObjectKind kind) {
            return "";
        }

        @Override
        public Optional<String> pathForObjectId(ObjectKind kind, String objectId) {
            if (kind == targetKind && objectId.startsWith(removedPrefix)) {
                return Optional.of(StringUtils.removeStart(objectId, removedPrefix));
            } else {
                return Optional.empty();
            }
        }

        @Override
        public Optional<String> objectIdFromPath(ObjectKind kind, String path) {
            if (kind != targetKind) {
                return Optional.empty();
            }
            return Optional.of(removedPrefix + path);
        }
    }

    public static void throwIfNonCanonical(String storagePath) {
        if (NON_CANONICAL_PATH_FRAGMENT.matcher(storagePath).find()) {
            throw new RuntimeException("Invalid non-canonical storage path \"" + storagePath + "\"");
        }
    }

    /**
     * @return last component of object path (after last separator), e.g.
     * "foo/bar/baz.html" -> "baz.html"
     */
    public static String nameWithExtension(String objectPath) {
        int lastSeparatorIndex = objectPath.lastIndexOf(PathMapping.SEPARATOR);
        String onlyFilename = lastSeparatorIndex < 0
            ? objectPath : objectPath.substring(lastSeparatorIndex + 1);
        return onlyFilename;
    }

    /**
     * @return last component of object path (after last separator) without file extension, e.g.
     * "foo/bar/baz.html" -> "baz"
     */
    public static String nameWithoutExtension(String objectPath) {
        String withExtension = nameWithExtension(objectPath);
        int lastDotIndex = withExtension.lastIndexOf('.');
        return lastDotIndex < 0 ? withExtension : withExtension.substring(0, lastDotIndex);
    }
}
