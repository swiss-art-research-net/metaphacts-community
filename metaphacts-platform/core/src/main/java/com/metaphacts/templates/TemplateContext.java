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
package com.metaphacts.templates;

import java.util.Map;
import java.util.Optional;

import javax.annotation.Nullable;
import javax.validation.constraints.Null;
import javax.ws.rs.core.UriInfo;

import com.github.jknack.handlebars.Context;
import org.eclipse.rdf4j.model.IRI;
import org.eclipse.rdf4j.model.Literal;
import org.eclipse.rdf4j.model.Value;
import org.eclipse.rdf4j.repository.Repository;

import com.google.common.collect.Maps;
import com.metaphacts.cache.LabelCache;
import com.metaphacts.config.NamespaceRegistry;

/**
 * Carries all the information and references to services required for compiling a handlebars
 * template for a particular resource.
 *
 * @author Johannes Trame <jt@metaphacts.com>
 *
 */
public class TemplateContext {

    private Value value;
    private Repository repository;
    private UriInfo uriInfo;
    @Nullable
    private String preferredLanguage;

    private Map<String, Value> params = Maps.newHashMap();

    private LabelCache labelCache;
    private NamespaceRegistry namespaceRegistry;

    public TemplateContext(
        Value value,
        Repository repository,
        UriInfo uriInfo,
        @Nullable String preferredLanguage
    ) {
        this.value = value;
        this.repository = repository;
        this.uriInfo = uriInfo;
        this.preferredLanguage = preferredLanguage;
    }

    public Value getValue() {
        return value;
    }

    public Repository getRepository() {
        return repository;
    }

    public UriInfo getUriInfo() {
        return uriInfo;
    }

    public Optional<String> getPreferredLanguage() {
        return Optional.ofNullable(preferredLanguage);
    }

    public Map<String, Value> getParams() {
        return this.params;
    }

    public void addParam(String key, Value value) {
        this.params.put(key, value);
    }

    public Optional<NamespaceRegistry> getNamespaceRegistry() {
        return Optional.ofNullable(namespaceRegistry);
    }

    public void setNamespaceRegistry(NamespaceRegistry ns) {
        this.namespaceRegistry = ns;
    }

    public void setLabelCache(LabelCache labelCache) {
        this.labelCache = labelCache;
    }

    public String getLabel() {
        if (this.labelCache != null && this.value instanceof IRI) {
            IRI iri = (IRI) this.value;
            Optional<Literal> label = labelCache.getLabel(
                iri, this.repository, this.preferredLanguage);
            return LabelCache.resolveLabelWithFallback(label, iri);
        }
        return "";
    }

    /**
     * Overrides toString() for template mechanism to access render [[this]] as
     * the string value of the current context value (i.e. resource)
     *
     * @see java.lang.Object#toString()
     */
    @Override
    public String toString() {
        return this.value.stringValue();
    }

    public static TemplateContext fromHandlebars(Context handlebarsContext) {
        Object rootModel = handlebarsContext.data("root");
        if (!(rootModel instanceof TemplateContext)) {
            throw new IllegalStateException(
                "Unexpected root Handlebars context is not a TemplateContext instance");
        }
        return (TemplateContext)rootModel;
    }
}
