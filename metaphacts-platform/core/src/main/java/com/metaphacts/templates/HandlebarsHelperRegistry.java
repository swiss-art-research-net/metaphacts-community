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

import java.util.List;
import java.util.Map;

import javax.inject.Inject;

import com.github.jknack.handlebars.Helper;
import com.google.common.collect.ImmutableList;
import com.google.inject.Singleton;
import com.metaphacts.cache.CacheManager;
import com.metaphacts.cache.LabelService;
import com.metaphacts.cache.QueryTemplateCache;
import com.metaphacts.config.Configuration;
import com.metaphacts.repository.RepositoryManager;
import com.metaphacts.services.fields.FieldDefinitionGeneratorChain;
import com.metaphacts.services.fields.FieldsBasedSearch;
import com.metaphacts.services.storage.api.PlatformStorage;
import com.metaphacts.templates.helper.AskHelperSource;
import com.metaphacts.templates.helper.DateTimeHelperSource;
import com.metaphacts.templates.helper.FieldDefinitionSource;
import com.metaphacts.templates.helper.HasPermissionHelperSource;
import com.metaphacts.templates.helper.I18nHelperSource;
import com.metaphacts.templates.helper.IsRepositoryTypeHelperSource;
import com.metaphacts.templates.helper.JsonFromSparqlSelectSource;
import com.metaphacts.templates.helper.PageLayoutHelperSource;
import com.metaphacts.templates.helper.PrefixResolverHelperSource;
import com.metaphacts.templates.helper.SetManagementHelperSource;
import com.metaphacts.templates.helper.SingleValueFromSelectSource;
import com.metaphacts.templates.helper.SparqlHelperSource;
import com.metaphacts.templates.helper.UriComponentHelperSource;
import com.metaphacts.templates.helper.UrlParamHelperSource;

@Singleton
public class HandlebarsHelperRegistry {
    private List<Object> helpers;
    private Map<String, Helper<Object>> namedHelpers;

    @Inject
    public HandlebarsHelperRegistry(
        Configuration config,
        PlatformStorage platformStorage,
        CacheManager cacheManager,
        RepositoryManager repositoryManager,
        FieldDefinitionGeneratorChain generatorChain,
        FieldsBasedSearch fieldsBasedSearch,
        QueryTemplateCache queryTemplateCache,
        LabelService labelCache
    ) {
        this.helpers = ImmutableList.of(
            new AskHelperSource(),
            new HasPermissionHelperSource(),
            new UrlParamHelperSource(),
            new SingleValueFromSelectSource(),
            new SparqlHelperSource(queryTemplateCache),
            new JsonFromSparqlSelectSource(),
            new FieldDefinitionSource(repositoryManager, generatorChain, fieldsBasedSearch, labelCache),
            new PrefixResolverHelperSource(),
            new SetManagementHelperSource(),
            new IsRepositoryTypeHelperSource(repositoryManager),
            new UriComponentHelperSource(),
            new I18nHelperSource(config, platformStorage, cacheManager),
            new PageLayoutHelperSource(platformStorage)
        );

        this.namedHelpers = DateTimeHelperSource.getHelpers();
    }

    public List<Object> getHelpers() {
        return this.helpers;
    }

    public Map<String, Helper<Object>> getNamedHelpers() {
        return this.namedHelpers;
    }
}
