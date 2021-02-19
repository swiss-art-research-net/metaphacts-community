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
package com.metaphacts.util;

import java.io.IOException;
import java.io.InputStream;
import java.util.Optional;
import java.util.jar.Manifest;

import javax.servlet.ServletContext;

public class SystemPropUtils {

    public static class PlatformMetaData {
        public String getVersion() {
            return version;
        }

        public String getGitHash() {
            return gitHash;
        }

        public String getBuildTimestamp() {
            return buildTimestamp;
        }

        public String getBuildBranch() {
            return buildBranch;
        }

        public PlatformMetaData(String version, String gitHash, String buildTimestamp, String buildBranch) {
            super();
            this.version = version;
            this.gitHash = gitHash;
            this.buildBranch = buildBranch;
            this.buildTimestamp = buildTimestamp;
        }

        private String version;
        private String gitHash;
        private String buildTimestamp;
        private String buildBranch;
    }

    /**
     * Get platform version from the MANIFEST.MF file in the WAR. We get it through ServletContext.
     */
    static public PlatformMetaData getVersionFromManifest(ServletContext sc) {
        InputStream inputStream = sc.getResourceAsStream("/META-INF/MANIFEST.MF");
        if (inputStream != null) {
            Manifest manifest;
            try {
                manifest = new Manifest(inputStream);
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
            Optional<String> version = Optional.ofNullable(manifest.getMainAttributes()
                    .getValue(java.util.jar.Attributes.Name.IMPLEMENTATION_VERSION));
            Optional<String> gitHash = Optional
                    .ofNullable(manifest.getMainAttributes().getValue("Build-Revision"));
            Optional<String> buildTimestamp = Optional
                    .ofNullable(manifest.getMainAttributes().getValue("Build-Timestamp"));
            Optional<String> buildBranch = Optional.ofNullable(manifest.getMainAttributes().getValue("Build-Branch"));
            return new PlatformMetaData(version.orElse("develop-build"),
                    gitHash.orElse("develop-build"), buildTimestamp.orElse("n/a"), buildBranch.orElse("develop-build"));
        } else {
            return new PlatformMetaData("develop-build", "develop-build", "n/a", "workspace");
        }
    }

}
