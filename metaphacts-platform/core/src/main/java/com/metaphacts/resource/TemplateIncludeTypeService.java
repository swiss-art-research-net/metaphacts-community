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

import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

import javax.inject.Inject;

import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Resource;
import org.eclipse.rdf4j.repository.Repository;

import com.metaphacts.cache.TemplateIncludeCache;
import com.metaphacts.config.NamespaceRegistry;
import com.metaphacts.config.groups.UIConfiguration;
import com.metaphacts.util.Orderable;
import com.metaphacts.util.OrderableComparator;

/**
 * This implementation fetches the set of types from the
 * {@link TemplateIncludeCache} which in turn uses a SPARQL query defined in
 * {@link UIConfiguration#getTemplateIncludeQuery()}.
 * 
 * <p>
 * Note: this implementation exists for backwards compatibility. See
 * {@link DefaultTypeService} for the preferred implementation. This
 * implementation might be removed at any time.
 * </p>
 * 
 * @author Wolfgang Schell <ws@metaphacts.com>
 */
public class TemplateIncludeTypeService implements TypeService, Orderable {

    protected TemplateIncludeCache templateIncludeCache;
    protected NamespaceRegistry namespaceRegistry;

    @Inject
    public TemplateIncludeTypeService() {
    }

    @Inject
    public void setTemplateIncludeCache(TemplateIncludeCache templateIncludeCache) {
        this.templateIncludeCache = templateIncludeCache;
    }

    @Inject
    public void setNamespaceRegistry(NamespaceRegistry namespaceRegistry) {
        this.namespaceRegistry = namespaceRegistry;
    }

    @Override
    public Iterable<IRI> getTypes(IRI resource, Repository repository) {
        if (templateIncludeCache == null) {
            return Collections.emptyList();
        }
        LinkedHashSet<Resource> types = templateIncludeCache.getTypesForIncludeScheme(repository, resource,
                Optional.ofNullable(namespaceRegistry));
        return types.stream().filter(type -> type instanceof IRI).map(type -> (IRI) type).collect(Collectors.toList());
    }

    @Override
    public Map<IRI, Optional<Iterable<IRI>>> getAllTypes(Iterable<? extends IRI> resourceIris, Repository repository) {
        return StreamSupport.stream(resourceIris.spliterator(), false).collect(Collectors
                .<IRI, IRI, Optional<Iterable<IRI>>>toMap(iri -> iri, iri -> Optional.of(getTypes(iri, repository))));
    }

    @Override
    public int getOrder() {
        return OrderableComparator.MIDDLE + 5;
    }

}
