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
package com.metaphacts.resource;

import java.util.Optional;

import javax.inject.Inject;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.rdf4j.model.IRI;

import com.metaphacts.config.NamespaceRegistry;
import com.metaphacts.services.storage.api.ObjectKind;
import com.metaphacts.services.storage.api.ObjectStorage;
import com.metaphacts.services.storage.api.PlatformStorage;
import com.metaphacts.services.storage.api.PlatformStorage.FindResult;
import com.metaphacts.services.storage.api.StorageException;
import com.metaphacts.services.storage.api.StoragePath;
import com.metaphacts.templates.TemplateByIriLoader;

/**
 * Template loader for description templates.
 * 
 * <p>
 * Description templates are loaded from the {@code data/templates/} folder in a
 * {@link ObjectStorage}. Templates are expected to have a
 * {@value #DESCRIPTION_TEMPLATE_EXTENSION} file extension.
 * </p>
 * 
 * @author Wolfgang Schell <ws@metaphacts.com>
 */
public class DescriptionTemplateByIriLoader extends TemplateByIriLoader {
    private static final Logger logger = LogManager.getLogger(DescriptionTemplateByIriLoader.class);

    public static final String DESCRIPTION_TEMPLATE_EXTENSION = ".description.txt";

    @Inject
    public DescriptionTemplateByIriLoader(PlatformStorage platformStorage, NamespaceRegistry ns) {
        super(platformStorage, ns);
    }

    public boolean hasDescriptionTemplate(String location) {
        StoragePath resolved = resolveLocation(location);

        try {
            Optional<FindResult> findResult = storage.findObject(resolved);
            return findResult.isPresent();
        } catch (StorageException e) {
            logger.warn("Failed to determine existence of description template for {}: {}", location, e.getMessage());
            logger.debug("Details: ", e);
            return false;
        }
    }

    @Override
    protected StoragePath resolveLocation(String location) {
        IRI templateIri = constructTemplateIri(location);
        return descriptionTemplatePathFromIri(templateIri);
    }

    public static StoragePath descriptionTemplatePathFromIri(IRI templateIri) {
        return ObjectKind.TEMPLATE.resolve(StoragePath.encodeIri(templateIri)).addExtension(DESCRIPTION_TEMPLATE_EXTENSION);
    }
}
