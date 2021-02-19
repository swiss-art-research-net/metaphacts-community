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
package com.metaphacts.templates.helper;

import static com.google.common.base.Preconditions.checkNotNull;

import java.io.IOException;
import java.io.InputStream;
import java.util.Optional;
import java.util.Set;

import org.apache.commons.io.IOUtils;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import com.github.jknack.handlebars.Options;
import com.google.common.base.Charsets;
import com.google.common.collect.Lists;
import com.google.common.collect.Sets;
import com.metaphacts.services.storage.api.ObjectKind;
import com.metaphacts.services.storage.api.ObjectRecord;
import com.metaphacts.services.storage.api.ObjectStorage;
import com.metaphacts.services.storage.api.PlatformStorage;

/**
 * A handlebars helper to retrieve the contents of default bundled page-layout
 * files for the current distribution.
 * 
 * <p>
 * Supported files are <i>html-head.hbs</i>, <i>header.hbs</i>, <i>login.hbs</i>
 * and <i>footer.hbs</i>.
 * </p>
 * 
 * <p>
 * Usage:
 * </p>
 * 
 * <pre>
 * [[pageLayout "header.hbs"]]
 * </pre>
 * 
 * @author Andreas Schwarte
 *
 */
public class PageLayoutHelperSource {

    private static final Logger logger = LogManager.getLogger(PageLayoutHelperSource.class);

    private static final Set<String> SUPPORTED_FILES = Sets.newHashSet("html-head.hbs", "header.hbs", "login.hbs",
            "footer.hbs");

    private final PlatformStorage platformStorage;


    public PageLayoutHelperSource(PlatformStorage platformStorage) {
        super();
        this.platformStorage = platformStorage;
    }

    public String pageLayout(String fileName, Options options) {

        checkNotNull(fileName, "File name must not be null");
        fileName = fileName.trim();

        if (!SUPPORTED_FILES.contains(fileName)) {
            return "[ERROR]: file name " + fileName + " not supported.";
        }

        for (String storageId : Lists.newArrayList("metaphactory", "metaphacts-platform")) {
            try {
                ObjectStorage storage = platformStorage.getStorage(storageId);
                Optional<ObjectRecord> obj = storage.getObject(ObjectKind.CONFIG.resolve("page-layout/" + fileName),
                        null);
                if (obj.isPresent()) {
                    try (InputStream in = obj.get().getLocation().readContent()) {
                        return IOUtils.toString(in, Charsets.UTF_8);
                    }
                }
            } catch (RuntimeException e) {
                logger.debug("Could not find storage. " + e.getMessage());
                logger.trace("Details:", e);
                // continue with next storage
            } catch (IOException e) {
                logger.warn("Failed to read contents of " + fileName + ": " + e.getMessage());
                logger.debug("Details: ", e);
                return "[ERROR]: could not retrieve contents of of " + fileName;
            }
        }

        return "[ERROR]: could not retrieve contents of of " + fileName;
    }
}
