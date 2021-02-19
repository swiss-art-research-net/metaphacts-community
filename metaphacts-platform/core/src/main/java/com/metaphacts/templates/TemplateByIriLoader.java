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

import java.util.Optional;

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.ValueFactory;
import org.eclipse.rdf4j.model.impl.SimpleValueFactory;

import com.metaphacts.config.NamespaceRegistry;
import com.metaphacts.services.storage.api.ObjectKind;
import com.metaphacts.services.storage.api.PlatformStorage;
import com.metaphacts.services.storage.api.StoragePath;

public class TemplateByIriLoader extends FromStorageLoader {
    protected final NamespaceRegistry ns;

    public TemplateByIriLoader(
        PlatformStorage platformStorage,
        NamespaceRegistry ns
    ) {
        super(platformStorage);
        this.ns = ns;
    }

    @Override
    protected StoragePath resolveLocation(String location) {
        IRI templateIri = constructTemplateIri(location);
        return templatePathFromIri(templateIri);
    }

    protected IRI constructTemplateIri(String location) {
        String prefix = this.getPrefix();
        if (location.startsWith(prefix)) {
            location = location.substring(prefix.length());
        }
        location = location.trim();

        boolean isTemplate = location.startsWith(TemplateUtil.TEMPLATE_PREFIX);

        String plainLocation = isTemplate
            ? location.substring(TemplateUtil.TEMPLATE_PREFIX.length())
            : location;

        ValueFactory vf = SimpleValueFactory.getInstance();
        IRI iri = plainLocation.startsWith("http")
            ? SimpleValueFactory.getInstance().createIRI(plainLocation)
            : ns.resolveToIRI(plainLocation).orElse(vf.createIRI(ns.getDefaultNamespace(), plainLocation));

        IRI templateIri = isTemplate ? vf.createIRI(TemplateUtil.TEMPLATE_PREFIX + iri.stringValue()) : iri;
        return templateIri;
    }

    public static StoragePath templatePathFromIri(IRI templateIri) {
        return ObjectKind.TEMPLATE.resolve(StoragePath.encodeIri(templateIri)).addExtension(".html");
    }

    public static Optional<IRI> templateIriFromPath(StoragePath objectPath) {
        if (!objectPath.hasExtension(".html")) {
            return Optional.empty();
        }
        return ObjectKind.TEMPLATE
            .relativize(objectPath.stripExtension(".html"))
            .map(StoragePath::decodeIri);
    }
}
