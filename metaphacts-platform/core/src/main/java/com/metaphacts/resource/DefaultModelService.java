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

import java.util.List;
import java.util.Optional;

import javax.inject.Inject;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.repository.Repository;

import com.metaphacts.cache.CacheManager;
import com.metaphacts.cache.LabelService;
import com.metaphacts.cache.ResourceDescriptionCacheHolder;
import com.metaphacts.config.groups.UIConfiguration;
import com.metaphacts.services.fields.FieldDefinitionGeneratorChain;

/**
 * Default implementation of the {@link ModelService}.
 * 
 * <p>
 * The services fetches type properties from a {@link TypePropertyProvider} and
 * uses this to create a {@link TypeDescription} for a type.
 * </p>
 * 
 * @author Wolfgang Schell <ws@metaphacts.com>
 */
public class DefaultModelService extends AbstractCachingModelService {
    private static final Logger logger = LogManager.getLogger(DefaultModelService.class);

    private TypeService typeService;

    protected final TypePropertyProvider propertyProvider;
    protected final FieldDefinitionGeneratorChain fieldDefinitionGeneratorChain;

    private ResourceDescriptionCacheHolder labelService;

    @Inject
    public DefaultModelService(CacheManager cacheManager, TypeService typeService,
            TypePropertyProvider propertyProvider, FieldDefinitionGeneratorChain fieldDefinitionGeneratorChain,
            ResourceDescriptionCacheHolder labelService) {
        super(cacheManager);
        this.typeService = typeService;
        this.propertyProvider = propertyProvider;
        this.fieldDefinitionGeneratorChain = fieldDefinitionGeneratorChain;
        this.labelService = labelService;
    }

    @Override
    protected Optional<TypeDescription> lookupTypeDescription(Repository repository, IRI typeIRI) {
        logger.trace("Fetching type description for {}", typeIRI);
        Optional<List<PropertyDescription>> properties = propertyProvider.getProperties(repository, typeIRI);

        // only create a type description if we actually found some properties
        return properties.map(props -> {
            // @formatter:off
            DefaultTypeDescription typeDescription = new DefaultTypeDescription(typeIRI)
                    .withProperties(props)
                    .withTypeLabel(LabelService.resolveLabelWithFallback(labelService.getLabel(typeIRI, repository, UIConfiguration.DEFAULT_LANGUAGE), typeIRI));
            // @formatter:on

            return typeDescription;
        });
    }

    @Override
    protected TypeService getTypeService() {
        return typeService;
    }

}
